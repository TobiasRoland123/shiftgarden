import { DrizzleAdapter } from "@auth/drizzle-adapter"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authConfig } from "@/lib/auth.config"
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

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1)

        if (!user?.password) return null

        const ok = await bcrypt.compare(parsed.data.password, user.password)
        if (!ok) return null

        return { id: user.id, email: user.email, name: user.name ?? null }
      },
    }),
  ],
})
