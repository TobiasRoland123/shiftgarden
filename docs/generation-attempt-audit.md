# Generation attempt audit data

`shift_schedule_generation_attempts` is an internal audit/debug store for parsed generated schedule plan attempts. `shift_schedule_plans` continues to contain accepted plans only.

Each record contains the parsed schedule input and model output, stable structured validation errors, model, attempt number, and generation correlation ID. An accepted attempt links to the accepted plan. A failed attempt is written before a retry starts, while an accepted attempt and its plan are committed in one transaction.

## Privacy and access

The input JSON contains staff names, roles, availability, capacity, group details, and staffing rules. The output JSON contains staff IDs and proposed assignments. Treat both as personal operational data.

- Audit records have no page, route, server action, or public API for reading them. Access is limited to operators with direct database access.
- Do not copy audit JSON into application logs or analytics.
- Group deletion cascades to its audit records. Deleting an accepted plan clears only the audit link; the audit record remains until its retention deadline.

## Retention

Audit records expire 30 days after creation. `expires_at` is indexed so the deployment's database maintenance job can remove expired data efficiently:

```sql
DELETE FROM shift_schedule_generation_attempts
WHERE expires_at <= now();
```

Run this cleanup at least daily. Thirty days is intended to provide enough time to investigate generation and validation failures without retaining staff scheduling data indefinitely. Increase it only after a documented privacy review.

## Dated planning requests

The planning workflow uses separate `planning_generation_requests` and `planning_generation_attempts` records. The legacy audit remains unchanged. A request identity records the draft revision, relevant-input fingerprint, model, lifecycle, and recoverable outcome. Parsed attempts keep input, output, and deterministic validation snapshots.

Preparation is committed before the model runs. No database lock spans a model call. The server records each parsed candidate before a correction request and accepts only a complete, current, zero-error period. A failed audit write stops correction. Provider, schema, validation, or persistence failures leave preparation recoverable; an expired running request can be retried with a new identity. A late result cannot overwrite a replacement request or changed draft.

AI change proposals are stored separately with their explicit scope and draft/input base. Proposal operations do not write shifts until Apply. Application and publication have request identities so a lost successful response can be recovered without creating another revision or version.

Dated attempt payloads contain the same operational personal data as legacy attempts. Do not include these payloads in console logs or analytics. Published input snapshots are retained as schedule history; transient attempt retention should be handled by the deployment's database maintenance policy.
