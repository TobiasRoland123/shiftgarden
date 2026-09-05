import { and, asc, desc, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  groups,
  planningDraftShifts,
  planningDrafts,
  planningGenerationAttempts,
  planningPeriods,
} from "@/lib/db/schema"
import {
  withPlanningCoordination,
  type PlanningExecutor,
} from "@/lib/planning/source-coordination"

class PlanningConflictError extends Error {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "PlanningConflictError"
    this.code = code
    this.details = details
  }
}

async function getPlanningPeriod(
  periodId: string,
  executor: PlanningExecutor = db
) {
  const [row] = await executor
    .select({ period: planningPeriods, group: groups })
    .from(planningPeriods)
    .innerJoin(groups, eq(groups.id, planningPeriods.groupId))
    .where(eq(planningPeriods.id, periodId))
    .limit(1)
  return row ? { ...row.period, group: row.group } : undefined
}

async function getPlanningDraft(
  draftId: string,
  executor: PlanningExecutor = db
) {
  const [draft] = await executor
    .select()
    .from(planningDrafts)
    .where(eq(planningDrafts.id, draftId))
    .limit(1)
  return draft
}

async function getDraftForPeriod(
  periodId: string,
  executor: PlanningExecutor = db
) {
  const [draft] = await executor
    .select()
    .from(planningDrafts)
    .where(
      and(
        eq(planningDrafts.periodId, periodId),
        sql`${planningDrafts.discardedAt} IS NULL`
      )
    )
    .orderBy(desc(planningDrafts.createdAt))
    .limit(1)
  return draft
}

async function getDraftShifts(
  draftId: string,
  executor: PlanningExecutor = db
) {
  return executor
    .select()
    .from(planningDraftShifts)
    .where(eq(planningDraftShifts.draftId, draftId))
    .orderBy(
      asc(planningDraftShifts.actualDate),
      asc(planningDraftShifts.startTime)
    )
}

async function recordGenerationAttempt(
  input: typeof planningGenerationAttempts.$inferInsert
) {
  return withPlanningCoordination(async (tx) => {
    const [existing] = await tx
      .select()
      .from(planningGenerationAttempts)
      .where(
        and(
          eq(planningGenerationAttempts.requestId, input.requestId),
          eq(planningGenerationAttempts.attemptNumber, input.attemptNumber)
        )
      )
      .limit(1)
    if (existing) return existing
    const [attempt] = await tx
      .insert(planningGenerationAttempts)
      .values(input)
      .returning()
    return attempt
  })
}

export {
  getDraftForPeriod,
  getDraftShifts,
  getPlanningDraft,
  getPlanningPeriod,
  PlanningConflictError,
  recordGenerationAttempt,
}
