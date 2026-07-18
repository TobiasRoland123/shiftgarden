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
