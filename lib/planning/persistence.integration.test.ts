import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import * as schema from "@/lib/db/schema"
import {
  groupStaffRules,
  groups,
  institutionOpeningHours,
  planningDraftShifts,
  planningDrafts,
  planningExceptions,
  planningPeriods,
  planningPublishedVersionShifts,
  planningPublishedVersions,
  staffMemberAvailability,
  staffMemberGroups,
  staffMembers,
} from "@/lib/db/schema"
import { validateExceptionInput } from "@/lib/planning/exceptions"

const databaseUrl = process.env.PLANNING_SOURCES_TEST_DATABASE_URL
const suite =
  databaseUrl &&
  ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
    ? describe
    : describe.skip

suite("planning persistence, owned sources, and migration constraints", () => {
  let pool: Pool
  let db: ReturnType<typeof drizzle<typeof schema>>
  let createPlanningException: (typeof import("./exception-service"))["createPlanningException"]
  let updatePlanningException: (typeof import("./exception-service"))["updatePlanningException"]
  let loadEffectivePlanningInputs: (typeof import("./load-inputs"))["loadEffectivePlanningInputs"]
  let getPlanningSourceRevision: (typeof import("./source-coordination"))["getPlanningSourceRevision"]
  let touchPlanningSource: (typeof import("./source-coordination"))["touchPlanningSource"]
  let withPlanningCoordination: (typeof import("./source-coordination"))["withPlanningCoordination"]
  const groupId = crypto.randomUUID()
  const otherGroupId = crypto.randomUUID()
  const advisoryGroupId = crypto.randomUUID()
  const staffId = crypto.randomUUID()
  const otherStaffId = crypto.randomUUID()
  const periodId = crypto.randomUUID()

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle({ client: pool, schema })
    await migrate(db, { migrationsFolder: "./drizzle" })
    await db.execute(sql`
      TRUNCATE TABLE
        planning_generation_attempts,
        planning_generation_requests,
        planning_proposal_operations,
        planning_proposals,
        planning_draft_shifts,
        planning_drafts,
        planning_published_version_shifts,
        planning_published_versions,
        planning_exception_intervals,
        planning_exception_participants,
        planning_exceptions,
        planning_periods,
        planning_source_revisions,
        group_staff_rules,
        institution_opening_hours,
        staff_member_availability,
        staff_member_groups,
        groups,
        staff_members
      RESTART IDENTITY CASCADE
    `)
    vi.doMock("@/lib/db", () => ({ db }))
    ;({ createPlanningException, updatePlanningException } =
      await import("./exception-service"))
    ;({ loadEffectivePlanningInputs } = await import("./load-inputs"))
    ;({
      getPlanningSourceRevision,
      touchPlanningSource,
      withPlanningCoordination,
    } = await import("./source-coordination"))
    await db.insert(groups).values([
      { id: groupId, name: "Persistence target" },
      { id: otherGroupId, name: "Published owner" },
      { id: advisoryGroupId, name: "Draft owner" },
    ])
    await db.insert(staffMembers).values([
      {
        id: staffId,
        firstName: "Linked",
        lastName: "Staff",
        role: "pedagog",
        maxHoursPerWeek: 30,
      },
      {
        id: otherStaffId,
        firstName: "Unlinked",
        lastName: "Staff",
        role: "assistant",
        maxHoursPerWeek: 30,
      },
    ])
    await db
      .insert(staffMemberGroups)
      .values({ staffMemberId: staffId, groupId })
    await db.insert(staffMemberAvailability).values({
      staffMemberId: staffId,
      dayOfWeek: "wednesday",
      startAvailabilityTime: "08:00",
      endAvailabilityTime: "16:00",
    })
    await db.insert(institutionOpeningHours).values({
      dayOfWeek: "wednesday",
      startTime: "07:00",
      endTime: "17:00",
    })
    await db.insert(groupStaffRules).values({
      groupId,
      dayOfWeek: "wednesday",
      startTime: "09:00",
      endTime: "15:00",
      minStaff: 1,
      minPedagogs: 2,
    })
    await db.insert(planningPeriods).values({
      id: periodId,
      groupId,
      startDate: "2026-09-09",
      endDate: "2026-09-09",
      timezone: "Europe/Copenhagen",
    })
  })

  afterAll(async () => {
    await pool?.end()
  })

  it("allows pedagog minima above total minima and enforces typed owner fields", async () => {
    expect(
      validateExceptionInput({
        owner: { ownerType: "group", ownerId: groupId },
        type: "staffing_replacement",
        startDate: "2026-10-01",
        endDate: "2026-10-01",
        startTime: "09:00",
        endTime: "12:00",
        minStaff: 1,
        minPedagogs: 2,
      }).success
    ).toBe(true)
    expect(
      validateExceptionInput({
        owner: { ownerType: "staff", ownerId: staffId },
        type: "staffing_replacement",
        startDate: "2026-10-01",
        endDate: "2026-10-01",
        startTime: "09:00",
        endTime: "12:00",
        minStaff: 1,
        minPedagogs: 1,
      }).success
    ).toBe(false)

    const saved = await createPlanningException({
      owner: { ownerType: "group", ownerId: groupId },
      type: "staffing_replacement",
      startDate: "2026-10-01",
      endDate: "2026-10-01",
      startTime: "09:00",
      endTime: "12:00",
      minStaff: 1,
      minPedagogs: 2,
    })
    expect(saved.minPedagogs).toBe(2)
  })

  it("serializes replacement writes and allows half-open adjacency", async () => {
    const base = {
      owner: { ownerType: "group" as const, ownerId: groupId },
      type: "staffing_replacement" as const,
      startDate: "2026-10-02",
      endDate: "2026-10-02",
      minStaff: 2,
      minPedagogs: 1,
    }
    await createPlanningException({
      ...base,
      startTime: "09:00",
      endTime: "12:00",
    })
    await expect(
      createPlanningException({
        ...base,
        startTime: "12:00",
        endTime: "14:00",
      })
    ).resolves.toBeDefined()
    await expect(
      createPlanningException({
        ...base,
        startTime: "11:00",
        endTime: "13:00",
      })
    ).rejects.toMatchObject({ code: "conflicting_replacement" })

    const results = await Promise.allSettled([
      createPlanningException({
        owner: { ownerType: "institution", ownerId: "1" },
        type: "closed_date",
        startDate: "2026-10-03",
        endDate: "2026-10-03",
      }),
      createPlanningException({
        owner: { ownerType: "institution", ownerId: "1" },
        type: "opening_replacement",
        startDate: "2026-10-03",
        endDate: "2026-10-03",
        intervals: [{ startTime: "08:00", endTime: "14:00" }],
      }),
    ])
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1)
  })

  it("rejects owner transfers and overlapping counted participant events", async () => {
    const absence = await createPlanningException({
      owner: { ownerType: "staff", ownerId: staffId },
      type: "leave",
      startDate: "2026-10-04",
      endDate: "2026-10-04",
    })
    await expect(
      updatePlanningException(
        absence.id,
        {
          owner: { ownerType: "staff", ownerId: otherStaffId },
          type: "leave",
          startDate: "2026-10-04",
          endDate: "2026-10-04",
        },
        absence.sourceRevision
      )
    ).rejects.toMatchObject({ code: "owner_immutable" })

    await createPlanningException({
      owner: { ownerType: "group", ownerId: otherGroupId },
      type: "training",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      startTime: "09:00",
      endTime: "11:00",
      participantStaffIds: [staffId],
      countsTowardWeeklyHours: true,
    })
    await expect(
      createPlanningException({
        owner: { ownerType: "institution", ownerId: "1" },
        type: "meeting",
        startDate: "2026-10-05",
        endDate: "2026-10-05",
        startTime: "10:00",
        endTime: "12:00",
        participantStaffIds: [staffId],
        countsTowardWeeklyHours: true,
      })
    ).rejects.toMatchObject({ code: "overlapping_counted_event" })
    await expect(
      createPlanningException({
        owner: { ownerType: "institution", ownerId: "1" },
        type: "meeting",
        startDate: "2026-10-05",
        endDate: "2026-10-05",
        startTime: "10:00",
        endTime: "12:00",
        participantStaffIds: [staffId],
        countsTowardWeeklyHours: false,
      })
    ).resolves.toBeDefined()
  })

  it("serializes source writes and rolls their revisions back atomically", async () => {
    const sourceId = crypto.randomUUID()
    let enterFirst!: () => void
    const firstEntered = new Promise<void>((resolve) => {
      enterFirst = resolve
    })
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const order: string[] = []
    const first = withPlanningCoordination(async () => {
      order.push("first")
      enterFirst()
      await firstGate
    })
    await firstEntered
    const second = withPlanningCoordination(async () => {
      order.push("second")
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(order).toEqual(["first"])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(["first", "second"])

    await expect(
      withPlanningCoordination(async (tx) => {
        await touchPlanningSource("group", sourceId, tx)
        throw new Error("rollback fixture")
      })
    ).rejects.toThrow("rollback fixture")
    expect(await getPlanningSourceRevision("group", sourceId)).toBe(0)
  })

  it("loads only relevant owner data plus full-week official and draft commitments", async () => {
    const fullDay = await createPlanningException({
      owner: { ownerType: "staff", ownerId: staffId },
      type: "sickness",
      startDate: "2026-09-09",
      endDate: "2026-09-09",
    })
    const relevantEvent = await createPlanningException({
      owner: { ownerType: "group", ownerId: otherGroupId },
      type: "training",
      startDate: "2026-09-07",
      endDate: "2026-09-07",
      startTime: "13:00",
      endTime: "15:00",
      participantStaffIds: [staffId],
      countsTowardWeeklyHours: true,
    })
    const irrelevantEvent = await createPlanningException({
      owner: { ownerType: "staff", ownerId: otherStaffId },
      type: "meeting",
      startDate: "2026-09-08",
      endDate: "2026-09-08",
      startTime: "10:00",
      endTime: "11:00",
      countsTowardWeeklyHours: true,
    })

    const publishedPeriodId = crypto.randomUUID()
    const oldVersionId = crypto.randomUUID()
    const currentVersionId = crypto.randomUUID()
    await db.insert(planningPeriods).values({
      id: publishedPeriodId,
      groupId: otherGroupId,
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      timezone: "Europe/Copenhagen",
      lifecycle: "published",
    })
    await db.insert(planningPublishedVersions).values([
      {
        id: oldVersionId,
        periodId: publishedPeriodId,
        versionNumber: 1,
        inputSnapshot: {},
        inputFingerprint: "old",
        validationSnapshot: {},
        displaySnapshot: {},
        publicationRequestId: crypto.randomUUID(),
      },
      {
        id: currentVersionId,
        periodId: publishedPeriodId,
        versionNumber: 2,
        priorVersionId: oldVersionId,
        inputSnapshot: {},
        inputFingerprint: "current",
        validationSnapshot: {},
        displaySnapshot: {},
        publicationRequestId: crypto.randomUUID(),
      },
    ])
    await db.insert(planningPublishedVersionShifts).values([
      {
        versionId: oldVersionId,
        shiftId: crypto.randomUUID(),
        staffMemberId: staffId,
        staffFirstName: "Linked",
        staffLastName: "Staff",
        staffRole: "pedagog",
        actualDate: "2026-09-10",
        startTime: "09:00",
        endTime: "10:00",
      },
      {
        versionId: currentVersionId,
        shiftId: crypto.randomUUID(),
        staffMemberId: staffId,
        staffFirstName: "Linked",
        staffLastName: "Staff",
        staffRole: "pedagog",
        actualDate: "2026-09-11",
        startTime: "09:00",
        endTime: "11:00",
      },
    ])
    await db
      .update(planningPeriods)
      .set({ currentPublishedVersionId: currentVersionId })
      .where(eq(planningPeriods.id, publishedPeriodId))

    const advisoryPeriodId = crypto.randomUUID()
    const advisoryDraftId = crypto.randomUUID()
    await db.insert(planningPeriods).values({
      id: advisoryPeriodId,
      groupId: advisoryGroupId,
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      timezone: "Europe/Copenhagen",
    })
    await db.insert(planningDrafts).values({
      id: advisoryDraftId,
      periodId: advisoryPeriodId,
      state: "editing",
    })
    await db.insert(planningDraftShifts).values({
      draftId: advisoryDraftId,
      staffMemberId: staffId,
      actualDate: "2026-09-12",
      startTime: "10:00",
      endTime: "12:00",
    })

    const loaded = await loadEffectivePlanningInputs(periodId)
    expect(loaded).toBeDefined()
    expect(loaded!.unavailability).toContainEqual(
      expect.objectContaining({
        id: fullDay.id,
        startTime: "00:00",
        endTime: "23:59",
      })
    )
    expect(loaded!.events).toContainEqual(
      expect.objectContaining({
        id: relevantEvent.id,
        date: "2026-09-07",
        participantStaffIds: [staffId],
        countsTowardWeeklyHours: true,
      })
    )
    expect(
      loaded!.events.some((event) => event.id === irrelevantEvent.id)
    ).toBe(false)
    expect(loaded!.commitments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-09-11",
          versionId: currentVersionId,
          authoritative: true,
        }),
        expect.objectContaining({
          date: "2026-09-12",
          sourcePeriodId: advisoryPeriodId,
          authoritative: false,
        }),
      ])
    )
    expect(
      loaded!.commitments.some(
        (commitment) => commitment.versionId === oldVersionId
      )
    ).toBe(false)
    expect(
      loaded!.sourceReferences.some(
        (source) =>
          source.sourceType === "event" && source.sourceId === relevantEvent.id
      )
    ).toBe(true)
    expect(
      loaded!.sourceReferences.some(
        (source) => source.sourceId === irrelevantEvent.id
      )
    ).toBe(false)
    expect(
      loaded!.sourceReferences.some(
        (source) =>
          source.sourceType === "institution_opening_hours" &&
          source.sourceId.startsWith("opening:")
      )
    ).toBe(true)
    expect(
      loaded!.sourceReferences.some(
        (source) =>
          source.sourceType === "group_staff_rules" &&
          source.sourceId.startsWith("rule:")
      )
    ).toBe(true)
  })

  it("keeps published snapshots immutable and owner references restricted", async () => {
    const historyPeriodId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    await db.insert(planningPeriods).values({
      id: historyPeriodId,
      groupId: advisoryGroupId,
      startDate: "2026-11-01",
      endDate: "2026-11-01",
      timezone: "Europe/Copenhagen",
    })
    await db.insert(planningPublishedVersions).values({
      id: versionId,
      periodId: historyPeriodId,
      versionNumber: 1,
      inputSnapshot: {},
      inputFingerprint: "immutable",
      validationSnapshot: {},
      displaySnapshot: {},
      publicationRequestId: crypto.randomUUID(),
    })
    await expect(
      db
        .update(planningPublishedVersions)
        .set({ inputFingerprint: "changed" })
        .where(eq(planningPublishedVersions.id, versionId))
    ).rejects.toThrow()
    const [unchangedVersion] = await db
      .select({ inputFingerprint: planningPublishedVersions.inputFingerprint })
      .from(planningPublishedVersions)
      .where(eq(planningPublishedVersions.id, versionId))
    expect(unchangedVersion.inputFingerprint).toBe("immutable")

    const ownerException = await createPlanningException({
      owner: { ownerType: "staff", ownerId: otherStaffId },
      type: "leave",
      startDate: "2026-11-02",
      endDate: "2026-11-02",
    })
    await expect(
      db
        .update(planningExceptions)
        .set({ staffMemberId: staffId })
        .where(eq(planningExceptions.id, ownerException.id))
    ).rejects.toThrow()
    const [unchangedOwner] = await db
      .select({ staffMemberId: planningExceptions.staffMemberId })
      .from(planningExceptions)
      .where(eq(planningExceptions.id, ownerException.id))
    expect(unchangedOwner.staffMemberId).toBe(otherStaffId)
    await expect(
      db.delete(staffMembers).where(eq(staffMembers.id, otherStaffId))
    ).rejects.toThrow()
  })
})
