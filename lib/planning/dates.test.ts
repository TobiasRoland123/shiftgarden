import { describe, expect, it } from "vitest"
import {
  addDays,
  enumerateDates,
  intersectingIsoWeeks,
  intervalsOverlap,
  isoWeekKey,
  isoWeekStart,
  mergeIntervals,
  minutesToTime,
  subtractIntervals,
  zonedDateTimeToInstant,
} from "./dates"

describe("dated planning calendar helpers", () => {
  it("enumerates inclusive single-day, weekend, and year-boundary ranges", () => {
    expect(enumerateDates("2026-09-05", "2026-09-05")).toEqual(["2026-09-05"])
    expect(enumerateDates("2026-12-31", "2027-01-02")).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ])
    expect(enumerateDates("2026-09-04", "2026-09-06")).toHaveLength(3)
  })

  it("uses ISO Monday through Sunday weeks without prorating partial ranges", () => {
    expect(isoWeekKey("2021-01-01")).toBe("2020-W53")
    expect(isoWeekKey("2021-01-04")).toBe("2021-W01")
    expect(isoWeekStart("2026-W01")).toBe("2025-12-29")
    expect(intersectingIsoWeeks("2026-01-01", "2026-01-04")).toEqual([
      "2026-W01",
    ])
  })

  it("treats adjacent intervals as non-overlapping and subtracts overlapping blocks once", () => {
    expect(
      intervalsOverlap(
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "12:00", endTime: "14:00" }
      )
    ).toBe(false)
    expect(
      mergeIntervals([
        { startTime: "10:00", endTime: "12:00" },
        { startTime: "11:00", endTime: "13:00" },
      ])
    ).toEqual([{ startTime: "10:00", endTime: "13:00" }])
    expect(
      subtractIntervals({ startTime: "08:00", endTime: "16:00" }, [
        { startTime: "11:00", endTime: "13:00" },
        { startTime: "12:00", endTime: "14:00" },
      ])
    ).toEqual([
      { startTime: "08:00", endTime: "11:00" },
      { startTime: "14:00", endTime: "16:00" },
    ])
  })

  it("keeps local date and time stable across DST boundaries", () => {
    const before = zonedDateTimeToInstant(
      "2026-03-29",
      "01:30",
      "Europe/Copenhagen"
    )
    const after = zonedDateTimeToInstant(
      "2026-03-29",
      "03:30",
      "Europe/Copenhagen"
    )
    expect(after.getTime() - before.getTime()).toBe(60 * 60 * 1000)
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30")
  })

  it("rejects nonexistent local times and invalid ISO week keys", () => {
    expect(() =>
      zonedDateTimeToInstant("2026-03-29", "02:30", "Europe/Copenhagen")
    ).toThrow(/does not exist/)
    expect(() => isoWeekStart("2021-W53")).toThrow(/Invalid ISO week/)
    expect(() => isoWeekStart("2026-W00")).toThrow(/Invalid ISO week/)
    expect(() => minutesToTime(1440)).toThrow(/Invalid minute value/)
  })
})
