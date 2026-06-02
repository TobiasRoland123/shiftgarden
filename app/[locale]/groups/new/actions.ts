"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { redirect } from "@/i18n/navigation"
import { defaultLocale, locales, type Locale } from "@/i18n/routing"
import { db } from "@/lib/db"
import { groups, groupStaffRules } from "@/lib/db/schema"
import { isWeekdayAvailability, weekdayAvailability } from "@/lib/groups"

type GroupFormState = {
  errors: string[]
}

type GroupStaffRuleRow = {
  dayOfWeek: (typeof weekdayAvailability)[number]
  startTime: string
  endTime: string
  minPedagogs: number
  minStaff: number
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function getLocale(formData: FormData): Locale {
  const locale = getString(formData, "locale")

  if (locales.includes(locale as Locale)) {
    return locale as Locale
  }

  return defaultLocale
}

function getPositiveWholeNumber(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getGroupStaffRuleRows(formData: FormData) {
  const errors: string[] = []
  const rows: GroupStaffRuleRow[] = []

  for (const day of weekdayAvailability) {
    const rowCount = Number(getString(formData, `${day}-rule-count`))

    if (!Number.isInteger(rowCount) || rowCount < 0) {
      errors.push("Rule rows are invalid.")
      continue
    }

    for (let index = 0; index < rowCount; index += 1) {
      const startTime = getString(formData, `${day}-${index}-startTime`)
      const endTime = getString(formData, `${day}-${index}-endTime`)
      const minPedagogsValue = getString(
        formData,
        `${day}-${index}-minPedagogs`
      )
      const minStaffValue = getString(formData, `${day}-${index}-minStaff`)
      const hasAnyValue =
        startTime || endTime || minPedagogsValue || minStaffValue

      if (!hasAnyValue) {
        continue
      }

      if (!startTime || !endTime || !minPedagogsValue || !minStaffValue) {
        errors.push("Staff rule rows need all fields filled in.")
        continue
      }

      if (endTime <= startTime) {
        errors.push("Staff rule end time must be after start time.")
        continue
      }

      const minPedagogs = getPositiveWholeNumber(minPedagogsValue)
      const minStaff = getPositiveWholeNumber(minStaffValue)

      if (minPedagogs === null || minStaff === null) {
        errors.push("Minimum staff counts must be positive whole numbers.")
        continue
      }

      if (minPedagogs > minStaff) {
        errors.push("Minimum pedagogs cannot be higher than minimum staff.")
        continue
      }

      if (!isWeekdayAvailability(day)) {
        continue
      }

      rows.push({
        dayOfWeek: day,
        startTime,
        endTime,
        minPedagogs,
        minStaff,
      })
    }
  }

  return { rows, errors }
}

async function createGroup(
  _previousState: GroupFormState,
  formData: FormData
): Promise<GroupFormState> {
  const locale = getLocale(formData)
  const name = getString(formData, "name")
  const rules = getGroupStaffRuleRows(formData)
  const errors = [...rules.errors]

  if (!name) {
    errors.push("Name is required.")
  }

  if (errors.length > 0) {
    return { errors }
  }

  const [createdGroup] = await db
    .insert(groups)
    .values({ name })
    .returning({ id: groups.id })

  if (rules.rows.length > 0) {
    await db.insert(groupStaffRules).values(
      rules.rows.map((row) => ({
        groupId: createdGroup.id,
        ...row,
      }))
    )
  }

  revalidatePath("/groups")
  if (locale !== defaultLocale) {
    revalidatePath(`/${locale}/groups`)
  }
  redirect({ href: `/groups/${createdGroup.id}`, locale })

  return { errors: [] }
}

async function updateGroup(
  _previousState: GroupFormState,
  formData: FormData
): Promise<GroupFormState> {
  const locale = getLocale(formData)
  const groupId = getString(formData, "groupId")
  const name = getString(formData, "name")
  const rules = getGroupStaffRuleRows(formData)
  const errors = [...rules.errors]

  if (!groupId) {
    errors.push("Group is required.")
  }

  if (!name) {
    errors.push("Name is required.")
  }

  if (errors.length > 0) {
    return { errors }
  }

  const [updatedGroup] = await db
    .update(groups)
    .set({ name })
    .where(eq(groups.id, groupId))
    .returning({ id: groups.id })

  if (!updatedGroup) {
    return { errors: ["Group could not be found."] }
  }

  await db.delete(groupStaffRules).where(eq(groupStaffRules.groupId, groupId))

  if (rules.rows.length > 0) {
    await db.insert(groupStaffRules).values(
      rules.rows.map((row) => ({
        groupId: updatedGroup.id,
        ...row,
      }))
    )
  }

  revalidatePath("/groups")
  revalidatePath(`/groups/${updatedGroup.id}`)
  revalidatePath(`/groups/${updatedGroup.id}/edit`)
  if (locale !== defaultLocale) {
    revalidatePath(`/${locale}/groups`)
    revalidatePath(`/${locale}/groups/${updatedGroup.id}`)
    revalidatePath(`/${locale}/groups/${updatedGroup.id}/edit`)
  }
  redirect({ href: `/groups/${updatedGroup.id}`, locale })

  return { errors: [] }
}

export { createGroup, updateGroup }
