## ADDED Requirements

### Requirement: Planners work from a group-first planning overview

The system SHALL provide an overview organized by group. For each group it SHALL show dated planning periods, the period's saved draft or published version when present, and dates that remain unplanned. A planning operation SHALL select exactly one group before a period is created or opened.

#### Scenario: Overview shows planning state by group

- **WHEN** a planner opens the planning overview
- **THEN** the system shows each group with its dated periods, available saved work or published version, and unplanned dates

#### Scenario: A planning operation has one group

- **WHEN** a planner starts or opens a planning operation
- **THEN** the operation has exactly one selected group and cannot combine groups in its period editor

### Requirement: Planning periods use inclusive arbitrary dates

The system SHALL allow a planner to create a period with an inclusive start date and inclusive end date, including periods containing weekends. The start date MUST be on or before the end date. A group SHALL NOT have overlapping non-abandoned planning periods.

#### Scenario: Period includes weekend dates

- **WHEN** a planner creates a period from Friday through the following Sunday
- **THEN** the system stores and plans every date in that inclusive range, including Saturday and Sunday

#### Scenario: Reversed dates are rejected

- **WHEN** the planner submits an end date earlier than the start date
- **THEN** the system rejects the period and explains that the range is invalid

#### Scenario: Overlapping active periods are rejected

- **WHEN** a new period overlaps an existing non-abandoned period for the same group
- **THEN** the system rejects creation and identifies the conflicting period

#### Scenario: Abandoned period does not block a new period

- **WHEN** a new period overlaps only an abandoned period for the same group
- **THEN** the system allows creation subject to the other period rules

### Requirement: Period dates use an explicit institution timezone

The system SHALL store the institution's IANA timezone and snapshot it on each planning period. Dates SHALL remain institution-local calendar dates across browsers and DST changes. Shifts SHALL use same-day half-open time intervals; overnight shifts SHALL be rejected. Date changes during preparation SHALL repeat range/overlap validation; dates SHALL be fixed after generation.

#### Scenario: Browser uses another timezone

- **WHEN** a planner views the same period from a browser with a different timezone
- **THEN** its dates and local shift times remain those of the period's institution timezone

#### Scenario: Adjacent periods are allowed

- **WHEN** one period ends on 4 October and the next starts on 5 October for the same group
- **THEN** the date-overlap rule permits both

#### Scenario: Generated period cannot silently change dates

- **WHEN** a planner attempts to change the range of a generated schedule
- **THEN** the system preserves its existing dates and directs new dates to a separate adjacent or otherwise non-overlapping period

### Requirement: Preparation assembles current owned inputs for the full period

The system MUST prepare a period from the selected group's usual settings and all dated exceptions and shared events owned by the institution, group, or relevant staff that intersect the inclusive range. Each included exception MUST retain a link to its owning source record and its effective revision or freshness identity. Preparation SHALL validate every date in the range and the full assembled range before generation.

#### Scenario: Relevant exception is included with its source

- **WHEN** a staff leave record owned by a selected group's staff member intersects the period
- **THEN** preparation includes the leave in effective inputs and exposes a link to that staff record

#### Scenario: Irrelevant exception is excluded

- **WHEN** an owned exception has no effect on the selected period or its full-week commitment accounting
- **THEN** preparation excludes it from effective inputs

#### Scenario: Full range validation finds a later date problem

- **WHEN** all early dates assemble successfully but a malformed setting or exception affects a later date in the range
- **THEN** preparation fails before generation and reports the later-date validation issue

#### Scenario: Weekly budget includes commitments beyond this period

- **WHEN** a selected period covers only part of an ISO Monday-through-Sunday week
- **THEN** effective inputs calculate that week's staff budget using all published commitments for the staff member, including commitments on dates outside the selected period and commitments in other groups

### Requirement: Saved preparation and drafts are resumable

The system SHALL persist preparation progress and the period's working draft so a planner can leave and resume the same period without losing completed work. There SHALL be at most one active working draft for a period, with a monotonic revision or version counter and a fingerprint of the relevant assembled inputs.

#### Scenario: Planner resumes saved preparation

- **WHEN** a planner leaves a period after saving preparation and later reopens it
- **THEN** the system restores the saved preparation state and lets the planner continue

#### Scenario: Planner resumes a draft

- **WHEN** a planner reopens a period with a saved working draft
- **THEN** the system opens that draft with its current revision and relevant-input fingerprint

#### Scenario: New revision replaces the active draft identity

- **WHEN** a draft is saved after an edit
- **THEN** the system advances its revision counter while retaining one active draft for the period

### Requirement: Every new period receives fresh generation

The system MUST perform a fresh generation for every newly created period from that period's assembled inputs. Creating a new period MUST NOT reuse, copy, or infer shifts from an earlier plan or period. Opening an existing schedule for changes SHALL use a separate editing flow.

#### Scenario: New period does not copy an earlier plan

- **WHEN** a group has an earlier plan and a planner creates a new period
- **THEN** the new period starts from its own preparation and has no copied shifts from the earlier plan

#### Scenario: Existing schedule uses editing flow

- **WHEN** a planner chooses an existing schedule rather than creating a new period
- **THEN** the system opens the separate existing-schedule editing flow

### Requirement: Generation failure preserves recoverable work

The system SHALL validate the generated result for every actual date and the full assembled range before saving it as an accepted draft. It SHALL keep the saved preparation and any prior draft when generation fails. For each full generation request or generation slice, the system MUST make no more than one correction retry. A retry SHALL be idempotent for the same request identity and input fingerprint; repeating that retry MUST NOT create duplicate drafts or shifts.

#### Scenario: Failed generation preserves preparation

- **WHEN** generation and its permitted retry fail
- **THEN** the system reports the failure and leaves the saved preparation and prior draft available for resume

#### Scenario: Retry limit is bounded per slice

- **WHEN** a generation request contains multiple generation slices and a slice fails validation
- **THEN** that slice receives at most one correction retry, and no slice is retried indefinitely

#### Scenario: Repeated retry is idempotent

- **WHEN** the same retry request is submitted again with the same request identity and input fingerprint
- **THEN** the system returns the existing retry result or failure without duplicating persisted schedule content

### Requirement: Undated legacy plans remain read-only

The system SHALL preserve existing plans without dates as immutable legacy records. It MUST expose them as read-only legacy plans and MUST NOT guess dates, period membership, or publication status for them.

#### Scenario: Legacy plan is viewed

- **WHEN** a planner opens a plan with no stored dates
- **THEN** the system labels it as legacy and permits viewing without treating it as a dated period

#### Scenario: Legacy plan cannot be edited as a dated period

- **WHEN** a planner attempts to change a legacy plan through the dated workflow
- **THEN** the system prevents the edit and does not invent dates or publication metadata
