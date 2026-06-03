## Context

ShiftGarden already builds a `ScheduleInput` from group, staff, availability, and staffing-rule data, sends it to the AI model, parses the model output with `generatedScheduleSchema`, and saves the resulting plan and shifts. The prompt describes hard constraints, but those constraints are not currently enforced by application code.

The new validation layer should sit between parsed AI output and persistence. It should treat AI output as a proposal, not as trusted truth. The validator must be deterministic, focused, and covered by unit tests so schedule quality does not depend only on prompt quality.

Current relevant files:

- `lib/shift-schedule/schemas.ts` defines `ScheduleInput` and `GeneratedSchedule`.
- `lib/shift-schedule/prompt.ts` lists hard scheduling constraints.
- `app/[locale]/shift-schedule/actions.ts` generates, parses, and saves AI plans.
- `lib/shift-schedule/save.ts` builds database insert values for accepted plans.

## Goals / Non-Goals

**Goals:**

- Add a pure validation module for generated schedule plans.
- Validate all initial hard constraints in code:
  - generated `groupId` matches the selected schedule input group
  - every shift references a known staff member
  - only active staff are scheduled
  - shift times are valid and have `endTime` after `startTime`
  - shifts fit inside the staff member's availability for that weekday
  - scheduled weekly hours do not exceed `maxHoursPerWeek`
  - a staff member does not receive overlapping shifts
  - each group staffing rule period has enough total staff and pedagog coverage
- Return structured validation issues with stable codes, useful context, and a clear distinction between blocking validation errors and non-blocking validation warnings.
- Integrate validation into the generation server action before saving.
- Retry generation once when validation fails, using validation feedback.
- Preserve focused testability with unit tests for each validator and integration-style tests for orchestration where practical.

**Non-Goals:**

- Replace AI generation with a mathematical scheduler or constraint solver.
- Build an interactive manual schedule editor.
- Add new database tables for invalid attempts unless implementation discovers a clear need.
- Persist invalid generation attempts for debugging; this remains future work.
- Solve advanced optimization goals such as perfect fairness, shortest shifts, or ideal pedagog distribution in this change.
- Validate cross-group conflicts for staff who may work in multiple groups at the same time; this change validates one generated group plan against its own input.
- Add institution opening hours. Until that future model exists, generated shifts must stay within staffing-rule periods.
- Expand generated schedules to Saturday or Sunday. The generated plan schema remains Monday-Friday for this change.

## Decisions

### Decision: Use pure functions split by validation target

Create small pure validation modules split by what they validate:

- `lib/shift-schedule/validation-types.ts` for shared validation result and issue types.
- `lib/shift-schedule/validate-input.ts` for schedule input support checks before AI generation.
- `lib/shift-schedule/validate-generated.ts` for generated schedule plan checks after AI output parsing.

`validate-input.ts` should expose:

- `validateScheduleInputSupport`
- `validateSupportedRuleDays`

`validate-generated.ts` should expose a main validator and focused helper validators:

- `validateScheduleGroupId`
- `validateWeekdays`
- `validateKnownStaffIds`
- `validateActiveStaffOnly`
- `validateShiftTimes`
- `validateAvailability`
- `validateMaxWeeklyHours`
- `validateNoOverlaps`
- `validateStaffingRules`

The main generated-plan entry point should compose these helpers:

```ts
validateGeneratedSchedule({
  scheduleInput,
  generatedSchedule,
})
```

It should return a result rather than throwing for normal validation failures:

```ts
{
  valid: boolean
  issues: ScheduleValidationIssue[]
}
```

Rationale: Pure functions are easy to test, easy to reuse, and avoid coupling business rules to server actions, database access, or UI code.

Splitting input validation from generated-plan validation keeps files smaller and makes it easier for developers to find the relevant rule. Input support checks answer "can this schedule input be represented by the current generation model?" Generated-plan checks answer "did this generated plan obey the rules?"

Shared result and issue types should live in `validation-types.ts` so neither validator module needs to import from the other.

Alternative considered: Put all validation functions in one `lib/shift-schedule/validate.ts` file. This is simpler initially, but it mixes pre-generation input support with post-generation output correctness and will become harder to scan as rules grow.

Alternative considered: Put validation directly in `app/[locale]/shift-schedule/actions.ts`. This is faster initially, but it makes the rules harder to test and harder to reuse.

### Decision: Use structured validation issues

