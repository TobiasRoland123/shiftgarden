"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { staff, staffAvailability } from "@/drizzle/schema"
import { requireAuth } from "@/lib/auth-guard"
import {
  type SetAvailabilityInput,
  type StaffInput,
  setAvailabilityInputSchema,
  staffInputSchema,
} from "@/lib/validation/staff"

export async function createStaff(input: StaffInput) {
  await requireAuth()
  const data = staffInputSchema.parse(input)
  const [row] = await db
    .insert(staff)
    .values({
      name: data.name,
      email: data.email ? data.email : null,
      role: data.role,
      weeklyMaxHours: data.weeklyMaxHours,
      active: data.active,
    })
    .returning({ id: staff.id })
  revalidatePath("/staff")
  return { id: row.id }
}

export async function updateStaff(id: string, input: StaffInput) {
  await requireAuth()
  const data = staffInputSchema.parse(input)
  await db
    .update(staff)
    .set({
      name: data.name,
      email: data.email ? data.email : null,
      role: data.role,
      weeklyMaxHours: data.weeklyMaxHours,
      active: data.active,
    })
    .where(eq(staff.id, id))
  revalidatePath("/staff")
  revalidatePath(`/staff/${id}`)
}

export async function deactivateStaff(id: string) {
  await requireAuth()
  await db.update(staff).set({ active: false }).where(eq(staff.id, id))
  revalidatePath("/staff")
  revalidatePath(`/staff/${id}`)
}

export async function setAvailability(input: SetAvailabilityInput) {
  await requireAuth()
  const data = setAvailabilityInputSchema.parse(input)
  await db
    .delete(staffAvailability)
    .where(eq(staffAvailability.staffId, data.staffId))
  if (data.windows.length > 0) {
    await db.insert(staffAvailability).values(
      data.windows.map((w) => ({
        staffId: data.staffId,
        weekday: w.weekday,
        startTime: w.startTime,
        endTime: w.endTime,
      }))
    )
  }
  revalidatePath(`/staff/${data.staffId}`)
}
