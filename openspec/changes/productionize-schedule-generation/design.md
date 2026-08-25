## Context

`/shift-schedule` was built as a developer harness for the AI generation pipeline and has not changed shape since. Its primary content is a `<pre>` dump of the schedule input (`app/[locale]/shift-schedule/page.tsx:116-130`) behind a submit button labelled "Show JSON". Group selection is a GET form with a native `<select>` that triggers a full page navigation (`page.tsx:64-87`).

The generation pipeline behind it is, by contrast, mature: `validateGeneratedSchedule` runs eleven validators producing structured issues with stable codes and context, `generateWithRetry` performs one bounded retry with grouped feedback, and every attempt is written to the `shift_schedule_generation_attempts` audit table. Almost none of that structure reaches the user. `generateSchedulePlan` (`actions.ts:200`) returns validation failures as one `\n`-joined English string, rendered inside a single `<p>` (`generate-schedule-plan.tsx:68`).

Three constraints shape the work:

- **`components/ui/` has only 7 primitives** — button, input, separator, sheet, sidebar, skeleton, tooltip. There is no Card, Select, Alert, Badge, Table, Tabs or Collapsible. `components.json` and the `shadcn` CLI are present, so these can be added.
- **There are no rendering tests anywhere.** `vitest.config.ts` uses `environment: "node"` with no jsdom and no Testing Library. The 1,500-odd existing test lines cover pure functions only.
- **`validationWarnings` is dead in practice.** Every validator hard-codes `severity: "error"`, so `getValidationWarnings` always returns `[]`. The plumbing and persistence exist and are tested; nothing emits one. The UI must handle the category correctly without this change inventing new warning-severity issues.

The domain language in `CONTEXT.md` already distinguishes generated schedule plan, accepted plan, validation error, validation warning and AI warning. The current UI collapses that distinction; the redesign is largely a matter of making the interface say what the domain already says.

## Goals / Non-Goals

**Goals:**

- Make the page answer "can I trust this plan enough to accept it?" instead of "what JSON would we send?"
- Separate generation from persistence so that acceptance is an explicit user act, matching the definition of an accepted plan.
- Move every user-facing string in the flow into next-intl for both `en` and `da`.
- Surface input problems before an AI call is spent rather than after.
- Make staffing-rule coverage — including pedagog coverage as a subset of total staff coverage — legible at a glance.
- Keep the saved-plan detail page and the review surface on one shared timeline component.

**Non-Goals:**

- Live retry or attempt progress streaming. Deferred; a static generating state is sufficient for this change.
- Persisting unaccepted plans as drafts. They stay in client state.
- Any database schema change.
- Manual editing, drag-and-drop, or shift adjustment. The timeline stays read-only.
- Pagination or filtering on `/shift-schedule/plans`, and any UI over the generation attempt audit table.
- Emitting new `warning`-severity validation issues. The category must render correctly, but populating it is separate work.
- Calendar dates. The model remains weekday-only.

## Decisions

### 1. Split `generateSchedulePlan` into generate and accept

`generateSchedulePlan` returns a discriminated union carrying the plan, its `ScheduleValidationResult`, the `ScheduleInput` used, and a `generationId`. It writes only audit rows. A new `acceptSchedulePlan` action takes the plan plus its schedule input, re-runs `validateGeneratedSchedule` server-side, and only then performs the existing transaction from `actions.ts:153-186`.

Re-validating on accept is deliberate. The plan travels through client state between the two actions, so the accept action cannot trust that what it receives is what it generated. Validation is pure, fast, and already covered by tests, so this costs nothing and closes the hole.

The accepted attempt audit row moves into `acceptSchedulePlan`'s transaction, keyed by the `generationId` returned from generation, preserving the existing `(generation_id, attempt_number)` uniqueness.

_Alternative considered:_ persist a draft row on generation and flip a status column on accept. Rejected — it needs a migration and a status enum, it leaves orphaned drafts to garbage-collect, and the audit table already provides the forensic record that a draft row would duplicate.

_Alternative considered:_ keep auto-save and add a delete action. Rejected — it inverts the domain, making every generated plan a saved plan until disproved.

### 2. Return structured issues to the client; localize at render

`formatValidationIssuesForUser` stops being the boundary format. The action returns `ScheduleValidationIssue[]` and the client renders each issue from its `code` plus context via next-intl. Message keys are `shiftSchedule.validation.<code>` with ICU arguments drawn from `dayOfWeek`, `staffId` (resolved to a name), `startTime`, `endTime` and `ruleIndex`.

