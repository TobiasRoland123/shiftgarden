## MODIFIED Requirements

### Requirement: Generated plans are validated before acceptance

The system SHALL validate every parsed AI-generated schedule plan against the schedule input before saving or presenting it as an accepted generated plan. Validation SHALL use the current dated effective inputs for the entire period. An accepted generated plan SHALL have zero validation errors and SHALL be saved as an unpublished draft. Saving an intermediate rule-invalid manual working draft SHALL NOT constitute acceptance or publication.

#### Scenario: Valid generated plan is accepted

- **WHEN** the AI returns a schedule plan that matches the selected group and has zero validation errors
- **THEN** the system accepts the plan and allows it to be saved

#### Scenario: Invalid generated plan is rejected

- **WHEN** the AI returns a schedule plan with one or more validation errors
- **THEN** the system rejects the plan as invalid and does not save it as an accepted plan

### Requirement: Validation reports structured issues

The system SHALL report validation errors and validation warnings as structured issues with stable issue codes, severity, fallback human-readable messages, and relevant context when available. Dated issues SHALL identify the actual date, exact affected time segment, relevant staff/shift IDs, and source/rule references. Independent total-staff and pedagog shortages SHALL be reported separately. AI-written notes SHALL remain separate from deterministic validation results.

#### Scenario: Validation issue includes actionable context

- **WHEN** a shift schedules a staff member outside their available hours
- **THEN** the validation result includes an issue with code `outside_availability`, severity `error`, the staff identifier, actual date, shift time range, and a message describing the problem

#### Scenario: Multiple validation failures are reported together

- **WHEN** a generated plan contains more than one validation error
- **THEN** the validation result includes all detected validation errors instead of stopping after the first issue

#### Scenario: Input support failure prevents generation

- **WHEN** schedule input support validation returns one or more validation errors
- **THEN** the system returns those validation errors without calling the AI model

#### Scenario: Both coverage dimensions fail

- **WHEN** an interval is short of both total staff and pedagog staff
- **THEN** validation returns both issue types with that exact date and interval rather than stopping after the first shortage

### Requirement: Shifts must fit staff availability

The system SHALL reject shifts that are not fully contained within one effective availability interval for the scheduled staff member on the actual date after recurring availability, staff absences, and event attendance have been composed.

#### Scenario: Shift starts before availability

- **WHEN** a staff member is available from `09:00` to `15:00` on Monday and the generated plan schedules that staff member from `08:00` to `12:00` on Monday
- **THEN** the validation result includes an `outside_availability` error

#### Scenario: Shift ends after availability

- **WHEN** a staff member is available from `09:00` to `15:00` on Monday and the generated plan schedules that staff member from `12:00` to `16:00` on Monday
- **THEN** the validation result includes an `outside_availability` error

#### Scenario: Staff has no availability for weekday

- **WHEN** a staff member has no availability entry for Tuesday and the generated plan schedules that staff member on Tuesday
- **THEN** the validation result includes an `outside_availability` error

#### Scenario: Shift crosses gap between availability intervals

- **WHEN** a staff member is available from `08:00` to `12:00` and from `13:00` to `16:00` on Monday and the generated plan schedules that staff member from `11:00` to `14:00` on Monday
- **THEN** the validation result includes an `outside_availability` error

#### Scenario: Shift fits inside one of multiple availability intervals

- **WHEN** a staff member is available from `08:00` to `12:00` and from `13:00` to `16:00` on Monday and the generated plan schedules that staff member from `13:00` to `15:00` on Monday
- **THEN** the validation result does not include an `outside_availability` error for that shift

#### Scenario: Dated absence overrides recurring availability

- **WHEN** recurring Tuesday availability ends at 16:00 but the staff member is unavailable from 13:00 on the selected Tuesday
- **THEN** a shift ending at 14:00 on that date returns an `outside_availability` error, without changing availability on other Tuesdays

### Requirement: Staff weekly hours must not exceed maximum

The system SHALL reject plans where a staff member's committed work exceeds that staff member's `maxHoursPerWeek` in any institution-local Monday–Sunday week. Totals SHALL include the candidate draft, current published shifts in other groups and on dates outside the period within each affected week, and counted meeting/training attendance once per participant. A revision SHALL replace its own published commitments for this calculation. Partial weeks SHALL NOT prorate the cap; separate weeks SHALL NOT share one combined cap.

