import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  compareMock,
  limitMock,
  whereMock,
  fromMock,
  selectMock,
  authModuleState,
} = vi.hoisted(() => ({
  compareMock: vi.fn(),
  limitMock: vi.fn(),
  whereMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  authModuleState: { config: undefined as unknown },
}))

whereMock.mockImplementation(() => ({ limit: limitMock }))
fromMock.mockImplementation(() => ({ where: whereMock }))
selectMock.mockImplementation(() => ({ from: fromMock }))

vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => Symbol("eq")),
}))

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({ name: "drizzle-adapter" })),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: selectMock,
  },
}))

vi.mock("@/drizzle/schema", () => ({
  users: { email: "email" },
  accounts: {},
  sessions: {},
  verificationTokens: {},
  authenticators: {},
}))

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((options) => options),
}))

vi.mock("next-auth", () => ({
  default: vi.fn((config: unknown) => {
    authModuleState.config = config
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    }
  }),
}))

import "@/lib/auth"

function getAuthorize() {
  const config = authModuleState.config as {
    providers?: Array<{ authorize?: unknown }>
  }
  if (!config) throw new Error("NextAuth config was not captured")
  const provider = config.providers?.[0]
  if (!provider?.authorize)
    throw new Error("Credentials authorize was not captured")
  return provider.authorize as (raw: unknown) => Promise<unknown>
}

const authorize = getAuthorize()

describe("credentials authorize", () => {
  beforeEach(() => {
    compareMock.mockReset()
    limitMock.mockReset()
    selectMock.mockClear()
    fromMock.mockClear()
    whereMock.mockClear()
  })

  it("returns null for invalid credential shape", async () => {
    await expect(authorize({ email: "bad", password: "x" })).resolves.toBeNull()
    expect(selectMock).not.toHaveBeenCalled()
  })

  it("returns null and runs dummy hash compare when user does not exist", async () => {
    limitMock.mockResolvedValueOnce([])

    await expect(
      authorize({ email: "user@example.com", password: "secret" })
    ).resolves.toBeNull()

    expect(compareMock).toHaveBeenCalledTimes(1)
    expect(compareMock.mock.calls[0]?.[0]).toBe("secret")
    expect(compareMock.mock.calls[0]?.[1]).toContain("$2b$")
  })

  it("returns null for wrong password", async () => {
    limitMock.mockResolvedValueOnce([
      { id: "u1", email: "user@example.com", name: "User", password: "hashed" },
    ])
    compareMock.mockResolvedValueOnce(false)

    await expect(
      authorize({ email: "user@example.com", password: "bad-pass" })
    ).resolves.toBeNull()
  })

  it("returns null when the db query throws", async () => {
    limitMock.mockRejectedValueOnce(new Error("relation does not exist"))

    await expect(
      authorize({ email: "user@example.com", password: "secret" })
    ).resolves.toBeNull()
  })

  it("returns id/email/name when password matches", async () => {
    limitMock.mockResolvedValueOnce([
      { id: "u1", email: "user@example.com", name: "User", password: "hashed" },
    ])
    compareMock.mockResolvedValueOnce(true)

    await expect(
      authorize({ email: "user@example.com", password: "secret" })
    ).resolves.toEqual({
      id: "u1",
      email: "user@example.com",
      name: "User",
    })
  })
})
