import { NextResponse } from "next/server"
import { desc } from "drizzle-orm"

import { db } from "@/lib/db"
import { healthChecks } from "@/lib/db/schema"

export async function GET() {
  const [latestCheck] = await db
    .select()
    .from(healthChecks)
    .orderBy(desc(healthChecks.checkedAt))
    .limit(1)

  return NextResponse.json({
    ok: true,
    database: "connected",
    latestCheck: latestCheck ?? null,
  })
}
