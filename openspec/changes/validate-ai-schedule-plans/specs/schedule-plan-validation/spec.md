## ADDED Requirements

### Requirement: Generated plans are validated before acceptance

The system SHALL validate every parsed AI-generated schedule plan against the schedule input before saving or presenting it as an accepted plan. An accepted plan SHALL have zero validation errors.

#### Scenario: Valid generated plan is accepted

- **WHEN** the AI returns a schedule plan that matches the selected group and has zero validation errors
- **THEN** the system accepts the plan and allows it to be saved

#### Scenario: Invalid generated plan is rejected

- **WHEN** the AI returns a schedule plan with one or more validation errors
- **THEN** the system rejects the plan as invalid and does not save it as an accepted plan

### Requirement: Validation reports structured issues

The system SHALL report validation errors and validation warnings as structured issues with stable issue codes, severity, fallback human-readable messages, and relevant context when available.

#### Scenario: Validation issue includes actionable context

- **WHEN** a shift schedules a staff member outside their available hours
- **THEN** the validation result includes an issue with code `outside_availability`, severity `error`, the staff identifier, weekday, shift time range, and a message describing the problem

#### Scenario: Multiple validation failures are reported together

- **WHEN** a generated plan contains more than one validation error
- **THEN** the validation result includes all detected validation errors instead of stopping after the first issue

#### Scenario: Input support failure prevents generation

- **WHEN** schedule input support validation returns one or more validation errors
- **THEN** the system returns those validation errors without calling the AI model

### Requirement: Generated group must match schedule input group

The system SHALL reject generated plans whose `groupId` does not match the selected schedule input group.

#### Scenario: Generated group id differs from input group id

- **WHEN** the selected group is `group-a` and the generated plan contains `groupId` `group-b`
- **THEN** the validation result includes a `group_id_mismatch` error

### Requirement: Generated plans must include each weekday exactly once

The system SHALL reject generated plans that do not include exactly one day entry for each weekday from Monday through Friday. Saturday and Sunday generated plan entries remain outside the generated schedule schema for this change.

#### Scenario: Generated plan is missing a weekday

- **WHEN** a generated plan includes Monday, Tuesday, Wednesday, and Friday but does not include Thursday
- **THEN** the validation result includes a `missing_weekday` error

#### Scenario: Generated plan includes weekday with no shifts

- **WHEN** a generated plan includes Thursday with an empty shifts array
- **THEN** the validation result does not include a `missing_weekday` error for Thursday

#### Scenario: Generated plan includes duplicate weekday

- **WHEN** a generated plan includes two Monday day entries
- **THEN** the validation result includes a `duplicate_weekday` error

### Requirement: Weekend staffing rules are unsupported

The system SHALL reject schedule input containing Saturday or Sunday staffing rules before AI generation because generated plans are Monday-Friday only in this change.

#### Scenario: Schedule input contains Saturday staffing rule

- **WHEN** the schedule input contains a Saturday staffing rule
- **THEN** the system returns an `unsupported_weekend_rule` error without calling the AI model

### Requirement: Shifts must reference known active staff

The system SHALL reject shifts that reference staff members absent from the schedule input or staff members marked inactive.

#### Scenario: Shift references unknown staff member

- **WHEN** a generated shift uses a `staffId` that does not exist in the schedule input staff list
- **THEN** the validation result includes an `unknown_staff` error

#### Scenario: Shift references inactive staff member

- **WHEN** a generated shift uses a `staffId` for a staff member whose `active` value is false
- **THEN** the validation result includes an `inactive_staff` error

### Requirement: Shift time ranges must be valid

The system SHALL reject shifts whose `endTime` is not after `startTime`.

#### Scenario: Shift has zero duration

- **WHEN** a generated shift has the same `startTime` and `endTime`
- **THEN** the validation result includes an `invalid_shift_time` error

#### Scenario: Shift ends before it starts

