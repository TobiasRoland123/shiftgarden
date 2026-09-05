import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  institutionSettings,
  planningCoordination,
  planningSourceRevisions,
  type planningSourceType,
} from "@/lib/db/schema"

type PlanningSourceType = (typeof planningSourceType.enumValues)[number]
type PlanningExecutor = typeof db

const SINGLETON_ID = 1

/** Run a short operation under the single-institution coordination lock. */
async function withPlanningCoordination<T>(
  operation: (tx: PlanningExecutor) => Promise<T>
): Promise<T> {
  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as PlanningExecutor
    await tx
      .insert(planningCoordination)
      .values({ id: SINGLETON_ID, revision: 0 })
      .onConflictDoNothing()
    await tx
      .select({ id: planningCoordination.id })
      .from(planningCoordination)
      .where(eq(planningCoordination.id, SINGLETON_ID))
      .for("update")
    return operation(tx)
  })
}

async function getInstitutionSettings(executor: PlanningExecutor = db) {
  await executor
    .insert(institutionSettings)
    .values({ id: SINGLETON_ID, timezone: "Europe/Copenhagen", revision: 0 })
    .onConflictDoNothing()
  const [row] = await executor
    .select()
    .from(institutionSettings)
    .where(eq(institutionSettings.id, SINGLETON_ID))
    .limit(1)
  return row
}

async function touchPlanningSource(
  sourceType: PlanningSourceType,
  sourceId: string,
  executor: PlanningExecutor = db
) {
  const now = new Date()
  const [source] = await executor
    .insert(planningSourceRevisions)
    .values({ sourceType, sourceId, revision: 1, changedAt: now })
    .onConflictDoUpdate({
      target: [
        planningSourceRevisions.sourceType,
        planningSourceRevisions.sourceId,
      ],
      set: {
        revision: sql`${planningSourceRevisions.revision} + 1`,
        changedAt: now,
      },
    })
    .returning({ revision: planningSourceRevisions.revision })

  await executor
    .insert(planningCoordination)
    .values({ id: SINGLETON_ID, revision: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: planningCoordination.id,
      set: {
        revision: sql`${planningCoordination.revision} + 1`,
        updatedAt: now,
      },
    })

  return source?.revision ?? 1
}

async function touchPlanningSources(
  sources: Array<{ sourceType: PlanningSourceType; sourceId: string }>,
  executor: PlanningExecutor = db
) {
  const revisions = []
  for (const source of sources) {
    revisions.push(
      await touchPlanningSource(source.sourceType, source.sourceId, executor)
    )
  }
  return revisions
}

async function getPlanningSourceRevision(
  sourceType: PlanningSourceType,
  sourceId: string,
  executor: PlanningExecutor = db
) {
  const [row] = await executor
    .select({ revision: planningSourceRevisions.revision })
    .from(planningSourceRevisions)
    .where(
      and(
        eq(planningSourceRevisions.sourceType, sourceType),
        eq(planningSourceRevisions.sourceId, sourceId)
      )
    )
    .limit(1)
  return row?.revision ?? 0
}

async function updateInstitutionTimezone(
  timezone: string,
  expectedRevision: number
) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format()
  } catch {
    throw new Error("Invalid institution timezone.")
  }
  return withPlanningCoordination(async (tx) => {
    const [updated] = await tx
      .update(institutionSettings)
      .set({
        timezone,
        revision: sql`${institutionSettings.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(institutionSettings.id, SINGLETON_ID),
          eq(institutionSettings.revision, expectedRevision)
        )
      )
      .returning()
    if (!updated)
      throw new Error("Institution settings changed in another session.")
    await touchPlanningSource("institution_settings", String(SINGLETON_ID), tx)
    return updated
  })
}

export {
  getInstitutionSettings,
  getPlanningSourceRevision,
  touchPlanningSource,
  touchPlanningSources,
  updateInstitutionTimezone,
  withPlanningCoordination,
}
export type { PlanningExecutor, PlanningSourceType }
