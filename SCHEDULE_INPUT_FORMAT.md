# LLM schedule input format

Generated schedule plan requests use versioned, minified columnar JSON for the schedule input. The serializer is `lib/shift-schedule/serialize-input.ts`.

## Format

The top-level `format` value is `shiftgarden.schedule-input.v1`. `group`, `staff`, `availability`, and `rules` are tables with `columns` and `rows`. A value's position in a row maps to the column at the same position. Availability is flattened into a separate table whose `staffId` references `staff.id`.

Example:

```json
{
  "format": "shiftgarden.schedule-input.v1",
  "group": { "columns": ["id", "name"], "rows": [["group-1", "Blue room"]] },
  "staff": {
    "columns": [
      "id",
      "firstName",
      "lastName",
      "role",
      "maxHoursPerWeek",
      "active"
    ],
    "rows": [["staff-1", "Ada", "Lovelace", "pedagog", 32, true]]
  },
  "availability": {
    "columns": ["staffId", "dayOfWeek", "startTime", "endTime"],
    "rows": [["staff-1", "monday", "08:00", "16:00"]]
  },
  "rules": {
    "columns": ["dayOfWeek", "startTime", "endTime", "minPedagogs", "minStaff"],
    "rows": [["monday", "08:00", "16:00", 1, 2]]
  }
}
```

The initial request and deterministic-validation retry both use this same serialized input. Generated schedule plan output remains schema-constrained object JSON; this change only affects input supplied to the model.

## Measured cost

Measurements cover the serialized schedule data only, excluding the static system prompt and retry validation feedback. The token proxy is `ceil(character count / 4)`. It is intentionally simple and reproducible, but actual tokenizer and provider usage can differ.

| Fixture | Shape                                       |               Pretty object JSON |             Minified object JSON |                  Columnar JSON |
| ------- | ------------------------------------------- | -------------------------------: | -------------------------------: | -----------------------------: |
| Small   | 2 staff, 2 availability intervals, 1 rule   |   1,004 chars / 251 proxy tokens |     666 chars / 167 proxy tokens |   720 chars / 180 proxy tokens |
| Typical | 8 staff, 40 availability intervals, 5 rules | 8,291 chars / 2,073 proxy tokens | 5,263 chars / 1,316 proxy tokens | 3,885 chars / 972 proxy tokens |

The checked-in fixtures are generated in `lib/shift-schedule/serialize-input.test.ts`. Columnar JSON reduces the typical fixture by 53.1% versus current pretty JSON and 26.2% versus minified object JSON. For the small fixture it is 28.3% smaller than pretty JSON but 8.1% larger than minified object JSON because table metadata is a fixed cost.

## Tradeoffs

- Columnar JSON removes repeated object keys as staff, availability, and rules grow while retaining standard JSON strings, numbers, booleans, and escaping.
- Explicit columns and a format version are more robust and debuggable than undocumented positional arrays or a custom delimiter.
- CSV/TSV can be smaller, but multiple related tables need framing and escaping rules; embedded commas, tabs, quotes, and newlines increase ambiguity for the model and debugging tools.
- Minified object JSON is simplest and wins for very small payloads, but repeated availability and rule keys make it scale worse for representative weekly schedules.
- The format is optimized for model input, not persisted data or generated schedule plan output. Any schema change must introduce a new format version or preserve the existing column meanings.
