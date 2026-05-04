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
      uniformWeek: data.uniformWeek ?? false,
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
      uniformWeek: data.uniformWeek ?? false,
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
      minPedagogues: data.minPedagogues,
      templateId: data.templateId,
    })
    .returning({ id: staffingRules.id })
  revalidatePath(`/groups/${data.groupId}`)
  return { id: row.id }
}

export async function updateStaffingRule(id: string, input: StaffingRuleInput) {
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
      minPedagogues: data.minPedagogues,
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

export async function copyStaffingRulesToDays(
  groupId: string,
  sourceWeekday: number,
  targetWeekdays: number[]
) {
  await requireAuth()
  const source = await db
    .select()
    .from(staffingRules)
    .where(
      and(
        eq(staffingRules.groupId, groupId),
        eq(staffingRules.weekday, sourceWeekday)
      )
    )
  let copied = 0
  const conflicts: number[] = []
  for (const target of targetWeekdays) {
    let hasConflict = false
    for (const rule of source) {
      try {
        await assertNoOverlap(groupId, target, rule.startTime, rule.endTime)
        await db.insert(staffingRules).values({
          groupId,
          weekday: target,
          startTime: rule.startTime,
          endTime: rule.endTime,
          minStaff: rule.minStaff,
          minPedagogues: rule.minPedagogues,
          templateId: rule.templateId,
        })
        copied++
      } catch {
        hasConflict = true
      }
    }
    if (hasConflict) conflicts.push(target)
  }
  revalidatePath(`/groups/${groupId}`)
  return { copied, conflicts }
}

export async function createStaffingRuleForWholeWeek(input: StaffingRuleInput) {
  await requireAuth()
  const data = staffingRuleInputSchema.parse(input)
  for (let weekday = 0; weekday < 7; weekday++) {
    await assertNoOverlap(data.groupId, weekday, data.startTime, data.endTime)
  }
  const templateId = crypto.randomUUID()
  for (let weekday = 0; weekday < 7; weekday++) {
    await db.insert(staffingRules).values({
      groupId: data.groupId,
      weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      minStaff: data.minStaff,
      minPedagogues: data.minPedagogues,
      templateId,
    })
  }
  revalidatePath(`/groups/${data.groupId}`)
}

export async function updateStaffingRuleByTemplate(
  templateId: string,
  groupId: string,
  patch: Omit<StaffingRuleInput, "groupId" | "weekday">
) {
  await requireAuth()
  const rules = await db
    .select()
    .from(staffingRules)
    .where(
      and(
        eq(staffingRules.groupId, groupId),
        eq(staffingRules.templateId, templateId)
      )
    )
  for (const rule of rules) {
    await assertNoOverlap(
      groupId,
      rule.weekday,
      patch.startTime,
      patch.endTime,
      rule.id
    )
    await db
      .update(staffingRules)
      .set({
        startTime: patch.startTime,
        endTime: patch.endTime,
        minStaff: patch.minStaff,
        minPedagogues: patch.minPedagogues,
      })
      .where(eq(staffingRules.id, rule.id))
  }
  revalidatePath(`/groups/${groupId}`)
}

export async function deleteStaffingRulesByTemplate(
  templateId: string,
  groupId: string
) {
  await requireAuth()
  await db
    .delete(staffingRules)
    .where(
      and(
        eq(staffingRules.groupId, groupId),
        eq(staffingRules.templateId, templateId)
      )
    )
  revalidatePath(`/groups/${groupId}`)
}
