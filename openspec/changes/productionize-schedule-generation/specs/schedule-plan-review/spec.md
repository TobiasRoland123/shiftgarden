## ADDED Requirements

### Requirement: Group readiness is shown before generation

The system SHALL show a group readiness summary for the selected group before any AI call is made. The summary SHALL report the number of linked active staff members, whether the institution has opening hours configured, whether the group has staffing rules, any staffing rule that falls outside institution opening hours, the weekly staff capacity shortfall, and the weekly pedagog capacity shortfall.

#### Scenario: Readiness summary is shown on group selection

- **WHEN** a user selects a group
- **THEN** the system shows the group readiness summary without calling the AI model

#### Scenario: Readiness summary reports capacity shortfalls

- **WHEN** the selected group's linked active staff have less weekly capacity than the group's minimum total staffing-rule hours
- **THEN** the readiness summary reports a weekly staff capacity shortfall with the demand hours, capacity hours, and shortfall hours

#### Scenario: Pedagog capacity shortfall is reported separately

- **WHEN** the selected group's linked active pedagog staff have less weekly capacity than the group's minimum pedagog staffing-rule hours
- **THEN** the readiness summary reports a weekly pedagog capacity shortfall separately from any weekly staff capacity shortfall

#### Scenario: Capacity shortfall does not block generation

- **WHEN** the readiness summary reports a weekly staff capacity shortfall and no blocking readiness issue
- **THEN** the system still allows the user to generate a schedule plan

### Requirement: Blocking readiness issues prevent generation

The system SHALL disable generation and state the reason when the selected group has a readiness issue that makes generation impossible. A staffing rule outside institution opening hours, an absence of institution opening hours, an absence of staffing rules for the group, and an absence of linked active staff SHALL each be blocking readiness issues.

#### Scenario: Staffing rule outside opening hours blocks generation

- **WHEN** the selected group has a staffing rule that is not contained within a single institution opening hours interval on the same weekday
- **THEN** the system disables the generate action and shows the offending staffing rule with its weekday and time range

#### Scenario: Group with no linked active staff blocks generation

- **WHEN** the selected group has no linked active staff members
- **THEN** the system disables the generate action and states that the group has no linked active staff

#### Scenario: Blocking issue is detected without an AI call

- **WHEN** a blocking readiness issue exists for the selected group
- **THEN** the system reports it without calling the AI model

### Requirement: Generation does not persist a plan

The system SHALL return a generated schedule plan together with its validation result without writing it to the schedule plan or shift tables. Generation SHALL continue to record every generation attempt in the generation attempt audit record.

#### Scenario: Successful generation is not saved

- **WHEN** generation returns a plan with zero validation errors
- **THEN** the system presents the accepted plan for review and no schedule plan row or shift row is created

#### Scenario: Generation attempts are still audited

- **WHEN** a generation request produces one or more attempts
- **THEN** each attempt is recorded in the generation attempt audit record regardless of whether the plan is later accepted

#### Scenario: Unaccepted plan is discarded on reload

- **WHEN** a user generates a plan and reloads the page without accepting it
- **THEN** the generated plan is no longer shown and nothing was persisted

### Requirement: Accepting a plan persists it

The system SHALL provide an explicit accept action that saves a reviewed accepted plan as a schedule plan with its shifts, its AI warnings, and its validation warnings. The accept action SHALL be available only for a plan with zero validation errors.

#### Scenario: User accepts a valid plan

- **WHEN** a user accepts a generated schedule plan that has zero validation errors
- **THEN** the system saves the plan and its shifts in a single transaction and confirms the saved plan

#### Scenario: Accept action is unavailable for an invalid plan

- **WHEN** a generated schedule plan has one or more validation errors
- **THEN** the system does not offer an accept action for that plan

#### Scenario: Saved plan appears in the saved plans list

- **WHEN** a user accepts a generated schedule plan
- **THEN** the saved plans list shows the newly saved plan without requiring a manual refresh

#### Scenario: User regenerates instead of accepting

