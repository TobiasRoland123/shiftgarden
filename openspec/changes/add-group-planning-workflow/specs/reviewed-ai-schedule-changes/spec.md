## ADDED Requirements

### Requirement: AI requests have an explicit calendar scope

The system SHALL scope each AI request to the selected group's working draft and one declared calendar scope: a day, a week, or the whole period. A request that does not declare a scope SHALL default to the current day or current week according to the active workspace view and MUST ask the planner before expanding beyond that default.

#### Scenario: Request defaults to current day

- **WHEN** the planner submits free text from a day view without naming a broader range
- **THEN** the system treats the request as scoped to the current day and asks before including additional dates

#### Scenario: Request names a week

- **WHEN** the planner asks AI to adjust a named week
- **THEN** the request scope is that actual Monday-through-Sunday week intersected with the selected period

#### Scenario: Expansion requires confirmation

- **WHEN** the planner's request could affect dates outside the default current day or week
- **THEN** the system asks for explicit scope confirmation before generating a proposal

### Requirement: AI produces an isolated revision-bound proposal

The system MUST generate a proposal as a patch against the current draft revision and relevant-input snapshot hash. The patch SHALL address stable shift IDs and declared scope, and generation MUST NOT write shifts, locks, exceptions, or any other draft content directly.

#### Scenario: Proposal records its base

- **WHEN** AI returns a schedule-change proposal
- **THEN** the proposal records the draft revision, relevant-input snapshot hash, declared scope, and stable shift IDs used by its operations

#### Scenario: Generation has no direct write

- **WHEN** AI generation completes
- **THEN** the working draft remains unchanged until the planner explicitly applies the proposal

### Requirement: Proposal review shows exact before-and-after effects

The system SHALL show the planner the exact shifts created, updated, moved, resized, reassigned, or deleted, with before-and-after calendar values and current validation results. The review SHALL expose the affected actual dates and any related validation issues.

#### Scenario: Planner reviews a shift update

- **WHEN** a proposal changes a shift's staff member or interval
- **THEN** review identifies the shift by staff, date and interval, shows the complete before and after values and validation results, and retains the stable shift ID internally

#### Scenario: Planner reviews a deletion

- **WHEN** a proposal deletes a shift
- **THEN** review identifies the exact shift and actual date and shows its removal in the before-and-after view

### Requirement: Applying a proposal is explicit and atomic

The system SHALL provide explicit whole-proposal Apply, Discard, and Refine actions. Apply MUST validate and commit the complete patch atomically against its recorded draft revision and input snapshot; if any operation is invalid, no operation in the patch SHALL be committed. Apply SHALL be idempotent by request identity. Discard SHALL leave the draft unchanged, and Refine SHALL create a new proposal request without applying the old patch.

#### Scenario: Planner applies a valid proposal

- **WHEN** the planner chooses Apply and the complete patch passes server validation with zero errors
- **THEN** all proposal operations commit together as one new draft revision

#### Scenario: Planner discards a proposal

- **WHEN** the planner chooses Discard
- **THEN** the working draft remains byte-for-byte unchanged and the proposal is marked discarded

#### Scenario: Atomic apply rejects one invalid operation

- **WHEN** one operation in a multi-operation proposal is malformed, out of scope, locked, or would leave a validation error
- **THEN** the system commits none of the operations and reports the failing issues

#### Scenario: Planner refines instead of applying

- **WHEN** the planner chooses Refine and supplies an adjusted request
- **THEN** the system generates a new isolated proposal from the unchanged draft

#### Scenario: Successful application response is lost

- **WHEN** the planner retries an already successful Apply request with the same identity
- **THEN** the system returns the recorded result without applying operations again or advancing the draft revision twice

### Requirement: Server enforcement protects scope, locks, and manual work

The server MUST reject malformed patches, operations outside the declared scope, references to missing or unstable shift IDs, and operations targeting locked shifts, including deletion. Proposal application MUST NOT silently alter manual edits outside the declared scope.

#### Scenario: Out-of-scope operation is rejected

- **WHEN** a proposal includes an operation on a date outside its declared day, week, or period scope
- **THEN** server application rejects the proposal and leaves the draft unchanged

#### Scenario: Locked deletion is rejected

- **WHEN** a proposal attempts to delete a locked shift
- **THEN** server application rejects that operation and commits no part of the proposal

#### Scenario: Manual edit outside scope survives

- **WHEN** a planner manually changes a shift outside the AI request scope while a proposal is being reviewed
- **THEN** the proposal is stale because the draft revision advanced, Apply is rejected, and the manual change remains intact until a new proposal is requested

### Requirement: Proposals require fresh draft and input state

The system SHALL invalidate a proposal when the base draft revision or relevant-input fingerprint changes after proposal creation, including relevant owner-source or authoritative external commitment changes. An unrelated source update with an unchanged relevant fingerprint SHALL NOT invalidate the proposal. If a user edit occurs while generation is running, the returned proposal MUST be rejected as stale and MUST NOT be auto-merged.

#### Scenario: Draft edit makes proposal stale

- **WHEN** the draft revision advances before the planner applies a proposal
- **THEN** Apply is rejected as stale and the draft remains unchanged

#### Scenario: Source or commitment change makes proposal stale

- **WHEN** a relevant owned exception source or shared commitment changes after proposal creation
- **THEN** the proposal is invalidated and the planner is told to regenerate from fresh inputs

#### Scenario: Concurrent edit during generation is rejected

- **WHEN** the planner edits the draft while an AI request is still generating
- **THEN** the generated result is rejected as stale rather than applied or merged automatically

### Requirement: Failed or impossible assistance is actionable and side-effect free

When AI cannot produce a valid proposal, the system SHALL explain known deterministic failures and provide links to relevant owner sources or validation issues when available. It SHALL distinguish a failed AI attempt from proof that no solution exists. It MUST NOT automatically edit exceptions, availability, staffing rules, or other owner records to make a proposal possible.

#### Scenario: Impossible request explains blocking causes

- **WHEN** no schedule satisfying the request can be generated because of availability, coverage, or commitment constraints
- **THEN** the system reports those causes and links to the relevant owning records or issues for planner action

#### Scenario: AI does not change owner inputs

- **WHEN** a proposal would require changing a staff leave, availability, or group exception
- **THEN** the system refuses that proposal and leaves all owner records and the draft unchanged
