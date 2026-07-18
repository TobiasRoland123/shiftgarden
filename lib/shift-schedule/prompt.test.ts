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
})
