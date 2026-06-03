## 1. Capacity Calculation

- [ ] 1.1 Add exported types for group staffing-rule and linked-staff capacity inputs in the group domain helper module.
- [ ] 1.2 Implement a `HH:mm` duration helper that calculates staffing-rule durations in minutes.
- [ ] 1.3 Implement a weekly demand calculation that sums each staffing rule's duration multiplied by `minStaff`.
- [ ] 1.4 Implement a linked active staff capacity calculation that sums only linked staff where `active` is true.
- [ ] 1.5 Implement a composed shortfall helper that returns demand hours, capacity hours, and missing weekly hours.

## 2. Tests

- [ ] 2.1 Add unit tests for the 165-hour demand example from Monday-Friday `06:00` to `17:00` with `minStaff` 3.
- [ ] 2.2 Add unit tests for the 111-hour capacity example from 3 linked active staff members at 37 hours each.
- [ ] 2.3 Add unit tests proving inactive linked staff are excluded from capacity.
- [ ] 2.4 Add unit tests proving unlinked active staff are excluded by only passing linked staff to the helper.
- [ ] 2.5 Add unit tests for no warning conditions when capacity equals or exceeds demand and when no staffing rules exist.
- [ ] 2.6 Add unit tests for fractional-hour rules if the helper formats or exposes decimal shortfall hours.

## 3. Group Detail Integration

- [ ] 3.1 Update the group detail linked staff query to select `maxHoursPerWeek`.
- [ ] 3.2 Calculate the group capacity shortfall in `app/[locale]/groups/[id]/page.tsx` after rules and linked staff are loaded.
- [ ] 3.3 Render a visible warning callout near the group header only when the shortfall is greater than zero.
- [ ] 3.4 Include the missing weekly hours in the warning message.
- [ ] 3.5 Ensure inactive linked staff remain visible in the staff table but do not contribute to the capacity calculation.

## 4. Localization

- [ ] 4.1 Add English group detail warning text that includes the missing weekly hours.
- [ ] 4.2 Add Danish group detail warning text that includes the missing weekly hours.
- [ ] 4.3 Use the existing `next-intl` translation pattern on the group detail page for the warning.

## 5. Verification

- [ ] 5.1 Run the focused group helper tests.
- [ ] 5.2 Run the full Vitest suite.
- [ ] 5.3 Run type checking.
- [ ] 5.4 Run linting.
- [ ] 5.5 Manually verify a group with enough capacity shows no warning.
- [ ] 5.6 Manually verify a group with insufficient capacity shows a warning with the missing weekly hours.
