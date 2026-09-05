import { composeEffectiveInputs } from "./effective-inputs"
import { loadEffectivePlanningInputs } from "./load-inputs"
import type { PlanningExecutor } from "./source-coordination"
import {
  getDraftForPeriod,
  getDraftShifts,
  PlanningConflictError,
} from "./repository"
import type { PlanningShift } from "./contracts"

export function assertReviewedPlanningInputs(
  context: Awaited<ReturnType<typeof loadCurrentPlanningContext>>
) {
  if (context.draft.inputFingerprint !== context.inputs.fingerprint)
    throw new PlanningConflictError(
      "stale_inputs",
      "Relevant inputs changed. Review and refresh them before continuing."
    )
}

export async function loadCurrentPlanningContext(
  periodId: string,
  tx: PlanningExecutor
) {
  const raw = await loadEffectivePlanningInputs(periodId, tx)
  if (!raw)
    throw new PlanningConflictError(
      "period_missing",
      "Planning period not found."
    )
  const draft = await getDraftForPeriod(periodId, tx)
  if (!draft)
    throw new PlanningConflictError(
      "draft_missing",
      "Open a draft revision before making changes."
    )
  const inputs = composeEffectiveInputs({
    ...raw,
    replacedVersionId: draft.basePublishedVersionId ?? undefined,
  })
  const rows = await getDraftShifts(draft.id, tx)
  const shifts: PlanningShift[] = rows.map((row) => ({
    id: row.id,
    staffId: row.staffMemberId,
    date: row.actualDate,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
    locked: row.locked,
  }))
  return { period: raw.period, draft, inputs, shifts }
}
