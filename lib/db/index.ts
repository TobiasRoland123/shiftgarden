import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to connect to Neon")
}

const sql = neon(process.env.DATABASE_URL)

export const db = drizzle(sql, { schema })
