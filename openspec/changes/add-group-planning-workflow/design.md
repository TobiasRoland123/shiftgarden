## Context

The agreed product flow is group-first planning for real dates. A new schedule is generated fresh; an existing schedule is opened for manual or AI-assisted editing. Exceptions remain on their owning records. AI changes require preview and explicit application. Publication is a separate decision from validation.

The current application uses Next.js App Router, React, next-intl, Zod, Drizzle/Neon, and the AI SDK. `app/[locale]/shift-schedule/actions.ts` accepts a group ID, generates a seven-day schedule, performs deterministic validation with at most one correction retry, and saves an accepted result transactionally. `lib/db/schema.ts` stores weekday-only shifts with no period, draft revision, or publication state. A staff member can belong to multiple groups.

Current specifications lag behind the implementation: seven-day generation and institution opening hours already exist. The validator also enforces FIFO end order, although the base validation spec does not describe it. This proposal preserves that implemented rule and updates the spec rather than silently relaxing it.

The completed but unarchived `warn-group-capacity-shortfall` change remains separate. Its aggregate capacity warnings do not prove dated feasibility and must not become publication blockers by themselves.

## Goals / Non-Goals

**Goals:**

- Deliver the complete agreed create, review, edit, and publish flows with durable records.
- Keep institution, group, and staff settings extensible without moving ownership into a planning wizard.
- Use one dated effective-input model and deterministic validator for generation, manual editing, AI proposals, and publication.
- Prevent lost changes, stale AI applications, double-booked staff, and silent changes to official schedules.
- Preserve legacy POC records and provide a self-contained implementation handoff.

**Non-Goals:**

- Planning all groups in one generation request, copying a previous schedule into a new period, recurring schedule templates, or automatic AI application.
- Staff self-service, leave approval workflows, payroll, email/push notifications, calendar integrations, or a new authorization/role system.
- Overnight shifts, arbitrary recurrence rules for exceptions, multiple institutions per deployment, or collaborative live cursors.
- A new calendar library or background-job platform by default. Choose dependencies only after assessing the existing timeline and deployment constraints.

## Decisions

### 1. Separate periods, working drafts, and published versions

Introduce additive storage rather than assigning invented dates to old plans. Suggested logical records follow; exact table names can follow repository conventions.

| Record                  | Important fields and purpose                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Planning period         | Group ID, inclusive start/end local dates, institution timezone, lifecycle, current published version ID                                         |
| Working draft           | Period ID, optional base published version ID, monotonic revision, preparation/generation state, input snapshot and fingerprint, last validation |
| Draft shift             | Stable ID, draft ID, staff ID, actual date, local start/end time, lock state                                                                     |
| Published version       | Period ID, version number, immutable dated shift snapshot, input and validation snapshots, publication timestamp, prior version ID               |
| AI change proposal      | Draft ID/revision, effective-input fingerprint, request/scope, structured operations, before/after validation, state                             |
| Generation attempt      | Period/draft ID and revision, request ID, optional generation slice, model, input/output, validation outcome; retain existing audit semantics    |
| Owner exception / event | Typed owner reference, local date/range and time intervals, type, details, source revision; shared event participant relations                   |

Allow one active working draft per period. A published period can have a working revision at the same time; the official pointer stays unchanged until publication. Use stable shift IDs across a revision and its patches. Preserve staff names/roles and group names in published snapshots so later edits or deletions do not rewrite history.

Keep workflow state separate from validation state. “Accepted” describes a generated result's successful deterministic validation, not another planner approval or a permanently valid draft status.

| Workflow state                | Transition                                                           | Validation/publication effect                                                         |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Preparation                   | Save dates and resolved inputs; start generation                     | No accepted shifts and no official version                                            |
| Generating                    | Stage slices and attempts                                            | Partial results are not an editable accepted schedule                                 |
| Generation failed/interrupted | Return to saved preparation/retry                                    | Preserve any pre-existing work; never label partial output accepted                   |
| Editing                       | Valid generation or explicit revision creation opens a working draft | Validation is unknown, stale, current with errors, or current with zero errors        |
| Editing after manual save     | Increment draft revision                                             | Persist structural edits and current rule errors; invalidate older proposals          |
| Reviewing AI proposal         | Store candidate separately                                           | No draft mutation; discard/refine stays in editing                                    |
| Editing after AI application  | Commit reviewed patch as one revision                                | Require a current zero-error full candidate                                           |
| Published                     | Commit immutable version and consume draft                           | Official pointer moves; no further edits to this version                              |
| Discarded unpublished work    | Explicit discard                                                     | Preserve published/history; release period dates only when no official version exists |

Opening a published schedule starts read-only. `Edit schedule` moves into Editing by creating/resuming a revision. There is no separate “accept draft” button.

