import { describe, expect, it } from "vitest"

import {
  rankSchedulesByFifoEndOrder,
  scoreFifoEndOrder,
} from "@/lib/shift-schedule/preferences"
import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"

function scheduleWithMondayShifts(
  shifts: GeneratedSchedule["days"][number]["shifts"]
): GeneratedSchedule {
  return {
    groupId: "group-1",
    days: [{ dayOfWeek: "monday", shifts }],
    warnings: [],
  }
}

describe("FIFO end-order preference", () => {
  const issueExample = scheduleWithMondayShifts([
    { staffId: "anna", startTime: "07:00", endTime: "15:00" },
    { staffId: "mikkel", startTime: "08:00", endTime: "16:30" },
    { staffId: "samuel", startTime: "08:30", endTime: "13:30" },
  ])
  const preferred = scheduleWithMondayShifts([
    { staffId: "anna", startTime: "07:00", endTime: "13:30" },
    { staffId: "mikkel", startTime: "08:00", endTime: "15:00" },
    { staffId: "samuel", startTime: "08:30", endTime: "16:30" },
  ])

  it("scores each reversed end-order pair as an inversion", () => {
    expect(scoreFifoEndOrder(issueExample)).toBe(2)
    expect(scoreFifoEndOrder(preferred)).toBe(0)
  })

  it("ranks the issue's preferred result first without mutating candidates", () => {
    const candidates = [issueExample, preferred]

    expect(rankSchedulesByFifoEndOrder(candidates)).toEqual([
      preferred,
      issueExample,
    ])
    expect(candidates).toEqual([issueExample, preferred])
  })

  it("keeps input order when candidates have equal scores", () => {
    const equallyPreferred = scheduleWithMondayShifts([
      { staffId: "anna", startTime: "07:00", endTime: "14:00" },
      { staffId: "mikkel", startTime: "08:00", endTime: "15:30" },
    ])

    expect(rankSchedulesByFifoEndOrder([preferred, equallyPreferred])).toEqual([
      preferred,
      equallyPreferred,
    ])
  })
})
