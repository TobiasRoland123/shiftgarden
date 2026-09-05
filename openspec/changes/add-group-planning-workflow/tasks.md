## 1. Baseline and dated contracts

- [x] 1.1 Read `handoff.md`, the proposal/design, all six capability specs, and the wireframe notes; inspect current scheduling code and record any implementation-time conflicts before changing behavior.
- [x] 1.2 Define dated period, shift, effective-input, validation-issue, and mutation contracts with inclusive dates, half-open same-day times, stable shift IDs, and institution timezone.
- [x] 1.3 Add date/ISO-week interval helpers and focused tests for single-day ranges, weekends, partial weeks, year boundaries, adjacent intervals, and timezone/DST behavior.
- [x] 1.4 Define typed exception/event contracts and validation for owner references, participants, replacement intervals, counts-toward-hours, and contradictory overlaps.

## 2. Additive persistence and historical safety

- [x] 2.1 Add institution timezone and planning coordination/revision storage with an explicit default and migration coverage for populated databases.
- [x] 2.2 Add planning-period and working-draft tables, one-active-draft constraints, expected-revision mutations, and transactionally enforced same-group date-overlap prevention.
- [x] 2.3 Add dated draft shifts with stable IDs/locks and immutable published-version snapshots with current-version pointers and version history.
- [x] 2.4 Add owner exception/event tables, participant relations, and source revision tracking; prevent dangling owner references.
- [x] 2.5 Add generation request/attempt and AI proposal persistence with request identities, expected draft revision, input fingerprint, outcomes, and retry metadata.
- [x] 2.6 Protect published history from cascade deletion and mutable display joins; support deactivation/restricted deletion and preserve legacy POC plan/audit tables.
- [x] 2.7 Test migration against populated fixtures, rollback-compatible reads, duplicate requests, period overlap/adjacency, draft uniqueness, and snapshot retention.

## 3. Effective inputs and owned exceptions

- [x] 3.1 Build a dated input loader for the chosen group, linked staff, recurring rules/availability, institution hours, source revisions, and relevant dated records.
- [x] 3.2 Implement opening replacement and recurring-demand trimming, explicit dated staffing replacements, provenance, and actionable conflicting-input results.
- [x] 3.3 Implement union/subtraction of leave, sickness, partial-day absence, and shared attendance; test split availability and participants linked to several groups.
- [x] 3.4 Load authoritative published commitments across all intersecting ISO weeks, substitute a revision for its own published version, and account for counted events once per participant.
- [x] 3.5 Implement relevant-input fingerprints, changed-source summaries, and draft/proposal freshness checks without flagging unrelated source changes.
- [x] 3.6 Make existing staff/group/institution settings writes and new exception writes transactional and participate in source revision/publication coordination.
- [x] 3.7 Add institution/group/staff exception management and shared-event participant forms with source ownership and English/Danish labels; retain and extend existing settings sections.
- [x] 3.8 Test closure effects, group overrides, conflicts outside opening hours, overlapping absences/events, unrelated exceptions, and edits from every source page.

## 4. Shared dated validation and coverage

- [x] 4.1 Replace weekday completeness assumptions in the new validator with exact inclusive-date completeness and explicit closed dates; retain seven-day support.
- [x] 4.2 Validate group/staff references, active membership, time order, effective availability, opening boundaries, and current FIFO ordering against dated inputs.
- [x] 4.3 Implement separate per-ISO-week caps and authoritative cross-group overlap checks, including partial-week boundaries and revision substitution.
- [x] 4.4 Produce coverage segments from all effective boundaries; count unique eligible staff IDs, report total and pedagog deficits independently, and attach date/interval/source context.
- [x] 4.5 Separate structural mutation errors, hard scheduling errors, advisory validation warnings, other-draft conflicts, and model-authored notes; retain non-blocking aggregate capacity warnings.
- [x] 4.6 Add regression tests for weekend/opening-hours behavior, FIFO, exact gaps, duplicate/inactive/unavailable coverage, pedagog subset semantics, external commitments, and manual-versus-AI validation consistency.

## 5. Group overview, preparation, and fresh generation

- [x] 5.1 Add group-first planning overview and group period lists with saved preparation/draft, published/revision state, uncovered dates, and explicit unpublished discard.
- [x] 5.2 Add inclusive date selection and resumable preparation showing usual settings and automatically relevant exceptions, their effects, source links, and return navigation.
- [x] 5.3 Build fresh dated generation from effective inputs without copying earlier schedules; validate input before invoking the model.
- [x] 5.4 Implement bounded correction retries, optional ISO-week slices, full assembled-period validation, idempotent requests, and rejection of stale/late generation results.
- [x] 5.5 Persist loading/failure/recoverable interruption state; preserve preparation and prior work on provider, schema, validation, or database failure, and never accept partial output.
- [x] 5.6 Test new versus existing flow separation, reload/resume, multiweek completeness, retries, interruptions, duplicate submission, and failure after an earlier slice succeeded.

