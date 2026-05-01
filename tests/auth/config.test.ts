import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { authConfig } from "@/lib/auth.config"

type AuthorizedArgs = Parameters<
  NonNullable<NonNullable<typeof authConfig.callbacks>["authorized"]>
>[0]

function makeRequest(pathname: string): AuthorizedArgs["request"] {
  return new NextRequest(
    new URL(pathname, "http://localhost")
  ) as unknown as AuthorizedArgs["request"]
}

const sessionWithUser = {
  user: { id: "u1", email: "u@example.com", name: null },
  expires: new Date(Date.now() + 60_000).toISOString(),
} as unknown as AuthorizedArgs["auth"]

describe("authConfig.callbacks.authorized", () => {
  const authorized = authConfig.callbacks!.authorized!

  it("blocks anonymous users on protected routes", () => {
    const result = authorized({
      auth: null,
      request: makeRequest("/dashboard"),
    })
    expect(result).toBe(false)
  })

  it("allows logged-in users on protected routes", () => {
    const result = authorized({
      auth: sessionWithUser,
      request: makeRequest("/dashboard"),
    })
    expect(result).toBe(true)
  })

  it("allows anonymous users to reach /login", () => {
    const result = authorized({
      auth: null,
      request: makeRequest("/login"),
    })
    expect(result).toBe(true)
  })

  it("redirects logged-in users away from /login", () => {
    const result = authorized({
      auth: sessionWithUser,
      request: makeRequest("/login"),
    })
    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect([302, 307]).toContain(response.status)
    expect(response.headers.get("location")).toBe("http://localhost/")
  })
})

describe("authConfig.callbacks.jwt", () => {
  const jwt = authConfig.callbacks!.jwt!

  it("copies user.id onto token.sub on sign-in", async () => {
    const token = await jwt({
      token: {},
      user: { id: "user-123", email: "u@example.com", name: null },
      // unused params required by the next-auth type
    } as unknown as Parameters<typeof jwt>[0])
    expect(token.sub).toBe("user-123")
  })

  it("returns existing token unchanged when no user is present", async () => {
    const token = await jwt({
      token: { sub: "existing" },
    } as unknown as Parameters<typeof jwt>[0])
    expect(token.sub).toBe("existing")
  })
})

describe("authConfig.callbacks.session", () => {
  const session = authConfig.callbacks!.session!

  it("propagates token.sub onto session.user.id", async () => {
    const result = await session({
      session: {
        user: {
          id: "",
          email: "u@example.com",
          name: null,
          emailVerified: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: { sub: "user-123" },
    } as unknown as Parameters<typeof session>[0])
    expect(result.user.id).toBe("user-123")
  })

  it("leaves session untouched when token.sub is missing", async () => {
    const result = await session({
      session: {
        user: {
          id: "preset",
          email: "u@example.com",
          name: null,
          emailVerified: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: {},
    } as unknown as Parameters<typeof session>[0])
    expect(result.user.id).toBe("preset")
  })
})
