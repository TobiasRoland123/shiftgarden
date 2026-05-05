import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((id: string) => ({ __model: id })),
}))

import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"

import { generatePlan } from "@/lib/ai/generate-plan"
import { planSchema } from "@/lib/ai/plan-schema"
import { buildPlannerPrompt } from "@/lib/ai/prompt"
import type { PlanningInput } from "@/lib/ai/types"

const INPUT: PlanningInput = {
  period: {
    startUtc: "2026-05-03T22:00:00Z",
    endUtc: "2026-05-10T22:00:00Z",
  },
  staff: [
    { id: "s1", name: "Alice", role: "pedagogue", weeklyMaxHours: 37 },
  ],
  availability: [
    {
      staffId: "s1",
      date: "2026-05-04",
      startUtc: "2026-05-04T06:00:00Z",
      endUtc: "2026-05-04T14:00:00Z",
    },
  ],
  absences: [],
  groups: [
    {
      id: "g1",
      name: "Solsikker",
      openTime: "06:30:00",
      closeTime: "17:00:00",
      expectedChildren: 12,
      staffingRules: [
        {
          startTime: "06:30:00",
          endTime: "17:00:00",
          minStaff: 2,
          minPedagoger: 1,
        },
      ],
    },
  ],
  rules: {
    minPedagogueRatio: 0.5,
    minStaffRatio: 0.1,
    breakMinutes: 30,
    breakThresholdHours: 5,
  },
}

const MOCK_PLAN = {
  shifts: [
    {
      staffId: "s1",
      groupId: "g1",
      start: "2026-05-04T06:30:00Z",
      end: "2026-05-04T11:00:00Z",
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("buildPlannerPrompt", () => {
  it("includes all hard constraints and the planning input JSON", () => {
    const { system, user } = buildPlannerPrompt(INPUT)

    for (const keyword of [
      "Availability",
      "Absences",
      "weeklyMaxHours",
      "minStaff",
      "minPedagoger",
      "minPedagogueRatio",
      "breakThresholdHours",
      "breakMinutes",
      "overlapping",
    ]) {
      expect(system).toContain(keyword)
    }

    expect(user).toContain(JSON.stringify(INPUT))
    expect(user).toContain('"shifts"')
  })
})

describe("generatePlan", () => {
  it("calls generateObject with planSchema and returns the model output", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: MOCK_PLAN,
    } as never)

    const result = await generatePlan(INPUT, { model: "gpt-4o-mini" })

    expect(openai).toHaveBeenCalledWith("gpt-4o-mini")
    expect(generateObject).toHaveBeenCalledTimes(1)
    const callArg = vi.mocked(generateObject).mock.calls[0][0] as {
      schema: unknown
      system: string
      prompt: string
    }
    expect(callArg.schema).toBe(planSchema)
    expect(callArg.system).toContain("daycare shift scheduler")
    expect(callArg.prompt).toContain(JSON.stringify(INPUT))
    expect(result).toEqual(MOCK_PLAN)
  })

  it("falls back to OPENAI_PLANNER_MODEL env var, then gpt-4o", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: MOCK_PLAN,
    } as never)

    const original = process.env.OPENAI_PLANNER_MODEL
    process.env.OPENAI_PLANNER_MODEL = "gpt-4o-2024-08-06"
    try {
      await generatePlan(INPUT)
      expect(openai).toHaveBeenLastCalledWith("gpt-4o-2024-08-06")
    } finally {
      if (original === undefined) delete process.env.OPENAI_PLANNER_MODEL
      else process.env.OPENAI_PLANNER_MODEL = original
    }

    delete process.env.OPENAI_PLANNER_MODEL
    await generatePlan(INPUT)
    expect(openai).toHaveBeenLastCalledWith("gpt-4o")
  })
})

describe("planSchema", () => {
  it("accepts a well-formed plan", () => {
    expect(planSchema.safeParse(MOCK_PLAN).success).toBe(true)
  })

  it("rejects shifts where end <= start", () => {
    const bad = {
      shifts: [
        {
          staffId: "s1",
          groupId: "g1",
          start: "2026-05-04T11:00:00Z",
          end: "2026-05-04T11:00:00Z",
        },
      ],
    }
    expect(planSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects missing fields", () => {
    const bad = { shifts: [{ staffId: "s1", groupId: "g1" }] }
    expect(planSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects non-UTC datetimes", () => {
    const bad = {
      shifts: [
        {
          staffId: "s1",
          groupId: "g1",
          start: "2026-05-04T06:30:00+02:00",
          end: "2026-05-04T11:00:00+02:00",
        },
      ],
    }
    expect(planSchema.safeParse(bad).success).toBe(false)
  })
})
