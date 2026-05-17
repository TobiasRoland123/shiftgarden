"use client"

import { useActionState, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatStaffRole,
  formatWeekday,
  isWeekdayAvailability,
  staffRoles,
  weekdayAvailability,
} from "@/lib/staff"
import { createStaff } from "./actions"

type StaffFormState = {
  errors: string[]
}

const initialCreateStaffState: StaffFormState = {
  errors: [],
}

type StaffFormAction = (
  previousState: StaffFormState,
  formData: FormData
) => Promise<StaffFormState>

type StaffFormAvailability = {
  dayOfWeek: string
  startAvailabilityTime: string
  endAvailabilityTime: string
}

type StaffFormInitialValues = {
  id?: string
  firstName?: string
  lastName?: string
  role?: (typeof staffRoles)[number]
  maxHoursPerWeek?: number
  active?: boolean
  availability?: StaffFormAvailability[]
}

type StaffFormProps = {
  action?: StaffFormAction
  initialValues?: StaffFormInitialValues
}

function toTimeInputValue(time?: string) {
  return time?.slice(0, 5)
}

type StaffFormSnapshot = {
  firstName: string
  lastName: string
  role: string
  maxHoursPerWeek: string
  active: boolean
  availability: Record<(typeof weekdayAvailability)[number], string>
}

function getInitialSnapshot(
  initialValues: StaffFormInitialValues | undefined,
  availabilityByDay: Map<string, StaffFormAvailability>
): StaffFormSnapshot {
  return {
    firstName: initialValues?.firstName ?? "",
    lastName: initialValues?.lastName ?? "",
    role: initialValues?.role ?? "",
    maxHoursPerWeek: initialValues?.maxHoursPerWeek?.toString() ?? "",
    active: initialValues?.active ?? true,
    availability: Object.fromEntries(
      weekdayAvailability.map((day) => {
        const availability = availabilityByDay.get(day)

        return [
          day,
          `${toTimeInputValue(availability?.startAvailabilityTime) ?? ""}-${
            toTimeInputValue(availability?.endAvailabilityTime) ?? ""
          }`,
        ]
      })
    ) as StaffFormSnapshot["availability"],
  }
}

function getCurrentSnapshot(form: HTMLFormElement): StaffFormSnapshot {
  const formData = new FormData(form)

  return {
    firstName: formData.get("firstName")?.toString() ?? "",
    lastName: formData.get("lastName")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? "",
    maxHoursPerWeek: formData.get("maxHoursPerWeek")?.toString() ?? "",
    active: formData.get("active") === "on",
    availability: Object.fromEntries(
      weekdayAvailability.map((day) => [
        day,
        `${formData.get(`${day}-start`)?.toString() ?? ""}-${
          formData.get(`${day}-end`)?.toString() ?? ""
        }`,
      ])
    ) as StaffFormSnapshot["availability"],
  }
}

function hasSnapshotChanges(
  currentSnapshot: StaffFormSnapshot,
  initialSnapshot: StaffFormSnapshot
) {
  return JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot)
}

function StaffForm({ action = createStaff, initialValues }: StaffFormProps) {
  const locale = useLocale()
  const t = useTranslations("staff")
  const [state, formAction, isPending] = useActionState(
    action,
    initialCreateStaffState
  )
  const errors = state?.errors ?? []
  const availabilityByDay = useMemo(
    () =>
      new Map(
        initialValues?.availability
          ?.filter((row) => isWeekdayAvailability(row.dayOfWeek))
          .map((row) => [row.dayOfWeek, row]) ?? []
      ),
    [initialValues?.availability]
  )
  const initialSnapshot = useMemo(
    () => getInitialSnapshot(initialValues, availabilityByDay),
    [initialValues, availabilityByDay]
  )
  const shouldTrackChanges = Boolean(initialValues?.id)
  const [hasChanges, setHasChanges] = useState(!shouldTrackChanges)

  function updateHasChanges(form: HTMLFormElement) {
    if (!shouldTrackChanges) {
      return
    }

    setHasChanges(hasSnapshotChanges(getCurrentSnapshot(form), initialSnapshot))
  }

  return (
    <form
      action={formAction}
      className="flex max-w-3xl flex-col gap-8"
      onChange={(event) => updateHasChanges(event.currentTarget)}
      onInput={(event) => updateHasChanges(event.currentTarget)}
    >
      <input name="locale" type="hidden" value={locale} />
      {initialValues?.id ? (
        <input name="staffMemberId" type="hidden" value={initialValues.id} />
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

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="font-medium">{t("form.detailsTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("form.detailsDescription")}
          </p>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.firstName")}
          <Input
            name="firstName"
            required
            autoComplete="given-name"
            defaultValue={initialValues?.firstName}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.lastName")}
          <Input
            name="lastName"
            required
            autoComplete="family-name"
            defaultValue={initialValues?.lastName}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.role")}
          <select
            name="role"
            required
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue={initialValues?.role ?? ""}
          >
            <option value="" disabled>
              {t("form.chooseRole")}
            </option>
            {staffRoles.map((role) => (
              <option key={role} value={role}>
                {formatStaffRole(role, t)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.maxHours")}
          <Input
            name="maxHoursPerWeek"
            type="number"
            required
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={initialValues?.maxHoursPerWeek}
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input
            name="active"
            type="checkbox"
            defaultChecked={initialValues?.active ?? true}
            className="size-4 rounded border-input"
          />
          {t("form.active")}
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">{t("form.availabilityTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("form.availabilityDescription")}
          </p>
        </div>

        <div className="grid gap-3">
          {weekdayAvailability.map((day) => {
            const availability = availabilityByDay.get(day)

            return (
              <div
                key={day}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_140px_140px] sm:items-center"
              >
                <div className="text-sm font-medium">
                  {formatWeekday(day, t)}
                </div>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("form.startTime")}
                  <Input
                    name={`${day}-start`}
                    type="time"
                    defaultValue={toTimeInputValue(
                      availability?.startAvailabilityTime
                    )}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("form.endTime")}
                  <Input
                    name={`${day}-end`}
                    type="time"
                    defaultValue={toTimeInputValue(
                      availability?.endAvailabilityTime
                    )}
                  />
                </label>
              </div>
            )
          })}
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

export { StaffForm }
