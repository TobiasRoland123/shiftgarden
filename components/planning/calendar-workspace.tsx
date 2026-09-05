"use client"

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Lock,
  LockKeyholeOpen,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useState,
  useTransition,
} from "react"
import { useTranslations } from "next-intl"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link, useRouter } from "@/i18n/navigation"
import {
  addDays,
  enumerateDates,
  isoWeekKey,
  isoWeekStart,
} from "@/lib/planning/dates"
import type {
  CalendarScope,
  PlanningShift,
  ValidationIssue,
} from "@/lib/planning/contracts"
import type {
  PeriodViewData,
  PlanningAction,
  PlanningActionCommand,
  ProposalView,
} from "./types"
import {
  classes,
  clock,
  dateLabel,
  minutes,
  newActorId,
  Notice,
  periodLabel,
  StatusBadge,
  usePlanningLocale,
} from "./shared"

type TimelineBounds = { start: number; end: number; span: number }

function timelineBounds(data: PeriodViewData, date: string): TimelineBounds {
  const day = data.calendarDays.find((item) => item.date === date)
  const intervals = [
    ...(day?.openingIntervals ?? []),
    ...(day?.demandSegments ?? []),
    ...(day?.availability ?? []),
    ...data.shifts.filter((shift) => shift.date === date),
    ...data.events.filter((event) => event.date === date),
    ...data.coverageSegments.filter((segment) => segment.date === date),
  ]
  if (!intervals.length) return { start: 0, end: 24 * 60, span: 24 * 60 }
  const earliest = Math.min(...intervals.map((item) => minutes(item.startTime)))
  const latest = Math.max(...intervals.map((item) => minutes(item.endTime)))
  const start = Math.max(0, Math.floor(earliest / 60) * 60 - 60)
  const end = Math.min(24 * 60, Math.ceil(latest / 60) * 60 + 60)
  return { start, end, span: Math.max(60, end - start) }
}