For the same group, block overlapping non-abandoned periods, including partial overlap; adjacent periods are allowed. Check this transactionally. Retain a visible route to the conflicting period. An unpublished preparation/draft can be explicitly discarded to release its dates; do not remove published history. Changing dates is allowed during preparation, subject to the same overlap check; dates are fixed after generation. To extend beyond a published period, create an adjacent period.

Alternative considered: add nullable dates and a status to the old accepted-plan table. Separate records avoid confusing undated accepted plans with official schedules and avoid destructive migration of current history.

### 2. Define date and week boundaries explicitly

Use database dates and local wall-clock times for scheduling. Store an IANA timezone on the institution and snapshot it on a period; initial deployment default is `Europe/Copenhagen`, editable at institution level. This is a proposal assumption based on this project's context, not a claim that a timezone field exists today.

Start and end dates are inclusive, including weekends and closed days. Every generated date appears exactly once, with no shifts on a closed date. Time intervals are half-open, so `09:00–12:00` and `12:00–15:00` are adjacent. Keep same-day shifts and the current minute precision; reject an end time not after its start. Do not reinterpret local dates through the browser timezone.

Weekly maxima apply separately to each local Monday–Sunday week. Do not prorate the cap for a partial week. Load published commitments for the entire intersecting week, including dates outside the requested period and commitments in other groups. When validating a revision, substitute its shifts for its own published version rather than counting both. Use timezone-aware boundary handling and test DST transitions; overnight and ambiguous overnight-time scheduling remain out of scope.

Alternative considered: attach a start date to a reusable weekly result. That cannot represent arbitrary ranges, exceptions, or shared staff commitments correctly.

### 3. Keep exceptions typed and owned; compose effective inputs once

Maintain recurring settings at the existing institution, group, and staff pages. Add dated-exception sections there. The preparation screen reads their effective results and links back to the source; a contextual editing shortcut must still save to the source and explain its wider effect.

| Owner             | Supported dated data                                           | Effective result                                                                                                 |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Staff             | Leave, sickness, leave early, other partial-day unavailability | Subtract blocked intervals from that person's recurring availability in every linked group                       |
| Staff             | Individual meeting/training                                    | Participant unavailability plus working-time accounting when configured to count                                 |
| Group             | Replacement staffing requirements for a dated time interval    | Replace usual minima in that interval, preserving requirements outside it                                        |
| Institution       | Closed date or replacement opening intervals                   | Replace recurring opening hours for the affected date                                                            |
| Institution/group | Shared meeting/training with explicit participants             | One event with participant links; block participants across all groups, count each participant's event time once |

Use typed relations/constraints, not an unvalidated settings JSON bag or duplicated per-plan exceptions. Staff events have an implicit single participant; shared events have explicit participants. An event owned by a group does not block every group member unless they are selected. Store only operational reasons needed for planning; a sickness event does not require medical details.

Composition order:

1. Expand recurring opening intervals, group rules, staff availability, roles, and hour limits onto actual dates.
2. Apply the institution's dated opening replacement. Suppress/trim recurring coverage requirements outside those dated hours and show that effect in preparation. This makes an intentional closure usable without editing each group's recurring rules.
3. Apply explicit dated group requirement replacements to their time segments. An explicit dated requirement outside effective opening hours is an input conflict, not an instruction to reopen the institution. Reject conflicting overlapping replacements at the same owner/time; do not choose by last-write order.
4. Subtract staff unavailability and event attendance. Union overlapping absence intervals; an overlap must not subtract time twice. Subtract authoritative published shifts in other groups for candidate allocation.
5. Add weekly committed-work totals, source references, and an effective-input fingerprint. Return effective intervals and explainable conflicts, not only a prompt string.

Ordinary overlapping recurring staffing rules remain independently required; the per-segment total and pedagog minima are their independent maxima, not a sum. Keep the existing definition that pedagogs are a subset of total staff.

Compute dated demand on the sorted union of opening, recurring-rule, and dated-replacement boundaries. For each half-open segment inside effective opening hours, use the dated replacement's minima if one covers it; otherwise use the independent maxima of covering recurring rules, or zero if none cover it. Split a replacement at these boundaries without changing its meaning. Retain the opening source, contributing rule IDs, replacement ID, and any suppressed recurring-rule IDs on resulting segments. Reject overlapping dated replacements before segmentation. A recurring rule outside ordinary opening hours remains an input error; only an explicit dated opening replacement triggers the documented trimming behavior.

Working-time assumption for implementation: meeting/training events carry an explicit `countsTowardWeeklyHours` value, default true; leave/sickness are availability restrictions, not scheduled work minutes. Show this setting on the owning event. Count a shared event once per participant even if several linked groups are being planned. This is scheduling-cap accounting, not payroll calculation.

