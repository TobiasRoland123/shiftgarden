import { describe, expect, it, vi } from "vitest"

import { generateWithValidationRetry } from "@/lib/shift-schedule/generate-with-retry"
import type { ValidatedGenerationAttempt } from "@/lib/shift-schedule/generate-with-retry"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"

const scheduleInput = {
  group: { id: "group-1", name: "Blue room" },
  openingHours: [],
  staff: [],
  rules: [],
} satisfies ScheduleInput

function plan(groupId: string): GeneratedSchedule {
  return {
    groupId,
    days: [
      { dayOfWeek: "monday", shifts: [] },
      { dayOfWeek: "tuesday", shifts: [] },
      { dayOfWeek: "wednesday", shifts: [] },
      { dayOfWeek: "thursday", shifts: [] },
      { dayOfWeek: "friday", shifts: [] },
      { dayOfWeek: "saturday", shifts: [] },
      { dayOfWeek: "sunday", shifts: [] },
    ],
    warnings: [],
  }
}

describe("generateWithValidationRetry", () => {
  it("persists the failed first attempt before accepting a retry", async () => {
    const outputs = [plan("wrong-group"), plan("group-1")]
    const prompts: string[] = []
    const failedAttempts: ValidatedGenerationAttempt[] = []
    const generate = vi.fn(async (prompt: string) => {
      prompts.push(prompt)
      return outputs.shift()!
    })
    const onValidationFailed = vi.fn(
      async (attempt: ValidatedGenerationAttempt) => {
        failedAttempts.push(attempt)
      }
    )
    const validate = vi.fn(({ generatedSchedule }) =>
      generatedSchedule.groupId === "group-1"
        ? { valid: true, issues: [] }
        : {
            valid: false,
            issues: [
              {
                code: "group_id_mismatch" as const,
                severity: "error" as const,
                message: "Wrong group.",
              },
            ],
          }
    )

    const result = await generateWithValidationRetry({
      basePrompt: "input",
      generate,
      onValidationFailed,
      scheduleInput,
      validate,
    })

    expect(result.attemptNumber).toBe(2)
    expect(result.validation.valid).toBe(true)
    expect(onValidationFailed).toHaveBeenCalledOnce()
    expect(failedAttempts[0]?.attemptNumber).toBe(1)
    expect(prompts[1]).toContain("group_id_mismatch")
  })

  it("persists both attempts when retry validation also fails", async () => {
    const failedAttempts: ValidatedGenerationAttempt[] = []
    const generate = vi.fn(async () => plan("wrong-group"))
    const onValidationFailed = vi.fn(
      async (attempt: ValidatedGenerationAttempt) => {
        failedAttempts.push(attempt)
      }
    )
    const validate = vi.fn(() => ({
      valid: false,
      issues: [
        {
          code: "group_id_mismatch" as const,
          severity: "error" as const,
          message: "Wrong group.",
        },
      ],
    }))

    const result = await generateWithValidationRetry({
      basePrompt: "input",
      generate,
      onValidationFailed,
      scheduleInput,
      validate,
    })

    expect(result.validation.valid).toBe(false)
    expect(failedAttempts.map((attempt) => attempt.attemptNumber)).toEqual([
      1, 2,
    ])
  })

  it("attaches FIFO validation details to the retry prompt", async () => {
    const prompts: string[] = []
    const generate = vi.fn(async (prompt: string) => {
      prompts.push(prompt)
      return plan("group-1")
    })
    const validate = vi
      .fn()
      .mockReturnValueOnce({
        valid: false,
        issues: [
          {
            code: "fifo_end_order_inversion" as const,
            severity: "error" as const,
            message: "Staff member samuel starts after anna but ends earlier.",
            dayOfWeek: "friday",
            staffId: "samuel",
            startTime: "08:30",
            endTime: "13:30",
          },
        ],
      })
      .mockReturnValueOnce({ valid: true, issues: [] })

    const result = await generateWithValidationRetry({
      basePrompt: "input",
      generate,
      onValidationFailed: vi.fn(async () => undefined),
      scheduleInput,
      validate,
    })

    expect(result.validation.valid).toBe(true)
    expect(prompts[1]).toContain("fifo_end_order_inversion")
    expect(prompts[1]).toContain(
      "Staff member samuel starts after anna but ends earlier. (friday, staff samuel, 08:30-13:30)"
    )
  })
})
