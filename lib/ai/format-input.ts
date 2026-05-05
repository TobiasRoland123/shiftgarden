import { fromZonedTime } from "date-fns-tz"

import {
  getAbsencesInPeriod,
  getActiveStaffWithAvailability,
  getGroupsWithStaffingRules,
  getPlanningRules,
  type AbsenceRow,
  type GroupWithRuleRow,
  type StaffWithAvailabilityRow,
} from "@/lib/ai/queries"
import {
  planningInputSchema,
  type AbsenceEntry,
  type GroupEntry,
  type PlanningAvailabilityWindow,
  type PlanningInput,
  type StaffEntry,
} from "@/lib/ai/types"

type StaffRow = StaffWithAvailabilityRow["staff"]
type AvailabilityRow = NonNullable<
  StaffWithAvailabilityRow["staff_availability"]
>
type GroupRow = GroupWithRuleRow["groups"]
type StaffingRuleRow = NonNullable<GroupWithRuleRow["staffing_rules"]>

export async function formatInput(
  periodStart: Date,
  periodEnd: Date,
  timezone: string
): Promise<PlanningInput> {
  if (periodStart >= periodEnd) {
    throw new Error("formatInput: periodStart must be before periodEnd")
  }

  const [staffRows, groupRows, absenceRows, planningRulesRow] =
    await Promise.all([
      getActiveStaffWithAvailability(),
      getGroupsWithStaffingRules(),
      getAbsencesInPeriod(periodStart, periodEnd),
      getPlanningRules(),
    ])

  if (!planningRulesRow) {
    throw new Error("formatInput: planning_rules row is missing")
  }

  const staffById = collapseStaff(staffRows)
  const groupById = collapseGroups(groupRows)
  const absencesByStaff = groupAbsencesByStaff(absenceRows)

  const staff: StaffEntry[] = []
  const availability: PlanningAvailabilityWindow[] = []
  const includedStaffIds = new Set<string>()

  for (const {
    staff: staffRow,
    availability: availabilityRows,
  } of staffById.values()) {
    if (!staffRow.active) continue

    const staffAbsences = absencesByStaff.get(staffRow.id) ?? []
    if (isFullyAbsent(staffAbsences, periodStart, periodEnd)) continue

    includedStaffIds.add(staffRow.id)

    staff.push({
      id: staffRow.id,
      name: staffRow.name,
      role: staffRow.role,
      weeklyMaxHours: staffRow.weeklyMaxHours,
    })

    availability.push(
      ...expandAvailability(
        staffRow.id,
        availabilityRows,
        periodStart,
        periodEnd,
        timezone
      )
    )
  }

  const absences: AbsenceEntry[] = absenceRows
    .filter((a) => includedStaffIds.has(a.staffId))
    .map((a) => ({
      staffId: a.staffId,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      type: a.type,
    }))

  const groups: GroupEntry[] = [...groupById.values()].map(
    ({ group, staffingRules }) => ({
      id: group.id,
      name: group.name,
      openTime: group.openTime,
      closeTime: group.closeTime,
      // TODO: confirm expectedChildren shape — schema is jsonb, currently typed as number
      expectedChildren: group.expectedChildren as number,
      staffingRules: staffingRules.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        minStaff: r.minStaff,
        minPedagoger: r.minPedagoger,
      })),
    })
  )

  const payload: PlanningInput = {
    period: {
      startUtc: periodStart.toISOString(),
      endUtc: periodEnd.toISOString(),
    },
    staff,
    availability,
    absences,
    groups,
    rules: {
      minPedagogueRatio: planningRulesRow.minPedagogueRatio,
      minStaffRatio: planningRulesRow.minStaffRatio,
      breakMinutes: planningRulesRow.breakMinutes,
      breakThresholdHours: planningRulesRow.breakThresholdHours,
    },
  }

  return planningInputSchema.parse(payload)
}

function collapseStaff(rows: StaffWithAvailabilityRow[]) {
  const map = new Map<
    string,
    { staff: StaffRow; availability: AvailabilityRow[] }
  >()
  for (const row of rows) {
    const existing = map.get(row.staff.id)
    if (existing) {
      if (row.staff_availability)
        existing.availability.push(row.staff_availability)
    } else {
      map.set(row.staff.id, {
        staff: row.staff,
        availability: row.staff_availability ? [row.staff_availability] : [],
      })
    }
  }
  return map
}

