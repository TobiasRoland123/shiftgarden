import { beforeEach, describe, expect, it, vi } from "vitest"

import { validateGeneratedSchedule } from "@/lib/shift-schedule/validate-generated"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"

const getScheduleInputByGroupId = vi.fn()
const insertedValues: Record<string, unknown[]> = {}

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/shift-schedule/data", () => ({
  getScheduleInputByGroupId: (groupId: string) =>
    getScheduleInputByGroupId(groupId),
}))

vi.mock("@/lib/db/schema", () => ({
  shiftSchedulePlans: { id: "id", tableName: "shift_schedule_plans" },
  shiftScheduleShifts: { tableName: "shift_schedule_shifts" },
  shiftScheduleGenerationAttempts: {
    tableName: "shift_schedule_generation_attempts",
  },
}))

vi.mock("@/lib/db", () => {
  function record(table: { tableName: string }) {
    return {
      values(values: unknown) {
        const rows = Array.isArray(values) ? values : [values]
        insertedValues[table.tableName] = [
          ...(insertedValues[table.tableName] ?? []),
          ...rows,
        ]

        return {
          returning: async () => [
            { id: "11111111-1111-4111-8111-111111111111" },
          ],
          then: (resolve: (value: unknown) => unknown) => resolve(undefined),
        }
      },
    }
  }

  const tx = { insert: record }

  return {
    db: {
      insert: record,
      transaction: async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    },
  }
})

const { acceptSchedulePlan } =
  await import("@/app/[locale]/shift-schedule/actions")

const groupId = "22222222-2222-4222-8222-222222222222"
const generationId = "33333333-3333-4333-8333-333333333333"
const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

function createScheduleInput(
  overrides: Partial<ScheduleInput> = {}
): ScheduleInput {
  return {
    group: { id: groupId, name: "Blue room" },
    openingHours: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: "07:00",
      endTime: "17:00",
    })),
    staff: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "pedagog",
        maxHoursPerWeek: 37,
        active: true,
        availability: daysOfWeek.map((dayOfWeek) => ({
          dayOfWeek,
          startAvailabilityTime: "07:00",
          endAvailabilityTime: "17:00",
        })),
      },
    ],
    rules: [
      {
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "12:00",
        minPedagogs: 1,
        minStaff: 1,
      },
    ],
    ...overrides,
  }
}

function createPlan(
  mondayShifts: GeneratedSchedule["days"][number]["shifts"]
): GeneratedSchedule {
  return {
    groupId,
    warnings: [],
    days: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      shifts: dayOfWeek === "monday" ? mondayShifts : [],
    })),
  }
}

const validPlan = createPlan([
  {
    staffId: "44444444-4444-4444-8444-444444444444",
    startTime: "09:00",
    endTime: "12:00",
  },
])

function createFormData(review: unknown) {
  const formData = new FormData()
  formData.set("review", JSON.stringify(review))

  return formData
}

function createReview(overrides: Record<string, unknown> = {}) {
  return {
    plan: validPlan,
    scheduleInput: createScheduleInput(),
    validationErrors: [],
    validationWarnings: [],
    generationId,
    attemptNumber: 1,
    ...overrides,
  }
}

describe("acceptSchedulePlan", () => {
  beforeEach(() => {
    for (const key of Object.keys(insertedValues)) {
      delete insertedValues[key]
    }
    getScheduleInputByGroupId.mockReset()
    getScheduleInputByGroupId.mockResolvedValue(createScheduleInput())
  })

  it("saves a valid plan and links the accepted attempt to the original generation", async () => {
    const result = await acceptSchedulePlan(
      { status: "idle" },
      createFormData(createReview())
    )

    expect(result).toEqual({
      status: "accepted",
      planId: "11111111-1111-4111-8111-111111111111",
    })
    expect(insertedValues.shift_schedule_generation_attempts).toEqual([
      expect.objectContaining({
        generationId,
        attemptNumber: 1,
        status: "accepted",
        acceptedPlanId: "11111111-1111-4111-8111-111111111111",
        validationErrors: [],
      }),
    ])
    expect(insertedValues.shift_schedule_shifts).toHaveLength(1)
  })

  it("rejects a tampered plan that no longer passes validation", async () => {
    const tampered = createPlan([
      {
        staffId: "44444444-4444-4444-8444-444444444444",
        startTime: "09:00",
        endTime: "18:00",
      },
    ])

    const result = await acceptSchedulePlan(
      { status: "idle" },
      createFormData(createReview({ plan: tampered }))
    )

    expect(result.status).toBe("failed")
    expect(result.status === "failed" ? result.failure.code : undefined).toBe(
      "plan_no_longer_valid"
    )
    expect(insertedValues.shift_schedule_plans).toBeUndefined()
  })

  it("re-validates against server data rather than the schedule input sent by the client", async () => {
    const permissiveClientInput = createScheduleInput({
      rules: [],
      openingHours: daysOfWeek.map((dayOfWeek) => ({
        dayOfWeek,
        startTime: "00:00",
        endTime: "23:00",
      })),
      staff: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 37,
          active: true,
          availability: daysOfWeek.map((dayOfWeek) => ({
            dayOfWeek,
            startAvailabilityTime: "00:00",
            endAvailabilityTime: "23:00",
          })),
        },
      ],
    })
    const outsideServerOpeningHours = createPlan([
      {
        staffId: "44444444-4444-4444-8444-444444444444",
        startTime: "06:00",
        endTime: "12:00",
      },
    ])

    // The plan is valid against the client's permissive copy, so it can only
    // be rejected if the action ignores that copy and reloads server data.
    expect(
      validateGeneratedSchedule({
        scheduleInput: permissiveClientInput,
        generatedSchedule: outsideServerOpeningHours,
      }).valid
    ).toBe(true)

    const result = await acceptSchedulePlan(
      { status: "idle" },
      createFormData(
        createReview({
          plan: outsideServerOpeningHours,
          scheduleInput: permissiveClientInput,
        })
      )
    )

    expect(result.status).toBe("failed")
    expect(result.status === "failed" ? result.failure.code : undefined).toBe(
      "plan_no_longer_valid"
    )
    expect(insertedValues.shift_schedule_plans).toBeUndefined()
  })

  it("rejects a review that does not match the review schema", async () => {
    const result = await acceptSchedulePlan(
      { status: "idle" },
      createFormData(createReview({ attemptNumber: 0 }))
    )

    expect(result.status).toBe("failed")
    expect(result.status === "failed" ? result.failure.code : undefined).toBe(
      "invalid_review"
    )
  })

  it("rejects a missing review", async () => {
    const result = await acceptSchedulePlan({ status: "idle" }, new FormData())

    expect(result.status).toBe("failed")
    expect(result.status === "failed" ? result.failure.code : undefined).toBe(
      "invalid_review"
    )
  })

  it("fails when the group can no longer be found", async () => {
    getScheduleInputByGroupId.mockResolvedValue(undefined)

    const result = await acceptSchedulePlan(
      { status: "idle" },
      createFormData(createReview())
    )

    expect(result.status).toBe("failed")
    expect(result.status === "failed" ? result.failure.code : undefined).toBe(
      "group_not_found"
    )
  })
})
