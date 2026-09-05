## Why

ShiftGarden can generate and validate a weekly schedule for one group, but a planner cannot yet prepare a real date range, edit a persistent calendar, or distinguish a draft from the official schedule. This change turns that POC into a complete planning workflow while preserving institution, group, and staff ownership of settings and exceptions.

## What Changes

- Add a planning overview with groups, dated planning periods, saved drafts, published versions, and unplanned dates. Plan one group at a time using an inclusive start and end date.
- Create each new schedule through preparation and fresh AI generation. Open an existing schedule through a separate editing flow; do not copy a previous schedule when creating a new period.
- Add dated staff leave, sickness, partial-day unavailability, meetings/training, institution opening exceptions, and group staffing exceptions at their owning records. Collect relevant exceptions automatically during preparation, with links to their sources.
- Provide a persistent calendar editor with week/day navigation, direct manual shift editing, drag interactions with keyboard alternatives, undo, shift locks, and actionable total-staff and pedagog coverage feedback.
- Add AI assistance for the selected scope. Show exact proposed changes on the calendar; apply only after explicit review. Discarding a proposal leaves the draft unchanged.
- Separate validation from publication. Save editable drafts, publish only after current deterministic checks pass, and revise published schedules without changing the official version until replacement publication.
- Check shared staff across groups and across date-range boundaries. Detect stale drafts and proposals when relevant inputs or commitments change.
- **BREAKING:** Replace weekday-only generation contracts with dated planning inputs/outputs for the new workflow. Preserve old undated plans as read-only legacy records; do not invent dates or publication status for them.
- Update stale validation requirements to match existing seven-day and institution-opening-hours behavior, then extend them to dated plans and the shared editor.

## Capabilities

### New Capabilities

- `group-planning-periods`: Group-first navigation, inclusive date ranges, preparation, fresh generation, saved progress, and legacy-plan access.
- `owned-scheduling-exceptions`: Dated exceptions and shared events, their ownership, effective-input composition, source links, and freshness tracking.
- `schedule-calendar-workspace`: Direct calendar editing, locks, undo, and precise coverage and rule feedback.
- `reviewed-ai-schedule-changes`: Scoped AI requests, isolated before/after proposals, explicit application, and stale-proposal protection.
- `schedule-publication-revisions`: Immutable official versions, editable revisions, current validation at publication, and conflict-safe publication.

### Modified Capabilities

- `schedule-plan-validation`: Dated completeness, seven-day support, institution opening boundaries, effective availability, per-week hours, cross-group conflicts, accurate coverage segments, and consistent checks for generated/manual/AI-edited schedules. Retain zero-error acceptance and the bounded retry policy.

## Impact

- Database migrations for periods, working drafts, versions, dated shifts, exceptions/events, source revisions, and AI proposals; preserve the existing POC tables and generation audit history.
- Scheduling schemas, input assembly, generation orchestration, validation, saving, and timeline helpers under `lib/shift-schedule/`; server actions and pages under `app/[locale]/shift-schedule/` and the new planning routes.
- Institution, group, and staff pages gain owner-specific exception management. Navigation, English/Danish translations, and domain documentation need updates.
- Reuse the existing Next.js, Drizzle/Neon, AI SDK, Zod, and component stack. Introduce dependencies only where implementation demonstrates a need.
- Implementation includes meaningful domain, persistence/concurrency, and browser verification. This proposal includes portable reference wireframes and a new-chat handoff; it does not implement the application.
