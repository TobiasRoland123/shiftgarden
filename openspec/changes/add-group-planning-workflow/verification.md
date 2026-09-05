# Verification

Verified on 5 September 2026 using isolated PostgreSQL 17 databases and a separate Next.js development server on port 3100. The configured application database was not migrated or edited. The existing development server was left running.

## Automated checks

- `pnpm test`: 135 tests passed across 22 files with both isolated database suites enabled. Without database test variables, the unit suite passes and integration suites are explicitly skipped.
- `pnpm typecheck`: passed, including generated route types.
- `pnpm lint`: passed.
- `pnpm build`: passed with an isolated database URL and build directory.
- OpenSpec strict validation: passed.
- Drizzle schema comparison: no ungenerated schema changes.
- Fresh official migration: passed.
- Populated migration from `0000`–`0007`: passed; existing staff, memberships, rules, opening hours, legacy plans, and audits remain readable. Timezone and source revision backfills use their persisted owner identities.

The 18 lifecycle integration tests cover preparation overlap and adjacency, invalid manual drafts, guarded undo, preview isolation, proposal discard/application, lost-response replay, competing publications, per-week cap races, immutable revision history, discard/recreate with stable shift IDs, provider failure and retry, atomic publication rollback, source edits before publication, stale and interrupted generation, complete multiweek output, late proposals after manual edits, relevant-input review gates, request-ID races across periods, and recoverable refinement.

The six source persistence tests cover typed owner constraints, contradictory replacements and events, relevant source provenance, full-week events and commitments, advisory drafts, and historical integrity. Pure domain tests cover exact gaps, eligible unique coverage, pedagog subset semantics, FIFO, partial weeks, weekend dates, ISO-year boundaries, DST, absence subtraction, counted attendance, and patch scope/locks.

## Browser acceptance

The synthetic fixture has two groups sharing Anna (pedagog) and Bo (assistant), both available 08:00–16:00, with daily 09:00–12:00 coverage demand. Browser generation and proposals used the configured AI Gateway model, `openai/gpt-5.6-luna`; integration tests use deterministic model fixtures.

Completed the new-schedule flow:

1. Selected Sunflowers and saved the inclusive 12–14 September period before generation.
2. Added shared training on Saturday 13:00–14:00 for both staff and an institution closure on Sunday. Preparation returned to its saved dates and showed the resulting two demand segments.
3. Generated a fresh, valid draft. The closed date stayed empty; the two open dates had coverage. Training counted once per participant in ISO week 37, with Monday accounted for separately in week 38.
4. Shortened a shift through keyboard-operated time controls. The draft saved the 11:00–12:00 gap and displayed exact total/pedagog deficits. Undo restored the saved shift.
5. Requested AI assistance for the selected day. Expanding scope required confirmation. Preview left the draft unchanged; Discard retained the gap. A second proposal was refined to 12:30, reviewed with exact before/after times, and applied.
6. Reviewed and published version 1. The overview showed Published, and the official calendar exposed read-only shift details.

Completed the existing-schedule flow:

1. Created a revision without fresh generation; version 1 remained official.
2. Exercised lock/unlock and mouse-edge resizing to 12:15. Saved times and shift identities survived reload.
3. Added a staff-owned partial absence. The revision detected the relevant source change; publication review named the changed record and blocked publication until refresh.
4. Refreshed current inputs, inspected the exact difference from version 1, and published version 2.
5. Opened version 1 and verified its original 12:30 end time; version 2 retained 12:15. Created another revision, added/reassigned/deleted a shift, and discarded the revision without changing either published version.

Additional browser checks covered English and Danish preparation, owner forms, calendar and review; exact exception edit prefill and participants; validated owner-source return paths; saved preparation and generation loading; manual creation and undo; and narrow layouts at 390×844. The calendar keeps horizontal scrolling inside its own panel, with no page overflow. A native browser touch event in mobile emulation navigated to the closed Sunday. Radix dialogs provide keyboard focus trapping and Escape handling.

## Deliberate limits

- Generation uses a whole-period request with at most one correction. Optional ISO-week slicing is not implemented, so partial-slice failure scenarios do not apply; no partially assembled result can be accepted.
- Undo restores the latest saved mutation for the editing session and revision. It is not an unlimited edit history.
- The real database was not stopped to force a browser outage. Provider, stale-result, interruption, and database rollback recovery were exercised in persisted integration tests; localized route error boundaries were compiled and reviewed.
- No deployment or OpenSpec archival is part of this implementation.