The `message` field on each issue stays as an English fallback and continues to be persisted into the audit table's `validation_errors` column, where an English developer-facing string is the right thing.

`formatValidationFeedbackForRetry` is unaffected — it feeds the model, not the user, and English is correct there.

### 3. Readiness runs on the server, on group selection

The readiness summary composes existing pure functions: `validateScheduleInputSupport` for the blocking opening-hours check, and `calculateGroupCapacityShortfall` (`lib/groups.ts:192`) for the two non-blocking capacity shortfalls. Both already run against data `getScheduleInputForGroup` returns.

A new `lib/shift-schedule/readiness.ts` exposes `getGroupReadiness(scheduleInput): GroupReadiness` as a pure function over `ScheduleInput`, returning `{ blockingIssues, capacityShortfall, linkedActiveStaffCount, ... }`. Pure means testable in the existing node environment, which matters given there is no rendering test infrastructure.

Blocking issues are: staffing rule outside opening hours, no institution opening hours, no staffing rules for the group, no linked active staff. The first three would produce a guaranteed-invalid plan or an empty one; the fourth cannot produce shifts at all. Capacity shortfalls stay non-blocking, consistent with how `CONTEXT.md` defines them — they are group-level concerns that do not prove a plan cannot be accepted.

### 4. Group selection becomes client state, readiness stays server-rendered

The `groupId` search param is kept as the source of truth so the page remains linkable and readiness stays a server render — but selection is driven by a client `Select` that pushes the route rather than a form submit. This keeps the four sequential queries in `getScheduleInputForGroup` on the server and avoids introducing a client data-fetching layer.

Because the picker is now a component, it is also where the readiness badge belongs, so users see which groups are ready before selecting.

_Alternative considered:_ group cards grid instead of a picker. Deferred — it reads better at small group counts but degrades past roughly twenty, and the picker is a smaller change.

### 5. Coverage segments become a first-class computed artifact

`validateStaffingRules` (`validate-generated.ts:402-481`) already performs a boundary-segment sweep computing staff and pedagog counts per segment. Two problems: it `break`s out of the segment loop after the first failure, and it reports the _rule's_ time range on the issue instead of the failing _segment's_.

Extract the sweep into `lib/shift-schedule/coverage.ts` as `calculateCoverageSegments({ scheduleInput, generatedSchedule })`, returning per-weekday segments with `startTime`, `endTime`, `staffCount`, `pedagogCount`, `minStaff`, `minPedagogs`. `validateStaffingRules` then maps failing segments to issues without breaking, and the timeline renders the same segments directly.

One computation feeding both validation and display is the point: it makes the coverage strip provably consistent with the verdict rather than a second implementation that could disagree.

This changes existing behaviour — a rule with two separate gaps now yields two issues instead of one, and issue time ranges narrow from rule to segment. `validate.test.ts` assertions on staffing-rule issue times will need updating. That is why `schedule-plan-validation` is a modified capability rather than an untouched one.

Segment boundaries must be the union of rule boundaries and shift boundaries across the whole weekday so that overlapping rules produce one coherent strip; today the sweep is per-rule.

### 6. Timeline: staff rows per weekday, availability behind, coverage strip per weekday

Replace one-row-per-shift with one-row-per-staff-member-per-weekday. Layout stays the existing `grid-cols-[label_minmax(0,1fr)]` with a sticky label column and horizontal scroll, so the responsive behaviour that already works is preserved.

Per weekday: a coverage strip, then one row per staff member scheduled that weekday, with availability intervals rendered as a muted underlay and shifts as solid bars on top. The time axis spans institution opening hours, falling back to `getTimelineBounds` when a weekday has none.

Availability is available in both contexts: the review surface has the live `ScheduleInput`, and the saved-plan page has `shift_schedule_plans.input_json`, which is exactly a persisted `ScheduleInput`. That column is currently untyped (`schema.ts:152`) while the audit table's equivalent is `$type`-annotated; annotate it to `$type<ScheduleInput>()` so `plans/[id]/page.tsx` can consume it without a cast. This is a type-level change only, no migration.

Staff colour currently hashes `staffId` char codes into 5 buckets (`shift-schedule-plan-view.tsx:37-44`), which collides readily. Replace with index-based assignment over the plan's sorted distinct staff ids across a wider palette — stable within a plan, which is all the spec requires, and collision-free below palette size.

