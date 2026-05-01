import { DrizzleAdapter } from "@auth/drizzle-adapter"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authConfig } from "@/lib/auth.config"

// Equalise timing on the user-miss path so latency can't be used
// to enumerate accounts. Bcrypt hash of an unguessable random string.
const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.4Yk3K6Z2YkF1QKtqgLwQ6sGq2y3a"

import { db } from "@/lib/db"
import { credentialsSchema } from "@/lib/validation/auth"
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/drizzle/schema"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        let user: (typeof users.$inferSelect) | undefined
        try {
          ;[user] = await db
            .select()
            .from(users)
            .where(eq(users.email, parsed.data.email))
            .limit(1)
        } catch {
          // DB unavailable or not migrated — fail closed without a 500
          return null
        }

        if (!user?.password) {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH)
          return null
        }

        const ok = await bcrypt.compare(parsed.data.password, user.password)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.name ?? null }
      },
    }),
  ],
})
