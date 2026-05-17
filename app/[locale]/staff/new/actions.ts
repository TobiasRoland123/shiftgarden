"use server"

import { revalidatePath } from "next/cache"

import { redirect } from "@/i18n/navigation"
import { defaultLocale, locales, type Locale } from "@/i18n/routing"
import { db } from "@/lib/db"
import { staffMemberAvailability, staffMembers } from "@/lib/db/schema"
import {
  isStaffRole,
  isWeekdayAvailability,
  weekdayAvailability,
} from "@/lib/staff"

type CreateStaffState = {
  errors: string[]
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

function getAvailabilityRows(formData: FormData) {
  const errors: string[] = []
  const rows = weekdayAvailability.flatMap((day) => {
    const start = getString(formData, `${day}-start`)
    const end = getString(formData, `${day}-end`)

    if (!start && !end) {
      return []
    }

    if (!start || !end) {
      errors.push("Availability rows need both start and end time.")
      return []
    }

    if (end <= start) {
      errors.push("Availability end time must be after start time.")
      return []
    }

    if (!isWeekdayAvailability(day)) {
      return []
    }

    return [
      {
        dayOfWeek: day,
        startAvailabilityTime: start,
        endAvailabilityTime: end,
      },
    ]
  })

  return { rows, errors }
}

async function createStaff(
  _previousState: CreateStaffState,
  formData: FormData
): Promise<CreateStaffState> {
  const locale = getLocale(formData)
  const firstName = getString(formData, "firstName")
  const lastName = getString(formData, "lastName")
  const role = getString(formData, "role")
  const maxHoursPerWeek = Number(getString(formData, "maxHoursPerWeek"))
  const active = formData.get("active") === "on"
  const availability = getAvailabilityRows(formData)

  const errors = [...availability.errors]

  if (!firstName) {
    errors.push("First name is required.")
  }

  if (!lastName) {
    errors.push("Last name is required.")
  }

  if (!isStaffRole(role)) {
    errors.push("Choose a valid staff role.")
  }

  if (!Number.isInteger(maxHoursPerWeek) || maxHoursPerWeek <= 0) {
    errors.push("Max hours per week must be a positive whole number.")
  }

  if (errors.length > 0 || !isStaffRole(role)) {
    return { errors }
  }

  const [createdStaffMember] = await db
    .insert(staffMembers)
    .values({
      firstName,
      lastName,
      role,
      maxHoursPerWeek,
      active,
    })
    .returning({ id: staffMembers.id })

  if (availability.rows.length > 0) {
    await db.insert(staffMemberAvailability).values(
      availability.rows.map((row) => ({
        staffMemberId: createdStaffMember.id,
        ...row,
      }))
    )
  }

  revalidatePath("/staff")
  if (locale !== defaultLocale) {
    revalidatePath(`/${locale}/staff`)
  }
  redirect({ href: `/staff/${createdStaffMember.id}`, locale })

  return { errors: [] }
}

export { createStaff }