### 7. Issue-to-timeline highlighting via shared identity

Selecting an issue highlights the referenced shift or coverage segment. A shift is identified by `(dayOfWeek, staffId, startTime, endTime)` — the tuple already carried on issues — and a coverage segment by `(dayOfWeek, startTime, endTime, ruleIndex)`. Both live as a `selectedIssue` in the review component's state, passed down to the timeline. No new identifiers, no keys threaded through the AI schema.

### 8. UI primitives

Add via `shadcn`: `card`, `select`, `alert`, `badge`, `collapsible`, `label`. These are the minimum for readiness cards, the group picker, the verdict banner, issue counts, and the JSON disclosure. Table is not needed — the redesigned surfaces are not tabular. Avoid adding Tabs; the review surface reads better as a single scrollable column than as hidden panes, given the whole point is that the user sees the verdict and the evidence together.

### 9. Rendering tests

Add `jsdom` and `@testing-library/react` and switch `vitest.config.ts` to a project-based config so `lib/**` keeps the fast node environment and component tests get jsdom. Component test coverage targets the verdict logic, issue grouping and localization, and readiness gating — the behaviour the specs describe — rather than timeline pixel geometry, which stays covered by pure tests over `coverage.ts` and `timeline.ts`.

### 10. Revalidation

`acceptSchedulePlan` calls `revalidatePath` for the saved plans list across locales, following the pattern in `app/[locale]/groups/new/actions.ts`. The current action does no revalidation at all, so `/shift-schedule/plans` goes stale after a save.

## Risks / Trade-offs

- **Splitting the action changes the audit row ordering.** The accepted attempt now writes on accept, not generation, so a generation that is never accepted leaves only failed-or-nothing attempts. → Write an `accepted`-status attempt row inside `acceptSchedulePlan` keyed by the original `generationId`; a generated-but-never-accepted plan legitimately has no accepted attempt, which is more truthful than today.

- **The plan round-trips through the client between generate and accept**, so a user could submit a tampered plan. → `acceptSchedulePlan` re-validates against a server-loaded `ScheduleInput` for the group rather than trusting the client's copy, and rejects on any validation error.

- **Removing the `break` in `validateStaffingRules` can produce many issues** for a badly under-covered plan, and those issues also feed the retry prompt. → `formatValidationFeedbackForRetry` already caps at 3 examples per code (`action-validation.ts:6`), so prompt size is bounded. The UI groups by code with counts, so the list stays scannable.

- **Existing validation tests will fail** once issue time ranges narrow from rule to segment. → Intentional and specified; update `validate.test.ts` assertions as part of the change rather than preserving the coarser behaviour.

- **The timeline rewrite has no test safety net today.** → Land the jsdom/Testing Library setup before the timeline rewrite, not after.

- **Coverage strip complexity is the largest unknown** in the visual design. → Build `coverage.ts` and its pure tests first so the data model is settled before any rendering work; if the visual proves hard, a minimal met/unmet band still satisfies the spec.

- **Weekend rows may make the timeline very long** now that all seven weekdays are required. → Weekdays with no shifts and no staffing rules render as a compact empty state rather than a full grid.

- **Danish translations are being written by a non-native process.** → Mirror the tone of the existing `da.json` `shiftSchedule` block, which is already complete and consistent; flag the new validation-code strings for review.

## Migration Plan

No data migration. Deployment order within the change:

1. Pure layer first — `coverage.ts`, `readiness.ts`, `validateStaffingRules` changes, `input_json` typing — all covered by node tests, no UI impact.
2. Action split — `generateSchedulePlan` stops persisting, `acceptSchedulePlan` added. This is the breaking step; the review UI must land in the same deploy or generation becomes a no-op from the user's perspective.
3. UI primitives and test infrastructure.
4. Readiness panel, review surface, timeline rewrite.
5. i18n keys for both locales.

Rollback is a revert. Plans saved under the new flow are schema-identical to plans saved under the old one, so no saved data becomes unreadable.

## Open Questions

- Should the readiness panel link directly to the group's staffing rules and the opening hours settings page so a blocking issue is one click from being fixed? Likely yes, but it adds cross-page navigation not covered by the specs.
- Should `Regenerate` be available after a failed generation, or only after a successful one? Offering it after failure risks users burning AI calls against input that will keep failing.
- How many colours does the staff palette need before it degrades? The answer depends on realistic concurrent staff counts per group, which is not established.
