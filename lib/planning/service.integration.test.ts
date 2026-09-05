import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import * as schema from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

const url = process.env.PLANNING_TEST_DATABASE_URL
const suite = url ? describe : describe.skip
suite("persisted planning lifecycle and publication races", () => {
  let pool: Pool
  let database: ReturnType<typeof drizzle<typeof schema>>
  let service: typeof import("./service")
  let ai: typeof import("./ai-service")
  const staffId = crypto.randomUUID()
  const groupId = crypto.randomUUID()
  const secondGroupId = crypto.randomUUID()
  const actorId = crypto.randomUUID()
  let periodId: string
  let generationGate: Promise<void> | undefined
  let proposalGate: Promise<void> | undefined
  let proposalStarted: (() => void) | undefined
  let providerFailure = false

  beforeAll(async () => {
    if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw new Error("Use an isolated local planning test database")
    pool = new Pool({ connectionString: url })
    database = drizzle({ client: pool, schema })
    await migrate(database, { migrationsFolder: "./drizzle" })
    vi.doMock("@/lib/db", () => ({ db: database }))
    vi.doMock("./ai-model", async () => {
      const actual =
        await vi.importActual<typeof import("./ai-model")>("./ai-model")
      return {
        ...actual,
        generateDatedSchedule: vi.fn(async (prompt: string) => {
          if (providerFailure) throw new Error("Provider unavailable")
          if (generationGate) await generationGate
          const input = JSON.parse(prompt.split("Dated effective inputs:\n")[1])
          return {
            groupId: input.group.id,
            days: input.days.map(
              (day: { date: string; demandSegments: unknown[] }) => ({
                date: day.date,
                shifts: day.demandSegments.length
                  ? [{ staffId, startTime: "09:00", endTime: "12:00" }]
                  : [],
              })
            ),
            warnings: [],
          }
        }),
        generateScheduleProposal: vi.fn(async (prompt: string) => {
          proposalStarted?.()
          if (providerFailure) throw new Error("Provider unavailable")
          if (proposalGate) await proposalGate
          const input = JSON.parse(prompt)
          const shift = input.draft[0]
          return {
            operations: [
              {
                type: "update",
                shiftId: shift.id,
                staffId: shift.staffId,
                date: shift.date,
                startTime: shift.startTime,
                endTime: "13:00",
              },
            ],
            notes: ["Extend coverage"],
          }
        }),
      }
    })
    service = await import("./service")
    ai = await import("./ai-service")
    await database.insert(schema.groups).values([
      { id: groupId, name: "Planning test A" },
      { id: secondGroupId, name: "Planning test B" },
    ])
    await database.insert(schema.staffMembers).values({
      id: staffId,
      firstName: "Planning",
      lastName: "Fixture",
      role: "pedagog",
      maxHoursPerWeek: 30,
    })
    await database.insert(schema.staffMemberGroups).values([
      { staffMemberId: staffId, groupId },
      { staffMemberId: staffId, groupId: secondGroupId },
    ])
    await database.insert(schema.staffMemberAvailability).values({
      staffMemberId: staffId,
      dayOfWeek: "monday",
      startAvailabilityTime: "08:00",
      endAvailabilityTime: "16:00",
    })
    await database.insert(schema.groupStaffRules).values([
      {
        groupId,
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "12:00",
        minStaff: 1,
        minPedagogs: 1,
      },
      {
        groupId: secondGroupId,
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "12:00",
        minStaff: 1,
        minPedagogs: 1,
      },
    ])
  })
  afterAll(async () => {
    await pool?.end()
  })

  async function context(id: string) {
    return ai.loadCurrentPlanningContext(id, database as never)
  }
  async function generated(group: string, date: string) {
    const period = await service.savePreparation({
      groupId: group,
      startDate: date,
      endDate: date,
    })
    const current = await context(period.id)
    await ai.generatePeriod({
      periodId: period.id,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
    })
    return period.id
  }
  async function publication(id: string) {
    const current = await context(id)
    return {
      periodId: id,
      requestId: crypto.randomUUID(),
      expectedRevision: current.draft.revision,
      expectedBaseVersionId: current.draft.basePublishedVersionId,
      reviewedFingerprint: current.inputs.fingerprint,
    }
  }

  it("keeps preparation durable, rejects overlap and accepts adjacent periods", async () => {
    periodId = await generated(groupId, "2026-09-07")
    await expect(
      service.savePreparation({
        groupId,
        startDate: "2026-09-06",
        endDate: "2026-09-08",
      })
    ).rejects.toMatchObject({ code: "period_overlap" })
    const adjacent = await service.savePreparation({
      groupId,
      startDate: "2026-09-08",
      endDate: "2026-09-08",
    })
    expect((await context(adjacent.id)).draft.state).toBe("preparation")
  })
  it("saves a manual gap, blocks publication, and protects undo from newer edits", async () => {
    const current = await context(periodId)
    const saved = await service.mutateShifts({
      periodId,
      expectedRevision: current.draft.revision,
      actorId,
      mutate: () => [],
    })
    expect(saved.validation.valid).toBe(false)
    await expect(
      service.publishDraft(await publication(periodId))
    ).rejects.toMatchObject({ code: "validation_failed" })
    await expect(
      service.undoDraft({
        periodId,
        expectedRevision: saved.revision,
        actorId: crypto.randomUUID(),
      })
    ).rejects.toMatchObject({ code: "stale_undo" })
    await service.undoDraft({
      periodId,
      expectedRevision: saved.revision,
      actorId,
    })
    expect((await context(periodId)).shifts).toHaveLength(1)
  })
  it("keeps AI previews isolated, discards without edits, and applies idempotently with undo", async () => {
    let current = await context(periodId)
    const before = current.shifts
    const first = await ai.requestPlanningProposal({
      periodId,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
      scope: { kind: "day", date: "2026-09-07" },
      prompt: "Extend coverage until 13:00",
    })
    expect((await context(periodId)).shifts).toEqual(before)
    await ai.discardPlanningProposal(periodId, first, current.draft.revision)
    expect((await context(periodId)).shifts).toEqual(before)
    const second = await ai.requestPlanningProposal({
      periodId,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
      scope: { kind: "day", date: "2026-09-07" },
      prompt: "Extend coverage until 13:00",
    })
    const command = {
      periodId,
      proposalId: second,
      requestId: crypto.randomUUID(),
      expectedRevision: current.draft.revision,
      reviewedFingerprint: current.inputs.fingerprint,
      actorId,
    }
    const outcome = await service.applyProposal(command)
    expect(await service.applyProposal(command)).toEqual(outcome)
    current = await context(periodId)
    expect(current.shifts[0].endTime).toBe("13:00")
    await service.undoDraft({
      periodId,
      expectedRevision: current.draft.revision,
      actorId,
    })
    expect((await context(periodId)).shifts).toEqual(before)
  })
  it("rejects a proposal after any manual edit, preserving that edit", async () => {
    const current = await context(periodId)
    const proposalId = await ai.requestPlanningProposal({
      periodId,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
      scope: { kind: "period" },
      prompt: "Extend coverage",
    })
    await service.mutateShifts({
      periodId,
      expectedRevision: current.draft.revision,
      actorId,
      mutate: (shifts) => shifts.map((shift) => ({ ...shift, locked: true })),
    })
    await expect(
      service.applyProposal({
        periodId,
        proposalId,
        requestId: crypto.randomUUID(),
        expectedRevision: current.draft.revision,
        reviewedFingerprint: current.inputs.fingerprint,
        actorId,
      })
    ).rejects.toMatchObject({ code: "proposal_closed" })
    expect((await context(periodId)).shifts[0].locked).toBe(true)
    const updated = await context(periodId)
    await service.undoDraft({
      periodId,
      expectedRevision: updated.draft.revision,
      actorId,
    })
  })
  it("serializes two groups trying to publish overlapping shared staff", async () => {
    const second = await generated(secondGroupId, "2026-09-07")
    const commands = [await publication(periodId), await publication(second)]
    const outcomes = await Promise.allSettled(
      commands.map((command) => service.publishDraft(command))
    )
    expect(
      outcomes.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(
      outcomes.filter((result) => result.status === "rejected")
    ).toHaveLength(1)
    const winner = outcomes.findIndex((result) => result.status === "fulfilled")
    const version = await service.publishDraft(commands[winner])
    expect(version.versionNumber).toBe(1)
    periodId = commands[winner].periodId
  })
  it("keeps the official version unchanged while revising and retains history", async () => {
    const [before] = await database
      .select()
      .from(schema.planningPeriods)
      .where(eq(schema.planningPeriods.id, periodId))
    const original = await database
      .select()
      .from(schema.planningPublishedVersionShifts)
      .where(
        eq(
          schema.planningPublishedVersionShifts.versionId,
          before.currentPublishedVersionId!
        )
      )
    await service.createRevision(periodId)
    const current = await context(periodId)
    expect(current.shifts[0].id).toBe(original[0].shiftId)
    await service.mutateShifts({
      periodId,
      expectedRevision: current.draft.revision,
      actorId,
      mutate: (shifts) =>
        shifts.map((shift) => ({ ...shift, endTime: "13:00" })),
    })
    const [during] = await database
      .select()
      .from(schema.planningPeriods)
      .where(eq(schema.planningPeriods.id, periodId))
    expect(during.currentPublishedVersionId).toBe(
      before.currentPublishedVersionId
    )
    const fresh = await context(periodId)
    await service.refreshDraftInputs({
      periodId,
      expectedRevision: fresh.draft.revision,
    })
    const version = await service.publishDraft(await publication(periodId))
    expect(version.versionNumber).toBe(2)
    const retained = await database
      .select()
      .from(schema.planningPublishedVersionShifts)
      .where(
        eq(
          schema.planningPublishedVersionShifts.versionId,
          before.currentPublishedVersionId!
        )
      )
    expect(retained[0].endTime.slice(0, 5)).toBe("12:00")
  })
  it("preserves preparation on provider failure and accepts an idempotent retry", async () => {
    const period = await service.savePreparation({
      groupId,
      startDate: "2026-09-14",
      endDate: "2026-09-14",
    })
    providerFailure = true
    await expect(
      ai.generatePeriod({
        periodId: period.id,
        expectedRevision: 1,
        requestId: crypto.randomUUID(),
      })
    ).rejects.toThrow("Provider unavailable")
    let current = await context(period.id)
    expect(current.draft.state).toBe("failed")
    expect(current.shifts).toEqual([])
    providerFailure = false
    const request = {
      periodId: period.id,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
    }
    await ai.generatePeriod(request)
    current = await context(period.id)
    await ai.generatePeriod(request)
    expect((await context(period.id)).draft.revision).toBe(
      current.draft.revision
    )
    expect((await context(period.id)).shifts).toEqual(current.shifts)
  })

  it("can discard and recreate a revision without changing stable shift identities", async () => {
    const first = await service.createRevision(periodId)
    const before = await context(periodId)
    await service.discardWorkingDraft({
      periodId,
      expectedRevision: first.revision,
    })
    const second = await service.createRevision(periodId)
    const after = await context(periodId)
    expect(second.id).not.toBe(first.id)
    expect(after.shifts).toEqual(before.shifts)
    await service.discardWorkingDraft({
      periodId,
      expectedRevision: second.revision,
    })
  })

  it("rolls publication back completely after a database failure and retries the same request", async () => {
    const failedPeriod = await generated(groupId, "2026-10-05")
    const before = await context(failedPeriod)
    const command = await publication(failedPeriod)
    await database.execute(
      sql.raw(
        `CREATE FUNCTION planning_test_reject_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected publication failure'; END $$`
      )
    )
    await database.execute(
      sql.raw(
        `CREATE TRIGGER planning_test_reject_publication BEFORE INSERT ON planning_published_version_shifts FOR EACH ROW EXECUTE FUNCTION planning_test_reject_publication()`
      )
    )
    try {
      await expect(service.publishDraft(command)).rejects.toThrow()
      const after = await context(failedPeriod)
      expect(after.period.currentPublishedVersionId).toBeNull()
      expect(after.draft.revision).toBe(before.draft.revision)
      expect(after.shifts).toEqual(before.shifts)
      expect(
        await database
          .select()
          .from(schema.planningPublishedVersions)
          .where(eq(schema.planningPublishedVersions.periodId, failedPeriod))
      ).toHaveLength(0)
    } finally {
      await database.execute(
        sql.raw(
          `DROP TRIGGER planning_test_reject_publication ON planning_published_version_shifts`
        )
      )
      await database.execute(
        sql.raw(`DROP FUNCTION planning_test_reject_publication()`)
      )
    }
    const published = await service.publishDraft(command)
    expect(published.versionNumber).toBe(1)
    expect(await service.publishDraft(command)).toEqual(published)
  })

  it("serializes non-overlapping publications that compete for one ISO-week cap", async () => {
    const coordination = await import("./source-coordination")
    await coordination.withPlanningCoordination(async (tx) => {
      await tx
        .update(schema.staffMembers)
        .set({ maxHoursPerWeek: 5 })
        .where(eq(schema.staffMembers.id, staffId))
      await tx.insert(schema.staffMemberAvailability).values({
        staffMemberId: staffId,
        dayOfWeek: "tuesday",
        startAvailabilityTime: "08:00",
        endAvailabilityTime: "16:00",
      })
      await tx.insert(schema.groupStaffRules).values({
        groupId: secondGroupId,
        dayOfWeek: "tuesday",
        startTime: "09:00",
        endTime: "12:00",
        minStaff: 1,
        minPedagogs: 1,
      })
      await coordination.touchPlanningSource("staff", staffId, tx)
    })
    const monday = await generated(groupId, "2026-09-28")
    const tuesday = await generated(secondGroupId, "2026-09-29")
    const commands = [await publication(monday), await publication(tuesday)]
    const outcomes = await Promise.allSettled(
      commands.map((command) => service.publishDraft(command))
    )
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled")
    ).toHaveLength(1)
    const loser = outcomes.findIndex((outcome) => outcome.status === "rejected")
    const current = await context(commands[loser].periodId)
    await service.refreshDraftInputs({
      periodId: current.period.id,
      expectedRevision: current.draft.revision,
    })
    const refreshed = (await context(current.period.id)).draft
      .lastValidation as { valid: boolean; issues: Array<{ code: string }> }
    expect(refreshed.valid).toBe(false)
    expect(
      refreshed.issues.some((issue) => issue.code === "max_hours_exceeded")
    ).toBe(true)
  })

  it("rechecks a source edit that wins the coordination lock before publication", async () => {
    const nextPeriod = await generated(groupId, "2026-10-12")
    const command = await publication(nextPeriod)
    const coordination = await import("./source-coordination")
    let release!: () => void
    let entered!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const acquired = new Promise<void>((resolve) => {
      entered = resolve
    })
    const sourceEdit = coordination.withPlanningCoordination(async (tx) => {
      entered()
      await held
      await tx
        .update(schema.staffMembers)
        .set({ maxHoursPerWeek: 2 })
        .where(eq(schema.staffMembers.id, staffId))
      await coordination.touchPlanningSource("staff", staffId, tx)
    })
    await acquired
    const publishResult = service.publishDraft(command).then(
      () => "unexpected_success",
      (error) => error
    )
    release()
    await sourceEdit
    expect(await publishResult).toMatchObject({ code: "stale_inputs" })
    const saved = await context(nextPeriod)
    expect(saved.period.currentPublishedVersionId).toBeNull()
    expect(saved.shifts).toHaveLength(1)
    expect(saved.draft.revision).toBe(command.expectedRevision)
    await coordination.withPlanningCoordination(async (tx) => {
      await tx
        .update(schema.staffMembers)
        .set({ maxHoursPerWeek: 5 })
        .where(eq(schema.staffMembers.id, staffId))
      await coordination.touchPlanningSource("staff", staffId, tx)
    })
  })

  it("rejects a late generated result after a relevant source edit", async () => {
    const period = await service.savePreparation({
      groupId,
      startDate: "2026-09-21",
      endDate: "2026-09-21",
    })
    let release!: () => void
    generationGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const pending = ai.generatePeriod({
      periodId: period.id,
      expectedRevision: 1,
      requestId: crypto.randomUUID(),
    })
    const result = pending.then(
      () => "unexpected_success",
      (error) => error
    )
    await vi.waitFor(async () =>
      expect((await context(period.id)).draft.state).toBe("generating")
    )
    const coordination = await import("./source-coordination")
    await coordination.withPlanningCoordination(async (tx) => {
      await tx
        .update(schema.staffMembers)
        .set({ maxHoursPerWeek: 29 })
        .where(eq(schema.staffMembers.id, staffId))
      await coordination.touchPlanningSource("staff", staffId, tx)
    })
    release()
    generationGate = undefined
    expect(await result).toMatchObject({ code: "stale_generation" })
    expect((await context(period.id)).shifts).toEqual([])
    expect((await context(period.id)).draft.state).toBe("failed")
  })

  it("accepts a complete multiweek period with weekend and empty dates", async () => {
    const period = await service.savePreparation({
      groupId,
      startDate: "2026-11-07",
      endDate: "2026-11-17",
    })
    const requestId = crypto.randomUUID()
    await ai.generatePeriod({
      periodId: period.id,
      expectedRevision: 1,
      requestId,
    })
    const saved = await context(period.id)
    expect(saved.draft.state).toBe("editing")
    expect(saved.inputs.days).toHaveLength(11)
    expect(saved.shifts.map((shift) => shift.date)).toEqual([
      "2026-11-09",
      "2026-11-16",
    ])
    const attempts = await database
      .select()
      .from(schema.planningGenerationAttempts)
      .where(eq(schema.planningGenerationAttempts.requestId, requestId))
    expect(
      (attempts[0].outputSnapshot as { days: unknown[] }).days
    ).toHaveLength(11)
  })

  it("recovers an interrupted generation and rejects its later response", async () => {
    const period = await service.savePreparation({
      groupId,
      startDate: "2026-10-19",
      endDate: "2026-10-19",
    })
    let release!: () => void
    generationGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const original = ai
      .generatePeriod({
        periodId: period.id,
        expectedRevision: 1,
        requestId: crypto.randomUUID(),
      })
      .then(
        () => "unexpected_success",
        (error) => error
      )
    await vi.waitFor(async () =>
      expect((await context(period.id)).draft.state).toBe("generating")
    )
    const running = await context(period.id)
    await database
      .update(schema.planningDrafts)
      .set({ updatedAt: new Date(Date.now() - 301_000) })
      .where(eq(schema.planningDrafts.id, running.draft.id))
    generationGate = undefined
    await ai.generatePeriod({
      periodId: period.id,
      expectedRevision: running.draft.revision,
      requestId: crypto.randomUUID(),
    })
    const accepted = await context(period.id)
    release()
    expect(await original).toMatchObject({ code: "stale_generation" })
    const final = await context(period.id)
    expect(final.draft.state).toBe("editing")
    expect(final.draft.revision).toBe(accepted.draft.revision)
    expect(final.shifts).toEqual(accepted.shifts)
  })

  it("keeps a manual edit when an AI proposal arrives after that edit", async () => {
    const id = await generated(groupId, "2026-10-26")
    const before = await context(id)
    let release!: () => void
    proposalGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      proposalStarted = resolve
    })
    const pending = ai
      .requestPlanningProposal({
        periodId: id,
        expectedRevision: before.draft.revision,
        requestId: crypto.randomUUID(),
        scope: { kind: "period" },
        prompt: "Extend coverage",
      })
      .then(
        () => "unexpected_success",
        (error) => error
      )
    await started
    await service.mutateShifts({
      periodId: id,
      expectedRevision: before.draft.revision,
      actorId,
      mutate: (shifts) =>
        shifts.map((shift) => ({ ...shift, endTime: "11:00" })),
    })
    release()
    proposalGate = undefined
    proposalStarted = undefined
    expect(await pending).toMatchObject({ code: "stale_proposal" })
    const saved = await context(id)
    expect(saved.shifts[0].endTime).toBe("11:00")
    expect(
      await database
        .select()
        .from(schema.planningProposals)
        .where(eq(schema.planningProposals.draftId, saved.draft.id))
    ).toHaveLength(0)
  })

  it("requires refreshed relevant inputs before generation and AI proposals", async () => {
    const coordination = await import("./source-coordination")
    const updateStaffLimit = (maxHoursPerWeek: number) =>
      coordination.withPlanningCoordination(async (tx) => {
        await tx
          .update(schema.staffMembers)
          .set({ maxHoursPerWeek })
          .where(eq(schema.staffMembers.id, staffId))
        await coordination.touchPlanningSource("staff", staffId, tx)
      })
    const period = await service.savePreparation({
      groupId,
      startDate: "2026-12-14",
      endDate: "2026-12-14",
    })

    await updateStaffLimit(28)
    await expect(
      ai.generatePeriod({
        periodId: period.id,
        expectedRevision: 1,
        requestId: crypto.randomUUID(),
      })
    ).rejects.toMatchObject({ code: "stale_inputs" })
    let current = await context(period.id)
    expect(current.draft.state).toBe("preparation")
    expect(current.shifts).toEqual([])

    await service.refreshDraftInputs({
      periodId: period.id,
      expectedRevision: current.draft.revision,
    })
    current = await context(period.id)
    await ai.generatePeriod({
      periodId: period.id,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
    })

    await updateStaffLimit(27)
    current = await context(period.id)
    await expect(
      ai.requestPlanningProposal({
        periodId: period.id,
        expectedRevision: current.draft.revision,
        requestId: crypto.randomUUID(),
        scope: { kind: "period" },
        prompt: "Extend coverage",
      })
    ).rejects.toMatchObject({ code: "stale_inputs" })

    await service.refreshDraftInputs({
      periodId: period.id,
      expectedRevision: current.draft.revision,
    })
    current = await context(period.id)
    const proposalId = await ai.requestPlanningProposal({
      periodId: period.id,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
      scope: { kind: "period" },
      prompt: "Extend coverage",
    })
    expect(proposalId).toEqual(expect.any(String))
  })

  it("rejects a shared proposal request identity across two drafts after both models start", async () => {
    const [firstPeriod, secondPeriod] = await Promise.all([
      generated(groupId, "2026-12-07"),
      generated(secondGroupId, "2026-12-07"),
    ])
    const [first, second] = await Promise.all([
      context(firstPeriod),
      context(secondPeriod),
    ])
    let release!: () => void
    proposalGate = new Promise<void>((resolve) => {
      release = resolve
    })
    let startedCount = 0
    let markBothStarted!: () => void
    const bothStarted = new Promise<void>((resolve) => {
      markBothStarted = resolve
    })
    proposalStarted = () => {
      startedCount += 1
      if (startedCount === 2) markBothStarted()
    }
    const requestId = crypto.randomUUID()
    const requests = [first, second].map((current) =>
      ai.requestPlanningProposal({
        periodId: current.period.id,
        expectedRevision: current.draft.revision,
        requestId,
        scope: { kind: "period" },
        prompt: "Extend coverage",
      })
    )
    await bothStarted
    release()
    const outcomes = await Promise.allSettled(requests)
    proposalGate = undefined
    proposalStarted = undefined

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled")
    ).toHaveLength(1)
    const rejected = outcomes.find(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === "rejected"
    )
    expect(rejected?.reason).toMatchObject({ code: "request_mismatch" })
    expect(
      await database
        .select()
        .from(schema.planningProposals)
        .where(eq(schema.planningProposals.requestId, requestId))
    ).toHaveLength(1)
  })

  it("keeps the original proposal when refinement fails and replays a successful refinement", async () => {
    const id = await generated(groupId, "2026-12-21")
    const current = await context(id)
    const originalId = await ai.requestPlanningProposal({
      periodId: id,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
      scope: { kind: "day", date: "2026-12-21" },
      prompt: "Extend coverage",
    })

    providerFailure = true
    try {
      await expect(
        ai.refinePlanningProposal({
          periodId: id,
          proposalId: originalId,
          expectedRevision: current.draft.revision,
          requestId: crypto.randomUUID(),
          prompt: "Try a different extension",
        })
      ).rejects.toThrow("Provider unavailable")
    } finally {
      providerFailure = false
    }
    const [originalAfterFailure] = await database
      .select()
      .from(schema.planningProposals)
      .where(eq(schema.planningProposals.id, originalId))
    expect(originalAfterFailure.state).toBe("pending")

    const refinement = {
      periodId: id,
      proposalId: originalId,
      expectedRevision: current.draft.revision,
      requestId: crypto.randomUUID(),
      prompt: "Try a different extension",
    }
    const replacementId = await ai.refinePlanningProposal(refinement)
    expect(replacementId).not.toBe(originalId)
    expect(await ai.refinePlanningProposal(refinement)).toBe(replacementId)
    const proposals = await database
      .select()
      .from(schema.planningProposals)
      .where(eq(schema.planningProposals.draftId, current.draft.id))
    expect(proposals).toHaveLength(2)
    expect(
      proposals.find((proposal) => proposal.id === originalId)?.state
    ).toBe("superseded")
    expect(
      proposals.find((proposal) => proposal.id === replacementId)?.state
    ).toBe("pending")
  })
})