## 6. Manual calendar workspace

- [x] 6.1 Add actual-date week/day navigation with period context, non-editable outside-period days, read-only event attendance blocks and weekly-budget detail, and published versus editable draft/revision states.
- [x] 6.2 Add manual shift creation, editing, deletion, reassignment, time changes, and explicit lock/unlock controls with expected-revision persistence.
- [x] 6.3 Add drag movement/resizing and equivalent labelled keyboard-operable forms; preserve exact times and prevent out-of-period/group mutations.
- [x] 6.4 Save structurally valid intermediate drafts with scheduling errors, display save/conflict state, and revalidate after mutations without silently discarding user work.
- [x] 6.5 Add aligned total/pedagog coverage feedback, selectable exact-interval issues, source links, and actions to inspect available staff or ask AI about a selected issue.
- [x] 6.6 Add undo for manual changes and applied AI proposals, guarded against newer revisions; preserve saved edits on close/reopen.
- [x] 6.7 Verify keyboard/touch/manual interactions, empty and split shifts, invalid drafts, undo, locks, and narrow-screen calendar access with real browser checks.

## 7. Reviewed AI assistance

- [x] 7.1 Add free-text AI requests with visible day/week/period scope and explicit confirmation before expanding beyond the selected scope.
- [x] 7.2 Define and generate structured create/update/delete proposals tied to stable shift IDs, draft revision, and effective-input fingerprint; keep model output separate from draft writes.
- [x] 7.3 Reject malformed, wrong-owner, out-of-scope, missing-reference, locked-shift, and stale proposals on the server; return actionable failure information without editing source exceptions.
- [x] 7.4 Add before/after calendar overlays, an exact change list, deterministic candidate validation, and Apply/Discard/Refine actions that keep unapplied proposals visibly separate.
- [x] 7.5 Implement atomic idempotent whole-proposal application with a zero-error current candidate, expected-revision/fingerprint checks, and undo; invalidate late results after user/source changes.
- [x] 7.6 Test preview isolation, discard/refine, locked deletion, scope expansion, manual edits during generation, stale source/commitment data, failed atomic patches, and duplicate application requests.

## 8. Publication, revisions, and race protection

- [x] 8.1 Add publication review with group/dates, full-period current validation, warning/AI-note separation, and changes since generation or the current official version.
- [x] 8.2 Implement explicit create/resume revision from a read-only published schedule, retaining the official version until successful replacement publication.
- [x] 8.3 Implement transactional current-input validation and publication using expected draft/base-version/fingerprint and idempotency checks; coordinate competing publications and source mutations without holding locks during AI calls.
- [x] 8.4 Add immutable version history and publication confirmation; allow unpublished revision discard without changing official history.
- [x] 8.5 Add advisory conflicts with other groups' drafts and refresh dependent drafts after authoritative publication; exclude superseded/self-replaced versions from reservations.
- [x] 8.6 Run persistence/integration tests for two groups publishing conflicting shifts simultaneously, weekly-cap races, source edits during publication, lost responses, stale revisions, and transaction failure recovery.

## 9. Integration, documentation, and end-to-end verification

- [x] 9.1 Integrate Planning into primary navigation, retain owner settings navigation, and keep existing saved-plan URLs available in a read-only legacy area without invented dates/status.
- [x] 9.2 Complete English/Danish UI text, date/time display, loading/empty/error states, accessibility, and the complete owner-source return path.
- [x] 9.3 Update `CONTEXT.md`, README, timeline/audit documentation, and tests to describe current dated planning and correct obsolete weekday/opening-hours claims; do not archive unrelated changes.
- [x] 9.4 Build deterministic-valid fixtures covering all retained rules. Use the wireframe's interaction sequence, not its illustrative shifts or hard-coded green checks, for browser acceptance tests.
- [x] 9.5 Verify the new flow end to end: group → dates → owned exceptions → fresh generated draft → manual gap → AI preview/discard/refine/apply → current review → publication → group overview.
- [x] 9.6 Verify the existing flow end to end: published schedule → draft revision → manual/AI changes → save/reload → source change detection → revalidation → publish replacement → retained version history.
- [x] 9.7 Verify partial-week/weekend ranges, two groups sharing staff, institution closure, multiple event participants, source ownership, and failed generation recovery against persisted state.
- [x] 9.8 Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` with the required local environment; report any environment-dependent checks honestly and record browser verification results.
- [x] 9.9 Validate the OpenSpec change, reconcile task completion with implemented behavior, and document any remaining limitations before calling the implementation complete.
