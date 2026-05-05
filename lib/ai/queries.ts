import { and, eq, gt, lt } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  absences,
  groups,
  planningRules,
  staff,
  staffAvailability,
  staffingRules,
} from "@/drizzle/schema"

type Database = typeof db

export function getActiveStaffWithAvailability(database: Database = db) {
  return database
    .select()
    .from(staff)
    .leftJoin(staffAvailability, eq(staffAvailability.staffId, staff.id))
    .where(eq(staff.active, true))
}

export function getGroupsWithStaffingRules(database: Database = db) {
  return database
    .select()
    .from(groups)
    .leftJoin(staffingRules, eq(staffingRules.groupId, groups.id))
}

export function getAbsencesInPeriod(
  periodStart: Date,
  periodEnd: Date,
  database: Database = db
) {
  return database
    .select()
    .from(absences)
    .where(
      and(lt(absences.startsAt, periodEnd), gt(absences.endsAt, periodStart))
    )
}

export async function getPlanningRules(database: Database = db) {
  const [row] = await database.select().from(planningRules).limit(1)
  return row ?? null
}

export type StaffWithAvailabilityRow = Awaited<
  ReturnType<typeof getActiveStaffWithAvailability>
>[number]
export type GroupWithRuleRow = Awaited<
  ReturnType<typeof getGroupsWithStaffingRules>
>[number]
export type AbsenceRow = Awaited<ReturnType<typeof getAbsencesInPeriod>>[number]
export type PlanningRulesRow = Awaited<ReturnType<typeof getPlanningRules>>
