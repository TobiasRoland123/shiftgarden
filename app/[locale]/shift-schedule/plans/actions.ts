"use server"

import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { shiftSchedulePlans } from "@/lib/db/schema"
import { uuidPattern } from "@/lib/uuid"

async function archiveSchedulePlan(formData: FormData) {
  const planId = formData.get("planId")?.toString()
  const locale = formData.get("locale")?.toString()

  if (!planId || !uuidPattern.test(planId) || !locale) {
    return
  }

  await db.transaction(async (tx) => {
    const [plan] = await tx
      .select({ weekStart: shiftSchedulePlans.weekStart })
      .from(shiftSchedulePlans)
      .where(eq(shiftSchedulePlans.id, planId))
      .limit(1)

    if (!plan) {
      return
    }

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${plan.weekStart}))`
    )
    await tx
      .update(shiftSchedulePlans)
      .set({ status: "archived" })
      .where(eq(shiftSchedulePlans.id, planId))
  })

  revalidatePath(`/${locale}/shift-schedule/plans`)
  revalidatePath(`/${locale}/shift-schedule/plans/${planId}`)
}

export { archiveSchedulePlan }