Each issue should include a stable `code`, `severity`, fallback human-readable `message`, and optional contextual fields such as `dayOfWeek`, `staffId`, `ruleIndex`, `startTime`, and `endTime`.

Suggested issue shape:

```ts
type ScheduleValidationIssue = {
  code:
    | "group_id_mismatch"
    | "missing_weekday"
    | "duplicate_weekday"
    | "unsupported_weekend_rule"
    | "unknown_staff"
    | "inactive_staff"
    | "invalid_shift_time"
    | "outside_availability"
    | "max_hours_exceeded"
    | "overlapping_shift"
    | "shift_outside_staffing_rule"
    | "min_staff_unmet"
    | "min_pedagogs_unmet"
  severity: "error" | "warning"
  message: string
  dayOfWeek?: string
  staffId?: string
  startTime?: string
  endTime?: string
  ruleIndex?: number
}
```

Initial hard-rule failures should use `severity: "error"` and block acceptance. Validation warnings can be added later for softer optimization goals and must not be confused with AI warnings.

The fallback `message` may be English and should be useful for logs, retry prompts, tests, and debugging. User-facing UI should be able to translate validation issues later from `code` plus structured context.

Rationale: Stable codes make tests, UI rendering, localization, logging, and AI retry prompts more reliable than parsing free-form strings.

Alternative considered: Return only strings. This is simpler, but weak for tests and future UI behavior.

Alternative considered: Return only codes and context without fallback messages. This is cleaner for localization, but less useful for retry prompts and developer debugging during the first implementation.

### Decision: Collect all issues within a validation layer

Each validation layer should collect all detected issues for that layer instead of stopping after the first issue. The server action should stop between layers when a layer fails.

Flow:

```txt
validate schedule input support
  ├─ errors -> return all input support errors, do not call AI
  ▼
call AI and parse schema
  ├─ schema error -> return schema error, do not run generated-plan validation
  ▼
validate generated schedule
  ├─ errors -> retry once with validation feedback
  ├─ retry errors -> return all retry validation errors
  ▼
save accepted plan
```

Rationale: Collecting all issues gives useful feedback and better retry prompts. Stopping between layers avoids wasting work when the next step cannot be valid.

Alternative considered: Stop at the first validation issue. This is simpler, but it creates a slower fix loop and weaker retry feedback.

### Decision: Keep persisted warnings as AI warnings for this change

The existing `shift_schedule_plans.warnings` field should continue to store AI warnings from accepted plans. This change should not persist validation warnings because the first implementation focuses on hard validation errors, and mixing validation warnings into the existing field would blur the domain language.

If future work introduces meaningful non-blocking validation warnings, that work should add an explicit persistence shape such as `validationWarnings` or `validationIssues`.

Rationale: The current database column already exists for AI output. Keeping it AI-only avoids confusing AI warnings with authoritative validation results.

Alternative considered: Store validation warnings and AI warnings together in the existing `warnings` column. This is convenient, but it makes future behavior harder to reason about and contradicts the glossary distinction between AI warnings and validation warnings.

### Decision: Validate coverage by checking staffing rule intervals

For each staffing rule, the validator should inspect the shifts on the same weekday and determine whether the rule period is covered by enough staff and enough pedagogs.

Overlapping staffing rules should be treated as independently required. The validator should evaluate each rule against its own interval rather than trying to merge or reject overlapping rules.

Pedagog coverage should be treated as a subset of total staff coverage. For example, a rule with `minStaff: 2` and `minPedagogs: 1` is satisfied by one pedagog and one assistant when both cover the full checked segment.

Rules where `minPedagogs` is greater than `minStaff` should not be treated as invalid configuration in this change. They are unusual but satisfiable because pedagogs count toward total staff coverage. For example, `minStaff: 1` and `minPedagogs: 2` requires two pedagogs, which also satisfies the one total staff requirement.

The first implementation should treat a rule period as satisfied only when the required count is present for the full rule interval. A staff shift can contribute to a rule only for the time range where that staff member is working. If coverage changes inside the rule interval, the validator should detect unmet coverage at any uncovered segment.

Implementation approach:

1. Convert `HH:mm` to minutes since midnight.
2. For each rule, collect boundary points from:
   - rule start
   - rule end
   - shift starts inside the rule
   - shift ends inside the rule
3. Validate each segment between neighboring boundary points.
4. Count active covering staff and covering pedagogs for that segment.
5. Emit `min_staff_unmet` or `min_pedagogs_unmet` when a segment fails.

Example:

