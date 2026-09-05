import { describe, expect, it, vi } from "vitest"
import { generateValidated } from "./generate"

describe("dated generation correction", () => {
  it("records the first rejected candidate before requesting one correction", async () => {
    const events: string[] = []
    const generate = vi.fn(async (prompt: string) => {
      events.push("generate")
      return prompt.includes("Previous candidate") ? 2 : 1
    })
    const result = await generateValidated({
      prompt: "All requested dates",
      generate,
      validate: (candidate) => ({ valid: candidate === 2 }),
      recordAttempt: async ({ attemptNumber }) => {
        events.push(`record ${attemptNumber}`)
      },
    })
    expect(events).toEqual(["generate", "record 1", "generate", "record 2"])
    expect(result).toEqual({
      candidate: 2,
      validation: { valid: true },
      attemptNumber: 2,
    })
    expect(generate.mock.calls[1][0]).toContain("All requested dates")
  })

  it("never makes a third attempt and returns failure without accepting output", async () => {
    const generate = vi.fn(async () => ({ days: [] }))
    const result = await generateValidated({
      prompt: "A multiweek range",
      generate,
      validate: () => ({ valid: false, errors: ["missing_date"] }),
      recordAttempt: async () => {},
    })
    expect(generate).toHaveBeenCalledTimes(2)
    expect(result.validation.valid).toBe(false)
  })

  it("does not call the model after a failed audit write", async () => {
    const generate = vi.fn(async () => 1)
    await expect(
      generateValidated({
        prompt: "input",
        generate,
        validate: () => ({ valid: false }),
        recordAttempt: async () => {
          throw new Error("database unavailable")
        },
      })
    ).rejects.toThrow("database unavailable")
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it("propagates provider or schema failure without a correction retry", async () => {
    const generate = vi.fn(async () => {
      throw new Error("invalid provider response")
    })
    const recordAttempt = vi.fn()
    await expect(
      generateValidated({
        prompt: "input",
        generate,
        validate: () => ({ valid: true }),
        recordAttempt,
      })
    ).rejects.toThrow("invalid provider response")
    expect(generate).toHaveBeenCalledTimes(1)
    expect(recordAttempt).not.toHaveBeenCalled()
  })
})
