## 1. Pure layer: coverage segments

- [x] 1.1 Create `lib/shift-schedule/coverage.ts` with `CoverageSegment` (`dayOfWeek`, `startTime`, `endTime`, `staffCount`, `pedagogCount`, `minStaff`, `minPedagogs`, `ruleIndexes`) and `calculateCoverageSegments({ scheduleInput, generatedSchedule })`, sweeping boundaries as the union of all staffing-rule and shift boundaries per weekday
- [x] 1.2 Add `lib/shift-schedule/coverage.test.ts` covering: single rule fully met, single gap inside a rule, two separate gaps inside one rule, overlapping rules producing a combined higher minimum, pedagog-only gap, and segments outside all rules carrying zero minimums
- [x] 1.3 Rewrite `validateStaffingRules` in `lib/shift-schedule/validate-generated.ts` to map failing coverage segments to issues, removing both `break` statements so every unsatisfied segment is reported
- [x] 1.4 Change `min_staff_unmet` and `min_pedagogs_unmet` issues to carry the failing segment's `startTime`/`endTime` instead of the rule's
- [x] 1.5 Update `lib/shift-schedule/validate.test.ts` staffing-rule assertions to expect segment time ranges, and add a case asserting two gaps in one rule yield two issues
- [x] 1.6 Add a `validate.test.ts` case asserting a segment failing both minimums yields both a `min_staff_unmet` and a `min_pedagogs_unmet` issue

## 2. Pure layer: group readiness

- [x] 2.1 Create `lib/shift-schedule/readiness.ts` with `GroupReadiness` and pure `getGroupReadiness(scheduleInput)` returning `blockingIssues`, `capacityShortfall`, `linkedActiveStaffCount`, `linkedStaffCount`, `staffingRuleCount`, `openingHoursCount`
- [x] 2.2 Implement blocking issue detection for: staffing rule outside opening hours (reusing `validateScheduleInputSupport`), no institution opening hours, no staffing rules, no linked active staff
- [x] 2.3 Reuse `calculateGroupCapacityShortfall` from `lib/groups.ts` for the weekly staff and weekly pedagog capacity shortfalls, mapping `ScheduleInput` staff and rules to its input shape
- [x] 2.4 Add `lib/shift-schedule/readiness.test.ts` covering each blocking issue in isolation, a fully ready group, and a ready group that still reports both capacity shortfalls

## 3. Action split

- [x] 3.1 Annotate `shiftSchedulePlans.inputJson` in `lib/db/schema.ts` as `$type<ScheduleInput>()` (type-only, no migration)
- [x] 3.2 Change `generateSchedulePlan` in `app/[locale]/shift-schedule/actions.ts` to return a discriminated union carrying `plan`, `validation`, `scheduleInput` and `generationId`, and to remove the plan and shift inserts
- [x] 3.3 Keep failed-attempt audit writes in `generateSchedulePlan`; remove the accepted-attempt write from it
- [x] 3.4 Change `generateSchedulePlan` failure returns from formatted strings to a structured shape carrying a message key plus any `ScheduleValidationIssue[]`
- [x] 3.5 Add `acceptSchedulePlan` that reloads `ScheduleInput` server-side for the group, re-runs `validateGeneratedSchedule`, and rejects on any validation error
- [x] 3.6 Move the plan insert, shift insert and accepted-attempt insert transaction into `acceptSchedulePlan`, keyed by the original `generationId`
- [x] 3.7 Add `revalidatePath` for the saved plans list across locales in `acceptSchedulePlan`, following `app/[locale]/groups/new/actions.ts`
- [x] 3.8 Add `app/[locale]/shift-schedule/accept.test.ts` covering: accept rejects a tampered plan that fails re-validation, accept rejects a plan with validation errors, and accepted insert values link to the original `generationId`

## 4. Test infrastructure and UI primitives

- [x] 4.1 Add `jsdom`, `@testing-library/react`, `@testing-library/user-event` and `@testing-library/jest-dom` as dev dependencies
- [x] 4.2 Convert `vitest.config.ts` to a project-based config so `lib/**` stays on the node environment and `app/**`/`components/**` component tests run on jsdom
- [x] 4.3 Add a test setup file registering jest-dom matchers and a next-intl test provider helper that loads `messages/en.json`
- [x] 4.4 Verify `pnpm test` passes with both environments before writing any component test
- [x] 4.5 Add `card`, `select`, `alert`, `badge`, `collapsible` and `label` via the shadcn CLI into `components/ui/`

## 5. i18n

