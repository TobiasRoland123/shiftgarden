## ADDED Requirements

### Requirement: Plan timeline groups shifts by staff member

The system SHALL render a schedule plan as one row per scheduled staff member per weekday, with that staff member's shifts placed on a shared time axis. A staff member with more than one shift on a weekday SHALL occupy a single row for that weekday.

#### Scenario: Staff member with multiple shifts occupies one row

- **WHEN** a staff member is scheduled from `08:00` to `11:00` and from `12:00` to `15:00` on Monday
- **THEN** the Monday timeline shows one row for that staff member containing both shifts

#### Scenario: Row shows staff member name and role

- **WHEN** the timeline renders a staff row
- **THEN** the row label shows the staff member's name and role

#### Scenario: Weekday with no shifts is shown as empty

- **WHEN** a plan has no shifts on Sunday
- **THEN** the timeline shows Sunday with an explicit empty state rather than omitting the day

### Requirement: Timeline shows availability and opening hours context

The system SHALL render each staff member's availability intervals behind that staff member's row for the weekday, and SHALL render the institution opening hours as the outer bound of the time axis for each weekday.

#### Scenario: Availability is shown behind shifts

- **WHEN** a staff member is available from `08:00` to `12:00` on Monday and is scheduled from `09:00` to `11:00`
- **THEN** the Monday row shows the `08:00` to `12:00` availability interval behind the `09:00` to `11:00` shift

#### Scenario: Gap between availability intervals is visible

- **WHEN** a staff member is available from `08:00` to `12:00` and from `13:00` to `16:00` on Monday
- **THEN** the Monday row shows two separate availability intervals with a visible gap between them

#### Scenario: Time axis spans opening hours

- **WHEN** Monday institution opening hours are `07:00` to `17:00`
- **THEN** the Monday time axis spans at least `07:00` to `17:00`

#### Scenario: Time axis without opening hours falls back to plan bounds

- **WHEN** a weekday has no institution opening hours configured
- **THEN** the time axis for that weekday spans the earliest shift start and latest shift end of that weekday

### Requirement: Timeline shows staffing rule coverage

The system SHALL render, for each weekday, a coverage display showing the number of scheduled staff and the number of scheduled pedagog staff across the time axis against the staffing rule minimums in force at each point. Segments where a minimum is unmet SHALL be visually distinguished from segments where all minimums are met.

#### Scenario: Unmet coverage segment is distinguished

- **WHEN** a Monday staffing rule requires 2 staff from `09:00` to `12:00` and only 1 staff member is scheduled from `11:00` to `12:00`
- **THEN** the Monday coverage display distinguishes the `11:00` to `12:00` segment as unmet

#### Scenario: Coverage display shows counts against minimums

- **WHEN** a Monday staffing rule requires 2 staff and 1 pedagog from `09:00` to `12:00` and 3 staff including 1 pedagog are scheduled for that period
- **THEN** the coverage display shows scheduled counts of 3 staff and 1 pedagog against minimums of 2 staff and 1 pedagog for that period

#### Scenario: Pedagog coverage is shown as a subset of staff coverage

- **WHEN** a period has 3 scheduled staff of whom 1 is a pedagog
- **THEN** the coverage display presents the pedagog count as part of the staff count rather than as additional staff

#### Scenario: Overlapping staffing rules are each represented

- **WHEN** one Monday staffing rule requires 2 staff from `09:00` to `12:00` and another requires 3 staff from `10:00` to `14:00`
- **THEN** the coverage display reflects the higher combined requirement of 3 staff during `10:00` to `12:00`

#### Scenario: Period outside all staffing rules requires no minimum

- **WHEN** Monday opening hours are `07:00` to `17:00` and the only Monday staffing rule is from `09:00` to `12:00`
- **THEN** the coverage display shows no unmet minimum for `07:00` to `09:00` or `12:00` to `17:00`

### Requirement: Staff members are visually identifiable across the timeline

The system SHALL assign each staff member in a plan a visually distinct appearance that is stable across every weekday of that plan.

#### Scenario: Same staff member looks the same on every weekday

- **WHEN** a staff member is scheduled on Monday and on Thursday
- **THEN** that staff member is rendered with the same appearance on both weekdays

#### Scenario: Distinct staff members are distinguishable

- **WHEN** a plan schedules staff members concurrently within one weekday
- **THEN** each concurrently scheduled staff member is rendered distinguishably from the others

### Requirement: Timeline is shared by review and saved plan views

The system SHALL render a reviewed generated schedule plan and a saved schedule plan with the same timeline presentation.

#### Scenario: Saved plan uses the same timeline

- **WHEN** a user opens a saved schedule plan
- **THEN** the plan is rendered with the same staff rows, availability context, and coverage display as during review

#### Scenario: Highlighting is only present during review

- **WHEN** a user opens a saved schedule plan
- **THEN** no validation issue highlighting is shown because there are no validation issues to select
