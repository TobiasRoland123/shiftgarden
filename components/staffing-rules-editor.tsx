"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  copyStaffingRulesToDays,
  createStaffingRule,
  createStaffingRuleForWholeWeek,
  deleteStaffingRule,
  deleteStaffingRulesByTemplate,
  updateGroup,
  updateStaffingRule,
  updateStaffingRuleByTemplate,
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
  templateId: string | null
}
type Props = {
  groupId: string
  initial: Rule[]
  uniformWeek: boolean
  groupName: string
  openTime: string
  closeTime: string
}
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
const normalizeTime = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t)

export function StaffingRulesEditor({
  groupId,
  initial,
  uniformWeek,
  groupName,
  openTime,
  closeTime,
}: Props) {
  const router = useRouter()
  const t = useTranslations("StaffingRulesEditor")
  const tW = useTranslations("Weekdays.Full")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draftByWeekday, setDraftByWeekday] = useState<Record<number, any>>({})
  const rules = initial.map((r) => ({
    ...r,
    startTime: normalizeTime(r.startTime),
    endTime: normalizeTime(r.endTime),
  }))
  const rulesByWeekday = useMemo(() => {
    const m = new Map<number, Rule[]>()
    for (const r of rules) {
      const l = m.get(r.weekday) ?? []
      l.push(r)
      m.set(r.weekday, l)
    }
    return m
  }, [rules])
  const canToggleOn = rules.every((r) => !!r.templateId)

  async function toggleUniform(next: boolean) {
    if (next && !canToggleOn) {
      toast.error(t("uniform.disabledHint"))
      return
    }
    await updateGroup(groupId, {
      name: groupName,
      openTime,
      closeTime,
      uniformWeek: next,
    })
    router.refresh()
  }

  async function onCreate(weekday: number) {
    const d = draftByWeekday[weekday]
    if (!d) return
    setBusyId(`new-${weekday}`)
    try {
      if (uniformWeek)
        await createStaffingRuleForWholeWeek({
          groupId,
          weekday,
          startTime: d.startTime,
          endTime: d.endTime,
          minStaff: d.minStaff,
          minPedagoger: d.minPedagoger,
        })
      else
        await createStaffingRule({
          groupId,
          weekday,
          startTime: d.startTime,
          endTime: d.endTime,
          minStaff: d.minStaff,
          minPedagoger: d.minPedagoger,
        })
      toast.success(t("toasts.saved"))
      router.refresh()
    } catch {
      toast.error(t("toasts.saveFailed"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-6">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={uniformWeek}
          onChange={(e) => toggleUniform(e.target.checked)}
          disabled={!uniformWeek && !canToggleOn}
        />
        <span>{t("uniform.toggle")}</span>
      </label>
      {uniformWeek ? (
        <UniformView
          rules={rules}
          groupId={groupId}
          busyId={busyId}
          setBusyId={setBusyId}
          onCreate={onCreate}
          t={t}
        />
      ) : (
        WEEKDAYS.map((d, weekday) => (
          <DayBlock
            key={weekday}
            weekday={weekday}
            dayLabel={tW(d)}
            rules={rulesByWeekday.get(weekday) ?? []}
            draft={draftByWeekday[weekday]}
            setDraftByWeekday={setDraftByWeekday}
            busyId={busyId}
            setBusyId={setBusyId}
            onCreate={onCreate}
            groupId={groupId}
            t={t}
            tW={tW}
          />
        ))
      )}
    </div>
  )
}

function UniformView({ rules, groupId, busyId, setBusyId, onCreate, t }: any) {
  const templated = rules.filter((r: any) => r.templateId)
  const legacy = rules.filter((r: any) => !r.templateId)
  const uniq = [
    ...new Map(templated.map((r: any) => [r.templateId, r])).values(),
  ]
  return (
    <div className="grid gap-2">
      {uniq.map((rule: any) => (
        <RuleRow
          key={rule.templateId}
          rule={rule}
          busy={busyId === rule.templateId}
          onSave={async (p: any) => {
            setBusyId(rule.templateId)
            await updateStaffingRuleByTemplate(rule.templateId, groupId, p)
            setBusyId(null)
          }}
          onDelete={async () => {
            setBusyId(rule.templateId)
            await deleteStaffingRulesByTemplate(rule.templateId, groupId)
            setBusyId(null)
          }}
          t={t}
        />
      ))}
      <Button size="sm" variant="outline" onClick={() => onCreate(0)}>
        {t("buttons.addRule")}
      </Button>
      {legacy.length > 0 ? (
        <div>
          <div>{t("uniform.legacyHeader")}</div>
          {legacy.map((r: any) => (
            <div
              key={r.id}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {WEEKDAYS[r.weekday]} {r.startTime}-{r.endTime}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteStaffingRule(r.id, groupId)}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DayBlock({
  weekday,
  dayLabel,
  rules,
  draft,
  setDraftByWeekday,
  busyId,
  groupId,
  t,
  tW,
}: any) {
  const [targets, setTargets] = useState<number[]>([])
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{dayLabel}</div>
      {rules.map((r: any) => (
        <RuleRow
          key={r.id}
          rule={r}
          busy={busyId === r.id}
          onSave={(p: any) =>
            updateStaffingRule(r.id, { groupId, weekday: r.weekday, ...p })
          }
          onDelete={() => deleteStaffingRule(r.id, groupId)}
          t={t}
        />
      ))}
      {draft ? (
        <div />
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraftByWeekday((p: any) => ({
                ...p,
                [weekday]: {
                  startTime: "08:00",
                  endTime: "16:00",
                  minStaff: 1,
                  minPedagoger: 1,
                },
              }))
            }
          >
            {t("buttons.addRule")}
          </Button>
          {rules.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm">
                {t("buttons.copyToDays")}
              </summary>
              <div className="mt-2 grid gap-2">
                {WEEKDAYS.map((d, i) =>
                  i !== weekday ? (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={targets.includes(i)}
                        onChange={(e) =>
                          setTargets((p) =>
                            e.target.checked
                              ? [...p, i]
                              : p.filter((x) => x !== i)
                          )
                        }
                      />{" "}
                      {tW(d)}
                    </label>
                  ) : null
                )}
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await copyStaffingRulesToDays(
                      groupId,
                      weekday,
                      targets
                    )
                    if (res.conflicts.length === 0)
                      toast.success(t("toasts.copied", { count: res.copied }))
                    else
                      toast.error(
                        t("toasts.copiedPartial", {
                          copied: res.copied,
                          conflicts: res.conflicts
                            .map((i: number) => tW(WEEKDAYS[i]))
                            .join(", "),
                        })
                      )
                  }}
                >
                  {t("buttons.copy")}
                </Button>
              </div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  )
}

function RuleRow({ rule, busy, onSave, onDelete, t }: any) {
  const [draft, setDraft] = useState({
    startTime: rule.startTime,
    endTime: rule.endTime,
    minStaff: rule.minStaff,
    minPedagoger: rule.minPedagoger,
  })
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify({
      startTime: rule.startTime,
      endTime: rule.endTime,
      minStaff: rule.minStaff,
      minPedagoger: rule.minPedagoger,
    })
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-center gap-2">
      <Input
        type="time"
        value={draft.startTime}
        onChange={(e) =>
          setDraft((d: any) => ({ ...d, startTime: e.target.value }))
        }
      />
      <Input
        type="time"
        value={draft.endTime}
        onChange={(e) =>
          setDraft((d: any) => ({ ...d, endTime: e.target.value }))
        }
      />
      <Input
        type="number"
        value={draft.minStaff}
        onChange={(e) =>
          setDraft((d: any) => ({
            ...d,
            minStaff: e.target.valueAsNumber || 0,
          }))
        }
      />
      <Input
        type="number"
        value={draft.minPedagoger}
        onChange={(e) =>
          setDraft((d: any) => ({
            ...d,
            minPedagoger: e.target.valueAsNumber || 0,
          }))
        }
      />
      <Button size="sm" onClick={() => onSave(draft)} disabled={busy || !dirty}>
        {t("buttons.save")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        ×
      </Button>
    </div>
  )
}
