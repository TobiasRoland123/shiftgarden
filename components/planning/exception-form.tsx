"use client"

import { ArrowLeft, Plus, RefreshCw, Save, Trash2, X } from "lucide-react"
import { FormEvent, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link, useRouter } from "@/i18n/navigation"
import type { ExceptionFormProps, PlanningExceptionSummary } from "./types"
import {
  dateLabel,
  localizedActionError,
  Notice,
  usePlanningLocale,
} from "./shared"

type Kind = NonNullable<ExceptionFormProps["existing"]>["kind"]
type Interval = { startTime: string; endTime: string }

const options: Record<ExceptionFormProps["ownerType"], Kind[]> = {
  institution: ["closure", "opening", "meeting", "training"],
  group: ["staffing", "meeting", "training"],
  staff: ["leave", "sickness", "unavailability", "meeting", "training"],
}

export function ExceptionForm({
  ownerType,
  ownerId,
  staff = [],
  returnHref,
  existing,
  onAction,
}: ExceptionFormProps) {
  const t = useTranslations("planning")
  const router = useRouter()
  const [kind, setKind] = useState<Kind>(
    existing?.kind ?? options[ownerType][0]
  )
  const [date, setDate] = useState(existing?.date ?? "")
  const [endDate, setEndDate] = useState(existing?.endDate ?? "")
  const [startTime, setStartTime] = useState(existing?.startTime ?? "")
  const [endTime, setEndTime] = useState(existing?.endTime ?? "")
  const [description, setDescription] = useState(existing?.description ?? "")
  const [counts, setCounts] = useState(
    existing?.countsTowardWeeklyHours ?? true
  )
  const [participants, setParticipants] = useState<string[]>(
    existing?.participantStaffIds ?? []
  )
  const [intervals, setIntervals] = useState<Interval[]>(
    existing?.openingIntervals?.length
      ? existing.openingIntervals
      : [{ startTime: "08:00", endTime: "16:00" }]
  )
  const [minStaff, setMinStaff] = useState(String(existing?.minStaff ?? 1))
  const [minPedagogs, setMinPedagogs] = useState(
    String(existing?.minPedagogs ?? 0)
  )
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const timed =
    kind === "unavailability" ||
    kind === "staffing" ||
    kind === "meeting" ||
    kind === "training"
  const event = kind === "meeting" || kind === "training"

  function submit(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault()
    if (!onAction) return
    if (!date || (endDate && endDate < date)) {
      setError(t("dateRangeError"))
      return
    }
    if (timed && (!startTime || !endTime || endTime <= startTime)) {
      setError(t("timeRangeError"))
      return
    }
    if (
      kind === "opening" &&
      intervals.some(
        (interval) =>
          !interval.startTime ||
          !interval.endTime ||
          interval.endTime <= interval.startTime
      )
    ) {
      setError(t("timeRangeError"))
      return
    }
    if (kind === "staffing" && Number(minPedagogs) > Number(minStaff)) {
      setError(t("pedagogMinimumError"))
      return
    }
    if (event && ownerType !== "staff" && !participants.length) {
      setError(t("participantRequired"))
      return
    }
    setError(undefined)
    startTransition(async () => {
      const result = await onAction({
        type: "saveException",
        exceptionId: existing?.id,
        expectedRevision: existing?.revision,
        ownerType,
        ownerId,
        kind,
        date,
        endDate: endDate || date,
        startTime: timed ? startTime : undefined,
        endTime: timed ? endTime : undefined,
        description: description || undefined,
        participantStaffIds: event ? participants : undefined,
        countsTowardWeeklyHours: event ? counts : undefined,
        openingIntervals: kind === "opening" ? intervals : undefined,
        minStaff: kind === "staffing" ? Number(minStaff) : undefined,
        minPedagogs: kind === "staffing" ? Number(minPedagogs) : undefined,
      })
      if (!result.ok) setError(localizedActionError(result, t))
      else router.push(returnHref as "/planning")
    })
  }

  function remove() {
    if (!onAction || !existing) return
    startTransition(async () => {
      const result = await onAction({
        type: "deleteException",
        exceptionId: existing.id,
        expectedRevision: existing.revision,
        ownerType,
        ownerId,
      })
      if (!result.ok) setError(localizedActionError(result, t))
      else router.push(returnHref as "/planning")
    })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 p-6 lg:p-10">
      <header>
        <Link
          href={returnHref as "/planning"}
          className="inline-flex min-h-12 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {existing ? t("editException") : t("addException")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("exceptionOwnerDescription", { owner: t(`owner.${ownerType}`) })}
        </p>
      </header>
      <form onSubmit={submit} className="space-y-6 rounded-xl border p-5">
        <fieldset>
          <legend className="text-sm font-medium">{t("exceptionType")}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {options[ownerType].map((option) => (
              <label
                key={option}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="kind"
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                />
                <span className="text-sm">{t(`exceptionKinds.${option}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            htmlFor="exception-date"
            className="space-y-1 text-sm font-medium"
          >
            {t("startDate")}
            <Input
              id="exception-date"
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-12 text-base"
            />
          </label>
          <label
            htmlFor="exception-end-date"
            className="space-y-1 text-sm font-medium"
          >
            {t("endDate")}
            <Input
              id="exception-end-date"
              name="endDate"
              type="date"
              min={date || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="min-h-12 text-base"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {t("sameDayHint")}
            </span>
          </label>
        </div>
        {timed ? (
          <fieldset>
            <legend className="text-sm font-medium">{t("timeInterval")}</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label htmlFor="exception-start" className="space-y-1 text-sm">
                {t("startTime")}
                <Input
                  id="exception-start"
                  name="startTime"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="min-h-12 text-base"
                />
              </label>
              <label htmlFor="exception-end" className="space-y-1 text-sm">
                {t("endTime")}
                <Input
                  id="exception-end"
                  name="endTime"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="min-h-12 text-base"
                />
              </label>
            </div>
          </fieldset>
        ) : null}
        {kind === "opening" ? (
          <fieldset>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-medium">
                {t("openingIntervals")}
              </legend>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setIntervals((current) => [
                    ...current,
                    { startTime: "08:00", endTime: "16:00" },
                  ])
                }
              >
                <Plus />
                {t("addInterval")}
              </Button>
            </div>
            <div className="mt-2 space-y-3">
              {intervals.map((interval, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <Input
                    aria-label={t("startTime")}
                    type="time"
                    required
                    value={interval.startTime}
                    onChange={(e) =>
                      setIntervals((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, startTime: e.target.value }
                            : item
                        )
                      )
                    }
                    className="min-h-12 text-base"
                  />
                  <Input
                    aria-label={t("endTime")}
                    type="time"
                    required
                    value={interval.endTime}
                    onChange={(e) =>
                      setIntervals((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, endTime: e.target.value }
                            : item
                        )
                      )
                    }
                    className="min-h-12 text-base"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("removeInterval")}
                    disabled={intervals.length === 1}
                    onClick={() =>
                      setIntervals((current) =>
                        current.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}
        {kind === "staffing" ? (
          <fieldset>
            <legend className="text-sm font-medium">
              {t("staffingMinimums")}
            </legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label htmlFor="min-staff" className="space-y-1 text-sm">
                {t("minimumStaff")}
                <Input
                  id="min-staff"
                  name="minStaff"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={minStaff}
                  onChange={(e) => setMinStaff(e.target.value)}
                  className="min-h-12 text-base"
                />
              </label>
              <label htmlFor="min-pedagogs" className="space-y-1 text-sm">
                {t("minimumPedagogs")}
                <Input
                  id="min-pedagogs"
                  name="minPedagogs"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={minPedagogs}
                  onChange={(e) => setMinPedagogs(e.target.value)}
                  className="min-h-12 text-base"
                />
              </label>
            </div>
          </fieldset>
        ) : null}
        <label
          htmlFor="exception-description"
          className="block space-y-1 text-sm font-medium"
        >
          {t("descriptionLabel")}
          <textarea
            id="exception-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className="min-h-24 w-full resize-y rounded-lg border bg-background px-3 py-2 text-base"
          />
        </label>
        {event ? (
          <>
            <label className="flex min-h-12 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={counts}
                onChange={(e) => setCounts(e.target.checked)}
              />
              {t("countsTowardHours")}
            </label>
            <fieldset>
              <legend className="text-sm font-medium">
                {t("participants")}
              </legend>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("participantsDescription")}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {staff.map((person) => (
                  <label
                    key={person.id}
                    className="flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={participants.includes(person.id)}
                      onChange={(e) =>
                        setParticipants((current) =>
                          e.target.checked
                            ? [...new Set([...current, person.id])]
                            : current.filter((id) => id !== person.id)
                        )
                      }
                    />
                    <span className="text-sm">
                      {person.firstName} {person.lastName}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}
        {error ? <Notice issue={error} /> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {existing ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={remove}
              >
                <Trash2 />
                {t("deleteException")}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button asChild variant="ghost">
              <Link href={returnHref as "/planning"}>{t("cancel")}</Link>
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <RefreshCw className="animate-spin" /> : <Save />}
              {t("saveException")}
            </Button>
          </div>
        </div>
      </form>
    </main>
  )
}

export function ExceptionList({
  items,
  baseHref,
  returnTo,
}: {
  items: PlanningExceptionSummary[]
  baseHref: string
  returnTo?: string
}) {
  const t = useTranslations("planning")
  const locale = usePlanningLocale()
  if (!items.length)
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        {t("noOwnerExceptions")}
      </p>
    )
  return (
    <div className="mt-4 divide-y rounded-lg border">
      {items.map((item) => (
        <Link
          key={item.id}
          href={
            returnTo
              ? {
                  pathname: `${baseHref}/exceptions/${item.id}` as "/planning",
                  query: { returnTo },
                }
              : (`${baseHref}/exceptions/${item.id}` as "/planning")
          }
          className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50"
        >
          <div>
            <div className="text-sm font-medium">
              {t(`exceptionKinds.${item.kind}`)}
            </div>
            <div className="text-xs text-muted-foreground">
              {dateLabel(item.date, locale)}
              {item.endDate !== item.date
                ? ` - ${dateLabel(item.endDate, locale)}`
                : ""}
              {item.startTime ? ` · ${item.startTime}-${item.endTime}` : ""}
            </div>
          </div>
          <span className="text-sm text-muted-foreground">{t("edit")}</span>
        </Link>
      ))}
    </div>
  )
}
