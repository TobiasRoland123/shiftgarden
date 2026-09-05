"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"

import { groups, staffMemberGroups, staffMembers } from "@/lib/db/schema"
import {
  touchPlanningSources,
  withPlanningCoordination,
} from "@/lib/planning/source-coordination"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function revalidateMembershipPaths() {
  revalidatePath("/[locale]/staff/[id]", "page")
  revalidatePath("/[locale]/groups/[id]", "page")
}

async function linkStaffToGroup(formData: FormData) {
  const staffMemberId = getString(formData, "staffMemberId")
  const groupId = getString(formData, "groupId")

  if (!uuidPattern.test(staffMemberId) || !uuidPattern.test(groupId)) {
    return
  }

  await withPlanningCoordination(async (tx) => {
    const [staffMember] = await tx
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.id, staffMemberId))
      .limit(1)
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1)
    if (!staffMember || !group) return
    await tx
      .insert(staffMemberGroups)
      .values({ staffMemberId, groupId })
      .onConflictDoNothing()
    await touchPlanningSources(
      [
        {
          sourceType: "staff_membership",
          sourceId: `${staffMemberId}:${groupId}`,
        },
        { sourceType: "staff", sourceId: staffMemberId },
        { sourceType: "group", sourceId: groupId },
      ],
      tx
    )
  })

  revalidateMembershipPaths()
}

async function unlinkStaffFromGroup(formData: FormData) {
  const staffMemberId = getString(formData, "staffMemberId")
  const groupId = getString(formData, "groupId")

  if (!uuidPattern.test(staffMemberId) || !uuidPattern.test(groupId)) {
    return
  }

  await withPlanningCoordination(async (tx) => {
    await tx
      .delete(staffMemberGroups)
      .where(
        and(
          eq(staffMemberGroups.staffMemberId, staffMemberId),
          eq(staffMemberGroups.groupId, groupId)
        )
      )
    await touchPlanningSources(
      [
        {
          sourceType: "staff_membership",
          sourceId: `${staffMemberId}:${groupId}`,
        },
        { sourceType: "staff", sourceId: staffMemberId },
        { sourceType: "group", sourceId: groupId },
      ],
      tx
    )
  })

  revalidateMembershipPaths()
}

export { linkStaffToGroup, unlinkStaffFromGroup }
