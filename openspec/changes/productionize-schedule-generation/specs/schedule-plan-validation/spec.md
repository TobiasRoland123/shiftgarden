## MODIFIED Requirements

### Requirement: Generated plans are validated before acceptance

The system SHALL validate every parsed AI-generated schedule plan against the schedule input before presenting it as an accepted plan. An accepted plan SHALL have zero validation errors. Validation SHALL NOT persist a plan; persistence requires an explicit acceptance step.

#### Scenario: Valid generated plan is accepted

- **WHEN** the AI returns a schedule plan that matches the selected group and has zero validation errors
- **THEN** the system marks the plan as an accepted plan and allows it to be saved

#### Scenario: Invalid generated plan is rejected

- **WHEN** the AI returns a schedule plan with one or more validation errors
- **THEN** the system rejects the plan as invalid and does not allow it to be saved as an accepted plan

### Requirement: Generated plans must include each weekday exactly once

The system SHALL reject generated plans that do not include exactly one day entry for each weekday from Monday through Sunday.

#### Scenario: Generated plan is missing a weekday

- **WHEN** a generated plan includes Monday, Tuesday, Wednesday, and Friday but does not include Thursday
- **THEN** the validation result includes a `missing_weekday` error

#### Scenario: Generated plan is missing a weekend day

- **WHEN** a generated plan includes Monday through Saturday but does not include Sunday
- **THEN** the validation result includes a `missing_weekday` error

#### Scenario: Generated plan includes weekday with no shifts

- **WHEN** a generated plan includes Thursday with an empty shifts array
- **THEN** the validation result does not include a `missing_weekday` error for Thursday

#### Scenario: Generated plan includes duplicate weekday

- **WHEN** a generated plan includes two Monday day entries
- **THEN** the validation result includes a `duplicate_weekday` error

### Requirement: Staffing rules must be satisfied for each rule period

The system SHALL reject plans where any staffing rule period lacks the required number of total staff or pedagog staff for any part of the rule interval. The system SHALL report every unsatisfied coverage segment within a staffing rule rather than stopping at the first unsatisfied segment, and each reported issue SHALL carry the time range of the unsatisfied segment rather than the time range of the whole rule.

#### Scenario: Minimum total staff is unmet for full rule period

- **WHEN** a staffing rule requires 2 staff from `09:00` to `12:00` and the generated plan provides only 1 covering staff member during that period
- **THEN** the validation result includes a `min_staff_unmet` error whose time range is `09:00` to `12:00`

#### Scenario: Minimum pedagog staff is unmet for full rule period

- **WHEN** a staffing rule requires 1 pedagog from `09:00` to `12:00` and the generated plan provides covering staff but no covering pedagog during that period
- **THEN** the validation result includes a `min_pedagogs_unmet` error whose time range is `09:00` to `12:00`

#### Scenario: Pedagog counts toward total staff coverage

- **WHEN** a staffing rule requires 2 staff and 1 pedagog from `09:00` to `12:00` and the generated plan provides 1 covering pedagog and 1 covering assistant during that period
- **THEN** the validation result includes neither a `min_staff_unmet` error nor a `min_pedagogs_unmet` error for that rule

#### Scenario: Pedagog minimum can exceed total staff minimum

- **WHEN** a staffing rule requires 1 staff and 2 pedagogs from `09:00` to `12:00` and the generated plan provides 2 covering pedagogs during that period
- **THEN** the validation result includes neither a `min_staff_unmet` error nor a `min_pedagogs_unmet` error for that rule

#### Scenario: Coverage gap inside rule period is detected

- **WHEN** a staffing rule requires 2 staff from `09:00` to `12:00`, two staff cover `09:00` to `11:00`, and only one staff member covers `11:00` to `12:00`
- **THEN** the validation result includes a `min_staff_unmet` error whose time range is `11:00` to `12:00`

#### Scenario: Multiple coverage gaps inside one rule period are all reported

- **WHEN** a staffing rule requires 2 staff from `09:00` to `15:00`, coverage falls to 1 staff member from `09:00` to `10:00`, rises to 2 staff members from `10:00` to `13:00`, and falls to 1 staff member from `13:00` to `15:00`
- **THEN** the validation result includes a `min_staff_unmet` error whose time range is `09:00` to `10:00` and a second `min_staff_unmet` error whose time range is `13:00` to `15:00`

#### Scenario: Total staff and pedagog gaps in the same segment are both reported

- **WHEN** a staffing rule requires 2 staff and 1 pedagog from `09:00` to `12:00` and the generated plan provides 1 covering assistant and no covering pedagog for the whole period
- **THEN** the validation result includes both a `min_staff_unmet` error and a `min_pedagogs_unmet` error for that segment

#### Scenario: Rule period is fully covered by split shifts

- **WHEN** a staffing rule requires 1 staff from `09:00` to `12:00`, one staff member covers `09:00` to `10:30`, and another staff member covers `10:30` to `12:00`
- **THEN** the validation result does not include a `min_staff_unmet` error for that rule

#### Scenario: Overlapping staffing rules are independently required

