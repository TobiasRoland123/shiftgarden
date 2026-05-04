import { describe, expect, it } from "vitest"

import {
  type CoverageInput,
  evaluateCoverage,
  hhmmToMinutes,
} from "@/lib/coverage"

const group = { openTime: "06:30", closeTime: "17:00" }

function shift(
  startTime: string,
  endTime: string,
  role: "pedagogue" | "assistant" | "substitute"
) {
  return {
    startMinute: hhmmToMinutes(startTime),
    endMinute: hhmmToMinutes(endTime),
    role,
  }
}

describe("evaluateCoverage", () => {
  it("returns green when staff and pedagog requirements are met", () => {
    const input: CoverageInput = {
      weekday: 0, // Monday
      group,
      rules: [
        {
          weekday: 0,
          startTime: "08:00",
          endTime: "17:00",
          minStaff: 2,
          minPedagoger: 1,
        },
      ],
      shifts: [
        shift("08:00", "17:00", "pedagogue"),
        shift("08:00", "17:00", "pedagogue"),
      ],
    }
    const result = evaluateCoverage(input)
    expect(result.status).toBe("green")
    expect(result.shortfalls).toEqual([])
  })

  it("returns yellow when only the pedagog mix is short", () => {
    const input: CoverageInput = {
      weekday: 0,
      group,
      rules: [
        {
          weekday: 0,
          startTime: "08:00",
          endTime: "17:00",
          minStaff: 2,
          minPedagoger: 1,
        },
      ],
      shifts: [
        shift("08:00", "17:00", "assistant"),
        shift("08:00", "17:00", "assistant"),
      ],
    }
    const result = evaluateCoverage(input)
    expect(result.status).toBe("yellow")
    expect(result.shortfalls).toHaveLength(1)
    expect(result.shortfalls[0]).toMatchObject({
      kind: "pedagoger",
      startMinute: hhmmToMinutes("08:00"),
      endMinute: hhmmToMinutes("17:00"),
      required: 1,
      actual: 0,
    })
  })

  it("returns red when staff is short, regardless of pedagog mix", () => {
    const input: CoverageInput = {
      weekday: 0,
      group,
      rules: [
        {
          weekday: 0,
          startTime: "08:00",
          endTime: "17:00",
          minStaff: 2,
          minPedagoger: 1,
        },
      ],
      shifts: [shift("08:00", "17:00", "assistant")],
    }
    const result = evaluateCoverage(input)
    expect(result.status).toBe("red")
    expect(result.shortfalls.some((s) => s.kind === "staff")).toBe(true)
  })

  it("ignores gaps between rules — no requirement, no shortfall", () => {
    const input: CoverageInput = {
      weekday: 0,
      group,
      rules: [
        {
          weekday: 0,
          startTime: "08:00",
          endTime: "12:00",
          minStaff: 1,
          minPedagoger: 0,
        },
        {
          weekday: 0,
          startTime: "13:00",
          endTime: "17:00",
          minStaff: 1,
          minPedagoger: 0,
        },
      ],
      shifts: [
        shift("08:00", "12:00", "assistant"),
        shift("13:00", "17:00", "assistant"),
      ],
    }
    const result = evaluateCoverage(input)
    expect(result.status).toBe("green")
    expect(result.shortfalls).toEqual([])
  })

  it("ignores rules whose weekday does not match the target day", () => {
    const input: CoverageInput = {
      weekday: 0,
      group,
      rules: [
        {
          weekday: 5, // Saturday rule, not Monday
          startTime: "08:00",
          endTime: "17:00",
          minStaff: 2,
          minPedagoger: 1,
        },
      ],
      shifts: [],
    }
    const result = evaluateCoverage(input)
    expect(result.status).toBe("green")
    expect(result.shortfalls).toEqual([])
  })
})
