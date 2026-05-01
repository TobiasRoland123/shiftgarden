import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { users } from "@/drizzle/schema"

async function main() {
  const url = process.env.DATABASE_URL
  const email = process.env.SEED_PLANNER_EMAIL
  const password = process.env.SEED_PLANNER_PASSWORD

  if (!url) throw new Error("DATABASE_URL is not set")
  if (!email) throw new Error("SEED_PLANNER_EMAIL is not set")
  if (!password) throw new Error("SEED_PLANNER_PASSWORD is not set")

  const pool = new Pool({ connectionString: url })
  const db = drizzle(pool)

  const hash = await bcrypt.hash(password, 10)

  await db
    .insert(users)
    .values({ email, name: "Planner", password: hash })
    .onConflictDoUpdate({
      target: users.email,
      set: { password: hash, name: "Planner" },
    })

  console.log(`Seeded planner: ${email}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
