import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import { Pool as NodePool } from "pg"
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres"

import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to connect to Neon")
}

const databaseUrl = process.env.DATABASE_URL
const isLocalPostgres =
  /^postgres(?:ql)?:\/\/(?:[^/@]+(?::[^/@]*)?@)?(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(
    databaseUrl
  )

// Neon remains the production/default driver. A local TCP driver makes the
// same application and migrations usable against an isolated Postgres fixture.
export const db = isLocalPostgres
  ? drizzleNode({
      client: new NodePool({ connectionString: databaseUrl }),
      schema,
    })
  : drizzle({ client: new Pool({ connectionString: databaseUrl }), schema })