Saved owner events are authoritative commitments immediately, independent of whether a group's schedule is drafted or published. Query counted attendance across the entire intersecting ISO weeks. Show attendance as distinct read-only calendar blocks and as a separate contribution in weekly totals; it supplies no group coverage. Include relevant event IDs, participants, intervals, and accounting flags in input/version snapshots. Historical versions display their recorded attendance context; a changed live event triggers source-impact review. An event outside the visible period can still affect its weekly budget and must be listed in that budget's detail.

Alternative considered: exceptions owned by the planning period. That duplicates staff facts across groups and makes other schedules unaware of the change.

### 4. Track relevant changes without silently rewriting schedules

Snapshot resolved inputs with source IDs/revisions and compute a deterministic fingerprint. Include effective opening/rule/availability data, active group membership and roles, weekly caps, relevant events, and authoritative published commitments across the affected weeks.

Compare the current relevant fingerprint on opening/refreshing a draft, starting generation, returning generated output, requesting/applying AI changes, and publication. Show changed sources and affected dates when a draft is stale. Refreshing inputs preserves manual shifts and revalidates them; it never regenerates or overwrites shifts automatically. Record the planner's review of changed inputs before publication. Changes with no effect on this group/range do not require review.

Published versions remain immutable, but their view can show that current source data would now invalidate the schedule and offer a revision. Publication validates against current inputs, not only the old snapshot.

Alternative considered: always use the latest source values silently. That hides why an already reviewed schedule changed and makes AI previews unsafe.

### 5. Generate fresh schedules into durable drafts

Persist preparation before generation. Build the prompt from resolved dated inputs, never from a prior period's shifts. Reuse the existing AI SDK integration and deterministic retry approach.

For larger ranges, generation can be split into intersecting ISO weeks, including partial weeks. Each slice receives its full-week external commitments. Allow at most one correction retry per slice and validate the assembled period before marking the generated draft accepted. Staged partial results are not accepted schedules. Do not assume repeatedly copying one generated week satisfies the range.

Use generation request IDs and expected draft revisions so repeated submissions or late results cannot create duplicate drafts or overwrite user changes. Store generation state and actionable failure information. Preserve preparation and any prior draft on parse, provider, validation, or persistence failure. Surface a recoverable interrupted state if a request is lost; do not promise uninterrupted background work without a durable execution mechanism.

Alternative considered: one unlimited model response for every range. Keep orchestration separable so token/runtime limits do not become implicit calendar limits or silently truncate dates.

### 6. Use one editor with explicit AI proposals

New creation enters the editor after accepted generation. Existing published schedules open read-only; `Edit schedule` creates/resumes a draft revision. Unpublished drafts open directly. Proposed routes:

- `/planning`: group overview and planning progress.
- `/planning/groups/[groupId]`: dated periods for one group.
- `/planning/groups/[groupId]/new`: date selection and preparation.
- `/planning/periods/[periodId]`: official schedule or current draft with explicit state.
- `/planning/periods/[periodId]/review`: publication review.

Use locale-aware navigation throughout. Keep old saved-plan URLs reachable under a clearly labelled legacy area.

The calendar provides period context, week/day navigation, actual dated shifts, manual add/edit/delete/reassign, drag move/resize, an equivalent labelled keyboard-accessible form, undo, and lock controls. Save structurally valid manual edits even if they create rule violations; persist their validation state and block publication. Invalid payloads, impossible time ranges, missing staff references, or lost-update conflicts are rejected before persistence. Never describe an invalid working draft as an accepted plan.

AI accepts a free-text request plus an explicit day/week/period scope. It returns typed create/update/delete operations against stable shift IDs, the draft revision, and input fingerprint. Validate ownership, scope, locked shifts, and references before evaluating the candidate schedule. Preview before/after shifts and validation together; the official draft is unchanged until `Apply`. Apply the whole reviewed proposal atomically only if it is current and has zero validation errors. `Discard` leaves the draft untouched; `Refine` creates a replacement proposal. A model response cannot expand its own scope or edit source settings/exceptions.

Explicitly locked shifts cannot be changed/deleted by AI. Manual changes outside the declared request scope also stay unchanged. The planner can deliberately unlock or edit their own shifts. Undo is an explicit mutation with an expected draft revision; it cannot overwrite another session's changes or alter a published version.

Any draft revision change invalidates an outstanding proposal, including a disjoint manual edit. Preserve the manual edit and ask for a new proposal; do not silently rebase or merge. Give Apply a request identity: after a lost successful response, a repeated identity returns the recorded application outcome before attempting another mutation. Generation and publication use the same outcome-recovery principle.

Alternative considered: a chat-first workspace with AI writing directly to the schedule. The calendar and reviewed patches keep the planner in control and make changes inspectable.

### 7. Share deterministic validation and coverage results