#### Scenario: Staff member exceeds maximum weekly hours

- **WHEN** a staff member has `maxHoursPerWeek` of 20 and the generated plan schedules that staff member for more than 20 total hours
- **THEN** the validation result includes a `max_hours_exceeded` error

#### Scenario: Staff member reaches exact maximum weekly hours

- **WHEN** a staff member has `maxHoursPerWeek` of 20 and the generated plan schedules that staff member for exactly 20 total hours
- **THEN** the validation result does not include a `max_hours_exceeded` error for that staff member

#### Scenario: Partial-hour shifts count toward weekly maximum

- **WHEN** a staff member has `maxHoursPerWeek` of 4 and the generated plan schedules that staff member from `09:00` to `12:30` and from `13:00` to `13:45`
- **THEN** the validation result includes a `max_hours_exceeded` error for that staff member

#### Scenario: Partial period includes external weekly commitments

- **WHEN** a 20-hour-cap staff member already has 12 published hours earlier in the same week and the proposed partial period adds 10 hours
- **THEN** validation reports `max_hours_exceeded` for that actual week even if the other 12 hours belong to another group

#### Scenario: Separate weeks have separate budgets

- **WHEN** a 20-hour-cap staff member is assigned 20 hours in each of two different weeks
- **THEN** validation does not reject the 40-hour period total merely for exceeding one weekly cap

#### Scenario: Revision is not double-counted

- **WHEN** a revision replaces its own 20-hour published version with a 19-hour draft
- **THEN** weekly accounting counts 19 hours from this period rather than 39 hours

#### Scenario: Shared training contributes once

- **WHEN** a staff member has 18 shift hours and attends one 3-hour training event configured to count toward a 20-hour weekly cap
- **THEN** validation reports `max_hours_exceeded` using 21 hours even if that event is visible in several groups

### Requirement: Staff shifts must not overlap

The system SHALL reject accepted or published plans where the same staff member has overlapping shifts on the same actual date, including authoritative published assignments in other groups or adjacent periods. Half-open adjacent intervals SHALL be allowed. Superseded versions and the revision's own replaced version SHALL NOT be treated as additional assignments. Other unpublished drafts SHALL create advisory conflicts rather than authoritative reservations.

#### Scenario: Staff member has overlapping shifts on same weekday

- **WHEN** a staff member is scheduled from `09:00` to `12:00` and from `11:00` to `14:00` on the same weekday
- **THEN** the validation result includes an `overlapping_shift` error

#### Scenario: Staff member has adjacent shifts on same weekday

- **WHEN** a staff member is scheduled from `09:00` to `12:00` and from `12:00` to `14:00` on the same weekday
- **THEN** the validation result does not include an `overlapping_shift` error for those shifts

#### Scenario: Another group has a committed assignment

- **WHEN** a staff member is published in another group from 09:00 to 12:00 on the same date and the candidate assigns them from 11:00 to 14:00
- **THEN** validation reports an overlap with the other group/date and blocks acceptance or publication

### Requirement: Staffing rules must be satisfied for each rule period

The system SHALL reject accepted or published plans where any effective dated staffing-rule interval lacks the required number of total staff or pedagog staff for any part of that interval. Coverage SHALL count distinct eligible staff IDs on exact boundaries, using current roles and effective availability. Unknown, inactive, unavailable, or externally double-booked assignments SHALL NOT fill a coverage requirement. Overlapping recurring rules SHALL remain independently required; dated replacements SHALL be composed before validation. Total and pedagog shortages SHALL be reported independently for every uncovered segment. Pedagogs SHALL count toward both total and role-specific coverage.

#### Scenario: Minimum total staff is unmet for full rule period

- **WHEN** a staffing rule requires 2 staff from `09:00` to `12:00` and the generated plan provides only 1 covering staff member during that period
- **THEN** the validation result includes a `min_staff_unmet` error

#### Scenario: Minimum pedagog staff is unmet for full rule period

