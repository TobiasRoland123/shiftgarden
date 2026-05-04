"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { groups, staffingRules } from "@/drizzle/schema"
import { requireAuth } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import {
  type GroupInput,
  type StaffingRuleInput,
  groupInputSchema,
  staffingRuleInputSchema,
} from "@/lib/validation/groups"

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return aStart < bEnd && bStart < aEnd
}

async function assertNoOverlap(
  groupId: string,
  weekday: number,
  startTime: string,
  endTime: string,
  excludeRuleId?: string
) {
  const existing = await db
    .select({
      id: staffingRules.id,
      startTime: staffingRules.startTime,
      endTime: staffingRules.endTime,
    })
    .from(staffingRules)
    .where(
      and(
        eq(staffingRules.groupId, groupId),
        eq(staffingRules.weekday, weekday)
      )
    )
  for (const row of existing) {
    if (excludeRuleId && row.id === excludeRuleId) continue
    if (timesOverlap(startTime, endTime, row.startTime, row.endTime)) {
      throw new Error("StaffingRule.overlap")
    }
  }
}

export async function createGroup(input: GroupInput) {
  await requireAuth()
  const data = groupInputSchema.parse(input)
  const [row] = await db
    .insert(groups)
    .values({
      name: data.name,
      openTime: data.openTime,
      closeTime: data.closeTime,
    })
    .returning({ id: groups.id })
  revalidatePath("/groups")
  return { id: row.id }
}

export async function updateGroup(id: string, input: GroupInput) {
  await requireAuth()
  const data = groupInputSchema.parse(input)
  await db
    .update(groups)
    .set({
      name: data.name,
      openTime: data.openTime,
      closeTime: data.closeTime,
    })
    .where(eq(groups.id, id))
  revalidatePath("/groups")
  revalidatePath(`/groups/${id}`)
}

export async function deleteGroup(id: string) {
  await requireAuth()
  await db.delete(groups).where(eq(groups.id, id))
  revalidatePath("/groups")
}

export async function createStaffingRule(input: StaffingRuleInput) {
  await requireAuth()
  const data = staffingRuleInputSchema.parse(input)
  await assertNoOverlap(
    data.groupId,
    data.weekday,
    data.startTime,
    data.endTime
  )
  const [row] = await db
    .insert(staffingRules)
    .values({
      groupId: data.groupId,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      minStaff: data.minStaff,
      minPedagoger: data.minPedagoger,
    })
    .returning({ id: staffingRules.id })
  revalidatePath(`/groups/${data.groupId}`)
  return { id: row.id }
}

export async function updateStaffingRule(
  id: string,
  input: StaffingRuleInput
) {
  await requireAuth()
  const data = staffingRuleInputSchema.parse(input)
  await assertNoOverlap(
    data.groupId,
    data.weekday,
    data.startTime,
    data.endTime,
    id
  )
  await db
    .update(staffingRules)
    .set({
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      minStaff: data.minStaff,
      minPedagoger: data.minPedagoger,
    })
    .where(
      and(eq(staffingRules.id, id), eq(staffingRules.groupId, data.groupId))
    )
  revalidatePath(`/groups/${data.groupId}`)
}

export async function deleteStaffingRule(id: string, groupId: string) {
  await requireAuth()
  await db
    .delete(staffingRules)
    .where(and(eq(staffingRules.id, id), eq(staffingRules.groupId, groupId)))
  revalidatePath(`/groups/${groupId}`)
}
