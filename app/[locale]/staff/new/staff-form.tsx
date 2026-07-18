"use client"

import { startTransition, useActionState, useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useForm } from "react-hook-form"

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

type AvailabilityFieldName = `${(typeof weekdayAvailability)[number]}-${
  | "start"
  | "end"}`

type StaffFormFields = {
  firstName: string
  lastName: string
  role: string
  maxHoursPerWeek: string
  active: boolean
} & Record<AvailabilityFieldName, string>

function getDefaultValues(
  initialValues: StaffFormInitialValues | undefined,
  availabilityByDay: Map<string, StaffFormAvailability>
): StaffFormFields {
  return {
    firstName: initialValues?.firstName ?? "",
    lastName: initialValues?.lastName ?? "",
    role: initialValues?.role ?? "",
    maxHoursPerWeek: initialValues?.maxHoursPerWeek?.toString() ?? "",
    active: initialValues?.active ?? true,
    ...Object.fromEntries(
      weekdayAvailability.flatMap((day) => {
        const availability = availabilityByDay.get(day)

        return [
          [
            `${day}-start`,
            toTimeInputValue(availability?.startAvailabilityTime) ?? "",
          ],
          [
            `${day}-end`,
            toTimeInputValue(availability?.endAvailabilityTime) ?? "",
          ],
        ]
      })
    ),
  } as StaffFormFields
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
  const defaultValues = useMemo(
    () => getDefaultValues(initialValues, availabilityByDay),
    [initialValues, availabilityByDay]
  )
  const {
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<StaffFormFields>({ defaultValues })
  const shouldTrackChanges = Boolean(initialValues?.id)
  const submitForm = handleSubmit((_fields, event) => {
    const form = event?.target

    if (form instanceof HTMLFormElement) {
      startTransition(() => formAction(new FormData(form)))
    }
  })

  return (
    <form
      action={formAction}
      className="flex max-w-3xl flex-col gap-8"
      onSubmit={submitForm}
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
            {...register("firstName")}
            required
            autoComplete="given-name"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.lastName")}
          <Input
            {...register("lastName")}
            required
            autoComplete="family-name"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("form.role")}
          <select
            {...register("role")}
            required
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            {...register("maxHoursPerWeek")}
            type="number"
            required
            min={1}
            step={1}
            inputMode="numeric"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input
            {...register("active")}
            type="checkbox"
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
                  <Input {...register(`${day}-start`)} type="time" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  {t("form.endTime")}
                  <Input {...register(`${day}-end`)} type="time" />
                </label>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={isPending || (shouldTrackChanges && !isDirty)}
        >
          {isPending ? t("form.saving") : t("form.save")}
        </Button>
      </div>
    </form>
  )
}

export { StaffForm }
