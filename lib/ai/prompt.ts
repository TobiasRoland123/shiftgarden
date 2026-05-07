import type { PlanningInput } from "./types"

export interface PlannerPrompt {
  system: string
  user: string
}

const SYSTEM_PROMPT = `You are a daycare shift scheduler. Given a planning input, produce a draft schedule that maximizes coverage while honoring all constraints.

Output rules:
- Respond ONLY with a JSON object matching the schema { "shifts": [{ "staffId": string, "groupId": string, "start": string, "end": string }] }.
- Every "start" and "end" MUST be a UTC ISO 8601 timestamp ending in "Z" (no offsets).
- "staffId" must be one of the provided staff IDs; "groupId" must be one of the provided group IDs.
- Do not include any prose, comments, or extra fields.

Hard constraints (a plan that violates any of these is invalid):
1. Availability: every shift's [start, end) must lie fully inside one of the staff member's availability windows for that date.
2. Absences: a shift must not overlap any absence (sick / vacation / other) for that staff.
3. Weekly hours: total assigned hours per staff over the planning period must not exceed weeklyMaxHours.
4. Group staffing rules: for each group and each of its staffingRules windows, at least minStaff staff and at least minPedagoger pedagogues must be present throughout the window whenever the group is open.
5. Global ratios: while a group is open, staffing must satisfy minPedagogueRatio (pedagogues vs. total staff) and minStaffRatio (staff vs. expectedChildren).
6. Breaks: any continuous shift longer than breakThresholdHours must be split so each segment is <= breakThresholdHours, with a gap of at least breakMinutes between segments for the same staff.
7. No overlapping shifts for the same staff (across any group).

Soft objectives (best effort, in priority order):
- Maximize coverage of each group during its open hours.
- Use as much of each staff member's available hours as possible without exceeding weeklyMaxHours.
- Balance load fairly across staff.
- Minimize fragmentation (prefer fewer, longer shifts).`

export function buildPlannerPrompt(input: PlanningInput): PlannerPrompt {
  const user = `Planning input (JSON):\n${JSON.stringify(input)}\n\nReturn the schedule as { "shifts": [...] }.`
  return { system: SYSTEM_PROMPT, user }
}
