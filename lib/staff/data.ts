import { asc } from "drizzle-orm"

import { db } from "@/lib/db"
import { staffMembers } from "@/lib/db/schema"

async function getStaffMembers() {
  return db
    .select()
    .from(staffMembers)
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
}

export { getStaffMembers }
