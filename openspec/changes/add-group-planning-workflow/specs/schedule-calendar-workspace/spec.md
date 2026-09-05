## ADDED Requirements

### Requirement: The workspace edits shifts on actual calendar dates

The system SHALL provide a persistent calendar workspace for the selected group's dated period. It SHALL support week and day navigation using actual dates and SHALL keep all edits scoped to the selected period and group.

#### Scenario: Week navigation uses Monday through Sunday

- **WHEN** a planner opens a week within a period
- **THEN** the workspace shows the actual Monday-through-Sunday dates for that week, including dates outside the period only as clearly non-editable context when necessary

#### Scenario: Day navigation opens the selected date

- **WHEN** a planner selects a date in the period
- **THEN** the workspace opens that actual date and its shifts for editing

### Requirement: Planners can perform direct shift edits with accessible alternatives

The workspace SHALL support clicking to edit a shift, adding, deleting, reassigning, and changing its exact start and end times. It SHALL support pointer drag to move and resize a shift and provide keyboard-operable alternatives for every such action.

#### Scenario: Planner edits shift details

- **WHEN** a planner changes a shift's staff member or exact interval
- **THEN** the workspace updates that dated shift in the working draft

#### Scenario: Planner drags a shift

- **WHEN** a planner drags a shift to another date or time, or drags an edge to resize it
- **THEN** the workspace records the corresponding move or interval change in the draft

#### Scenario: Keyboard alternative changes a shift

- **WHEN** a planner uses the documented keyboard controls to move or resize a focused shift
- **THEN** the workspace makes the same change without requiring pointer input

### Requirement: Draft persistence permits intermediate rule-invalid manual edits

The system SHALL persist structurally valid manual edits even when deterministic scheduling rules are currently violated. Such a draft MUST NOT be represented as an accepted plan and MUST NOT be eligible for publication while it has validation errors.

#### Scenario: Manual edit creates a coverage gap

- **WHEN** a planner deletes a shift and the draft no longer meets a staffing minimum
- **THEN** the system saves the structurally valid draft, marks the coverage issue, and keeps it ineligible for acceptance or publication

#### Scenario: Malformed shift is rejected

- **WHEN** a planner submits a shift with missing required identity or an end time that is not after its start time
- **THEN** the system rejects that structural edit and leaves the last structurally valid draft unchanged

### Requirement: Validation reports precise selectable coverage and conflict issues

The system MUST validate the current assembled inputs and draft using exact date and time intervals. It SHALL report total-staff coverage and pedagog coverage as distinct issue types, count distinct staff IDs for coverage, and make each issue selectable so the planner can locate the affected date, interval, and shifts.

#### Scenario: Total and pedagog coverage are reported separately

- **WHEN** an interval has enough total staff but too few pedagogs
- **THEN** validation reports a pedagog coverage error without incorrectly reporting a total-staff error

#### Scenario: Duplicate assignment does not inflate coverage

- **WHEN** the same staff ID appears in overlapping shifts covering an interval
- **THEN** total and pedagog counts use distinct staff IDs and validation identifies the overlapping assignment as applicable

#### Scenario: Planner selects an issue

- **WHEN** a planner selects a validation issue
- **THEN** the workspace navigates or focuses the affected actual date and exact interval and identifies the related shift or source input

### Requirement: Shift locks are explicit and protect against AI changes

The system SHALL let the planner explicitly toggle a lock on an individual shift. A locked shift MUST be protected from AI proposals, including proposed deletion, until the planner unlocks it.

#### Scenario: Planner locks a shift

- **WHEN** a planner toggles a shift to locked
- **THEN** the draft records the lock and AI proposals cannot move, resize, reassign, or delete that shift

#### Scenario: Planner unlocks a shift

- **WHEN** a planner explicitly toggles a locked shift off
- **THEN** subsequent eligible AI proposals may target that shift subject to scope and validation rules

### Requirement: Undo is limited to planner history and safe with concurrent edits

The workspace SHALL provide undo for the planner's own latest applicable change using a single planner history. Undo MUST preserve edits made by another actor after the original change and MUST reject or safely skip an undo that would overwrite a newer conflicting edit.

#### Scenario: Planner undoes their latest edit

- **WHEN** the planner changes a shift and immediately invokes undo
- **THEN** the workspace restores the prior value and advances the draft revision

#### Scenario: Undo does not erase another edit

- **WHEN** another actor edits the same draft after the planner's change and before undo
- **THEN** undo does not overwrite the newer actor's edit and reports that the history entry is stale or conflicted

### Requirement: Draft readiness is derived from current full-period validation

The workspace MUST run current deterministic validation over the full assembled period before marking a draft ready for publication. A draft with any validation error SHALL remain editable and SHALL be blocked from publication. Readiness SHALL be derived from validation, without adding a separate planner acceptance step between editing and publication review.

#### Scenario: Error-free draft is ready for publication review

- **WHEN** the full current period draft has zero validation errors
- **THEN** the workspace marks it ready for publication review without publishing it

#### Scenario: Error draft remains a working draft

- **WHEN** current validation finds one or more errors
- **THEN** the workspace keeps the draft editable and blocks publication while exposing the issues