```txt
Rule: 09:00-12:00 requires 2 staff

Anna: 09:00-11:00
Bo:   09:00-12:00

Segments:
09:00-11:00 = 2 staff, ok
11:00-12:00 = 1 staff, invalid
```

Rationale: Counting only shifts that fully contain a rule period would miss valid partial combinations, while checking segments catches real coverage gaps.

Alternative considered: Require every scheduled shift to fully match a staffing rule. That would be easier but too strict and would prevent useful split shifts.

Alternative considered: Reject overlapping staffing rules as invalid group configuration during schedule validation. The current data model allows overlapping rules, so schedule validation must define predictable behavior when they exist. Preventing overlapping rule entry can be future form validation work.

Alternative considered: Reject staffing rules where `minPedagogs` exceeds `minStaff`. This would be a group-rule authoring concern, not a generated-plan validation concern, and the rule can still be satisfied.

### Decision: Generated shifts must be inside staffing-rule periods for now

In the current model, a generated shift should be considered invalid when it does not overlap any staffing-rule period on the same weekday. A shift should also be invalid for any segment that falls outside all staffing-rule periods. A shift may span multiple adjacent or overlapping staffing-rule periods as long as every segment of the shift is inside at least one staffing-rule period.

Example:

```txt
Staffing rule:
09:00-12:00

Valid shift:
09:00-12:00
09:00-15:00 when rules cover 09:00-12:00 and 12:00-15:00

Invalid shift:
12:00-14:00
```

Rationale: The current prompt states that shifts must stay within rule start and end times, and there is no broader institution opening-hours model yet. This prevents the AI from inventing unnecessary work outside the known scheduling need.

Future direction: institution opening hours should eventually define the broader allowed schedule window across groups, while group staffing rules define minimum coverage within that window.

Alternative considered: Require each generated shift to fit inside one staffing-rule period. This would force artificial shift splits at rule boundaries even when one continuous shift is valid for the staff member.

Alternative considered: Allow shifts outside staffing-rule periods because staffing rules are minimum coverage, not opening hours. That is likely the better long-term domain model, but the current data model does not yet include institution opening hours.

### Decision: Generated plans must include every weekday

Generated plans should include exactly one day entry for each weekday from Monday through Friday, even when a day has no shifts. Missing or duplicate weekday entries should be validation errors.

Saturday and Sunday remain out of scope for generated plans in this change. The existing generated schedule schema rejects weekend day entries before deterministic validation runs.

If schedule input contains Saturday or Sunday staffing rules, validation should return an `unsupported_weekend_rule` error instead of ignoring those rules. The user has configured a staffing need the generated plan model cannot represent yet.

Rationale: Complete weekday output keeps generated plans predictable for validation, display, and persistence. If a day has staffing rules but no generated day entry, the plan should fail clearly instead of relying on implicit "no shifts" behavior. Duplicate days should also fail rather than being merged silently.

Alternative considered: Allow sparse day output where a missing day means no shifts. This is more compact, but it makes missing coverage easier to overlook and weakens the output contract.

Alternative considered: Merge duplicate day entries. This hides malformed model output and can make validation results harder to explain.

Alternative considered: Expand generated plans to all seven days. That is a broader scheduling capability change and should be handled separately from validation of the current Monday-Friday output model.

### Decision: A shift must fit inside one availability interval

Staff availability should be treated as a set of allowed weekday intervals. A generated shift is valid only when the full shift fits inside one availability interval for the staff member on that weekday.

Example:

```txt
Availability:
08:00-12:00
13:00-16:00

Valid shift:
13:00-15:00

Invalid shift:
11:00-14:00
```

Rationale: A shift crossing `12:00-13:00` uses time where the staff member is unavailable. If the intended schedule is split by a gap or break, it should be represented as separate shifts.

Alternative considered: Allow a single shift to be stitched across multiple availability intervals. This hides unavailable gaps inside one shift and makes later break handling ambiguous.

### Decision: Use integer minutes for time math

Validation should convert `HH:mm` values to integer minutes since midnight for all comparisons and duration calculations. Weekly scheduled time should be summed in minutes and compared to `maxHoursPerWeek * 60`.

Example:

```txt
09:00-12:30 = 210 minutes
20 max weekly hours = 1200 minutes
```

Rationale: Integer minutes support 15-minute and 30-minute shifts without decimal precision issues.

Alternative considered: Use decimal hours internally. This is readable, but can introduce floating point comparison problems.

