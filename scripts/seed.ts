import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { staff, staffAvailability, users } from "@/drizzle/schema"
import type { Role } from "@/lib/validation/staff"

type SeedWindow = { weekday: number; startTime: string; endTime: string }
type SeedStaff = {
  name: string
  email: string
  role: Role
  weeklyContractHours: number
  active: boolean
  availability: SeedWindow[]
}

// weekday 0=Mon … 4=Fri
const weekdays = [0, 1, 2, 3, 4]
const win = (weekday: number, startTime: string, endTime: string) => ({
  weekday,
  startTime,
  endTime,
})

const dummyStaff: SeedStaff[] = [
  {
    name: "Astrid Sørensen",
    email: "astrid@shiftgarden.dev",
    role: "pedagogue",
    weeklyContractHours: 37,
    active: true,
    availability: weekdays.map((d) => win(d, "06:30", "14:30")),
  },
  {
    name: "Bjørn Kristiansen",
    email: "bjorn@shiftgarden.dev",
    role: "pedagogue",
    weeklyContractHours: 37,
    active: true,
    availability: weekdays.map((d) => win(d, "09:00", "17:00")),
  },
  {
    name: "Camilla Holm",
    email: "camilla@shiftgarden.dev",
    role: "pedagogue",
    weeklyContractHours: 32,
    active: true,
    availability: [
      win(0, "08:00", "12:00"),
      win(0, "14:00", "17:00"),
      win(1, "08:00", "16:00"),
      win(2, "08:00", "16:00"),
      win(3, "08:00", "16:00"),
    ],
  },
  {
    name: "Dorthe Mikkelsen",
    email: "dorthe@shiftgarden.dev",
    role: "assistant",
    weeklyContractHours: 30,
    active: true,
    availability: weekdays.map((d) => win(d, "07:00", "13:00")),
  },
  {
    name: "Emil Jakobsen",
    email: "emil@shiftgarden.dev",
    role: "assistant",
    weeklyContractHours: 32,
    active: true,
    availability: weekdays.map((d) => win(d, "10:00", "17:00")),
  },
  {
    name: "Frederikke Vinther",
    email: "frederikke@shiftgarden.dev",
    role: "assistant",
    weeklyContractHours: 20,
    active: true,
    availability: [
      win(1, "08:00", "13:00"),
      win(3, "08:00", "13:00"),
      win(4, "08:00", "13:00"),
    ],
  },
  {
    name: "Gunnar Larsen",
    email: "gunnar@shiftgarden.dev",
    role: "substitute",
    weeklyContractHours: 0,
    active: true,
    availability: weekdays.map((d) => win(d, "06:30", "17:00")),
  },
  {
    name: "Helle Brandt",
    email: "helle@shiftgarden.dev",
    role: "substitute",
    weeklyContractHours: 0,
    active: false,
    availability: [win(2, "08:00", "16:00"), win(4, "08:00", "16:00")],
  },
]

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

  for (const s of dummyStaff) {
    const [row] = await db
      .insert(staff)
      .values({
        name: s.name,
        email: s.email,
        role: s.role,
        weeklyContractHours: s.weeklyContractHours,
        active: s.active,
      })
      .onConflictDoUpdate({
        target: staff.email,
        set: {
          name: s.name,
          role: s.role,
          weeklyContractHours: s.weeklyContractHours,
          active: s.active,
        },
      })
      .returning({ id: staff.id })

    await db
      .delete(staffAvailability)
      .where(eq(staffAvailability.staffId, row.id))
    if (s.availability.length > 0) {
      await db.insert(staffAvailability).values(
        s.availability.map((w) => ({
          staffId: row.id,
          weekday: w.weekday,
          startTime: w.startTime,
          endTime: w.endTime,
        }))
      )
    }
  }
  console.log(`Seeded ${dummyStaff.length} dummy staff`)

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
