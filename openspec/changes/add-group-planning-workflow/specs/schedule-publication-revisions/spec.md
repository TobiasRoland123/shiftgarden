## ADDED Requirements

### Requirement: Publication is separate from acceptance and draft saving

The system SHALL distinguish an accepted generated result, an editable working draft, and an official published version. Passing validation or saving/applying changes SHALL NOT publish a schedule. Publication SHALL require an explicit planner action after a review showing group, dates, validation results, warnings, and changes. Current hard validation errors SHALL block publication; non-blocking validation warnings and labelled AI notes SHALL remain visible without becoming errors.

#### Scenario: Valid generation creates a draft

- **WHEN** a generated schedule passes deterministic validation and is saved
- **THEN** it is available for review as a draft and no official version is created

#### Scenario: Manual edit creates a coverage error

- **WHEN** a saved manual edit leaves required coverage unmet
- **THEN** the draft remains editable and publication is blocked with a link to the affected calendar interval

#### Scenario: Warnings do not prohibit publication

- **WHEN** current deterministic validation has zero errors and only non-blocking warnings
- **THEN** review displays those warnings and permits explicit publication

### Requirement: Published versions remain immutable during revisions

The system SHALL open published schedules read-only. An explicit edit action SHALL create or resume the period's single active draft revision based on the current published version. Manual and AI edits SHALL affect only that draft. Publication of the revision SHALL create a new immutable version and replace the official pointer atomically. Previous versions SHALL remain readable from stored snapshots.

#### Scenario: Planner edits a published schedule

- **WHEN** the planner selects Edit schedule on published version 1
- **THEN** a draft revision opens and version 1 remains official until revision publication

#### Scenario: Revision replaces official version

- **WHEN** a reviewed valid revision of version 1 is published
- **THEN** version 2 becomes official and version 1 remains available in history

#### Scenario: Staff is renamed or deactivated

- **WHEN** a staff member referenced by a published version is renamed or deactivated
- **THEN** that version retains its snapshotted identity and shifts, while new drafts use current eligibility

### Requirement: Current inputs are checked at the publication boundary

Publication SHALL verify the expected draft revision, reviewed relevant-input fingerprint, and current base published version. It SHALL rebuild or verify current effective inputs and validate the entire period including full-week external commitments. A stale revision or changed relevant input SHALL prevent publication until reviewed and revalidated. Structurally invalid or partially generated drafts SHALL NOT be publishable.

#### Scenario: Another group commits shared staff after review

- **WHEN** another group publishes a conflicting staff assignment before this draft is published
- **THEN** publication does not rely on the old green validation result and reports the new conflict

#### Scenario: Draft changed in another session

- **WHEN** publication submits an expected revision that is older than the current draft revision
- **THEN** the request is rejected without overwriting changes or creating a version

### Requirement: Publication is atomic and idempotent

The system SHALL serialize competing publications and relevant source mutations sufficiently to prevent two successful publications from committing incompatible staff assignments or weekly totals. Creating the immutable version, updating the official pointer, and consuming the draft SHALL be one transaction. Retrying the same publication request SHALL return the same published outcome without creating another version. No database lock SHALL be held across an AI model call.

#### Scenario: Concurrent groups compete for the same staff

- **WHEN** two groups simultaneously publish drafts assigning the same staff member to overlapping times
- **THEN** at most one succeeds and the other receives a current conflict instead of both becoming official

#### Scenario: Publication response is lost

- **WHEN** a successful publication is retried with the same request identity
- **THEN** the existing version is returned and the version number does not advance again

#### Scenario: Version write fails

- **WHEN** persistence fails before the publication transaction completes
- **THEN** neither a partial official version nor a changed official pointer remains and the draft is recoverable

### Requirement: Draft conflicts are advisory until publication

Published versions SHALL reserve staff commitments; other groups' working drafts SHALL NOT reserve them. Detected overlap or weekly-hour competition with other drafts SHALL be shown as advisory concerns with the affected group/date. Publishing one draft SHALL cause dependent drafts to detect the new authoritative commitment on their next freshness check. Historical superseded versions and a revision's own replaced version SHALL NOT be counted twice.

#### Scenario: Two drafts share a candidate

- **WHEN** two groups have unpublished drafts assigning the same staff member at overlapping times
- **THEN** planners see the draft conflict and either draft can be reviewed for publication subject to current authoritative checks

#### Scenario: One competing draft publishes first

- **WHEN** the first draft is published
- **THEN** the second must revalidate against its assignments and cannot publish the conflicting shifts

### Requirement: Planning history survives owner lifecycle changes

Published versions SHALL retain immutable input, shift, validation, and display-identity snapshots. Deleting referenced planning owners SHALL NOT cascade-delete published history. The application SHALL use deactivation or a clear deletion restriction for referenced records. Unpublished draft discard SHALL require an explicit action and SHALL NOT delete official or historical versions.

#### Scenario: Referenced staff record is deleted

- **WHEN** a deletion is attempted for a staff member needed by retained planning history
- **THEN** the deletion is restricted or replaced by deactivation and the published history remains readable

#### Scenario: Unpublished revision is discarded

- **WHEN** the planner explicitly discards a draft revision
- **THEN** the current published version remains official and its history is unchanged
