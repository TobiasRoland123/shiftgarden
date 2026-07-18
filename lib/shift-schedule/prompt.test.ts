import { describe, expect, it } from "vitest"

import { shiftSchedulePrompt } from "@/lib/shift-schedule/prompt"

describe("shiftSchedulePrompt", () => {
  it("makes FIFO end order a soft preference below hard constraints", () => {
    expect(shiftSchedulePrompt).toContain(
      "a staff member who starts earlier should generally finish earlier"
    )
    expect(shiftSchedulePrompt).toContain(
      "Hard constraints always take precedence"
    )
    expect(shiftSchedulePrompt).toContain(
      "First-in-first-out end order is a soft preference only"
    )
    expect(shiftSchedulePrompt).toContain(
      "A first-in-first-out inversion is not an unmet constraint"
    )
  })
})