function collapseGroups(rows: GroupWithRuleRow[]) {
  const map = new Map<
    string,
    { group: GroupRow; staffingRules: StaffingRuleRow[] }
  >()
  for (const row of rows) {
    const existing = map.get(row.groups.id)
    if (existing) {
      if (row.staffing_rules) existing.staffingRules.push(row.staffing_rules)
    } else {
      map.set(row.groups.id, {
        group: row.groups,
        staffingRules: row.staffing_rules ? [row.staffing_rules] : [],
      })
    }
  }
  return map
}

function groupAbsencesByStaff(rows: AbsenceRow[]) {
  const map = new Map<string, AbsenceRow[]>()
  for (const row of rows) {
    const list = map.get(row.staffId)
    if (list) list.push(row)
    else map.set(row.staffId, [row])
  }
  return map
}

function isFullyAbsent(
  absences: AbsenceRow[],
  periodStart: Date,
  periodEnd: Date
): boolean {
  const overlappingAbsences = absences
    .filter((a) => a.endsAt >= periodStart && a.startsAt <= periodEnd)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  if (overlappingAbsences.length === 0) return false
  if (overlappingAbsences[0]!.startsAt > periodStart) return false

  let coveredUntil = overlappingAbsences[0]!.endsAt
  if (coveredUntil >= periodEnd) return true

  for (let i = 1; i < overlappingAbsences.length; i++) {
    const absence = overlappingAbsences[i]!
    if (absence.startsAt > coveredUntil) return false
    if (absence.endsAt > coveredUntil) coveredUntil = absence.endsAt
    if (coveredUntil >= periodEnd) return true
  }

  return false
}

function expandAvailability(
  staffId: string,
  rows: AvailabilityRow[],
  periodStart: Date,
  periodEnd: Date,
  timezone: string
): PlanningAvailabilityWindow[] {
  if (rows.length === 0) return []

  const byWeekday = new Map<number, AvailabilityRow[]>()
  for (const row of rows) {
    const list = byWeekday.get(row.weekday)
    if (list) list.push(row)
    else byWeekday.set(row.weekday, [row])
  }

  const out: PlanningAvailabilityWindow[] = []
  for (const dateStr of eachLocalDate(periodStart, periodEnd, timezone)) {
    const weekday = isoMondayZeroWeekday(dateStr)
    const matches = byWeekday.get(weekday)
    if (!matches) continue

    for (const row of matches) {
      const startUtc = fromZonedTime(
        `${dateStr}T${normalizeTime(row.startTime)}`,
        timezone
      ).toISOString()
      const endUtc = fromZonedTime(
        `${dateStr}T${normalizeTime(row.endTime)}`,
        timezone
      ).toISOString()

      // Skip windows that fall entirely outside the planning period.
      if (Date.parse(endUtc) <= periodStart.getTime()) continue
      if (Date.parse(startUtc) >= periodEnd.getTime()) continue

      out.push({ staffId, date: dateStr, startUtc, endUtc })
    }
  }

  return out
}

function eachLocalDate(
  periodStart: Date,
  periodEnd: Date,
  timezone: string
): string[] {
  const startStr = formatLocalDate(periodStart, timezone)
  // periodEnd is exclusive; use the instant just before it to find the last
  // local date that has any overlap with the period.
  const endStr = formatLocalDate(new Date(periodEnd.getTime() - 1), timezone)

  const dates: string[] = []
  let cursor = startStr
  while (cursor <= endStr) {
    dates.push(cursor)
    cursor = addOneDay(cursor)
  }
  return dates
}

function formatLocalDate(date: Date, timezone: string): string {
  // Intl gives us the wall-clock date in the target timezone without DST land mines.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const y = parts.find((p) => p.type === "year")!.value
  const m = parts.find((p) => p.type === "month")!.value
  const d = parts.find((p) => p.type === "day")!.value
  return `${y}-${m}-${d}`
}

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d))
  next.setUTCDate(next.getUTCDate() + 1)
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

function isoMondayZeroWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // Sun=0, Mon=1...
  return (jsDay + 6) % 7 // Mon=0 ... Sun=6
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
