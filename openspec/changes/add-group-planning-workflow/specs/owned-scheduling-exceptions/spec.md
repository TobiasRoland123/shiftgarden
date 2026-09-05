## ADDED Requirements

### Requirement: Dated exceptions belong to their domain owner

The system SHALL manage recurring settings and dated exceptions on institution, group, and staff records. Staff exceptions SHALL support leave, sickness, full-day or partial-day unavailability, and individual meetings/training. Institution exceptions SHALL support closures and replacement opening hours. Group exceptions SHALL support changed staffing minima for a dated time range. Each exception SHALL have an identifiable owner, date/range, affected intervals, type, and operational description; it SHALL NOT be owned only by a planning period.

#### Scenario: Staff member leaves early

- **WHEN** Anna is recorded as unavailable from 13:00 on 15 September on her staff record
- **THEN** relevant plans for every linked group treat her as unavailable from that time without duplicating the exception per group

#### Scenario: Whole institution changes hours

- **WHEN** a planner records replacement opening hours on the institution for a date
- **THEN** every group planning that date uses the institution exception and the recurring opening hours remain unchanged

#### Scenario: Group requires more staff temporarily

- **WHEN** Sunflowers records 4 required staff from 09:00 to 12:00 on 18 September
- **THEN** only that group's effective staffing minima in that interval change

### Requirement: Shared events have explicit participants

The system SHALL store a shared institution/group meeting or training event once with explicit participant references. Attendance SHALL affect each participant's availability across their linked groups regardless of the event's owner. Individual staff events SHALL have that staff member as participant. Meetings/training SHALL expose whether attendance counts toward the weekly scheduling cap, defaulting to true; leave/sickness SHALL NOT create scheduled work minutes. Shared event work minutes SHALL be counted once per participant.

#### Scenario: Participant belongs to two groups

- **WHEN** a staff member linked to Sunflowers and Butterflies attends one shared training event from 10:00 to 12:00
- **THEN** both groups see that person unavailable during attendance and the weekly committed-work total includes at most one 2-hour event contribution

#### Scenario: Group member is not attending

- **WHEN** a group-owned meeting lists only two of the group's staff as participants
- **THEN** staff not listed remain subject to their normal availability and other commitments

#### Scenario: Saved training is an authoritative commitment

- **WHEN** counted training is saved on its owning record before any group schedule is published
- **THEN** effective availability and weekly totals already include it, including full-week dates outside the requested period

### Requirement: Event attendance is visible and snapshotted

The calendar SHALL show relevant meeting/training attendance as distinct read-only blocks that provide no group coverage. Weekly-budget details SHALL distinguish shift minutes from counted attendance, including relevant commitments outside the visible period. Published input snapshots SHALL retain event identity, participants, intervals, and accounting flags so historical context remains readable after live event edits.

#### Scenario: Attendance consumes time but supplies no group coverage

- **WHEN** a staff member attends training from 10:00 to 12:00
- **THEN** the calendar displays attendance, counts configured work minutes once, and does not count that attendance as staffing coverage

#### Scenario: Historical attendance context is preserved

- **WHEN** an event changes after a version was published
- **THEN** the historical version retains its recorded event context and the live change is shown separately as a current input impact

### Requirement: Effective inputs preserve provenance and relevance

The system SHALL assemble effective inputs for the chosen group/date range from recurring settings, relevant owner exceptions, participants, and authoritative published commitments. The preparation screen SHALL show affected dates/times, resulting effects, and links to the owning records. Contextual edits SHALL save to those records and explain their scope. Unrelated exceptions SHALL NOT appear as affecting the period. Weekly accounting SHALL include relevant commitments outside the period within intersecting Monday–Sunday weeks.

#### Scenario: Relevant and irrelevant staff exceptions

- **WHEN** Anna's exception overlaps the selected period but a non-participating staff member's exception does not affect this group
- **THEN** preparation includes Anna's exception and excludes the unrelated exception

#### Scenario: Exception is opened from preparation

- **WHEN** the planner selects the source link for an institution closure
- **THEN** the system opens the institution's exception record and provides a route back to preparation

### Requirement: Dated opening and staffing replacements compose predictably

An institution opening exception SHALL replace recurring opening intervals for each affected date, with an empty set representing closure. Recurring group requirements SHALL be intersected with that date's effective opening intervals and suppressed portions SHALL be explained in preparation. A dated group staffing exception SHALL replace the usual minima only within its specified interval. Explicit dated requirements outside effective opening hours SHALL be reported as input conflicts. Conflicting overlapping opening replacements for the same institution/date or staffing replacements for the same group/time SHALL be rejected rather than resolved by write order.

#### Scenario: Closure suppresses recurring demand

- **WHEN** the institution is closed on a date that ordinarily has recurring staffing requirements
- **THEN** the effective date has no group shifts or recurring coverage demand and preparation explains the closure's effect

#### Scenario: Explicit staffing demand conflicts with closure

- **WHEN** a dated group requirement demands coverage during a dated institution closure
- **THEN** preparation reports an actionable input conflict with both sources and generation does not proceed until resolved

#### Scenario: Partial staffing replacement leaves other times intact

- **WHEN** an exception replaces 3 required staff with 4 from 09:00 to 12:00
- **THEN** the effective minimum is 4 for that interval and the usual requirements remain outside it

#### Scenario: Requirement boundaries split consistently

- **WHEN** recurring requirements change at 10:00 and a dated replacement spans 09:00 to 12:00 inside effective opening hours
- **THEN** every resulting segment from 09:00 to 12:00 uses the replacement minima, segments outside it use recurring independent maxima, and every segment retains its opening/rule/replacement source references

### Requirement: Unavailability restricts scheduling without duplicating time

The system SHALL subtract the union of staff absences and event attendance from recurring availability. A shift SHALL fit within one resulting availability interval. Exceptions SHALL NOT implicitly expand availability or waive institution/group rules. Overlapping counted-work events for one participant SHALL be surfaced as a conflict rather than double-counted as independent availability.

#### Scenario: Partial-day absence splits availability

- **WHEN** a staff member is ordinarily available 08:00 to 16:00 and unavailable 11:00 to 13:00
- **THEN** effective availability is 08:00 to 11:00 and 13:00 to 16:00 and a shift spanning the gap fails validation

#### Scenario: Overlapping absences

- **WHEN** a staff member has absence intervals 10:00 to 12:00 and 11:00 to 13:00 on one date
- **THEN** the effective unavailable interval is 10:00 to 13:00 without duplicate duration effects

### Requirement: Source changes invalidate relevant review state

The system SHALL record source identities/revisions and an effective-input fingerprint on generation, draft validation, and AI proposals. It SHALL detect relevant changes when opening/refreshing drafts and before generation, AI application, and publication. Affected drafts SHALL identify changed sources/dates and require renewed review. Refreshing inputs SHALL retain existing shifts and revalidate them. Published snapshots SHALL remain unchanged, with any newly detected live conflicts shown separately. Irrelevant source edits SHALL NOT force renewed review.

#### Scenario: Staff absence added after generation

- **WHEN** new sickness overlaps a generated draft shift
- **THEN** the draft is flagged for review, the shift remains visible, current validation reports the conflict, and publication requires resolution

#### Scenario: Institution setting changes during AI work

- **WHEN** relevant effective opening hours change after an AI request starts
- **THEN** its old proposal cannot be applied using the earlier fingerprint

#### Scenario: Unrelated dates change

- **WHEN** an exception changes outside the period and every intersecting weekly commitment boundary
- **THEN** an unchanged relevant fingerprint leaves the draft's review state valid
