## Why

The `/shift-schedule` page is still a developer harness: its primary content is a raw JSON dump of the schedule input behind a button labelled "Show JSON", generation silently persists whatever it produces, and every failure is reported as a single newline-joined English string. A user cannot answer the one question the page exists to answer — _can I trust this generated schedule plan enough to accept it?_

## What Changes

- **BREAKING**: `generateSchedulePlan` no longer saves. It returns a generated schedule plan plus its validation result. A new `acceptSchedulePlan` action performs the save. Generation and acceptance become distinct steps, matching the domain definition of an **Accepted plan** as a plan that "is allowed to be saved".
- Add a **group readiness** step between choosing a group and generating. It surfaces, before any AI call is spent: staffing rules that fall outside institution opening hours (a hard blocker), weekly staff capacity shortfall, weekly pedagog capacity shortfall, linked active staff counts, and missing opening hours. Generation is blocked with a stated reason when a blocking input issue exists.
- Replace the newline-joined error string with a **structured, localized issue list** grouped by validation issue code, using the `dayOfWeek` / `staffId` / `startTime` / `endTime` / `ruleIndex` context already carried on every issue. Selecting an issue highlights the offending shift or staffing rule in the timeline.
- Establish a strict visual hierarchy across the three result concepts so that **validation errors** read as authoritative and blocking, **validation warnings** read as non-blocking, and **AI warnings** read as non-authoritative model commentary that never sits adjacent to the accept/reject verdict.
- Rebuild the plan timeline as **one row per staff member per weekday** (replacing one row per shift), with availability intervals rendered behind each row and institution opening hours as the outer boundary.
- Add a per-weekday **coverage strip** showing scheduled total staff and pedagog coverage against staffing-rule minimums across the time axis, so that pedagog coverage is visibly a subset of total staff coverage.
- Demote the schedule input JSON dump and the generated plan JSON dump to a collapsed developer disclosure.
- Replace the GET-form native `<select>` group picker with a client-side picker that does not require a full page navigation.

## Capabilities

### New Capabilities

- `schedule-plan-review`: The review-and-accept workflow for a generated schedule plan — readiness gating before generation, the acceptance verdict, structured localized presentation of validation errors, validation warnings and AI warnings, and the rule that only an explicit accept persists a plan.
- `schedule-plan-timeline`: The visual representation of a schedule plan — staff-row layout, availability and opening-hours context, and staffing-rule coverage display.

### Modified Capabilities

- `schedule-plan-validation`: The staffing-rule validator must report every unsatisfied coverage segment for a rule rather than stopping at the first one, so that coverage can be displayed across the whole rule period. The spec is also corrected where it has drifted from the implementation: weekend staffing rules are supported, `shift_outside_staffing_rule` has been replaced by `shift_outside_opening_hours` plus the pre-generation `staffing_rule_outside_opening_hours` check, and FIFO end order is an implemented hard rule.

## Impact

- `app/[locale]/shift-schedule/page.tsx` — readiness panel replaces the JSON preview as primary content.
- `app/[locale]/shift-schedule/actions.ts` — split into `generateSchedulePlan` (no persistence) and `acceptSchedulePlan`; all user-facing error strings move to next-intl.
- `app/[locale]/shift-schedule/generate-schedule-plan.tsx` — becomes a review surface with verdict, issue list, and accept/regenerate actions.
- `app/[locale]/shift-schedule/shift-schedule-plan-view.tsx` — rebuilt; shared with `app/[locale]/shift-schedule/plans/[id]/page.tsx`, which inherits the new timeline.
- `lib/shift-schedule/validate-generated.ts` — `validateStaffingRules` reports all failing segments; coverage segments become reusable for display.
- `lib/shift-schedule/save.ts` — insert builders now called from the accept action.
- `lib/groups.ts` — `calculateGroupCapacityShortfall` gains a second consumer.
- `messages/en.json`, `messages/da.json` — new keys for readiness, verdict, every validation issue code, and generation failure reasons.
- `components/ui/` — currently only 7 primitives; Card, Select, Alert, Badge and Collapsible are required.
- Testing — the suite is `node`-environment only with no rendering tests; component coverage requires adding jsdom and Testing Library.
- No database schema change. Unaccepted generated schedule plans are held in client state only; the existing generation attempt audit table continues to record every attempt.