- **WHEN** a staffing rule requires 1 pedagog from `09:00` to `12:00` and the generated plan provides covering staff but no covering pedagog during that period
- **THEN** the validation result includes a `min_pedagogs_unmet` error

#### Scenario: Pedagog counts toward total staff coverage

- **WHEN** a staffing rule requires 2 staff and 1 pedagog from `09:00` to `12:00` and the generated plan provides 1 covering pedagog and 1 covering assistant during that period
- **THEN** the validation result includes neither a `min_staff_unmet` error nor a `min_pedagogs_unmet` error for that rule

#### Scenario: Pedagog minimum can exceed total staff minimum

- **WHEN** a staffing rule requires 1 staff and 2 pedagogs from `09:00` to `12:00` and the generated plan provides 2 covering pedagogs during that period
- **THEN** the validation result includes neither a `min_staff_unmet` error nor a `min_pedagogs_unmet` error for that rule

#### Scenario: Coverage gap inside rule period is detected

- **WHEN** a staffing rule requires 2 staff from `09:00` to `12:00`, two staff cover `09:00` to `11:00`, and only one staff member covers `11:00` to `12:00`
- **THEN** the validation result includes a `min_staff_unmet` error for the uncovered segment

#### Scenario: Rule period is fully covered by split shifts

- **WHEN** a staffing rule requires 1 staff from `09:00` to `12:00`, one staff member covers `09:00` to `10:30`, and another staff member covers `10:30` to `12:00`
- **THEN** the validation result does not include a `min_staff_unmet` error for that rule

#### Scenario: Overlapping staffing rules are independently required

- **WHEN** one staffing rule requires 2 staff from `09:00` to `12:00`, another staffing rule requires 3 staff from `10:00` to `14:00`, and the generated plan provides only 2 staff from `10:00` to `12:00`
- **THEN** the validation result includes a `min_staff_unmet` error for the second staffing rule

#### Scenario: Invalid shifts cannot make coverage appear complete

- **WHEN** a staffing interval requires two staff but one covering assignment is inactive or outside effective availability
- **THEN** coverage counts only eligible distinct staff and reports the shortage as well as the assignment error

#### Scenario: Duplicate assignments do not fill additional places

- **WHEN** two overlapping shifts reference the same eligible staff member in an interval requiring two staff
- **THEN** coverage counts one person and reports the total-staff shortage and overlapping assignment

#### Scenario: Exact missing segments are actionable

- **WHEN** coverage is missing only from 11:00 to 11:30 inside a 09:00 to 15:00 requirement
- **THEN** the issue identifies the actual date and 11:00 to 11:30 segment rather than only the whole rule interval

### Requirement: Invalid first attempt may be retried once

The system SHALL make at most one correction retry when the first parsed AI-generated schedule fails deterministic validation, per full request or per explicit date slice if generation is divided. The entire assembled period SHALL pass validation before acceptance. Request identities and expected draft revisions SHALL prevent duplicate persistence or late-result overwrites; invalid attempts SHALL remain separate from accepted plans.

#### Scenario: Retry succeeds after validation failure

- **WHEN** the first generated plan fails deterministic validation and the retry returns a valid plan
- **THEN** the system accepts and saves the retry result as an unpublished draft only after the entire assembled period passes validation

#### Scenario: Retry also fails validation

- **WHEN** the first generated plan fails deterministic validation and the retry plan also fails deterministic validation
- **THEN** the system rejects the generation request, returns validation issues to the user-facing flow, and does not save either invalid plan as an accepted plan

#### Scenario: Retry is not repeated indefinitely

- **WHEN** a generated plan fails deterministic validation
- **THEN** the system performs no more than one retry attempt for that generation request or explicit date slice

## ADDED Requirements

### Requirement: Generated schedules contain exactly the requested dates

The system SHALL require exactly one entry for every actual date in the inclusive requested period, including weekends and closed dates, and SHALL reject missing, duplicate, or out-of-range dates. Closed dates SHALL have an empty shift set. A weekday label SHALL NOT substitute for an actual date.

#### Scenario: Missing date in a multiweek period

- **WHEN** the generated result omits one Tuesday but includes the Tuesday of another week
- **THEN** validation reports the missing actual date