- **WHEN** one staffing rule requires 2 staff from `09:00` to `12:00`, another staffing rule requires 3 staff from `10:00` to `14:00`, and the generated plan provides only 2 staff from `10:00` to `12:00`
- **THEN** the validation result includes a `min_staff_unmet` error for the second staffing rule

### Requirement: Invalid first attempt may be retried once

The system SHALL make at most one retry attempt when the first parsed AI-generated schedule plan fails deterministic validation.

#### Scenario: Retry succeeds after validation failure

- **WHEN** the first generated plan fails deterministic validation and the retry returns a valid plan
- **THEN** the system returns the retry plan as an accepted plan without saving it

#### Scenario: Retry also fails validation

- **WHEN** the first generated plan fails deterministic validation and the retry plan also fails deterministic validation
- **THEN** the system rejects the generation request, returns validation issues to the user-facing flow, and does not save either invalid plan as an accepted plan

#### Scenario: Retry is not repeated indefinitely

- **WHEN** a generated plan fails deterministic validation
- **THEN** the system performs no more than one retry attempt for that generation request

## ADDED Requirements

### Requirement: Staffing rules must fit institution opening hours

The system SHALL reject schedule input containing a staffing rule that is not fully contained within a single institution opening hours interval on the same weekday, before calling the AI model.

#### Scenario: Staffing rule extends past opening hours

- **WHEN** Monday institution opening hours are `07:00` to `17:00` and a Monday staffing rule runs from `16:00` to `18:00`
- **THEN** the system returns a `staffing_rule_outside_opening_hours` error without calling the AI model

#### Scenario: Staffing rule crosses a gap between opening hours intervals

- **WHEN** Monday institution opening hours are `07:00` to `12:00` and `13:00` to `17:00` and a Monday staffing rule runs from `11:00` to `14:00`
- **THEN** the system returns a `staffing_rule_outside_opening_hours` error without calling the AI model

#### Scenario: Weekend staffing rule inside opening hours is supported

- **WHEN** Saturday institution opening hours are `08:00` to `14:00` and a Saturday staffing rule runs from `09:00` to `12:00`
- **THEN** the system returns no `staffing_rule_outside_opening_hours` error and proceeds to call the AI model

### Requirement: Shifts must stay within institution opening hours

The system SHALL reject generated shifts that are not fully contained within a single institution opening hours interval on the shift weekday. Shifts MAY extend outside staffing-rule periods provided they remain inside institution opening hours.

#### Scenario: Shift extends past opening hours

- **WHEN** Monday institution opening hours are `07:00` to `17:00` and the generated plan schedules a staff member from `16:00` to `18:00` on Monday
- **THEN** the validation result includes a `shift_outside_opening_hours` error

#### Scenario: Shift crosses a gap between opening hours intervals

- **WHEN** Monday institution opening hours are `07:00` to `12:00` and `13:00` to `17:00` and the generated plan schedules a staff member from `11:00` to `14:00` on Monday
- **THEN** the validation result includes a `shift_outside_opening_hours` error

#### Scenario: Shift outside staffing-rule periods but inside opening hours is allowed

- **WHEN** Monday institution opening hours are `07:00` to `17:00`, the only Monday staffing rule is from `09:00` to `12:00`, and the generated plan schedules an available staff member from `12:00` to `14:00` on Monday
- **THEN** the validation result includes no `shift_outside_opening_hours` error for that shift

### Requirement: Shift end order must follow FIFO

The system SHALL reject plans in which, on the same weekday, a staff member who starts later ends earlier than a staff member who starts earlier.

#### Scenario: Later starter ends earlier

- **WHEN** on Monday one staff member is scheduled from `08:00` to `16:00` and another is scheduled from `09:00` to `14:00`
- **THEN** the validation result includes a `fifo_end_order_inversion` error

#### Scenario: End order follows start order

- **WHEN** on Monday one staff member is scheduled from `08:00` to `14:00` and another is scheduled from `09:00` to `16:00`
- **THEN** the validation result includes no `fifo_end_order_inversion` error for those shifts

## REMOVED Requirements

### Requirement: Weekend staffing rules are unsupported

**Reason**: Weekend scheduling is fully supported. The generated schedule schema includes Saturday and Sunday, weekday validation requires all seven days, and weekend staffing coverage is enforced. No `unsupported_weekend_rule` code exists in the implementation. This requirement documented a constraint that was lifted when institution opening hours were introduced.

**Migration**: Weekend staffing rules are now validated by the `Staffing rules must fit institution opening hours` requirement. A weekend rule is accepted when the institution has matching weekend opening hours and rejected with `staffing_rule_outside_opening_hours` otherwise.

### Requirement: Shifts must stay within staffing-rule periods

**Reason**: Staffing rules define minimum coverage, not the boundary of the allowed schedule window. Institution opening hours now define that boundary. Requiring shifts to stay inside rule periods made it impossible to schedule staff during open hours that carry no minimum-coverage requirement. The `shift_outside_staffing_rule` code does not exist in the implementation.

**Migration**: Replaced by the `Shifts must stay within institution opening hours` requirement, which emits `shift_outside_opening_hours`, together with the pre-generation `Staffing rules must fit institution opening hours` requirement.
