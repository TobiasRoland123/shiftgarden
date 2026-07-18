"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { groupStaffRules, institutionOpeningHours } from "@/lib/db/schema"
import {
  intervalFitsWithin,
  validateOpeningHours,
  type TimeInterval,
} from "@/lib/opening-hours"
import { daysOfWeek } from "@/lib/staff"

type OpeningHoursFormState = {
  errors: string[]
  saved?: boolean
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function getOpeningHoursRows(formData: FormData) {
  const errors: string[] = []
  const rows: TimeInterval[] = []

  for (const day of daysOfWeek) {
    const rowCount = Number(getString(formData, `${day}-interval-count`))

    if (!Number.isInteger(rowCount) || rowCount < 0) {
      errors.push("Opening-hours rows are invalid.")
      continue
    }

    for (let index = 0; index < rowCount; index += 1) {
      const startTime = getString(formData, `${day}-${index}-startTime`)
      const endTime = getString(formData, `${day}-${index}-endTime`)

      if (!startTime && !endTime) {
        continue
      }

      if (!startTime || !endTime) {
        errors.push("Opening-hours rows need both start and end time.")
        continue
      }

      rows.push({ dayOfWeek: day, startTime, endTime })
    }
  }

  return { errors: [...errors, ...validateOpeningHours(rows)], rows }
}

async function updateOpeningHours(
  _previousState: OpeningHoursFormState,
  formData: FormData
): Promise<OpeningHoursFormState> {
  const openingHours = getOpeningHoursRows(formData)

  if (openingHours.errors.length > 0) {
    return { errors: openingHours.errors }
  }

  const rules = await db
    .select({
      dayOfWeek: groupStaffRules.dayOfWeek,
      startTime: groupStaffRules.startTime,
      endTime: groupStaffRules.endTime,
    })
    .from(groupStaffRules)
  const uncoveredRule = rules.find(
    (rule) => !intervalFitsWithin(rule, openingHours.rows)
  )

  if (uncoveredRule) {
    return {
      errors: [
        `Opening hours must contain every staffing rule. Check ${uncoveredRule.dayOfWeek} ${uncoveredRule.startTime.slice(0, 5)}-${uncoveredRule.endTime.slice(0, 5)}.`,
      ],
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(institutionOpeningHours)
    if (openingHours.rows.length > 0) {
      await tx.insert(institutionOpeningHours).values(openingHours.rows)
    }
  })

  revalidatePath("/settings/opening-hours")
  return { errors: [], saved: true }
}

export { updateOpeningHours }
