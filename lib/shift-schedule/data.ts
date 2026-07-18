import { and, asc, eq, inArray, ne } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  groups,
  groupStaffRules,
  shiftSchedulePlans,
  shiftScheduleShifts,
  staffMemberAvailability,
  staffMemberGroups,
  staffMembers,
} from "@/lib/db/schema"
import { buildScheduleInput } from "@/lib/shift-schedule/build"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import type { ActivePlanShift } from "@/lib/shift-schedule/cross-group-conflicts"

type GroupRecord = {
  id: string
  name: string
}

async function getScheduleInputForGroup(
  selectedGroup: GroupRecord
): Promise<ScheduleInput> {
  const linkedStaff = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
      active: staffMembers.active,
    })
    .from(staffMemberGroups)
    .innerJoin(
      staffMembers,
      eq(staffMemberGroups.staffMemberId, staffMembers.id)
    )
    .where(eq(staffMemberGroups.groupId, selectedGroup.id))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))

  const linkedStaffIds = linkedStaff.map((staffMember) => staffMember.id)
  const availability =
    linkedStaffIds.length > 0
      ? await db
          .select({
            staffMemberId: staffMemberAvailability.staffMemberId,
            dayOfWeek: staffMemberAvailability.dayOfWeek,
            startAvailabilityTime:
              staffMemberAvailability.startAvailabilityTime,
            endAvailabilityTime: staffMemberAvailability.endAvailabilityTime,
          })
          .from(staffMemberAvailability)
          .where(inArray(staffMemberAvailability.staffMemberId, linkedStaffIds))
          .orderBy(
            asc(staffMemberAvailability.dayOfWeek),
            asc(staffMemberAvailability.startAvailabilityTime)
          )
      : []

  const rules = await db
    .select({
      dayOfWeek: groupStaffRules.dayOfWeek,
      startTime: groupStaffRules.startTime,
      endTime: groupStaffRules.endTime,
      minPedagogs: groupStaffRules.minPedagogs,
      minStaff: groupStaffRules.minStaff,
    })
    .from(groupStaffRules)
    .where(eq(groupStaffRules.groupId, selectedGroup.id))
    .orderBy(asc(groupStaffRules.dayOfWeek), asc(groupStaffRules.startTime))

  return buildScheduleInput({
    group: selectedGroup,
    linkedStaff,
    availability,
    rules,
  })
}

async function getScheduleInputByGroupId(
  groupId: string
): Promise<ScheduleInput | undefined> {
  const [selectedGroup] = await db
    .select({
      id: groups.id,
      name: groups.name,
    })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!selectedGroup) {
    return undefined
  }

  return getScheduleInputForGroup(selectedGroup)
}

async function getActivePlanShiftsForWeek({
  database = db,
  excludedGroupId,
  staffIds,
  weekStart,
}: {
  database?: Pick<typeof db, "select">
  excludedGroupId: string
  staffIds: string[]
  weekStart: string
}): Promise<ActivePlanShift[]> {
  if (staffIds.length === 0) {
    return []
  }

  return database
    .select({
      dayOfWeek: shiftScheduleShifts.dayOfWeek,
      endTime: shiftScheduleShifts.endTime,
      groupId: shiftSchedulePlans.groupId,
      groupName: groups.name,
      planId: shiftSchedulePlans.id,
      staffId: shiftScheduleShifts.staffMemberId,
      startTime: shiftScheduleShifts.startTime,
    })
    .from(shiftScheduleShifts)
    .innerJoin(
      shiftSchedulePlans,
      eq(shiftScheduleShifts.planId, shiftSchedulePlans.id)
    )
    .innerJoin(groups, eq(shiftSchedulePlans.groupId, groups.id))
    .where(
      and(
        eq(shiftSchedulePlans.weekStart, weekStart),
        eq(shiftSchedulePlans.status, "active"),
        ne(shiftSchedulePlans.groupId, excludedGroupId),
        inArray(shiftScheduleShifts.staffMemberId, staffIds)
      )
    )
}

export {
  getActivePlanShiftsForWeek,
  getScheduleInputByGroupId,
  getScheduleInputForGroup,
}
