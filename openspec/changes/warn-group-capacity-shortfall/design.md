## Context

The group detail page currently loads the selected group, its staffing rules, linked staff, and active staff that can still be linked. It displays linked staff status and staffing rules, but it does not compare the group's weekly total or pedagog staffing demand against the linked staff members' weekly capacity.

The database already contains the required source data: `group_staff_rules.startTime`, `group_staff_rules.endTime`, `group_staff_rules.minStaff`, `group_staff_rules.minPedagogs`, `staff_members.active`, `staff_members.role`, `staff_members.maxHoursPerWeek`, and the `staff_member_groups` link table. The page's linked staff query needs to include `maxHoursPerWeek` and `role` before both calculations can run.

## Goals / Non-Goals

**Goals:**

- Calculate weekly total staffing demand for a group from configured staffing rules.
- Calculate weekly pedagog staffing demand for a group from configured staffing rules.
- Calculate weekly total capacity from linked active staff members.
- Calculate weekly pedagog capacity from linked active pedagog staff members.
- Show visible localized warnings on the group detail page when either relevant capacity is lower than demand.
- Keep the calculation deterministic and independently testable.

**Non-Goals:**

- Prevent saving groups, staffing rules, or staff links that create a shortfall.
- Generate or modify shift schedules.
- Account for staff availability intervals, breaks, holidays, absences, or cross-group commitments.
- Allocate one staff member's weekly capacity across multiple linked groups.
- Change the database schema.

## Decisions

### Decision: Add a pure domain helper for the capacity calculation

Create a small helper, likely in `lib/groups.ts` or a nearby group-domain module, that accepts staffing rules and linked staff-like records and returns total demand hours, total capacity hours, total shortfall hours, pedagog demand hours, pedagog capacity hours, and pedagog shortfall hours.

Rationale: The group detail page should remain mostly presentation and data loading. A pure helper keeps examples such as "5 weekdays from 06:00 to 17:00 with minStaff 3 equals 165 weekly demand hours" and role-specific pedagog shortfalls easy to unit test without rendering a Next.js server component.

Alternative considered: Inline the calculation in `app/[locale]/groups/[id]/page.tsx`. That would be quicker, but it would make the core business rule harder to test and reuse.

### Decision: Sum each staffing rule independently

Weekly demand should be the sum of every configured rule's duration multiplied by `minStaff`, regardless of whether rules overlap.

Rationale: The issue specifies `staffing rule duration * minimum staff count for each configured day`. The current schedule validation domain also treats overlapping staffing rules as independently required.

Alternative considered: Merge overlapping staffing-rule intervals before calculating demand. That would avoid double-counting overlaps, but it would also change the meaning of independently configured minimum staffing rules and would be inconsistent with existing schedule validation behavior.

### Decision: Capacity uses only linked active staff weekly max hours

Available weekly total capacity should sum `maxHoursPerWeek` for staff members that are both linked to the group and active. Available weekly pedagog capacity should sum `maxHoursPerWeek` for linked active staff members with role `pedagog`.

Rationale: The warning is about whether the current group setup has enough linked staff capacity. Inactive staff and unlinked active staff are not available to the group in that setup.

Alternative considered: Include all active staff that could be linked. That would hide the exact configuration problem the warning is meant to expose.

### Decision: Keep total and pedagog shortfalls separate

Render total staff and pedagog capacity shortfalls as separate warnings when both are present.

Rationale: Pedagog capacity is a role-specific subset of total staff capacity. Combining the messages would make it harder to see whether the group lacks any staff hours, pedagog hours, or both.

Alternative considered: Only warn about total staff capacity. That would miss groups where total staff capacity appears sufficient but pedagog capacity is still too low.

### Decision: Do not reduce capacity for cross-group links

When a staff member is linked to multiple groups, each group should count that staff member's full `maxHoursPerWeek` for this warning.

Rationale: These warnings are local to a single group's linked staff pool. Cross-group allocation would require a separate institution-level planning model and would make the group detail warnings harder to interpret.

Alternative considered: Divide capacity across linked groups. That would imply an allocation rule that the current domain has not defined.

### Decision: Display the warning near the group header

Render visible warning callouts near the top of the group detail page when total or pedagog shortfall hours are greater than zero, with the missing hours included in each relevant message.

Rationale: The issue is visible from the group detail page and the warning should be noticed before users inspect staff or staffing-rule tables.

Alternative considered: Show the warnings only inside the staff section. That places the warnings closer to linked staff, but the shortfalls are group-level configuration problems involving both staff and rules.

## Risks / Trade-offs

- [Risk] The calculation ignores staff availability, so capacity may still look sufficient even when staff cannot work the required time windows. -> Mitigation: Keep the warnings scoped to weekly capacity only and leave availability feasibility to schedule validation or future group warnings.
- [Risk] Fractional-hour staffing rules can produce decimal shortfalls. -> Mitigation: Calculate in minutes internally and format whole or decimal hours consistently in the localized message.
- [Risk] The warnings could be interpreted as blocking even though saving remains allowed. -> Mitigation: Use wording that explains the current shortfall without preventing the user from editing staff links or staffing rules.
