"use client"

import { Plus, Trash2 } from "lucide-react"
import { useActionState, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatWeekday, weekdayAvailability } from "@/lib/groups"
import { createGroup } from "./actions"

type GroupFormState = {
  errors: string[]
}

const initialCreateGroupState: GroupFormState = {
  errors: [],
}

type GroupFormAction = (
  previousState: GroupFormState,
  formData: FormData
) => Promise<GroupFormState>

type GroupFormRule = {
  id?: string
  dayOfWeek: string
  startTime: string
  endTime: string
  minPedagogs: number
  minStaff: number
}

type GroupFormInitialValues = {
  id?: string
  name?: string
  rules?: GroupFormRule[]
}

type GroupFormProps = {
  action?: GroupFormAction
  initialValues?: GroupFormInitialValues
}

type RuleInput = {
  key: string
  startTime: string
  endTime: string
  minPedagogs: string
  minStaff: string
}

type RuleInputsByDay = Record<(typeof weekdayAvailability)[number], RuleInput[]>

type GroupFormSnapshot = {
  name: string
  rules: Record<(typeof weekdayAvailability)[number], string[]>
}

function toTimeInputValue(time?: string) {
  return time?.slice(0, 5) ?? ""
}

function createEmptyRule(key: string): RuleInput {
  return {
    key,
    startTime: "",
    endTime: "",
    minPedagogs: "",
    minStaff: "",
  }
}

function getInitialRuleInputs(initialValues?: GroupFormInitialValues) {
  return Object.fromEntries(
    weekdayAvailability.map((day) => {
      const rules =
        initialValues?.rules
          ?.filter((rule) => rule.dayOfWeek === day)
          .map((rule, index) => ({
            key: rule.id ?? `${day}-${index}`,
            startTime: toTimeInputValue(rule.startTime),
            endTime: toTimeInputValue(rule.endTime),
            minPedagogs: rule.minPedagogs.toString(),
            minStaff: rule.minStaff.toString(),
          })) ?? []

      return [day, rules]
    })
  ) as RuleInputsByDay
}

function getRulesSnapshot(rulesByDay: RuleInputsByDay) {
  return Object.fromEntries(
    weekdayAvailability.map((day) => [
      day,
      rulesByDay[day].map(
        (rule) =>
          `${rule.startTime}-${rule.endTime}-${rule.minPedagogs}-${rule.minStaff}`
      ),
    ])
  ) as GroupFormSnapshot["rules"]
}

function getInitialSnapshot(
  initialValues: GroupFormInitialValues | undefined,
  rulesByDay: RuleInputsByDay
): GroupFormSnapshot {
  return {
    name: initialValues?.name ?? "",
    rules: getRulesSnapshot(rulesByDay),
  }
}

function getCurrentSnapshot(form: HTMLFormElement): GroupFormSnapshot {
  const formData = new FormData(form)

  return {
    name: formData.get("name")?.toString() ?? "",
    rules: Object.fromEntries(
      weekdayAvailability.map((day) => {
        const rowCount = Number(formData.get(`${day}-rule-count`) ?? 0)
        const rules = Array.from({ length: rowCount }, (_, index) => {
          const startTime =
            formData.get(`${day}-${index}-startTime`)?.toString() ?? ""
          const endTime =
            formData.get(`${day}-${index}-endTime`)?.toString() ?? ""
          const minPedagogs =
            formData.get(`${day}-${index}-minPedagogs`)?.toString() ?? ""
          const minStaff =
            formData.get(`${day}-${index}-minStaff`)?.toString() ?? ""

          return `${startTime}-${endTime}-${minPedagogs}-${minStaff}`
        })

        return [day, rules]
      })
    ) as GroupFormSnapshot["rules"],
  }
}

function hasSnapshotChanges(
  currentSnapshot: GroupFormSnapshot,
  initialSnapshot: GroupFormSnapshot
) {
  return JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot)
}

function GroupForm({ action = createGroup, initialValues }: GroupFormProps) {
  const locale = useLocale()
  const t = useTranslations("groups")
  const tStaff = useTranslations("staff")
  const [state, formAction, isPending] = useActionState(
    action,
    initialCreateGroupState
  )
  const [rulesByDay, setRulesByDay] = useState(() =>
    getInitialRuleInputs(initialValues)
  )
  const initialSnapshot = useMemo(
    () =>
      getInitialSnapshot(initialValues, getInitialRuleInputs(initialValues)),
    [initialValues]
  )
  const shouldTrackChanges = Boolean(initialValues?.id)
  const [hasChanges, setHasChanges] = useState(!shouldTrackChanges)
  const errors = state?.errors ?? []

  function updateHasChanges(form: HTMLFormElement) {
    if (!shouldTrackChanges) {
      return
    }

    window.requestAnimationFrame(() => {
      setHasChanges(
        hasSnapshotChanges(getCurrentSnapshot(form), initialSnapshot)
      )
    })
  }

  function addRule(day: (typeof weekdayAvailability)[number]) {
    setRulesByDay((current) => ({
      ...current,
      [day]: [
        ...current[day],
        createEmptyRule(`${day}-${crypto.randomUUID()}`),
      ],
    }))
  }

  function removeRule(day: (typeof weekdayAvailability)[number], key: string) {
    setRulesByDay((current) => ({
      ...current,
      [day]: current[day].filter((rule) => rule.key !== key),
    }))
  }

  return (
    <form
      action={formAction}
      className="flex max-w-4xl flex-col gap-8"
      onChange={(event) => updateHasChanges(event.currentTarget)}
      onInput={(event) => updateHasChanges(event.currentTarget)}
    >
      <input name="locale" type="hidden" value={locale} />
      {initialValues?.id ? (
        <input name="groupId" type="hidden" value={initialValues.id} />
      ) : null}

      {errors.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">{t("form.errorTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">{t("form.detailsTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("form.detailsDescription")}
          </p>
        </div>

        <label className="grid max-w-md gap-2 text-sm font-medium">
          {t("form.name")}
          <Input
            name="name"
            required
            autoComplete="off"
            defaultValue={initialValues?.name}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">{t("form.rulesTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("form.rulesDescription")}
          </p>
        </div>

        <div className="grid gap-4">
          {weekdayAvailability.map((day) => (
            <div key={day} className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">
                  {formatWeekday(day, tStaff)}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    addRule(day)
                    updateHasChanges(event.currentTarget.form!)
                  }}
                >
                  <Plus />
                  {t("form.addRule")}
                </Button>
              </div>

              <input
                name={`${day}-rule-count`}
                type="hidden"
                value={rulesByDay[day].length}
              />

              {rulesByDay[day].length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("form.noRules")}
                </p>
              ) : (
                <div className="grid gap-3">
                  {rulesByDay[day].map((rule, index) => (
                    <div
                      key={rule.key}
                      className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end"
                    >
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        {t("form.startTime")}
                        <Input
                          name={`${day}-${index}-startTime`}
                          type="time"
                          defaultValue={rule.startTime}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        {t("form.endTime")}
                        <Input
                          name={`${day}-${index}-endTime`}
                          type="time"
                          defaultValue={rule.endTime}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        {t("form.minPedagogs")}
                        <Input
                          name={`${day}-${index}-minPedagogs`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          defaultValue={rule.minPedagogs}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        {t("form.minStaff")}
                        <Input
                          name={`${day}-${index}-minStaff`}
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          defaultValue={rule.minStaff}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("form.removeRule")}
                        onClick={(event) => {
                          removeRule(day, rule.key)
                          updateHasChanges(event.currentTarget.form!)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || !hasChanges}>
          {isPending ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  )
}

export { GroupForm }