#### Scenario: Duplicate or out-of-range date

- **WHEN** generation repeats one date or includes a date outside the chosen range
- **THEN** validation rejects the result with the duplicate or out-of-range date identified

#### Scenario: Weekend coverage is supported

- **WHEN** the requested range includes an open Saturday with staffing requirements
- **THEN** the system validates that Saturday's dated shifts using the same rules as other dates without an unsupported-weekend error

#### Scenario: Closed date is represented explicitly

- **WHEN** a requested date is closed under its effective institution hours
- **THEN** the generated result includes that date with no shifts

### Requirement: Institution hours bound dated shifts and requirements

The system SHALL require each group shift to fit inside one effective institution opening interval for its actual date. Shifts SHALL be allowed outside staffing-rule intervals when they remain inside effective opening hours and satisfy all other rules. Recurring staffing demand SHALL be intersected with dated opening replacements as specified by owned exceptions; contradictory explicit dated demand SHALL fail input validation before generation.

#### Scenario: Shift is outside group demand but inside opening hours

- **WHEN** a valid staff shift extends beyond a staffing-rule interval while remaining within one effective opening interval
- **THEN** validation does not return a staffing-rule-boundary error solely for that extension

#### Scenario: Shift crosses an opening-hours gap

- **WHEN** effective opening intervals are 07:00 to 12:00 and 13:00 to 17:00 and a shift spans 11:00 to 14:00
- **THEN** validation reports `shift_outside_opening_hours`

#### Scenario: Dated requirement outside opening hours

- **WHEN** an explicit dated staffing requirement cannot fit within effective institution opening hours
- **THEN** input validation reports `staffing_rule_outside_opening_hours` with source context and does not call the AI

### Requirement: Existing FIFO end ordering remains a hard rule

For group shifts on the same actual date, the system SHALL preserve the implemented FIFO end-order rule: if one staff member starts earlier than another, that person's shift SHALL NOT end later. Equal start times SHALL NOT impose an end-order relation. A violation SHALL produce `fifo_end_order_inversion` and block generated acceptance, AI application, and publication; a manual draft can retain it as a visible unresolved error.

#### Scenario: Later starter finishes earlier

- **WHEN** Anna works 07:00 to 16:00 and Jonas works 09:00 to 15:00 in the same group/date
- **THEN** validation reports `fifo_end_order_inversion`

#### Scenario: Equal start times have different end times

- **WHEN** two staff members both start at 09:00 and finish at different times
- **THEN** their pair does not violate FIFO solely because the end times differ

### Requirement: Every mutation uses the same current dated rules

Fresh generation, draft validation, AI preview/application, and publication SHALL use the same effective-input and deterministic scheduling rules. Client-side feedback SHALL NOT substitute for server validation. Structurally valid manual drafts SHALL remain saveable with rule errors; only zero-error current candidates SHALL be accepted from generation, applied as AI proposals, or published.

#### Scenario: AI proposes the same invalid assignment as a manual edit

- **WHEN** either route assigns a staff member outside effective availability
- **THEN** both report the same rule violation, manual work can remain an invalid draft, and AI application/publication are blocked

#### Scenario: Browser bypasses client checks

- **WHEN** a malformed or stale direct mutation request bypasses client validation
- **THEN** the server rejects it without corrupting the draft or official version

## REMOVED Requirements

### Requirement: Generated plans must include each weekday exactly once

**Reason**: Weekday-only completeness cannot represent arbitrary dated periods and the old Monday–Friday wording already conflicts with seven-day implementation.

**Migration**: Use “Generated schedules contain exactly the requested dates” for the new workflow. Retain the old undated schema only for legacy reads.

### Requirement: Weekend staffing rules are unsupported

**Reason**: The current implementation already supports all seven weekdays and dated planning must preserve that behavior.

**Migration**: Validate Saturday and Sunday dates with the same effective-input and shift rules as other dates.

### Requirement: Shifts must stay within staffing-rule periods

**Reason**: Institution opening hours already define the allowed scheduling boundary; staffing rules define minimum coverage.

**Migration**: Use “Institution hours bound dated shifts and requirements” and preserve allowed shifts outside coverage-rule intervals but within opening hours.
