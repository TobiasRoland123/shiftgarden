"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import type { AcceptedSchedulePlan } from "@/lib/shift-schedule/validation-types"
import { generateSchedulePlan } from "./actions"
import { ShiftSchedulePlanView } from "./shift-schedule-plan-view"

type StaffOption = {
  id: string
  name: string
}

type GenerateSchedulePlanProps = {
  copiedLabel: string
  copyLabel: string
  groupId: string
  staff: StaffOption[]
}

type GenerateSchedulePlanState = {
  error?: string
  plan?: AcceptedSchedulePlan
  planId?: string
  planJson?: string
}

const initialState: GenerateSchedulePlanState = {}

function GenerateSchedulePlan({
  copiedLabel,
  copyLabel,
  groupId,
  staff,
}: GenerateSchedulePlanProps) {
  const t = useTranslations("shiftSchedule")
  const [state, formAction, isPending] = useActionState(
    generateSchedulePlan,
    initialState
  )
  const staffById = Object.fromEntries(
    staff.map((staffMember) => [staffMember.id, staffMember.name])
  )

  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-3 border-b bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">{t("generatedTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("generatedDescription")}
          </p>
        </div>
        <form action={formAction}>
          <input name="groupId" type="hidden" value={groupId} />
          <Button disabled={isPending} type="submit">
            {isPending ? t("generatingPlan") : t("generatePlan")}
          </Button>
        </form>
      </div>

      <div className="grid gap-4 p-4" aria-live="polite">
        {state.error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">{t("generationErrorTitle")}</p>
            <p className="mt-1">{state.error}</p>
          </div>
        ) : null}

        {state.plan ? (
          <GeneratedPlanView
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            plan={state.plan}
            planId={state.planId}
            planJson={state.planJson}
            staffById={staffById}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("generatedEmptyDescription")}
          </p>
        )}
      </div>
    </section>
  )
}

function GeneratedPlanView({
  copiedLabel,
  copyLabel,
  plan,
  planId,
  planJson,
  staffById,
}: {
  copiedLabel: string
  copyLabel: string
  plan: AcceptedSchedulePlan
  planId?: string
  planJson?: string
  staffById: Record<string, string>
}) {
  const t = useTranslations("shiftSchedule")

  return (
    <div className="grid gap-4">
      {planId ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p className="font-medium">{t("savedTitle")}</p>
          <p className="mt-1">{t("savedDescription", { planId })}</p>
        </div>
      ) : null}

      <ShiftSchedulePlanView
        copiedLabel={copiedLabel}
        copyLabel={copyLabel}
        plan={plan}
        planJson={planJson}
        staffById={staffById}
      />
    </div>
  )
}

export { GenerateSchedulePlan }