- **WHEN** a user chooses to regenerate rather than accept a reviewed plan
- **THEN** the system discards the reviewed plan, generates a new plan, and persists nothing from the discarded plan

### Requirement: Review shows an acceptance verdict

The system SHALL show a single acceptance verdict for a reviewed generated schedule plan. The verdict SHALL state whether the plan is an accepted plan, and SHALL be determined only by the count of validation errors.

#### Scenario: Verdict for a plan with zero validation errors

- **WHEN** a reviewed plan has zero validation errors and three AI warnings
- **THEN** the verdict states that the plan is accepted and can be saved

#### Scenario: Verdict for a plan with validation errors

- **WHEN** a reviewed plan has four validation errors
- **THEN** the verdict states that the plan is blocked and reports the number of validation errors

#### Scenario: AI warnings do not change the verdict

- **WHEN** a reviewed plan has zero validation errors and one or more AI warnings
- **THEN** the verdict is unchanged by the AI warnings

### Requirement: Validation issues are presented as localized structured entries

The system SHALL present each validation error and each validation warning as a separate localized entry derived from its issue code and context, grouped by issue code. The system SHALL NOT present multiple issues as a single joined string.

#### Scenario: Each issue is a separate entry

- **WHEN** a reviewed plan has four validation errors
- **THEN** the system shows four separate entries rather than one combined message

#### Scenario: Issues are grouped by code with a count

- **WHEN** a reviewed plan has three `outside_availability` errors and one `max_hours_exceeded` error
- **THEN** the system shows an `outside_availability` group containing three entries and a `max_hours_exceeded` group containing one entry

#### Scenario: Entry includes issue context

- **WHEN** a validation error carries a weekday, staff identifier, and time range
- **THEN** the entry shows the staff member's name, the weekday, and the time range

#### Scenario: Issue text is localized

- **WHEN** the active locale is Danish
- **THEN** each validation issue entry is shown in Danish

#### Scenario: Selecting an issue highlights it in the plan

- **WHEN** a user selects a validation issue that references a shift
- **THEN** the corresponding shift is highlighted in the plan timeline

### Requirement: Result categories are visually distinguished

The system SHALL present validation errors, validation warnings, and AI warnings as three distinct categories. Validation errors SHALL be presented as blocking and authoritative. Validation warnings SHALL be presented as non-blocking. AI warnings SHALL be labelled as non-authoritative model notes and SHALL NOT be presented adjacent to the acceptance verdict.

#### Scenario: AI warnings are labelled as non-authoritative

- **WHEN** a reviewed plan includes AI warnings
- **THEN** the AI warnings are shown under a label identifying them as model notes that do not determine acceptance

#### Scenario: Validation warnings do not block acceptance

- **WHEN** a reviewed plan has zero validation errors and one or more validation warnings
- **THEN** the accept action remains available

#### Scenario: Empty categories are omitted

- **WHEN** a reviewed plan has no validation warnings
- **THEN** no validation warnings section is shown

### Requirement: Generation failures are reported in the active locale

The system SHALL report every user-facing generation failure in the active locale, including missing or invalid group selection, missing AI gateway credentials, model errors, and a plan that still fails validation after the permitted retry.

#### Scenario: Missing credentials failure is localized

- **WHEN** generation fails because no AI gateway credentials are configured and the active locale is Danish
- **THEN** the failure message is shown in Danish

#### Scenario: Post-retry validation failure lists the issues

- **WHEN** generation fails because the plan still has validation errors after the permitted retry
- **THEN** the system shows the localized structured validation issue entries for that plan

### Requirement: Raw plan data is available but not primary

The system SHALL keep the schedule input JSON and the generated plan JSON available to the user as a collapsed disclosure that is closed by default, and SHALL NOT present either as the page's primary content.

#### Scenario: JSON is collapsed by default

- **WHEN** a user opens the shift schedule page and selects a group
- **THEN** the schedule input JSON is not visible until the user expands the disclosure

#### Scenario: JSON remains copyable

- **WHEN** a user expands the schedule input JSON disclosure
- **THEN** the user can copy the JSON to the clipboard
