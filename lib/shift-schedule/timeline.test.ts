import { describe, expect, it } from "vitest"

import {
  getShiftBarGeometry,
  getTimelineBounds,
} from "@/lib/shift-schedule/timeline"

describe("getTimelineBounds", () => {
  it("uses default working-day bounds when there are no shifts", () => {
    expect(
      getTimelineBounds({
        days: [
          { dayOfWeek: "monday", shifts: [] },
          { dayOfWeek: "tuesday", shifts: [] },
        ],
      })
    ).toEqual({ start: 8 * 60, end: 17 * 60 })
  })

  it("rounds the earliest start down and latest end up to full hours", () => {
    expect(
      getTimelineBounds({
        days: [
          {
            dayOfWeek: "monday",
            shifts: [
              {
                staffId: "staff-1",
                startTime: "07:45",
                endTime: "12:00",
              },
            ],
          },
          {
            dayOfWeek: "tuesday",
            shifts: [
              {
                staffId: "staff-2",
                startTime: "10:00",
                endTime: "18:10",
              },
            ],
          },
        ],
      })
    ).toEqual({ start: 7 * 60, end: 19 * 60 })
  })
})

describe("getShiftBarGeometry", () => {
  it("positions and sizes a shift relative to the timeline bounds", () => {
    const geometry = getShiftBarGeometry("09:30", "12:00", {
      start: 8 * 60,
      end: 17 * 60,
    })

    expect(geometry.leftPercent).toBeCloseTo(16.67, 2)
    expect(geometry.widthPercent).toBeCloseTo(27.78, 2)
  })
})