- **WHEN** a generated shift has an `endTime` earlier than `startTime`
- **THEN** the validation result includes an `invalid_shift_time` error

### Requirement: Shifts must fit staff availability

The system SHALL reject shifts that are not fully contained within one availability interval for the scheduled staff member on the shift weekday.

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

### Requirement: Staff weekly hours must not exceed maximum

The system SHALL reject plans where a staff member's total scheduled weekly hours exceed that staff member's `maxHoursPerWeek`.

#### Scenario: Staff member exceeds maximum weekly hours

- **WHEN** a staff member has `maxHoursPerWeek` of 20 and the generated plan schedules that staff member for more than 20 total hours
- **THEN** the validation result includes a `max_hours_exceeded` error

#### Scenario: Staff member reaches exact maximum weekly hours

- **WHEN** a staff member has `maxHoursPerWeek` of 20 and the generated plan schedules that staff member for exactly 20 total hours
- **THEN** the validation result does not include a `max_hours_exceeded` error for that staff member

#### Scenario: Partial-hour shifts count toward weekly maximum

- **WHEN** a staff member has `maxHoursPerWeek` of 4 and the generated plan schedules that staff member from `09:00` to `12:30` and from `13:00` to `13:45`
- **THEN** the validation result includes a `max_hours_exceeded` error for that staff member

### Requirement: Staff shifts must not overlap

The system SHALL reject plans where the same staff member has overlapping shifts.

#### Scenario: Staff member has overlapping shifts on same weekday

- **WHEN** a staff member is scheduled from `09:00` to `12:00` and from `11:00` to `14:00` on the same weekday
- **THEN** the validation result includes an `overlapping_shift` error

#### Scenario: Staff member has adjacent shifts on same weekday

- **WHEN** a staff member is scheduled from `09:00` to `12:00` and from `12:00` to `14:00` on the same weekday
- **THEN** the validation result does not include an `overlapping_shift` error for those shifts

### Requirement: Staffing rules must be satisfied for each rule period

The system SHALL reject plans where any staffing rule period lacks the required number of total staff or pedagog staff for any part of the rule interval.

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

### Requirement: Shifts must stay within staffing-rule periods

The system SHALL reject generated shifts, or generated shift segments, that fall outside all staffing-rule periods for the same weekday.

#### Scenario: Shift is completely outside staffing-rule periods

- **WHEN** the only Monday staffing rule is from `09:00` to `12:00` and the generated plan schedules a staff member from `12:00` to `14:00` on Monday
- **THEN** the validation result includes a `shift_outside_staffing_rule` error

#### Scenario: Shift partly extends outside staffing-rule periods

- **WHEN** the only Monday staffing rule is from `09:00` to `12:00` and the generated plan schedules a staff member from `11:00` to `13:00` on Monday
- **THEN** the validation result includes a `shift_outside_staffing_rule` error

#### Scenario: Shift spans adjacent staffing-rule periods

- **WHEN** Monday staffing rules cover `09:00` to `12:00` and `12:00` to `15:00` and the generated plan schedules an available staff member from `09:00` to `15:00` on Monday
- **THEN** the validation result does not include a `shift_outside_staffing_rule` error for that shift

### Requirement: Invalid first attempt may be retried once

The system SHALL make at most one retry attempt when the first parsed AI-generated schedule plan fails deterministic validation.

#### Scenario: Retry succeeds after validation failure

- **WHEN** the first generated plan fails deterministic validation and the retry returns a valid plan
- **THEN** the system accepts and saves the retry plan

#### Scenario: Retry also fails validation

- **WHEN** the first generated plan fails deterministic validation and the retry plan also fails deterministic validation
- **THEN** the system rejects the generation request, returns validation issues to the user-facing flow, and does not save either invalid plan as an accepted plan

#### Scenario: Retry is not repeated indefinitely

- **WHEN** a generated plan fails deterministic validation
- **THEN** the system performs no more than one retry attempt for that generation request
