## 1. Validation Types and Utilities

- [x] 1.1 Create `lib/shift-schedule/validate-input.ts` for pre-generation schedule input support checks.
- [x] 1.2 Create `lib/shift-schedule/validate-generated.ts` for post-generation schedule plan validation.
- [x] 1.3 Create `lib/shift-schedule/validation-types.ts` with exported validation result and issue types shared by both validation modules, including stable codes, structured context, and fallback messages.
- [x] 1.4 Add a `HH:mm` to minutes helper for deterministic time comparison.
- [x] 1.5 Add helper functions for indexing schedule input staff by ID and generated shifts by staff/day.
- [x] 1.6 Add `validateScheduleInputSupport` and `validateGeneratedSchedule` as the main composition functions returning `{ valid, issues }`.

## 2. Core Rule Validators

- [x] 2.1 Implement `validateSupportedRuleDays` in `validate-input.ts` to reject Saturday/Sunday staffing rules before AI generation while generated plans are Monday-Friday only.
- [x] 2.2 Implement `validateScheduleGroupId` in `validate-generated.ts` to reject generated plans for the wrong group.
- [x] 2.3 Implement `validateWeekdays` in `validate-generated.ts` to reject generated plans missing Monday-Friday day entries or containing duplicate weekday entries.
- [x] 2.4 Implement `validateKnownStaffIds` to reject shifts for staff IDs missing from the schedule input.
- [x] 2.5 Implement `validateActiveStaffOnly` to reject shifts assigned to inactive staff.
- [x] 2.6 Implement `validateShiftTimes` to reject zero-length or backwards shift ranges.
- [x] 2.7 Implement `validateAvailability` to reject shifts outside the staff member's weekday availability.
- [x] 2.8 Implement `validateMaxWeeklyHours` to reject total scheduled weekly hours above `maxHoursPerWeek`.
- [x] 2.9 Implement `validateNoOverlaps` to reject overlapping shifts for the same staff member on the same weekday.
- [x] 2.10 Implement `validateStaffingRules` using interval segment checks for `minStaff`, `minPedagogs`, and shifts or shift segments outside all staffing-rule periods.

## 3. Server Action Integration

- [x] 3.1 Update `app/[locale]/shift-schedule/actions.ts` to validate parsed AI output before saving.
- [x] 3.2 Add a pre-generation supported-input check that returns `unsupported_weekend_rule` without calling the AI.
- [x] 3.3 Add compact validation feedback formatting for retry prompts with all unique issue codes and capped repeated examples per code.
- [x] 3.4 Add one fixed retry attempt when the first parsed plan fails deterministic validation, without introducing retry configuration.
- [x] 3.5 Ensure invalid first attempts and invalid retry attempts are not saved as accepted plans.
- [x] 3.6 Return useful validation failure messages to the existing generation UI flow when retry does not produce a valid plan.
- [x] 3.7 Ensure the server action collects all errors within the current validation layer but does not continue to later layers after a failed layer.

## 4. Tests

- [x] 4.1 Add focused tests for `validate-input.ts` and `validate-generated.ts` with shared fixtures for schedule input and generated plans.
- [x] 4.2 Test valid generated plans return `valid: true` with no hard-rule issues.
- [x] 4.3 Test group ID mismatch, missing weekday entries, duplicate weekday entries, unsupported weekend rules, unknown staff, inactive staff, invalid shift times, outside availability, availability gaps between same-day intervals, max hours including partial-hour shifts, and overlapping shifts.
- [x] 4.4 Test staffing rule validation for unmet total staff, unmet pedagog coverage, pedagogs counting toward total staff, `minPedagogs` greater than `minStaff`, internal coverage gaps, valid split-shift coverage, overlapping rules that remain independently required, shifts outside staffing-rule periods, and shifts spanning adjacent rule periods.
- [x] 4.5 Test that multiple validation failures are returned together.
- [x] 4.6 Add or update server action tests where practical to verify unsupported weekend rules skip AI generation, failed layers stop the flow, validation blocks saving, and retry succeeds/fails as specified.

## 5. Verification

- [x] 5.1 Run focused Vitest tests for shift schedule validation.
- [x] 5.2 Run the full test suite.
- [x] 5.3 Run type checking.
- [x] 5.4 Run linting.
- [ ] 5.5 Manually review the generation UI behavior for valid plan, invalid-then-valid retry, and invalid retry failure paths.
