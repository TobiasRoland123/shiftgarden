import { describe, expect, it } from "vitest"

import {
  getDayTimelineBounds,
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

describe("getDayTimelineBounds", () => {
  it("spans the institution opening hours for the weekday", () => {
    expect(
      getDayTimelineBounds({
        dayOfWeek: "monday",
        openingHours: [
          { dayOfWeek: "monday", startTime: "07:00", endTime: "17:00" },
          { dayOfWeek: "tuesday", startTime: "06:00", endTime: "20:00" },
        ],
        shifts: [{ startTime: "09:00", endTime: "12:00" }],
      })
    ).toEqual({ start: 7 * 60, end: 17 * 60 })
  })

  it("spans every opening interval when a weekday has a gap", () => {
    expect(
      getDayTimelineBounds({
        dayOfWeek: "monday",
        openingHours: [
          { dayOfWeek: "monday", startTime: "07:00", endTime: "12:00" },
          { dayOfWeek: "monday", startTime: "13:00", endTime: "17:00" },
        ],
        shifts: [],
      })
    ).toEqual({ start: 7 * 60, end: 17 * 60 })
  })

  it("falls back to the weekday's shifts when there are no opening hours", () => {
    expect(
      getDayTimelineBounds({
        dayOfWeek: "saturday",
        openingHours: [
          { dayOfWeek: "monday", startTime: "07:00", endTime: "17:00" },
        ],
        shifts: [{ startTime: "08:45", endTime: "14:10" }],
      })
    ).toEqual({ start: 8 * 60, end: 15 * 60 })
  })

  it("falls back to default bounds with neither opening hours nor shifts", () => {
    expect(
      getDayTimelineBounds({
        dayOfWeek: "sunday",
        openingHours: [],
        shifts: [],
      })
    ).toEqual({ start: 8 * 60, end: 17 * 60 })
  })

  it("extends past opening hours when a shift falls outside them", () => {
    expect(
      getDayTimelineBounds({
        dayOfWeek: "monday",
        openingHours: [
          { dayOfWeek: "monday", startTime: "07:00", endTime: "17:00" },
        ],
        shifts: [{ startTime: "06:30", endTime: "18:30" }],
      })
    ).toEqual({ start: 6 * 60, end: 19 * 60 })
  })
})
