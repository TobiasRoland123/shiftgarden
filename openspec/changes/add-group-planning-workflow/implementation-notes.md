# Implementation notes

The baseline inspection confirmed seven-day generation, institution opening boundaries, and FIFO end ordering in the existing code. The old weekday-only completeness text and the former opening-hours claim in `CONTEXT.md` were obsolete. Dated planning is additive, and legacy accepted plans retain their undated records and audit history.

The new workflow uses a single-institution PostgreSQL coordination lock for short source and publication transactions. No model call holds that lock. Fresh generation uses a complete-period request with at most one correction; generation slices are optional and are not used by this implementation. Failed or incomplete model output cannot become an editable accepted draft.

Manual edits, applied proposals, and undo use expected draft revisions. The latest undo snapshot is tied to the editing session and saved revision. Publication rebuilds effective inputs and validation inside its transaction and stores immutable version snapshots. Published shifts retain stable identities across revisions.

Local verification uses PostgreSQL 17 databases created for this change, synthetic groups and staff, and a separate Next.js build directory and port. The configured application database is not migrated or edited during verification. Deterministic model fixtures exercise the service paths in integration tests; browser acceptance also checks the configured AI Gateway.

The populated-database migration, owner-source tests, final browser results, and full check results are recorded in `verification.md` when complete. This change and unrelated OpenSpec changes remain unarchived.
