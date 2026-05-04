"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  createStaffingRule,
  deleteStaffingRule,
  updateStaffingRule,
} from "@/app/actions/groups"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Rule = {
  id: string
  weekday: number
  startTime: string
  endTime: string
  minStaff: number
  minPedagoger: number
}

type Props = {
  groupId: string
  initial: Rule[]
}

const WEEKDAYS = [
  { key: "mon", fullKey: "monday" },
  { key: "tue", fullKey: "tuesday" },
  { key: "wed", fullKey: "wednesday" },
  { key: "thu", fullKey: "thursday" },
  { key: "fri", fullKey: "friday" },
  { key: "sat", fullKey: "saturday" },
  { key: "sun", fullKey: "sunday" },
] as const

function normalizeTime(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t
}

export function StaffingRulesEditor({ groupId, initial }: Props) {
  const router = useRouter()
  const t = useTranslations("StaffingRulesEditor")
  const tWeekdays = useTranslations("Weekdays.Full")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draftByWeekday, setDraftByWeekday] = useState<
    Record<number, { startTime: string; endTime: string; minStaff: number; minPedagoger: number }>
  >({})

  const rulesByWeekday = new Map<number, Rule[]>()
  for (const r of initial) {
    const list = rulesByWeekday.get(r.weekday) ?? []
    list.push({
      ...r,
      startTime: normalizeTime(r.startTime),
      endTime: normalizeTime(r.endTime),
    })
    rulesByWeekday.set(r.weekday, list)
  }
  for (const list of rulesByWeekday.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  function handleError(err: unknown) {
    console.error(err)
    const message = err instanceof Error ? err.message : ""
    if (message.includes("StaffingRule.overlap")) {
      toast.error(t("toasts.overlap"))
    } else {
      toast.error(t("toasts.saveFailed"))
    }
  }

  async function onSaveExisting(rule: Rule, patch: Partial<Rule>) {
    const next = { ...rule, ...patch }
    setBusyId(rule.id)
    try {
      await updateStaffingRule(rule.id, {
        groupId,
        weekday: next.weekday,
        startTime: next.startTime,
        endTime: next.endTime,
        minStaff: next.minStaff,
        minPedagoger: next.minPedagoger,
      })
      toast.success(t("toasts.saved"))
      router.refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(rule: Rule) {
    setBusyId(rule.id)
    try {
      await deleteStaffingRule(rule.id, groupId)
      toast.success(t("toasts.deleted"))
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error(t("toasts.deleteFailed"))
    } finally {
      setBusyId(null)
    }
  }

  async function onCreate(weekday: number) {
    const draft = draftByWeekday[weekday]
    if (!draft) return
    setBusyId(`new-${weekday}`)
    try {
      await createStaffingRule({
        groupId,
        weekday,
        startTime: draft.startTime,
        endTime: draft.endTime,
        minStaff: draft.minStaff,
        minPedagoger: draft.minPedagoger,
      })
      toast.success(t("toasts.saved"))
      setDraftByWeekday((prev) => {
        const next = { ...prev }
        delete next[weekday]
        return next
      })
      router.refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusyId(null)
    }
  }

  function startDraft(weekday: number) {
    setDraftByWeekday((prev) => ({
      ...prev,
      [weekday]: {
        startTime: "08:00",
        endTime: "16:00",
        minStaff: 1,
        minPedagoger: 1,
      },
    }))
  }

  function updateDraft(
    weekday: number,
    patch: Partial<{
      startTime: string
      endTime: string
      minStaff: number
      minPedagoger: number
    }>
  ) {
    setDraftByWeekday((prev) => ({
      ...prev,
      [weekday]: { ...prev[weekday], ...patch },
    }))
  }

  return (
    <div className="grid gap-6">
      {WEEKDAYS.map((day, weekday) => {
        const dayRules = rulesByWeekday.get(weekday) ?? []
        const draft = draftByWeekday[weekday]
        return (
          <div key={weekday} className="grid gap-2">
            <div className="text-sm font-medium">{tWeekdays(day.fullKey)}</div>

            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-end gap-2 text-xs text-muted-foreground">
              <div>{t("headers.from")}</div>
              <div>{t("headers.to")}</div>
              <div>{t("headers.minStaff")}</div>
              <div>{t("headers.minPedagoger")}</div>
              <div />
              <div />
            </div>

            {dayRules.length === 0 && !draft ? (
              <div className="text-sm text-muted-foreground">{t("empty")}</div>
            ) : null}

            {dayRules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                busy={busyId === rule.id}
                onSave={(patch) => onSaveExisting(rule, patch)}
                onDelete={() => onDelete(rule)}
                t={t}
              />
            ))}

            {draft ? (
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-center gap-2">
                <Input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) =>
                    updateDraft(weekday, { startTime: e.target.value })
                  }
                />
                <Input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) =>
                    updateDraft(weekday, { endTime: e.target.value })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={draft.minStaff}
                  onChange={(e) =>
                    updateDraft(weekday, {
                      minStaff: e.target.valueAsNumber || 0,
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={draft.minPedagoger}
                  onChange={(e) =>
                    updateDraft(weekday, {
                      minPedagoger: e.target.valueAsNumber || 0,
                    })
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onCreate(weekday)}
                  disabled={busyId === `new-${weekday}`}
                >
                  {busyId === `new-${weekday}`
                    ? t("buttons.saving")
                    : t("buttons.save")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraftByWeekday((prev) => {
                      const next = { ...prev }
                      delete next[weekday]
                      return next
                    })
                  }
                >
                  ×
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startDraft(weekday)}
                >
                  {t("buttons.addRule")}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RuleRow({
  rule,
  busy,
  onSave,
  onDelete,
  t,
}: {
  rule: Rule
  busy: boolean
  onSave: (patch: Partial<Rule>) => void
  onDelete: () => void
  t: ReturnType<typeof useTranslations<"StaffingRulesEditor">>
}) {
  const [draft, setDraft] = useState({
    startTime: rule.startTime,
    endTime: rule.endTime,
    minStaff: rule.minStaff,
    minPedagoger: rule.minPedagoger,
  })
  const dirty =
    draft.startTime !== rule.startTime ||
    draft.endTime !== rule.endTime ||
    draft.minStaff !== rule.minStaff ||
    draft.minPedagoger !== rule.minPedagoger

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-center gap-2">
      <Input
        type="time"
        value={draft.startTime}
        onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
      />
      <Input
        type="time"
        value={draft.endTime}
        onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}
      />
      <Input
        type="number"
        min={0}
        max={50}
        value={draft.minStaff}
        onChange={(e) =>
          setDraft((d) => ({ ...d, minStaff: e.target.valueAsNumber || 0 }))
        }
      />
      <Input
        type="number"
        min={0}
        max={50}
        value={draft.minPedagoger}
        onChange={(e) =>
          setDraft((d) => ({ ...d, minPedagoger: e.target.valueAsNumber || 0 }))
        }
      />
      <Button
        type="button"
        size="sm"
        onClick={() => onSave(draft)}
        disabled={busy || !dirty}
      >
        {busy ? t("buttons.saving") : t("buttons.save")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={busy}
      >
        ×
      </Button>
    </div>
  )
}
