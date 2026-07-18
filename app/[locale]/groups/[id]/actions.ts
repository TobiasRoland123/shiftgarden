"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { groups, staffMemberGroups, staffMembers } from "@/lib/db/schema"

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

async function linkGroupToStaff(formData: FormData) {
  const groupId = getString(formData, "groupId")
  const staffMemberId = getString(formData, "staffMemberId")

  if (!uuidPattern.test(groupId) || !uuidPattern.test(staffMemberId)) {
    return
  }

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)
  const [staffMember] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(
      and(eq(staffMembers.id, staffMemberId), eq(staffMembers.active, true))
    )
    .limit(1)

  if (!group || !staffMember) {
    return
  }

  await db
    .insert(staffMemberGroups)
    .values({ staffMemberId, groupId })
    .onConflictDoNothing()

  revalidateMembershipPaths()
}

async function unlinkGroupFromStaff(formData: FormData) {
  const groupId = getString(formData, "groupId")
  const staffMemberId = getString(formData, "staffMemberId")

  if (!uuidPattern.test(groupId) || !uuidPattern.test(staffMemberId)) {
    return
  }

  await db
    .delete(staffMemberGroups)
    .where(
      and(
        eq(staffMemberGroups.groupId, groupId),
        eq(staffMemberGroups.staffMemberId, staffMemberId)
      )
    )

  revalidateMembershipPaths()
}

export { linkGroupToStaff, unlinkGroupFromStaff }
