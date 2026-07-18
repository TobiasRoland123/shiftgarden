# Shift Schedule Timeline Scope

The first version is a read-only weekly timeline for one Group's generated schedule plan or saved schedule plan.

## Product choices

- **View:** One Monday-Friday week with a shared horizontal time axis. Day and month views are out of scope.
- **Grouping:** Shifts are grouped by weekday, with one staff-labelled row per shift. Staff members have stable colors. The Group is identified by the surrounding page because each plan belongs to one Group.
- **Filtering:** No timeline-level filters in the first version. Users select a Group before generating a plan; staff and cross-group filters can be added later.
- **Editing:** Read-only. Direct shift editing, moving, and resizing are future enhancements.
- **Status:** Generated and saved schedule plans use the same timeline. Their surrounding page and status messaging distinguish them; individual bars do not repeat a plan-wide status.
- **Shift details:** The row shows the staff member, the weekday heading shows the date context available in the current weekly model, and each bar shows start and end time. The Group remains visible in the page context.
- **Concerns:** AI warnings remain visible above the timeline. Coverage gaps, conflicts, staffing-rule overlays, and deterministic validation details are not added to the timeline in this version.

The timeline derives a shared start and end from all shifts, rounded outward to whole hours. Empty plans use 08:00-17:00 so the weekly structure remains readable.
