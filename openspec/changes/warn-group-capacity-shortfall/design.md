## Context

The group detail page currently loads the selected group, its staffing rules, linked staff, and active staff that can still be linked. It displays linked staff status and staffing rules, but it does not compare the group's weekly staffing demand against the linked staff members' weekly capacity.

The database already contains the required source data: `group_staff_rules.startTime`, `group_staff_rules.endTime`, `group_staff_rules.minStaff`, `staff_members.active`, `staff_members.maxHoursPerWeek`, and the `staff_member_groups` link table. The page's linked staff query needs to include `maxHoursPerWeek` before the calculation can run.

## Goals / Non-Goals

**Goals:**

- Calculate weekly staffing demand for a group from configured staffing rules.
- Calculate weekly available capacity from linked active staff members.
- Show a visible localized warning on the group detail page when capacity is lower than demand.
- Keep the calculation deterministic and independently testable.

**Non-Goals:**

- Prevent saving groups, staffing rules, or staff links that create a shortfall.
- Generate or modify shift schedules.
- Account for staff availability intervals, role-specific pedagog capacity, breaks, holidays, absences, or cross-group commitments.
- Change the database schema.

## Decisions

### Decision: Add a pure domain helper for the capacity calculation

Create a small helper, likely in `lib/groups.ts` or a nearby group-domain module, that accepts staffing rules and linked staff-like records and returns demand hours, capacity hours, and shortfall hours.

Rationale: The group detail page should remain mostly presentation and data loading. A pure helper keeps examples such as "5 weekdays from 06:00 to 17:00 with minStaff 3 equals 165 weekly demand hours" easy to unit test without rendering a Next.js server component.

Alternative considered: Inline the calculation in `app/[locale]/groups/[id]/page.tsx`. That would be quicker, but it would make the core business rule harder to test and reuse.

### Decision: Sum each staffing rule independently

Weekly demand should be the sum of every configured rule's duration multiplied by `minStaff`, regardless of whether rules overlap.

Rationale: The issue specifies `staffing rule duration * minimum staff count for each configured day`. The current schedule validation domain also treats overlapping staffing rules as independently required.

Alternative considered: Merge overlapping staffing-rule intervals before calculating demand. That would avoid double-counting overlaps, but it would also change the meaning of independently configured minimum staffing rules and would be inconsistent with existing schedule validation behavior.

### Decision: Capacity uses only linked active staff weekly max hours

Available weekly capacity should sum `maxHoursPerWeek` for staff members that are both linked to the group and active.

Rationale: The warning is about whether the current group setup has enough linked staff capacity. Inactive staff and unlinked active staff are not available to the group in that setup.

Alternative considered: Include all active staff that could be linked. That would hide the exact configuration problem the warning is meant to expose.

### Decision: Display the warning near the group header

Render a visible warning/error callout near the top of the group detail page when `shortfallHours > 0`, with the missing hours included in the message.

Rationale: The issue is visible from the group detail page and the warning should be noticed before users inspect staff or staffing-rule tables.

Alternative considered: Show the warning only inside the staff section. That places the warning closer to linked staff, but the shortfall is a group-level configuration problem involving both staff and rules.

## Risks / Trade-offs

- [Risk] The calculation ignores staff availability, so capacity may still look sufficient even when staff cannot work the required time windows. -> Mitigation: Keep the warning scoped to weekly capacity only and leave availability feasibility to schedule validation or future group warnings.
- [Risk] Fractional-hour staffing rules can produce decimal shortfalls. -> Mitigation: Calculate in minutes internally and format whole or decimal hours consistently in the localized message.
- [Risk] The warning could be interpreted as blocking even though saving remains allowed. -> Mitigation: Use wording that explains the current shortfall without preventing the user from editing staff links or staffing rules.
