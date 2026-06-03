## Why

Group detail pages can show staffing rules and linked staff as if the setup is usable even when the linked active staff cannot provide enough weekly hours to satisfy the configured minimum staffing rules. This makes impossible group configurations easy to miss until schedule generation or manual planning fails.

## What Changes

- Add a group detail warning when total weekly staffing-rule demand is greater than total weekly capacity from linked active staff.
- Calculate weekly demand as each staffing rule duration multiplied by its `minStaff`, summed across all configured days.
- Calculate weekly capacity from linked staff members whose `active` value is true, using their `maxHoursPerWeek`.
- Include the missing weekly hours in the warning message.
- Do not show the warning when linked active staff capacity is equal to or greater than weekly demand.
- Do not count inactive, unlinked, or merely available-to-link staff toward capacity.

## Capabilities

### New Capabilities

- `group-capacity-warning`: Detects and displays insufficient linked staff weekly capacity for a group's minimum staffing rules.

### Modified Capabilities

- None.

## Impact

- Affects the group detail page at `app/[locale]/groups/[id]/page.tsx`.
- Requires linked staff data on the group detail page to include `maxHoursPerWeek`.
- Likely adds a small domain helper for calculating staffing-rule demand, active linked staff capacity, and weekly shortfall.
- Adds localized warning strings in `messages/en.json` and `messages/da.json`.
- Adds focused tests for the calculation helper and, if practical in the existing test setup, rendering behavior for the warning state.
