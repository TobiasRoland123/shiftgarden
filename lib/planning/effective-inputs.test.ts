import { describe, expect, it } from "vitest"
import type { PlanningEvent } from "./contracts"
import {
  composeEffectiveInputs,
  summarizeChangedSources,
} from "./effective-inputs"
import { fixturePeriod, fixtureRecurring } from "./domain.fixture"

describe("effective dated input composition", () => {
  it("trims recurring demand for a closure and records an explicit replacement conflict", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      openingReplacements: [
        {
          id: "closure",
          institutionId: "institution-1",
          date: "2026-09-08",
          intervals: [],
        },
      ],
      requirementReplacements: [
        {
          id: "demand",
          groupId: "group-1",
          date: "2026-09-08",
          startTime: "09:00",
          endTime: "10:00",
          minStaff: 3,
          minPedagogs: 1,
        },
      ],
    })
    expect(
      inputs.days.find((day) => day.date === "2026-09-08")?.openingIntervals
    ).toEqual([])
    expect(
      inputs.days.find((day) => day.date === "2026-09-08")?.demandSegments
    ).toEqual([])
    expect(
      inputs.issues.some(
        (entry) =>
          entry.code === "staffing_rule_outside_opening_hours" &&
          entry.sourceIds?.includes("demand") &&
          entry.sourceIds?.includes("closure")
      )
    ).toBe(true)
  })

  it("splits effective availability around absence and shared attendance", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      unavailability: [
        {
          id: "leave",
          staffId: "staff-p",
          kind: "leave",
          date: "2026-09-07",
          startTime: "11:00",
          endTime: "13:00",
        },
      ],
      events: [
        {
          id: "training",
          ownerType: "institution",
          ownerId: "institution-1",
          kind: "training",
          date: "2026-09-07",
          startTime: "14:00",
          endTime: "15:00",
          participantStaffIds: ["staff-p"],
          countsTowardWeeklyHours: true,
        },
      ],
    })
    const availability = inputs.days[0].availability.filter(
      (interval) => interval.staffId === "staff-p"
    )
    expect(
      availability.map(({ startTime, endTime }) => `${startTime}-${endTime}`)
    ).toEqual(["08:00-11:00", "13:00-14:00", "15:00-16:00"])
  })

  it("changes the fingerprint only when relevant effective input changes", () => {
    const first = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const second = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      unavailability: [
        {
          id: "absence",
          staffId: "staff-p",
          kind: "leave",
          date: "2026-09-07",
          startTime: "11:00",
          endTime: "12:00",
        },
      ],
      sourceReferences: [{ sourceId: "absence", sourceRevision: 2 }],
    })
    expect(summarizeChangedSources(first, second).changed).toBe(true)
    expect(first.fingerprint).not.toBe(second.fingerprint)
  })

  it("keeps replacement minima across every recurring boundary and restores ordinary demand outside it", () => {
    const recurring = {
      ...fixtureRecurring,
      rules: [
        {
          dayOfWeek: "monday" as const,
          startTime: "09:00",
          endTime: "10:00",
          minStaff: 1,
          minPedagogs: 0,
        },
        {
          dayOfWeek: "monday" as const,
          startTime: "10:00",
          endTime: "12:00",
          minStaff: 3,
          minPedagogs: 1,
        },
      ],
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      requirementReplacements: [
        {
          id: "dated",
          groupId: "group-1",
          date: "2026-09-07",
          startTime: "09:30",
          endTime: "11:30",
          minStaff: 4,
          minPedagogs: 2,
        },
      ],
    })
    expect(
      inputs.days[0].demandSegments.map((segment) => [
        segment.startTime,
        segment.endTime,
        segment.minStaff,
        segment.replacementSourceId,
      ])
    ).toEqual([
      ["09:00", "09:30", 1, undefined],
      ["09:30", "10:00", 4, "dated"],
      ["10:00", "11:30", 4, "dated"],
      ["11:30", "12:00", 3, undefined],
    ])
  })

  it("does not let dated hours legitimize an invalid ordinary rule", () => {
    const recurring = {
      ...fixtureRecurring,
      openingHours: [
        { dayOfWeek: "monday" as const, startTime: "09:00", endTime: "12:00" },
      ],
      rules: [
        {
          dayOfWeek: "monday" as const,
          startTime: "08:00",
          endTime: "10:00",
          minStaff: 1,
          minPedagogs: 0,
        },
      ],
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      openingReplacements: [
        {
          id: "extended",
          institutionId: "institution-1",
          date: "2026-09-07",
          intervals: [{ startTime: "08:00", endTime: "12:00" }],
        },
      ],
    })
    expect(
      inputs.issues.some(
        (entry) =>
          entry.code === "staffing_rule_outside_opening_hours" &&
          entry.ruleIds?.length
      )
    ).toBe(true)
  })

  it("deduplicates shared events and participant IDs before weekly accounting", () => {
    const event: PlanningEvent = {
      id: "shared",
      ownerType: "institution",
      ownerId: "institution-1",
      kind: "training",
      date: "2026-09-07",
      startTime: "13:00",
      endTime: "15:00",
      participantStaffIds: ["staff-p", "staff-p", "other-group-staff"],
      countsTowardWeeklyHours: true,
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      events: [event, event],
    })
    expect(inputs.events).toHaveLength(1)
    expect(inputs.events[0].participantStaffIds).toEqual(["staff-p"])
  })

  it("reports overlapping counted attendance once per affected participant", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      events: [
        {
          id: "first",
          ownerType: "institution",
          ownerId: "institution-1",
          kind: "training",
          date: "2026-09-07",
          startTime: "10:00",
          endTime: "12:00",
          participantStaffIds: ["staff-p"],
          countsTowardWeeklyHours: true,
        },
        {
          id: "second",
          ownerType: "group",
          ownerId: "group-1",
          kind: "meeting",
          date: "2026-09-07",
          startTime: "11:00",
          endTime: "13:00",
          participantStaffIds: ["staff-p"],
          countsTowardWeeklyHours: true,
        },
      ],
    })
    const conflicts = inputs.issues.filter(
      (entry) => entry.code === "overlapping_counted_event"
    )
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      staffId: "staff-p",
      date: "2026-09-07",
      startTime: "11:00",
      endTime: "12:00",
    })
  })

  it("excludes unrelated malformed exceptions and ignores display-only and lifecycle changes in fingerprints", () => {
    const first = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      requirementReplacements: [
        {
          id: "other",
          groupId: "other-group",
          date: "2026-09-07",
          startTime: "bad",
          endTime: "bad",
          minStaff: 1,
          minPedagogs: 0,
        },
      ],
    })
    const second = composeEffectiveInputs({
      period: { ...fixturePeriod, lifecycle: "published" },
      recurring: {
        ...fixtureRecurring,
        group: { ...fixtureRecurring.group, name: "Renamed" },
        staff: fixtureRecurring.staff.map((staff) => ({
          ...staff,
          firstName: `Renamed ${staff.firstName}`,
        })),
      },
    })
    expect(first.issues.some((entry) => entry.code === "invalid_time")).toBe(
      false
    )
    expect(first.fingerprint).toBe(second.fingerprint)
  })

  it("fingerprints core source revisions and relevant staff semantics in stable order", () => {
    const first = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      sourceReferences: [
        { sourceId: "staff-p", sourceType: "staff", sourceRevision: 1 },
      ],
    })
    const reordered = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: {
        ...fixtureRecurring,
        staff: fixtureRecurring.staff.toReversed(),
      },
      sourceReferences: [
        { sourceId: "staff-p", sourceType: "staff", sourceRevision: 1 },
      ],
    })
    const revised = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      sourceReferences: [
        { sourceId: "staff-p", sourceType: "staff", sourceRevision: 2 },
      ],
    })
    const roleChanged = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: {
        ...fixtureRecurring,
        staff: fixtureRecurring.staff.map((staff) =>
          staff.id === "staff-p"
            ? { ...staff, role: "assistant" as const }
            : staff
        ),
      },
    })
    expect(first.fingerprint).toBe(reordered.fingerprint)
    expect(first.fingerprint).not.toBe(revised.fingerprint)
    expect(first.fingerprint).not.toBe(roleChanged.fingerprint)
    expect(summarizeChangedSources(first, revised).sourceIds).toContain(
      "staff-p"
    )
  })

  it("excludes the replaced version and deduplicates repeated published commitments", () => {
    const commitment = {
      id: "published-shift",
      sourceGroupId: "group-1",
      sourcePeriodId: "older-period",
      versionId: "version-2",
      staffId: "staff-p",
      date: "2026-09-13",
      startTime: "09:00",
      endTime: "12:00",
      locked: true,
      authoritative: true,
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      commitments: [
        commitment,
        commitment,
        { ...commitment, versionId: "version-1" },
      ],
      replacedVersionId: "version-1",
    })
    expect(inputs.commitments).toEqual([commitment])
  })

  it("retains draft advisories without changing availability or the hard-input fingerprint", () => {
    const advisory = {
      id: "draft-shift",
      sourceGroupId: "other-group",
      sourcePeriodId: "draft-period",
      staffId: "staff-p",
      date: "2026-09-07",
      startTime: "10:00",
      endTime: "11:00",
      locked: false,
      authoritative: false,
    }
    const baseline = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      commitments: [advisory],
    })
    expect(inputs.commitments).toEqual([advisory])
    expect(inputs.days[0].availability).toEqual(baseline.days[0].availability)
    expect(inputs.fingerprint).toBe(baseline.fingerprint)
  })
})
