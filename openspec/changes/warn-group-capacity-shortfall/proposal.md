## Why

Group detail pages can show staffing rules and linked staff as if the setup is usable even when the linked active staff cannot provide enough weekly hours to satisfy the configured minimum staffing rules. They can also hide when linked active pedagog staff cannot provide enough weekly pedagog hours. These coarse capacity shortfalls are easy to miss until schedule generation or manual planning fails.

## What Changes

- Add a group detail warning when total weekly staffing-rule demand is greater than total weekly capacity from linked active staff.
- Add a separate group detail warning when weekly pedagog staffing-rule demand is greater than weekly pedagog capacity from linked active pedagog staff.
- Calculate total weekly demand as each staffing rule duration multiplied by its `minStaff`, summed across all configured days.
- Calculate pedagog weekly demand as each staffing rule duration multiplied by its `minPedagogs`, summed across all configured days.
- Calculate weekly capacity from linked staff members whose `active` value is true, using their `maxHoursPerWeek`.
- Calculate weekly pedagog capacity from linked active staff members with role `pedagog`, using their `maxHoursPerWeek`.
- Include the missing weekly hours in the warning message.
- Do not show a warning when the relevant linked active capacity is equal to or greater than the relevant weekly demand.
- Do not count inactive, unlinked, or merely available-to-link staff toward capacity.
- Count a staff member's full `maxHoursPerWeek` for each linked group; do not reduce capacity for cross-group links in this proposal.
- Keep both warnings non-blocking.

## Capabilities

### New Capabilities

- `group-capacity-warning`: Detects and displays insufficient linked staff weekly capacity for a group's minimum total staffing rules and minimum pedagog staffing rules.

### Modified Capabilities

- None.

## Impact

- Affects the group detail page at `app/[locale]/groups/[id]/page.tsx`.
- Requires linked staff data on the group detail page to include `maxHoursPerWeek`.
- Likely adds a small domain helper for calculating total and pedagog staffing-rule demand, active linked staff capacity, linked active pedagog capacity, and weekly shortfalls.
- Adds localized warning strings in `messages/en.json` and `messages/da.json`.
- Adds focused tests for the calculation helper and, if practical in the existing test setup, rendering behavior for the warning state.