Alternative considered: Round shifts to whole hours. This is simpler, but incorrect for partial-hour shifts.

### Decision: Server action remains the orchestration boundary

`app/[locale]/shift-schedule/actions.ts` should keep responsibility for:

- reading form data
- fetching `ScheduleInput`
- checking whether the input is supported by the current generated schedule model
- checking AI Gateway configuration
- calling the AI SDK
- parsing output with Zod
- calling `validateGeneratedSchedule`
- retrying once if validation fails
- saving only accepted plans, meaning generated schedule plans with zero validation errors

The validation modules should not import the database, AI SDK, or Next.js APIs.

Rationale: This keeps business rules portable while preserving the current user-triggered server action flow.

Alternative considered: Add an API route for validation. This is unnecessary unless external clients need validation over HTTP.

### Decision: Unsupported input should fail before AI generation

Saturday and Sunday staffing rules should be detected after fetching `ScheduleInput` and before calling the AI. This should return an `unsupported_weekend_rule` error without spending an AI request.

Rationale: Weekend staffing rules are an unsupported input condition in the current Monday-Friday generated schedule model, not a model-output mistake. Failing before generation is faster, cheaper, and easier to explain.

Alternative considered: Call the AI and let generated-plan validation fail afterward. This wastes an AI call for an input that is already known to be unsupported.

### Decision: Retry once with validation feedback

When the first generated plan has validation errors, the server action should perform at most one retry. The retry prompt should include concise validation feedback using issue codes and messages. If the retry also has validation errors, return a validation error state to the UI and do not save the invalid plan.

If the retry succeeds, validation errors from the discarded first attempt should not be shown in the user-facing result because the accepted plan no longer has those errors.

Retry feedback should include all unique validation issue codes while capping repeated examples per code. For example, include up to three concrete examples for `outside_availability`, then summarize how many additional examples were omitted.

Rationale: A single retry can improve successful generation without risking long wait times, surprise costs, or loops.

Alternative considered: Keep retry out of scope. That would be simpler, but the requested workflow includes "maybe retry once" and this is a contained way to do it.

Alternative considered: Retry until valid. This risks high latency, cost, and unpredictable behavior.

Alternative considered: Send every validation issue to the retry prompt. This gives full detail, but can make the retry prompt noisy and expensive when the same issue repeats many times.

The retry count should not be configurable in this change. Product behavior should be fixed at one initial generation attempt plus one retry attempt. Tests can exercise validator functions directly and can test server action behavior around the fixed retry flow.

Alternative considered: Add an environment variable or UI setting for retry count. This adds configuration surface before there is a clear product need.

## Risks / Trade-offs

- [Risk] Coverage validation can be subtly wrong around partial overlaps and boundary times. -> Mitigation: convert times to minutes, test exact boundaries, partial coverage, and gap scenarios.
- [Risk] Validation messages may duplicate or conflict with AI-provided `warnings`. -> Mitigation: treat code validation as authoritative; AI warnings are not validation results and must not decide whether a plan is accepted.
- [Risk] A strict validator may reject plans that look acceptable to a human because the current data model lacks nuance such as breaks, preferred hours, or acceptable understaffing. -> Mitigation: only enforce current hard constraints and keep optimization goals out of hard validation.
- [Risk] Retry feedback may become too verbose for the prompt. -> Mitigation: include compact issue summaries with stable codes, not full debug dumps.
- [Risk] Persisting only accepted plans may hide invalid attempts during debugging. -> Mitigation: log validation failures server-side during development, and consider a separate invalid-attempt audit trail later if needed.

## Migration Plan

1. Add the validation module and unit tests without changing persistence behavior.
2. Integrate validation into the generation server action.
3. Add the one-retry flow.
4. Update UI/server action response handling only as needed to show validation failure messages.
5. Run focused tests, typecheck, and lint.

Rollback is straightforward: remove the validation call from the server action while keeping the pure validation module dormant. No database migration is expected.

## Open Questions

- Should invalid first-attempt issues be visible to users when the retry succeeds, or only used internally as retry feedback?
- Resolved: invalid first-attempt validation errors should only be used internally as retry feedback when the retry succeeds.
- Resolved: accepted plans should keep the current `warnings` field AI-only. Validation warnings are not persisted in this change.
- Resolved: debug persistence for invalid generation attempts is future work, not part of this change.
- Resolved: institution opening hours are future work; for now, generated shifts must stay within staffing-rule periods.
- Should future validation include cross-group conflicts for the same staff member across saved plans?
