import { describe, expect, it } from "vitest"

import { shiftSchedulePrompt } from "@/lib/shift-schedule/prompt"

describe("shiftSchedulePrompt", () => {
  it("makes FIFO end order a hard constraint", () => {
    expect(shiftSchedulePrompt).toContain(
      "a staff member who starts earlier must not finish later"
    )
    expect(shiftSchedulePrompt).toContain(
      "Hard constraints always take precedence"
    )
    expect(shiftSchedulePrompt).not.toContain("soft preference only")
  })

  it("prioritizes a fair weekly rotation of early and late shifts", () => {
    const earlyLateRotation = shiftSchedulePrompt.indexOf(
      "Rotate early and late shifts fairly"
    )
    const totalHours = shiftSchedulePrompt.indexOf(
      "Distribute total hours fairly"
    )

    expect(earlyLateRotation).toBeGreaterThan(-1)
    expect(earlyLateRotation).toBeLessThan(totalHours)
    expect(shiftSchedulePrompt).toContain(
      "Count early shifts and late shifts separately"
    )
    expect(shiftSchedulePrompt).toContain("differ by no more than one")
    expect(shiftSchedulePrompt).toContain(
      "Avoid assigning the same person an early or late shift on consecutive days"
    )
    expect(shiftSchedulePrompt).toContain(
      "tally these counts and swap equally qualified staff"
    )
    expect(shiftSchedulePrompt).toContain(
      "Do not use balanced total hours as a substitute"
    )
  })
})
