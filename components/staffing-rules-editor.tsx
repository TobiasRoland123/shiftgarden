"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
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
  minPedagogues: number
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

  async function onCreate(
    weekday: number,
    values: {
      startTime: string
      endTime: string
      minStaff: number
      minPedagogues: number
    }
  ) {
    setBusyId(`new-${weekday}`)
    try {
      if (uniformWeek)
        await createStaffingRuleForWholeWeek({
          groupId,
          weekday,
          startTime: values.startTime,
          endTime: values.endTime,
          minStaff: values.minStaff,
          minPedagogues: values.minPedagogues,
        })
      else
        await createStaffingRule({
          groupId,
          weekday,
          startTime: values.startTime,
          endTime: values.endTime,
          minStaff: values.minStaff,
          minPedagogues: values.minPedagogues,
        })
      toast.success(t("toasts.saved"))
      setDraftByWeekday((p: any) => {
        const n = { ...p }
        delete n[weekday]
        return n
      })
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
          draft={draftByWeekday[0]}
          setDraftByWeekday={setDraftByWeekday}
          t={t}
        />
      ) : (
        WEEKDAYS.slice(0, 5).map((d, weekday) => (
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

function UniformView({
  rules,
  groupId,
  busyId,
  setBusyId,
  onCreate,
  draft,
  setDraftByWeekday,
  t,
}: any) {
  const templated = rules.filter((r: any) => r.templateId)
  const legacy = rules.filter((r: any) => !r.templateId)
  const uniq = [
    ...new Map(templated.map((r: any) => [r.templateId, r])).values(),
  ]
  return (
    <div className="grid gap-2">
      {(uniq.length > 0 || draft) && <RuleHeaders t={t} />}
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
      {draft ? (
        <DraftRow
          onSave={(values: any) => onCreate(0, values)}
          onCancel={() =>
            setDraftByWeekday((p: any) => {
              const n = { ...p }
              delete n[0]
              return n
            })
          }
          busy={busyId === "new-0"}
          t={t}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDraftByWeekday((p: any) => ({ ...p, [0]: true }))}
        >
          {t("buttons.addRule")}
        </Button>
      )}
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
  onCreate,
  groupId,
  t,
}: any) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{dayLabel}</div>
      {(rules.length > 0 || draft) && <RuleHeaders t={t} />}
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
        <DraftRow
          onSave={(values: any) => onCreate(weekday, values)}
          onCancel={() =>
            setDraftByWeekday((p: any) => {
              const n = { ...p }
              delete n[weekday]
              return n
            })
          }
          busy={busyId === `new-${weekday}`}
          t={t}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setDraftByWeekday((p: any) => ({ ...p, [weekday]: true }))
          }
        >
          {t("buttons.addRule")}
        </Button>
      )}
    </div>
  )
}

function DraftRow({ onSave, onCancel, busy, t }: any) {
  const [draft, setDraft] = useState({
    startTime: "08:00",
    endTime: "16:00",
    minStaff: 1,
    minPedagogues: 1,
  })
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
        value={draft.minStaff}
        onChange={(e) =>
          setDraft((d) => ({ ...d, minStaff: e.target.valueAsNumber || 0 }))
        }
      />
      <Input
        type="number"
        value={draft.minPedagogues}
        onChange={(e) =>
          setDraft((d) => ({
            ...d,
            minPedagogues: e.target.valueAsNumber || 0,
          }))
        }
      />
      <Button
        size="sm"
        type="button"
        onClick={() => onSave(draft)}
        disabled={busy}
      >
        {t("buttons.save")}
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
        ×
      </Button>
    </div>
  )
}

function RuleHeaders({ t }: any) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-center gap-2 px-1">
      <span className="text-xs text-muted-foreground">{t("headers.from")}</span>
      <span className="text-xs text-muted-foreground">{t("headers.to")}</span>
      <span className="text-xs text-muted-foreground">
        {t("headers.minStaff")}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("headers.minPedagogues")}
      </span>
      <span />
      <span />
    </div>
  )
}

function RuleRow({ rule, busy, onSave, onDelete, t }: any) {
  const [draft, setDraft] = useState({
    startTime: rule.startTime,
    endTime: rule.endTime,
    minStaff: rule.minStaff,
    minPedagogues: rule.minPedagogues,
  })
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify({
      startTime: rule.startTime,
      endTime: rule.endTime,
      minStaff: rule.minStaff,
      minPedagogues: rule.minPedagogues,
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
        value={draft.minPedagogues}
        onChange={(e) =>
          setDraft((d: any) => ({
            ...d,
            minPedagogues: e.target.valueAsNumber || 0,
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
