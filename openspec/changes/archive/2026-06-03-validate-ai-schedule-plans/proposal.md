## Why

AI-generated shift schedules currently pass through schema validation, but the application does not deterministically verify that the proposed shifts obey staff availability, max weekly hours, active staff status, or group staffing rules before saving. This reduces confidence in generated plans and makes the AI prompt responsible for business-rule correctness.

This change adds code-level validation so the AI can propose a generated schedule plan, while ShiftGarden decides whether the plan has validation errors, can become an accepted plan, and can optionally retry generation once with validation feedback.

## What Changes

- Add deterministic validation for generated schedule plans after AI output parsing and before saving.
- Introduce focused validation functions for:
  - schedule group identity
  - known staff IDs
  - active staff only
  - valid shift time ranges
  - staff availability coverage
  - max weekly hours
  - overlapping shifts per staff member
  - group staffing and pedagog coverage rules
- Return structured validation errors for hard rule failures. Validation warnings remain reserved for future non-blocking concerns and are not persisted in this change.
- Update the shift schedule generation server action to call the validator before saving a generated plan.
- Add a single optional retry attempt when the first generated plan fails validation.
- Persist only accepted plans, meaning generated schedule plans with zero validation errors. Persisting invalid generation attempts is future work.
- Add focused automated tests for each validation rule and the server action validation flow.

## Capabilities

### New Capabilities

- `schedule-plan-validation`: Validates AI-generated shift schedule plans against staff availability, active staff status, max hours, overlap, group identity, known staff IDs, and staffing rule coverage before a plan is accepted.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `lib/shift-schedule/validate-input.ts`
  - `lib/shift-schedule/validate-generated.ts`
  - `lib/shift-schedule/validation-types.ts`
  - `lib/shift-schedule/validate.test.ts`
  - `app/[locale]/shift-schedule/actions.ts`
  - Existing shift schedule tests may need small updates for validation outcomes.
- Affected behavior:
  - AI-generated plans that break hard scheduling rules are rejected instead of saved as accepted plans.
  - Users receive specific validation errors instead of relying on AI warnings.
  - Existing saved plan warnings remain AI warnings.
  - Generation may make one retry attempt using validation feedback.
- Dependencies:
  - No new runtime dependency is expected for the first implementation.
  - Existing TypeScript, Zod, and Vitest tooling are sufficient.
