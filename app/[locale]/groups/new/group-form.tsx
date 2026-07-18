"use client"

import { Plus, Trash2 } from "lucide-react"
import { useActionState, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatWeekday,
  haveSameStaffingRulesOnAllWeekdays,
  normalizeGroupName,
  weekdayAvailability,
} from "@/lib/groups"
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
    name: normalizeGroupName(initialValues?.name ?? ""),
    rules: getRulesSnapshot(rulesByDay),
  }
}

function getCurrentSnapshot(form: HTMLFormElement): GroupFormSnapshot {
  const formData = new FormData(form)
  const isShared = formData.get("applyRulesToAllWeekdays") === "true"

  function getRules(prefix: string) {
    const rowCount = Number(formData.get(`${prefix}-rule-count`) ?? 0)

    return Array.from({ length: rowCount }, (_, index) => {
      const startTime =
        formData.get(`${prefix}-${index}-startTime`)?.toString() ?? ""
      const endTime =
        formData.get(`${prefix}-${index}-endTime`)?.toString() ?? ""
      const minPedagogs =
        formData.get(`${prefix}-${index}-minPedagogs`)?.toString() ?? ""
      const minStaff =
        formData.get(`${prefix}-${index}-minStaff`)?.toString() ?? ""

      return `${startTime}-${endTime}-${minPedagogs}-${minStaff}`
    })
  }

  return {
    name: formData.get("name")?.toString() ?? "",
    rules: Object.fromEntries(
      weekdayAvailability.map((day) => {
        return [day, getRules(isShared ? "shared" : day)]
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
  const initialRuleInputs = useMemo(
    () => getInitialRuleInputs(initialValues),
    [initialValues]
  )
  const initiallyShared =
    Boolean(initialValues?.rules?.length) &&
    haveSameStaffingRulesOnAllWeekdays(initialValues?.rules ?? [])
  const [applyRulesToAllWeekdays, setApplyRulesToAllWeekdays] =
    useState(initiallyShared)
  const [rulesByDay, setRulesByDay] = useState(initialRuleInputs)
  const [sharedRules, setSharedRules] = useState(initialRuleInputs.monday)
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

  function updateRule(
    rules: RuleInput[],
    setRules: (rules: RuleInput[]) => void,
    key: string,
    field: Exclude<keyof RuleInput, "key">,
    value: string
  ) {
    setRules(
      rules.map((rule) =>
        rule.key === key ? { ...rule, [field]: value } : rule
      )
    )
  }

  function toggleSharedRules(enabled: boolean) {
    if (enabled) {
      const sourceRules =
        weekdayAvailability
          .map((day) => rulesByDay[day])
          .find((rules) => rules.length > 0) ?? []
      setSharedRules(sourceRules.map((rule) => ({ ...rule })))
    } else {
      setRulesByDay(
        Object.fromEntries(
          weekdayAvailability.map((day) => [
            day,
            sharedRules.map((rule) => ({
              ...rule,
              key: `${day}-${crypto.randomUUID()}`,
            })),
          ])
        ) as RuleInputsByDay
      )
    }

    setApplyRulesToAllWeekdays(enabled)
  }

  function renderRules(
    label: string,
    prefix: string,
    rules: RuleInput[],
    add: () => void,
    remove: (key: string) => void,
    change: (
      key: string,
      field: Exclude<keyof RuleInput, "key">,
      value: string
    ) => void
  ) {
    return (
      <div key={prefix} className="grid gap-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{label}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              add()
              updateHasChanges(event.currentTarget.form!)
            }}
          >
            <Plus />
            {t("form.addRule")}
          </Button>
        </div>

        <input
          name={`${prefix}-rule-count`}
          type="hidden"
          value={rules.length}
        />

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("form.noRules")}</p>
        ) : (
          <div className="grid gap-3">
            {rules.map((rule, index) => (
              <div
                key={rule.key}
                className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end"
              >
                {(
                  [
                    ["startTime", t("form.startTime"), "time"],
                    ["endTime", t("form.endTime"), "time"],
                    ["minPedagogs", t("form.minPedagogs"), "number"],
                    ["minStaff", t("form.minStaff"), "number"],
                  ] as const
                ).map(([field, fieldLabel, type]) => (
                  <label
                    key={field}
                    className="grid gap-1 text-xs font-medium text-muted-foreground"
                  >
                    {fieldLabel}
                    <Input
                      name={`${prefix}-${index}-${field}`}
                      type={type}
                      min={type === "number" ? 1 : undefined}
                      step={type === "number" ? 1 : undefined}
                      inputMode={type === "number" ? "numeric" : undefined}
                      value={rule[field]}
                      onChange={(event) =>
                        change(rule.key, field, event.currentTarget.value)
                      }
                    />
                  </label>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("form.removeRule")}
                  onClick={(event) => {
                    remove(rule.key)
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
    )
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
            defaultValue={normalizeGroupName(initialValues?.name ?? "")}
            onInput={(event) => {
              event.currentTarget.value = normalizeGroupName(
                event.currentTarget.value
              )
            }}
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

        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <input
            className="mt-1 size-4 accent-primary"
            type="checkbox"
            name="applyRulesToAllWeekdays"
            value="true"
            checked={applyRulesToAllWeekdays}
            onChange={(event) => toggleSharedRules(event.currentTarget.checked)}
          />
          <span className="grid gap-1">
            <span className="text-sm font-medium">
              {t("form.applyRulesToAllWeekdays")}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("form.applyRulesToAllWeekdaysDescription")}
            </span>
          </span>
        </label>

        <div className="grid gap-4">
          {applyRulesToAllWeekdays
            ? renderRules(
                t("form.allWeekdays"),
                "shared",
                sharedRules,
                () =>
                  setSharedRules((current) => [
                    ...current,
                    createEmptyRule(`shared-${crypto.randomUUID()}`),
                  ]),
                (key) =>
                  setSharedRules((current) =>
                    current.filter((rule) => rule.key !== key)
                  ),
                (key, field, value) =>
                  updateRule(sharedRules, setSharedRules, key, field, value)
              )
            : weekdayAvailability.map((day) =>
                renderRules(
                  formatWeekday(day, tStaff),
                  day,
                  rulesByDay[day],
                  () => addRule(day),
                  (key) => removeRule(day, key),
                  (key, field, value) =>
                    updateRule(
                      rulesByDay[day],
                      (rules) =>
                        setRulesByDay((current) => ({
                          ...current,
                          [day]: rules,
                        })),
                      key,
                      field,
                      value
                    )
                )
              )}
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