Separate shape validation from schedule-rule validation and publication readiness. Reuse interval helpers but replace weekday-only assumptions with date-based keys. Validate active staff membership, time ranges, effective availability, opening intervals, per-week maximum minutes, cross-group committed conflicts, FIFO ordering, and each effective coverage requirement.

Coverage uses unique eligible staff IDs on exact interval boundaries. Do not double-count overlapping shifts for the same person; invalid assignments cannot make a coverage bar green. Report total and pedagog shortages independently, with actual dates, affected segments, staff/rule/source references, and stable issue codes. The same results feed the calendar strip, selected-issue detail, AI feedback, and publication gate.

Maintain non-blocking validation warnings separately from hard errors. AI-written notes are labelled as such and never decide validity. Existing aggregate group-capacity warnings remain advisory.

The reference wireframe intentionally demonstrates only selected-day coverage and UI state. Its sample shifts can violate current FIFO ordering; its full-period green checks are illustrative. Do not turn that fixture into a validation exemption or claim it is a valid production plan. Implementation fixtures must satisfy every retained rule.

### 8. Publish atomically and handle other groups predictably

Published assignments are authoritative reservations. Other groups' drafts produce visible advisory conflict warnings but do not reserve staff or block an otherwise valid publication. If one draft publishes first, the other must refresh and revalidate against that new commitment. Reject an overlap or excess weekly hours at publication.

Use expected draft revision, reviewed input fingerprint, and current published-version pointer on every publication request. In a transaction, serialize competing publications and relevant source mutations, rebuild/check current effective inputs and commitments, validate, write an immutable version, update the official pointer, and close the consumed draft. Repeated publication with the same request ID returns the existing outcome.

For the current single-institution deployment, a shared institution planning lock/revision row is an acceptable simple way to serialize these short critical sections. All relevant source mutation paths must participate. Do not hold database locks during an AI request. A global change counter can trigger fingerprint recomputation, but only a changed relevant fingerprint flags the draft. If adopting finer staff/week locking instead, prove equivalent race protection with integration tests.

Alternative considered: validate first and publish in a later unprotected write. Concurrent group publications could both pass and double-book the same staff member.

## Risks / Trade-offs

- Broad scope → Implement in the ordered tasks, proving the dated domain and persistence before adding AI editing. All phases remain part of this proposal.
- Long generation or request interruption → Persist preparation and attempt state; slice by week when necessary; never save partial output as accepted.
- Source ownership spans existing forms → Route all mutations through shared revision/validation services; test edits from each owning page.
- Publication races and stale previews → Expected revisions, relevant fingerprints, short transactional serialization, and integration tests with two competing writers.
- Current cascade deletes can remove history → Keep immutable published snapshots; restrict deletion of referenced planning owners and offer deactivation. Preserve legacy tables and audit references.
- Historical snapshots and live names differ → Render historical versions from snapshots and label current-source impact separately.
- Institution closure changes recurring demand → Show which recurring requirements were suppressed; treat conflicting explicit dated demand as an actionable input error.
- Visual approval can be mistaken for fixture approval → Treat wireframes as flow/layout references. Specs and deterministic checks govern behavior.

## Migration Plan

1. Add new tables, constraints, source revisions, and the institution timezone without rewriting or deleting old plans, shifts, or generation attempts.
2. Introduce and test dated effective inputs and validators alongside the existing undated read path. Preserve legacy read access and its labels.
3. Add owner exception management and the new planning routes. Switch primary navigation to Planning only when the full create/edit/publish paths work.
4. Retire the old undated generation entry point from normal navigation; retain existing saved-plan URLs in a legacy area. Do not map an old accepted plan to a published dated period.
5. Validate populated-database migration, snapshot retention, deactivation, and foreign-key behavior. Back up before any deployment migration; deployment is outside this proposal-writing task.
6. Rollback uses a compatible prior UI/read path while retaining additive planning data. Do not drop published versions or newly recorded exceptions to roll back a release.

## Open Questions

No product question blocks starting implementation. The following are explicit assumptions or implementation choices, rather than additional decisions the user made during brainstorming:

- Initial institution timezone is `Europe/Copenhagen`; show and persist it at institution level.
- Meetings/training count toward the weekly scheduling cap by default, with an explicit event flag; absence does not create work minutes.
- Keep current FIFO end-order validation as a hard rule. Changing its business meaning requires a separate decision.
- Other drafts warn but do not reserve staff. Publication determines authoritative commitments.
- One active draft per period and no overlapping active periods per group; discard only unpublished work to release dates.
- Choose calendar/drag primitives and generation execution details during implementation after checking current project patterns and platform limits. The application must meet the contracts regardless of that choice.

See `handoff.md` for the new-chat entry point and `wireframes/README.md` for the portable visual reference.
