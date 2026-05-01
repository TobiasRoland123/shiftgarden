import { beforeEach, describe, expect, it, vi } from "vitest"

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

import { requireAuth } from "@/lib/auth-guard"

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT")
    })
  })

  it("returns the session for authenticated users", async () => {
    const session = {
      user: { id: "u1", email: "u@example.com", name: null },
      expires: new Date(Date.now() + 60_000).toISOString(),
    }
    authMock.mockResolvedValue(session)

    await expect(requireAuth()).resolves.toEqual(session)
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("redirects anonymous visitors to /login", async () => {
    authMock.mockResolvedValue(null)

    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT")
    expect(redirectMock).toHaveBeenCalledWith("/login")
  })

  it("redirects when session has no user", async () => {
    authMock.mockResolvedValue({
      user: null,
      expires: new Date(Date.now() + 60_000).toISOString(),
    })

    await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT")
    expect(redirectMock).toHaveBeenCalledWith("/login")
  })
})
