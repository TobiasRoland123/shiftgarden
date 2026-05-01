import { describe, expect, it } from "vitest"

import { credentialsSchema } from "@/lib/validation/auth"

describe("credentialsSchema", () => {
  it("accepts a valid email and password", () => {
    const result = credentialsSchema.safeParse({
      email: "user@example.com",
      password: "hunter2",
    })
    expect(result.success).toBe(true)
  })

  it("rejects malformed email", () => {
    const result = credentialsSchema.safeParse({
      email: "not-an-email",
      password: "hunter2",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = credentialsSchema.safeParse({
      email: "user@example.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing fields", () => {
    expect(credentialsSchema.safeParse({}).success).toBe(false)
    expect(
      credentialsSchema.safeParse({ email: "user@example.com" }).success
    ).toBe(false)
    expect(credentialsSchema.safeParse({ password: "x" }).success).toBe(false)
  })

  it("rejects non-string password", () => {
    const result = credentialsSchema.safeParse({
      email: "user@example.com",
      password: 12345,
    })
    expect(result.success).toBe(false)
  })
})