function position(startTime: string, endTime: string, bounds: TimelineBounds) {
  const start = Math.max(bounds.start, minutes(startTime))
  const end = Math.min(bounds.end, minutes(endTime))
  const left = ((start - bounds.start) / bounds.span) * 100
  const width = ((Math.max(start, end) - start) / bounds.span) * 100
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.min(100 - Math.max(0, left), width)}%`,
  }
}

function timelineTicks(bounds: TimelineBounds) {
  const step = bounds.span <= 8 * 60 ? 60 : 2 * 60
  const first = Math.ceil(bounds.start / step) * step
  const ticks: number[] = []
  for (let value = first; value <= bounds.end; value += step) ticks.push(value)
  return ticks
}

function timeLabel(value: number) {
  if (value === 24 * 60) return "24:00"
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}

function issueText(
  issue: ValidationIssue,
  t: ReturnType<typeof useTranslations>
) {
  const keys: Record<string, string> = {
    min_staff_unmet: "issues.minStaff",
    min_pedagogs_unmet: "issues.minPedagogs",
    outside_availability: "issues.availability",
    max_hours_exceeded: "issues.hours",
    overlapping_shift: "issues.overlap",
    external_overlap: "issues.external",
    shift_outside_opening_hours: "issues.opening",
    fifo_end_order_inversion: "issues.fifo",
    stale_proposal: "issues.stale",
  }
  return keys[issue.code]
    ? t(keys[issue.code] as "issues.minStaff", { fallback: issue.message })
    : issue.message
}

function actorIdentity() {
  return newActorId()
}

export function CalendarWorkspace({
  data,
  action,
}: {
  data: PeriodViewData
  action?: PlanningAction
}) {
  const t = useTranslations("planning")
  const locale = usePlanningLocale()
  const router = useRouter()
  const [day, setDay] = useState(data.period.startDate)
  const [view, setView] = useState<"day" | "week">("week")
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue>()
  const [showCreate, setShowCreate] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [aiSeed, setAiSeed] = useState("")
  const [showDiscard, setShowDiscard] = useState(false)
  const [actorId] = useState(actorIdentity)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const editable = !data.readOnly
  const allDates = enumerateDates(data.period.startDate, data.period.endDate)
  const weekStart = isoWeekStart(day)
  const visibleDates =
    view === "day" ? [day] : enumerateDates(weekStart, addDays(weekStart, 6))
  const selected = data.shifts.find((shift) => shift.id === selectedId)

  function navigate(amount: number) {
    const next = addDays(day, amount * (view === "week" ? 7 : 1))
    const bounded =
      next < data.period.startDate
        ? data.period.startDate
        : next > data.period.endDate
          ? data.period.endDate
          : next
    setDay(bounded)
    setSelectedId(undefined)
    setSelectedIssue(undefined)
  }
  function run(command: PlanningActionCommand, onSuccess?: () => void) {
    if (!action) return
    setError(undefined)
    startTransition(async () => {
      const result = await action(command)
      if (!result.ok) setError(result.error)
      else {
        onSuccess?.()
        router.refresh()
      }
    })
  }

  const workspaceStatus = data.readOnly
    ? "published"
    : data.inputsStale
      ? "stale"
      : data.period.currentPublishedVersionId
        ? "revision"
        : "draft"
  return (
    <main className="flex min-h-svh flex-col gap-6 p-4 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/planning/groups/${data.group.id}`}
            className="inline-flex min-h-12 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {data.group.name}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {periodLabel(data.period.startDate, data.period.endDate, locale)}
            </h1>
            <StatusBadge status={workspaceStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.readOnly
              ? t("viewingPublished", { version: data.publishedVersion ?? 1 })
              : t("draftDetails", {
                  revision: data.draftRevision,
                  timezone: data.period.timezone,
                })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.readOnly ? (
            <Button
              onClick={() =>
                run(
                  {
                    type: "createRevision",
                    periodId: data.period.id,
                    requestId: crypto.randomUUID(),
                  },
                  () =>
                    router.push(`/planning/periods/${data.period.id}?edit=1`)
                )
              }
            >
              {t("editSchedule")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={pending || !data.undoAvailable}
                onClick={() =>
                  run({
                    type: "undo",
                    periodId: data.period.id,
                    expectedRevision: data.draftRevision,
                    actorId,
                  })
                }
              >
                <Undo2 />
                {t("undo")}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run({
                    type: "refreshInputs",
                    periodId: data.period.id,
                    expectedRevision: data.draftRevision,
                  })
                }
              >
                <RefreshCw />
                {t("refreshInputs")}
              </Button>
              <Button variant="outline" onClick={() => setShowDiscard(true)}>
                <Trash2 />
                {t("discardDraft")}
              </Button>
              <Button
                asChild
                disabled={Boolean(data.issues.length) || data.inputsStale}
              >
                <Link href={`/planning/periods/${data.period.id}/review`}>
                  <CheckCircle2 />
                  {t("reviewPublication")}
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {data.inputsStale ? (
        <div className="space-y-2">
          <Notice warning issue={t("inputsChanged")} />
          <Button
            variant="outline"
            onClick={() =>
              run({
                type: "refreshInputs",
                periodId: data.period.id,
                expectedRevision: data.draftRevision,
              })
            }
          >
            {t("reviewFreshInputs")}
          </Button>
        </div>
      ) : null}
      {error ? <Notice issue={error} /> : null}
      <ValidationSummary
        issues={data.issues}
        warnings={data.warnings}
        day={day}
        onSelect={(issue) => {
          if (issue.date && allDates.includes(issue.date)) setDay(issue.date)
          setSelectedIssue(issue)
          setSelectedId(undefined)
        }}
      />
      {selectedIssue ? (
        <SelectedIssueDetails
          issue={selectedIssue}
          data={data}
          onAskAi={
            editable
              ? (prompt) => {
                  setAiSeed(prompt)
                  setShowAi(true)
                }
              : undefined
          }
        />
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("previousDate")}
              onClick={() => navigate(-1)}
            >
              <ChevronLeft />
            </Button>
            <div className="min-w-44 text-center">
              <div className="font-semibold">
                {view === "week"
                  ? t("weekOf", { date: dateLabel(weekStart, locale) })
                  : dateLabel(day, locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("nextDate")}
              onClick={() => navigate(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              role="group"
              aria-label={t("calendarView")}
              className="flex rounded-lg bg-muted p-1"
            >
              <Button
                size="sm"
                variant={view === "day" ? "default" : "ghost"}
                aria-pressed={view === "day"}
                onClick={() => setView("day")}
              >
                {t("day")}
              </Button>
              <Button
                size="sm"
                variant={view === "week" ? "default" : "ghost"}
                aria-pressed={view === "week"}
                onClick={() => setView("week")}
              >
                {t("week")}
              </Button>
            </div>
            {editable ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus />
                {t("addShift")}
              </Button>
            ) : null}
          </div>
        </div>
        {view === "week" ? (
          <div
            className="flex gap-2 overflow-x-auto px-3 pt-1"
            role="tablist"
            aria-label={t("datesInWeek")}
          >
            {visibleDates.map((date) => (
              <div key={date} className="min-w-28">
                <button
                  role="tab"
                  aria-selected={day === date}
                  disabled={!allDates.includes(date)}
                  title={
                    allDates.includes(date) ? undefined : t("dateOutsidePeriod")
                  }
                  onClick={() => setDay(date)}
                  className={classes(
                    "min-h-12 w-full rounded-lg border px-3 text-sm",
                    day === date
                      ? "border-primary bg-primary text-primary-foreground"
                      : allDates.includes(date)
                        ? "hover:bg-muted"
                        : "cursor-not-allowed bg-muted/30 text-muted-foreground opacity-60"
                  )}
                >
                  {dateLabel(date, locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <CalendarDay
          data={data}
          date={day}
          editable={editable}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(shiftId, startTime, endTime) =>
            run({
              type: "moveShift",
              periodId: data.period.id,
              expectedRevision: data.draftRevision,
              actorId,
              shiftId,
              date: day,
              startTime,
              endTime,
            })
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border p-4">
          <h2 className="font-semibold">
            {selected && editable ? t("editShift") : t("selectedDay")}
          </h2>
          {selected ? (
            editable ? (
              <ShiftEditor
                key={`${selected.id}:${data.draftRevision}`}
                shift={selected}
                data={data}
                actorId={actorId}
                action={action}
                onDone={() => {
                  setSelectedId(undefined)
                  router.refresh()
                }}
              />
            ) : (
              <ReadOnlyShiftDetails shift={selected} data={data} />
            )
          ) : (
            <DayDetails data={data} date={day} />
          )}
        </section>
        <aside className="space-y-4">
          <WeeklyBudgets data={data} />
          <HistoryPanel data={data} />
          {editable ? (
            <Button
              className="w-full"
              onClick={() => {
                setAiSeed("")
                setShowAi(true)
              }}
            >
              <Sparkles />
              {t("askAi")}
            </Button>
          ) : null}
        </aside>
      </div>
      {showCreate ? (
        <ShiftDialog
          data={data}
          date={day}
          actorId={actorId}
          action={action}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            router.refresh()
          }}
        />
      ) : null}
      {showAi ? (
        <AiDialog
          data={data}
          date={day}
          action={action}
          initialPrompt={aiSeed}
          onClose={() => setShowAi(false)}
          onSuccess={() => {
            setShowAi(false)
            router.refresh()
          }}
        />
      ) : null}
      {data.proposal ? (
        <ProposalPanel
          proposal={data.proposal}
          data={data}
          actorId={actorId}
          action={action}
        />
      ) : null}
      {showDiscard ? (
        <ConfirmDialog
          title={t("discardDraft")}
          description={t("discardDraftDescription")}
          confirm={t("discardDraft")}
          destructive
          onClose={() => setShowDiscard(false)}
          onConfirm={() =>
            run(
              {
                type: "discardDraft",
                periodId: data.period.id,
                expectedRevision: data.draftRevision,
              },
              () => {
                setShowDiscard(false)
                router.push(
                  data.period.currentPublishedVersionId
                    ? `/planning/periods/${data.period.id}`
                    : `/planning/groups/${data.group.id}`
                )
              }
            )
          }
        />
      ) : null}
    </main>
  )
}

function ValidationSummary({
  issues,
  warnings,
  day,
  onSelect,
}: {
  issues: ValidationIssue[]
  warnings: ValidationIssue[]
  day: string
  onSelect: (issue: ValidationIssue) => void
}) {
  const t = useTranslations("planning")
  if (!issues.length && !warnings.length)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <CheckCircle2 className="size-4" />
        {t("noFakeChecks")}
      </div>
    )
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{t("needsAttention")}</h2>
      {[...issues, ...warnings].slice(0, 8).map((issue, index) => (
        <button
          type="button"
          key={`${issue.code}-${index}`}
          aria-label={
            issueText(issue, t) +
            (issue.date && issue.date !== day ? ` · ${issue.date}` : "")
          }
          onClick={() => onSelect(issue)}
          className="block w-full text-left"
        >
          <Notice
            warning={issue.severity === "warning"}
            issue={{
              ...issue,
              message:
                issueText(issue, t) +
                (issue.date && issue.date !== day ? ` · ${issue.date}` : ""),
            }}
          />
        </button>
      ))}
    </section>
  )
}

function SelectedIssueDetails({
  issue,
  data,
  onAskAi,
}: {
  issue: ValidationIssue
  data: PeriodViewData
  onAskAi?: (prompt: string) => void
}) {
  const t = useTranslations("planning")
  const day = data.calendarDays.find((item) => item.date === issue.date)
  const eligibleStaff =
    issue.startTime && issue.endTime
      ? data.staff.filter(
          (person) =>
            person.active &&
            day?.availability.some(
              (interval) =>
                interval.staffId === person.id &&
                interval.startTime <= issue.startTime! &&
                interval.endTime >= issue.endTime!
            )
        )
      : []
  const sourceIds = [
    ...new Set([...(issue.sourceIds ?? []), ...(issue.ruleIds ?? [])]),
  ]
  const sourceLinks = sourceIds
    .map((sourceId) =>
      data.sourceLinks.find((source) => source.sourceId === sourceId)
    )
    .filter((source): source is PeriodViewData["sourceLinks"][number] =>
      Boolean(source)
    )
  const prompt = [
    issueText(issue, t),
    issue.date,
    issue.startTime && issue.endTime
      ? `${issue.startTime}-${issue.endTime}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <section className="rounded-xl border bg-card p-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{issueText(issue, t)}</h2>
          {issue.date ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {issue.date}
              {issue.startTime && issue.endTime
                ? ` · ${issue.startTime}-${issue.endTime}`
                : ""}
            </p>
          ) : null}
        </div>
        {onAskAi ? (
          <Button variant="outline" onClick={() => onAskAi(prompt)}>
            <Sparkles />
            {t("askAi")}
          </Button>
        ) : null}
      </div>
      {issue.startTime && issue.endTime ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">{t("availableAtInterval")}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {eligibleStaff.length ? (
              eligibleStaff.map((person) => (
                <span
                  key={person.id}
                  className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                >
                  {person.firstName} {person.lastName}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t("none")}</span>
            )}
          </div>
        </div>
      ) : null}
      {sourceLinks.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t("sourceRecord")}</span>
          {sourceLinks.map((source) => (
            <Button key={source.sourceId} asChild size="sm" variant="outline">
              <Link href={source.href}>
                {source.label ?? source.sourceId} · {t("viewSource")}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function CalendarDay({
  data,
  date,
  editable,
  selectedId,
  onSelect,
  onMove,
}: {
  data: PeriodViewData
  date: string
  editable: boolean
  selectedId?: string
  onSelect: (id: string) => void
  onMove: (id: string, start: string, end: string) => void
}) {
  const t = useTranslations("planning")
  const day = data.calendarDays.find((item) => item.date === date)
  const dayIssues = data.issues.filter((issue) => issue.date === date)
  const shifts = data.shifts.filter((shift) => shift.date === date)
  const coverage = data.coverageSegments.filter(
    (segment) => segment.date === date
  )
  const bounds = timelineBounds(data, date)
  const ticks = timelineTicks(bounds)
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[12rem_1fr] border-y bg-muted/30 text-xs text-muted-foreground">
          <div className="px-4 py-3">{t("staffAndEvents")}</div>
          <div className="relative h-10">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-3 -translate-x-1/2"
                style={{
                  left: `${((tick - bounds.start) / bounds.span) * 100}%`,
                }}
              >
                {timeLabel(tick)}
              </span>
            ))}
          </div>
        </div>
        {data.staff.map((person) => {
          const availability =
            day?.availability.filter(
              (interval) => interval.staffId === person.id
            ) ?? []
          const personShifts = shifts.filter(
            (shift) => shift.staffId === person.id
          )
          const events = data.events.filter(
            (event) =>
              event.date === date &&
              event.participantStaffIds.includes(person.id)
          )
          return (
            <div
              key={person.id}
              className="grid min-h-16 grid-cols-[12rem_1fr] border-b"
            >
              <div className="flex items-center gap-2 px-4 text-sm">
                <span className="truncate">
                  {person.firstName} {person.lastName}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {person.role === "pedagog"
                    ? t("pedagogShort")
                    : t("assistantShort")}
                </span>
              </div>
              <div
                className="relative bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px)]"
                style={{
                  backgroundSize: `${100 / Math.max(1, ticks.length - 1)}% 100%`,
                }}
              >
                {availability.map((interval, index) => (
                  <div
                    aria-hidden
                    key={index}
                    className="absolute inset-y-1 rounded bg-slate-100"
                    style={position(
                      interval.startTime,
                      interval.endTime,
                      bounds
                    )}
                  />
                ))}
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="absolute inset-y-2 overflow-hidden rounded border border-dashed border-sky-500 bg-sky-50 px-2 py-1 text-xs text-sky-950"
                    style={position(event.startTime, event.endTime, bounds)}
                  >
                    {t(`exceptionKinds.${event.kind}`)} · {event.startTime}-
                    {event.endTime}
                  </div>
                ))}
                {personShifts.map((shift) => (
                  <ShiftBlock
                    key={shift.id}
                    shift={shift}
                    editable={editable}
                    selected={selectedId === shift.id}
                    onSelect={() => onSelect(shift.id)}
                    onMove={onMove}
                    bounds={bounds}
                  />
                ))}
              </div>
            </div>
          )
        })}
        <CoverageStrip segments={coverage} issues={dayIssues} bounds={bounds} />
      </div>
    </div>
  )
}

function ShiftBlock({
  shift,
  editable,
  selected,
  onSelect,
  onMove,
  bounds,
}: {
  shift: PlanningShift
  editable: boolean
  selected: boolean
  onSelect: () => void
  onMove: (id: string, start: string, end: string) => void
  bounds: TimelineBounds
}) {
  const t = useTranslations("planning")
  const [preview, setPreview] = useState<{ start: string; end: string }>()
  const locale = usePlanningLocale()
  const [drag, setDrag] = useState<{
    x: number
    start: number
    end: number
    mode: "move" | "start" | "end"
  }>()
  const shown = preview ?? { start: shift.startTime, end: shift.endTime }
  const duration = t("shiftHours", {
    hours: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      (minutes(shown.end) - minutes(shown.start)) / 60
    ),
  })
  const label = `${shown.start}-${shown.end} (${duration})`
  function pointerDown(
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "start" | "end"
  ) {
    if (!editable || shift.locked) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      x: event.clientX,
      start: minutes(shift.startTime),
      end: minutes(shift.endTime),
      mode,
    })
  }
  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return
    const width = event.currentTarget.parentElement?.clientWidth ?? 1
    const delta =
      Math.round((((event.clientX - drag.x) / width) * bounds.span) / 15) * 15
    let start = drag.start
    let end = drag.end
    if (drag.mode === "move") {
      start += delta
      end += delta
    }
    if (drag.mode === "start") start = Math.min(end - 15, start + delta)
    if (drag.mode === "end") end = Math.max(start + 15, end + delta)
    if (start < bounds.start) {
      end += bounds.start - start
      start = bounds.start
    }
    if (end > bounds.end) {
      start -= end - bounds.end
      end = bounds.end
    }
    setPreview({ start: clock(start), end: clock(end) })
  }
  function pointerUp() {
    if (
      drag &&
      preview &&
      (preview.start !== shift.startTime || preview.end !== shift.endTime)
    )
      onMove(shift.id, preview.start, preview.end)
    setDrag(undefined)
    setPreview(undefined)
  }
  function pointerCancel() {
    setDrag(undefined)
    setPreview(undefined)
  }
  return (
    <button
      type="button"
      aria-label={
        editable && !shift.locked
          ? t("shiftLabel", { start: shown.start, end: shown.end, duration })
          : label
      }
      title={label}
      onClick={onSelect}
      onPointerDown={(event) => pointerDown(event, "move")}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerCancel}
      className={classes(
        "absolute inset-y-2 z-10 touch-none overflow-hidden rounded-md border bg-primary px-2 py-1 text-left text-xs text-primary-foreground shadow-sm select-none focus-visible:outline-2 focus-visible:outline-offset-2",
        selected && "ring-2 ring-ring ring-offset-2",
        shift.locked && "cursor-pointer bg-slate-700"
      )}
      style={position(shown.start, shown.end, bounds)}
    >
      <span className="flex items-center gap-1">
        {shift.locked ? <Lock className="size-3" /> : null}
        <span className="truncate">{label}</span>
      </span>
      {editable && !shift.locked ? (
        <>
          <span
            onPointerDown={(event) => {
              event.stopPropagation()
              pointerDown(event, "start")
            }}
            className="absolute inset-y-0 left-0 w-3 cursor-ew-resize"
          />
          <span
            onPointerDown={(event) => {
              event.stopPropagation()
              pointerDown(event, "end")
            }}
            className="absolute inset-y-0 right-0 w-3 cursor-ew-resize"
          />
        </>
      ) : null}
    </button>
  )
}

function CoverageStrip({
  segments,
  issues,
  bounds,
}: {
  segments: PeriodViewData["coverageSegments"]
  issues: ValidationIssue[]
  bounds: TimelineBounds
}) {
  const t = useTranslations("planning")
  return (
    <div className="grid grid-cols-[12rem_1fr] bg-muted/20">
      <div className="px-4 py-3 text-sm font-medium">{t("coverage")}</div>
      <div className="relative min-h-14">
        {segments.map((segment, index) => {
          const bad =
            segment.actualStaff < segment.requiredStaff ||
            segment.actualPedagogs < segment.requiredPedagogs
          return (
            <div
              key={index}
              title={segment.sourceIds.join(", ")}
              className={classes(
                "absolute inset-y-2 overflow-hidden rounded border px-2 py-1 text-xs",
                bad
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
              )}
              style={position(segment.startTime, segment.endTime, bounds)}
            >
              {segment.actualStaff}/{segment.requiredStaff} ·{" "}
              {segment.actualPedagogs}/{segment.requiredPedagogs} P
            </div>
          )
        })}
        {!segments.length ? (
          <span className="absolute inset-0 flex items-center px-3 text-xs text-muted-foreground">
            {t("noCoverageDemand")}
          </span>
        ) : null}
        {issues.some(
          (issue) =>
            issue.code === "min_staff_unmet" ||
            issue.code === "min_pedagogs_unmet"
        ) ? (
          <AlertCircle className="absolute top-2 right-2 size-4 text-red-700" />
        ) : null}
      </div>
    </div>
  )
}

function DayDetails({ data, date }: { data: PeriodViewData; date: string }) {
  const t = useTranslations("planning")
  const day = data.calendarDays.find((item) => item.date === date)
  const available = new Set(day?.availability.map((item) => item.staffId)).size
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground">{t("openingHours")}</div>
        <div className="mt-1 text-sm font-medium">
          {day?.openingIntervals.length
            ? day.openingIntervals
                .map((item) => `${item.startTime}-${item.endTime}`)
                .join(", ")
            : t("closed")}
        </div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground">
          {t("availableStaff")}
        </div>
        <div className="mt-1 text-sm font-medium">{available}</div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="text-xs text-muted-foreground">
          {t("scheduledShifts")}
        </div>
        <div className="mt-1 text-sm font-medium">
          {data.shifts.filter((shift) => shift.date === date).length}
        </div>
      </div>
    </div>
  )
}

function ReadOnlyShiftDetails({
  shift,
  data,
}: {
  shift: PlanningShift
  data: PeriodViewData
}) {
  const t = useTranslations("planning")
  const person = data.staff.find((staff) => staff.id === shift.staffId)
  return (
    <dl className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted-foreground">{t("staff")}</dt>
        <dd className="mt-1 text-sm font-medium">
          {person ? `${person.firstName} ${person.lastName}` : shift.staffId}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">{t("date")}</dt>
        <dd className="mt-1 text-sm font-medium">{shift.date}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">{t("startTime")}</dt>
        <dd className="mt-1 text-sm font-medium">{shift.startTime}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">{t("endTime")}</dt>
        <dd className="mt-1 text-sm font-medium">{shift.endTime}</dd>
      </div>
    </dl>
  )
}

function ShiftEditor({
  shift,
  data,
  actorId,
  action,
  onDone,
}: {
  shift: PlanningShift
  data: PeriodViewData
  actorId: string
  action?: PlanningAction
  onDone: () => void
}) {
  const t = useTranslations("planning")
  const [staffId, setStaffId] = useState(shift.staffId)
  const [date, setDate] = useState(shift.date)
  const [startTime, setStartTime] = useState(shift.startTime)
  const [endTime, setEndTime] = useState(shift.endTime)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    startTransition(async () => {
      const result = await action({
        type: "saveShift",
        periodId: data.period.id,
        expectedRevision: data.draftRevision,
        actorId,
        shift: { ...shift, staffId, date, startTime, endTime },
      })
      if (!result.ok) setError(result.error)
      else onDone()
    })
  }
  function mutate(command: PlanningActionCommand) {
    if (!action) return
    startTransition(async () => {
      const result = await action(command)
      if (!result.ok) setError(result.error)
      else onDone()
    })
  }
  return (
    <form onSubmit={save} className="mt-4 space-y-4">
      <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {shift.locked ? t("lockedShiftHelp") : t("manualEditHelp")}
      </p>
      <label className="block space-y-1 text-sm font-medium">
        {t("staff")}
        <select
          className="min-h-12 w-full rounded-lg border bg-background px-3 text-base"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          disabled={shift.locked}
        >
          {data.staff
            .filter((person) => person.active)
            .map((person) => (
              <option key={person.id} value={person.id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          {t("date")}
          <Input
            type="date"
            min={data.period.startDate}
            max={data.period.endDate}
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={shift.locked}
          />
        </label>
        <label className="space-y-1 text-sm">
          {t("startTime")}
          <Input
            type="time"
            step={60}
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={shift.locked}
          />
        </label>
        <label className="space-y-1 text-sm">
          {t("endTime")}
          <Input
            type="time"
            step={60}
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={shift.locked}
          />
        </label>
      </div>
      {error ? <Notice issue={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || shift.locked}>
          <Save />
          {t("saveShift")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            mutate({
              type: "toggleLock",
              periodId: data.period.id,
              expectedRevision: data.draftRevision,
              actorId,
              shiftId: shift.id,
              locked: !shift.locked,
            })
          }
        >
          {shift.locked ? <LockKeyholeOpen /> : <Lock />}
          {shift.locked ? t("unlock") : t("lock")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending || shift.locked}
          onClick={() =>
            mutate({
              type: "deleteShift",
              periodId: data.period.id,
              expectedRevision: data.draftRevision,
              actorId,
              shiftId: shift.id,
            })
          }
        >
          <Trash2 />
          {t("deleteShift")}
        </Button>
      </div>
    </form>
  )
}

function ShiftDialog({
  data,
  date,
  actorId,
  action,
  onClose,
  onSuccess,
}: {
  data: PeriodViewData
  date: string
  actorId: string
  action?: PlanningAction
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations("planning")
  const [staffId, setStaffId] = useState(
    data.staff.find((person) => person.active)?.id ?? ""
  )
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("16:00")
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || !staffId) return
    startTransition(async () => {
      const result = await action({
        type: "createShift",
        periodId: data.period.id,
        expectedRevision: data.draftRevision,
        actorId,
        shift: {
          id: crypto.randomUUID(),
          groupId: data.group.id,
          staffId,
          date,
          startTime,
          endTime,
          locked: false,
        },
      })
      if (!result.ok) setError(result.error)
      else onSuccess()
    })
  }
  return (
    <PlanningDialog
      title={t("addShift")}
      description={t("manualEditHelp")}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          {t("staff")}
          <select
            required
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="min-h-12 w-full rounded-lg border bg-background px-3 text-base"
          >
            {data.staff
              .filter((person) => person.active)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            {t("startTime")}
            <Input
              type="time"
              step={60}
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            {t("endTime")}
            <Input
              type="time"
              step={60}
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>
        {error ? <Notice issue={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            <Plus />
            {t("addShift")}
          </Button>
        </div>
      </form>
    </PlanningDialog>
  )
}

function AiDialog({
  data,
  date,
  action,
  initialPrompt,
  onClose,
  onSuccess,
}: {
  data: PeriodViewData
  date: string
  action?: PlanningAction
  initialPrompt: string
  onClose: () => void
  onSuccess: () => void
}) {
  const t = useTranslations("planning")
  const [scope, setScope] = useState<CalendarScope>({ kind: "day", date })
  const [prompt, setPrompt] = useState(initialPrompt)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  function choose(kind: "day" | "week" | "period") {
    setScope(
      kind === "day"
        ? { kind, date }
        : kind === "week"
          ? { kind, week: isoWeekKey(date) }
          : { kind }
    )
    setConfirmed(kind === "day")
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || !prompt.trim() || (scope.kind !== "day" && !confirmed))
      return
    startTransition(async () => {
      const result = await action({
        type: "requestAi",
        periodId: data.period.id,
        requestId: crypto.randomUUID(),
        expectedRevision: data.draftRevision,
        scope,
        prompt: prompt.trim(),
      })
      if (!result.ok) setError(result.error)
      else onSuccess()
    })
  }
  return (
    <PlanningDialog
      title={t("askAi")}
      description={t("aiWorking")}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium">{t("aiScope")}</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["day", "week", "period"] as const).map((kind) => (
              <label
                key={kind}
                className="flex min-h-12 items-center gap-2 rounded-lg border px-3 has-checked:border-primary"
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope.kind === kind}
                  onChange={() => choose(kind)}
                />
                {t(kind)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block space-y-1 text-sm font-medium">
          {t("aiRequest")}
          <textarea
            required
            maxLength={8000}
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full resize-y rounded-lg border bg-background p-3 text-base"
            placeholder={t("aiPlaceholder")}
          />
        </label>
        {scope.kind !== "day" ? (
          <label className="flex min-h-12 items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t("confirmAiScope", { scope: t(scope.kind) })}
          </label>
        ) : null}
        {pending ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm"
          >
            <RefreshCw className="size-4 animate-spin" />
            {t("aiWorking")}
          </div>
        ) : null}
        {error ? <Notice issue={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            disabled={pending || (scope.kind !== "day" && !confirmed)}
          >
            <Sparkles />
            {t("previewProposal")}
          </Button>
        </div>
      </form>
    </PlanningDialog>
  )
}

function ProposalPanel({
  proposal,
  data,
  actorId,
  action,
}: {
  proposal: ProposalView
  data: PeriodViewData
  actorId: string
  action?: PlanningAction
}) {
  const t = useTranslations("planning")
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [refining, setRefining] = useState(false)
  const [refineText, setRefineText] = useState(proposal.prompt)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const stale =
    proposal.baseDraftRevision !== data.draftRevision ||
    proposal.inputFingerprint !== data.effectiveFingerprint
  const staffName = (id: string) => {
    const person = data.staff.find((item) => item.id === id)
    return person ? `${person.firstName} ${person.lastName}` : id
  }
  function execute(command: PlanningActionCommand) {
    if (!action) return
    startTransition(async () => {
      const result = await action(command)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })
  }
  return (
    <PlanningDialog
      title={proposal.prompt}
      description={t("proposalUnchanged", {
        count: proposal.operations.length,
      })}
      open={open}
      wide
      onClose={() => setOpen(false)}
    >
      {stale ? (
        <div>
          <Notice issue={t("proposalStale")} />
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {proposal.operations.map((operation, index) => {
          const before =
            operation.type === "create"
              ? undefined
              : proposal.before.find((shift) => shift.id === operation.shiftId)
          const after =
            operation.type === "delete"
              ? undefined
              : operation.type === "create"
                ? operation.shift
                : proposal.candidate.find(
                    (shift) => shift.id === operation.shiftId
                  )
          return (
            <article key={index} className="rounded-lg border p-3">
              <div className="text-sm font-medium">
                {t(`proposal.${operation.type}`)}
              </div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded bg-muted/50 p-2">
                  <div className="text-xs text-muted-foreground">
                    {t("before")}
                  </div>
                  {before
                    ? `${staffName(before.staffId)} · ${before.date} · ${before.startTime}-${before.endTime}`
                    : t("none")}
                </div>
                <div className="rounded bg-primary/5 p-2">
                  <div className="text-xs text-muted-foreground">
                    {t("after")}
                  </div>
                  {after
                    ? `${staffName(after.staffId)} · ${after.date} · ${after.startTime}-${after.endTime}`
                    : t("removed")}
                </div>
              </div>
              <ProposalChangeTimeline before={before} after={after} />
            </article>
          )
        })}
      </div>
      {proposal.notes?.length ? (
        <section className="mt-4 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">{t("proposalNotes")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {proposal.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {proposal.issues.length ? (
        <section className="mt-4 space-y-2">
          {proposal.issues.map((issue, index) => (
            <Notice
              key={index}
              issue={{ ...issue, message: issueText(issue, t) }}
            />
          ))}
        </section>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />
          {t("proposalValid")}
        </p>
      )}
      {proposal.warnings?.length ? (
        <section className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">{t("validationWarnings")}</h3>
          {proposal.warnings.map((warning, index) => (
            <Notice
              key={index}
              warning
              issue={{ ...warning, message: issueText(warning, t) }}
            />
          ))}
        </section>
      ) : null}
      {refining ? (
        <label className="mt-4 block space-y-1 text-sm font-medium">
          {t("refineProposal")}
          <textarea
            rows={4}
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            className="w-full rounded-lg border bg-background p-3 text-base"
          />
        </label>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice issue={error} />
        </div>
      ) : null}
      <footer className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            execute({
              type: "discardProposal",
              periodId: data.period.id,
              proposalId: proposal.id!,
              expectedRevision: data.draftRevision,
            })
          }
        >
          <X />
          {t("discardProposal")}
        </Button>
        {refining ? (
          <Button
            variant="outline"
            disabled={pending || !refineText.trim()}
            onClick={() =>
              execute({
                type: "refineProposal",
                periodId: data.period.id,
                proposalId: proposal.id!,
                requestId: crypto.randomUUID(),
                expectedRevision: data.draftRevision,
                prompt: refineText.trim(),
              })
            }
          >
            {t("sendRefinement")}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setRefining(true)}>
            {t("refineProposal")}
          </Button>
        )}
        <Button
          disabled={pending || stale || Boolean(proposal.issues.length)}
          onClick={() =>
            execute({
              type: "applyProposal",
              periodId: data.period.id,
              proposalId: proposal.id!,
              requestId: crypto.randomUUID(),
              expectedRevision: data.draftRevision,
              actorId,
              reviewedFingerprint: proposal.inputFingerprint,
            })
          }
        >
          <Check />
          {t("applyProposal")}
        </Button>
      </footer>
    </PlanningDialog>
  )
}

function ProposalChangeTimeline({
  before,
  after,
}: {
  before?: PlanningShift
  after?: PlanningShift
}) {
  const t = useTranslations("planning")
  const shifts = [before, after].filter((shift): shift is PlanningShift =>
    Boolean(shift)
  )
  if (!shifts.length) return null
  const earliest = Math.min(...shifts.map((shift) => minutes(shift.startTime)))
  const latest = Math.max(...shifts.map((shift) => minutes(shift.endTime)))
  const start = Math.max(0, Math.floor(earliest / 60) * 60 - 60)
  const end = Math.min(24 * 60, Math.ceil(latest / 60) * 60 + 60)
  const bounds = { start, end, span: Math.max(60, end - start) }
  return (
    <div className="mt-3 rounded-lg border bg-muted/20 p-2">
      <div className="relative ml-16 h-5 text-[10px] text-muted-foreground">
        {timelineTicks(bounds).map((tick) => (
          <span
            key={tick}
            className="absolute -translate-x-1/2"
            style={{ left: `${((tick - bounds.start) / bounds.span) * 100}%` }}
          >
            {timeLabel(tick)}
          </span>
        ))}
      </div>
      {(
        [
          {
            label: t("before"),
            shift: before,
            className: "border-dashed bg-muted",
          },
          {
            label: t("after"),
            shift: after,
            className: "border-primary bg-primary/20",
          },
        ] as const
      ).map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[3.5rem_1fr] items-center gap-2"
        >
          <span className="text-xs text-muted-foreground">{row.label}</span>
          <div className="relative h-8 border-r border-l">
            {row.shift ? (
              <div
                className={classes(
                  "absolute inset-y-1 overflow-hidden rounded border px-2 text-[11px] leading-6",
                  row.className
                )}
                style={position(row.shift.startTime, row.shift.endTime, bounds)}
              >
                {row.shift.date} · {row.shift.startTime}-{row.shift.endTime}
              </div>
            ) : (
              <span className="absolute inset-0 flex items-center px-2 text-xs text-muted-foreground">
                {row.label === t("before") ? t("none") : t("removed")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function WeeklyBudgets({ data }: { data: PeriodViewData }) {
  const t = useTranslations("planning")
  return (
    <section className="rounded-xl border p-4">
      <h2 className="font-semibold">{t("weeklyBudgets")}</h2>
      <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">
        {data.weeklyBudgets.map((item) => {
          const person = data.staff.find((staff) => staff.id === item.staffId)
          const used = item.shiftMinutes + item.attendanceMinutes
          return (
            <div key={`${item.staffId}-${item.week}`}>
              <div className="flex justify-between gap-2 text-xs">
                <span>
                  {person?.firstName} · {item.week}
                </span>
                <span>
                  {Math.round((used / 60) * 10) / 10}/{item.maxMinutes / 60}h
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={classes(
                    "h-full",
                    used > item.maxMinutes ? "bg-red-500" : "bg-primary"
                  )}
                  style={{
                    width: `${Math.min(100, item.maxMinutes ? (used / item.maxMinutes) * 100 : 0)}%`,
                  }}
                />
              </div>
              {item.attendanceMinutes ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("includesAttendance", {
                    hours: Math.round(item.attendanceMinutes / 6) / 10,
                  })}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HistoryPanel({ data }: { data: PeriodViewData }) {
  const t = useTranslations("planning")
  return (
    <section className="rounded-xl border p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <History className="size-4" />
        {t("versionHistory")}
      </h2>
      {data.history.length ? (
        <div className="mt-3 space-y-1">
          {data.history.map((item) => (
            <Button
              key={item.version}
              asChild
              variant={
                data.publishedVersion === item.version && data.readOnly
                  ? "secondary"
                  : "ghost"
              }
              className="w-full justify-between"
            >
              <Link
                href={`/planning/periods/${data.period.id}?version=${item.version}`}
              >
                <span>{t("version", { version: item.version })}</span>
                <span className="text-xs text-muted-foreground">
                  {t("shiftCount", { count: item.shiftCount })}
                </span>
              </Link>
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("noVersions")}</p>
      )}
    </section>
  )
}

function PlanningDialog({
  title,
  description,
  open = true,
  wide = false,
  onClose,
  children,
}: {
  title: string
  description: string
  open?: boolean
  wide?: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useTranslations("planning")
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35" />
        <DialogPrimitive.Content
          className={classes(
            "fixed bottom-4 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 overflow-y-auto rounded-xl border bg-background p-5 shadow-2xl focus:outline-none sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2",
            wide ? "max-w-3xl" : "max-w-lg"
          )}
        >
          <header className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("close")}
              >
                <X />
              </Button>
            </DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ConfirmDialog({
  title,
  description,
  confirm,
  destructive,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirm: string
  destructive?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const t = useTranslations("planning")
  return (
    <PlanningDialog title={title} description={description} onClose={onClose}>
      <div className="flex justify-end gap-2">
        <DialogPrimitive.Close asChild>
          <Button variant="ghost">{t("cancel")}</Button>
        </DialogPrimitive.Close>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
        >
          {confirm}
        </Button>
      </div>
    </PlanningDialog>
  )
}