- [x] 5.1 Add `shiftSchedule.validation.<code>` message keys to `messages/en.json` for all 14 issue codes, with ICU arguments for staff name, weekday, time range and rule number
- [x] 5.2 Add `shiftSchedule.readiness.*` keys for each blocking issue, both capacity shortfalls, and the readiness counts
- [x] 5.3 Add `shiftSchedule.verdict.*` keys for the accepted and blocked verdicts including error counts
- [x] 5.4 Add `shiftSchedule.failure.*` keys replacing the hard-coded English strings in `actions.ts:29-57, 89, 97, 112`
- [x] 5.5 Add `shiftSchedule.accept`, `shiftSchedule.regenerate`, `shiftSchedule.coverage.*` and `shiftSchedule.developerDetails` keys
- [x] 5.6 Mirror every new key into `messages/da.json` matching the tone of the existing Danish `shiftSchedule` block
- [x] 5.7 Add a test asserting `messages/en.json` and `messages/da.json` have identical key sets

## 6. Readiness panel and group picker

- [x] 6.1 Create a client group picker component using the new Select that pushes the `groupId` route param instead of submitting a GET form
- [x] 6.2 Create a readiness panel component rendering blocking issues as alerts, capacity shortfalls as non-blocking notices, and the readiness counts
- [x] 6.3 Rewrite `app/[locale]/shift-schedule/page.tsx` so the readiness panel is the primary content after group selection and the JSON dump is removed from the top level
- [x] 6.4 Disable the generate action with a stated reason whenever `blockingIssues` is non-empty
- [x] 6.5 Add a component test asserting generation is disabled with a reason for each blocking issue and enabled when only capacity shortfalls are present

## 7. Review surface

- [x] 7.1 Create a verdict banner component driven solely by validation error count, rendering accepted or blocked states
- [x] 7.2 Create a validation issue list component grouping `ScheduleValidationIssue[]` by code with counts, rendering each entry from its code and context via next-intl and resolving `staffId` to a staff name
- [x] 7.3 Give validation errors, validation warnings and AI warnings three distinct presentations, placing AI warnings away from the verdict under a label identifying them as non-authoritative model notes
- [x] 7.4 Omit any of the three result sections when it is empty
- [x] 7.5 Rewrite `generate-schedule-plan.tsx` as a review surface: generate, then verdict plus issues plus timeline, with accept and regenerate actions and no auto-save
- [x] 7.6 Show the accept action only when validation error count is zero; show a saved confirmation after acceptance
- [x] 7.7 Add a generating state using the Skeleton primitive covering both the verdict and timeline regions
- [x] 7.8 Move the schedule input JSON and generated plan JSON into a Collapsible that is closed by default and retains the copy-to-clipboard action
- [x] 7.9 Add component tests for: verdict unchanged by AI warnings, four errors rendering four entries grouped by code, accept action hidden when errors exist, and Danish locale rendering issue text in Danish

## 8. Timeline rewrite

- [x] 8.1 Add index-based staff colour assignment over the plan's sorted distinct staff ids, replacing the 5-bucket char-code hash in `shift-schedule-plan-view.tsx:37-44`
- [x] 8.2 Extend `lib/shift-schedule/timeline.ts` so bounds derive from institution opening hours per weekday, falling back to plan bounds when a weekday has none, and add tests for both paths
- [x] 8.3 Rewrite `shift-schedule-plan-view.tsx` to render one row per staff member per weekday, grouping a staff member's multiple same-day shifts into one row
- [x] 8.4 Render availability intervals as a muted underlay behind each staff row, showing gaps between intervals as visibly separate
- [x] 8.5 Render a per-weekday coverage strip from `calculateCoverageSegments`, distinguishing unmet segments and presenting pedagog counts as a subset of staff counts
- [x] 8.6 Render weekdays with no shifts and no staffing rules as a compact empty state
- [x] 8.7 Accept an optional `selectedIssue` prop and highlight the matching shift by `(dayOfWeek, staffId, startTime, endTime)` or coverage segment by `(dayOfWeek, startTime, endTime, ruleIndex)`
- [x] 8.8 Wire issue selection in the review surface to timeline highlighting
- [x] 8.9 Update `app/[locale]/shift-schedule/plans/[id]/page.tsx` to pass the persisted `inputJson` so the saved-plan view gets availability and coverage context, with no issue highlighting
- [x] 8.10 Verify shift bars retain accessible labels and the sticky label column plus horizontal scroll behaviour

## 9. Verification

- [x] 9.1 Run `pnpm test` and confirm all node and jsdom tests pass
- [x] 9.2 Run `pnpm lint` and the TypeScript build and resolve any errors
- [ ] 9.3 Manually verify the full flow in both locales: select group, read readiness, generate, review verdict and issues, accept, and confirm the plan appears in the saved plans list without a manual refresh
- [ ] 9.4 Manually verify a blocking readiness issue prevents generation and that generating then reloading without accepting persists nothing
- [x] 9.5 Confirm no user-facing English string remains hard-coded in `app/[locale]/shift-schedule/`
