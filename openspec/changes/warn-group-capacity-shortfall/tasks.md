## 1. Capacity Calculation

- [x] 1.1 Add exported types for group staffing-rule and linked-staff capacity inputs in the group domain helper module.
- [x] 1.2 Implement a `HH:mm` duration helper that calculates staffing-rule durations in minutes.
- [x] 1.3 Implement a weekly demand calculation that sums each staffing rule's duration multiplied by `minStaff`.
- [x] 1.4 Implement a weekly pedagog demand calculation that sums each staffing rule's duration multiplied by `minPedagogs`.
- [x] 1.5 Implement a linked active staff capacity calculation that sums only linked staff where `active` is true.
- [x] 1.6 Implement a linked active pedagog capacity calculation that sums only linked pedagog staff where `active` is true.
- [x] 1.7 Implement a composed shortfall helper that returns total and pedagog demand hours, capacity hours, and missing weekly hours.

## 2. Tests

- [x] 2.1 Add unit tests for the 165-hour demand example from Monday-Friday `06:00` to `17:00` with `minStaff` 3.
- [x] 2.2 Add unit tests for the 111-hour capacity example from 3 linked active staff members at 37 hours each.
- [x] 2.3 Add unit tests proving inactive linked staff are excluded from capacity.
- [x] 2.4 Add unit tests proving unlinked active staff are excluded by only passing linked staff to the helper.
- [x] 2.5 Add unit tests for no warning conditions when capacity equals or exceeds demand and when no staffing rules exist.
- [x] 2.6 Add unit tests for pedagog demand and linked active pedagog capacity.
- [x] 2.7 Add unit tests proving non-pedagog, inactive pedagog, and unlinked pedagog staff are excluded from pedagog capacity.
- [x] 2.8 Add unit tests for fractional-hour rules if the helper formats or exposes decimal shortfall hours.

## 3. Group Detail Integration

- [x] 3.1 Update the group detail linked staff query to select `maxHoursPerWeek` and `role`.
- [x] 3.2 Calculate the group capacity shortfalls in `app/[locale]/groups/[id]/page.tsx` after rules and linked staff are loaded.
- [x] 3.3 Render visible warning callouts near the group header only when total or pedagog shortfall is greater than zero.
- [x] 3.4 Include the missing weekly hours in each warning message.
- [x] 3.5 Ensure inactive linked staff remain visible in the staff table but do not contribute to the capacity calculation.
- [x] 3.6 Ensure linked active non-pedagog staff remain counted for total capacity but do not contribute to pedagog capacity.

## 4. Localization

- [x] 4.1 Add English group detail warning text for total and pedagog shortfalls that includes the missing weekly hours.
- [x] 4.2 Add Danish group detail warning text for total and pedagog shortfalls that includes the missing weekly hours.
- [x] 4.3 Use the existing `next-intl` translation pattern on the group detail page for the warning.

## 5. Verification

- [x] 5.1 Run the focused group helper tests.
- [x] 5.2 Run the full Vitest suite.
- [x] 5.3 Run type checking.
- [x] 5.4 Run linting.
- [x] 5.5 Manually verify a group with enough capacity shows no warning.
- [x] 5.6 Manually verify a group with insufficient total capacity shows a warning with the missing weekly hours.
- [x] 5.7 Manually verify a group with insufficient pedagog capacity shows a separate warning with the missing weekly pedagog hours.
