"use client"

import { useActionState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatStaffRole,
  formatWeekday,
  staffRoles,
  weekdayAvailability,
} from "@/lib/staff"
import { createStaff } from "./actions"

const initialCreateStaffState = {
  errors: [],
}

function StaffForm() {
  const locale = useLocale()
  const t = useTranslations("staff")
  const [state, formAction, isPending] = useActionState(
    createStaff,
    initialCreateStaffState
  )
  const errors = state?.errors ?? []

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-8">
      <input name="locale" type="hidden" value={locale} />

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
          <Input name="firstName" required autoComplete="given-name" />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.lastName")}
          <Input name="lastName" required autoComplete="family-name" />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.role")}
          <select
            name="role"
            required
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue=""
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
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input
            name="active"
            type="checkbox"
            defaultChecked
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
          {weekdayAvailability.map((day) => (
            <div
              key={day}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_140px_140px] sm:items-center"
            >
              <div className="text-sm font-medium">{formatWeekday(day, t)}</div>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                {t("form.startTime")}
                <Input name={`${day}-start`} type="time" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                {t("form.endTime")}
                <Input name={`${day}-end`} type="time" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  )
}

export { StaffForm }
