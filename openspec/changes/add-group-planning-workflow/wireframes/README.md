# Connected planning wireframes

Open [planning-journey.html](planning-journey.html) in a browser. It is a portable preview of the interaction direction discussed with the user. It includes the application shell, a group overview, preparation with source links, the calendar editor, AI proposal review, publication, and published-schedule editing.

Use the two walkthrough buttons above the application to choose fresh creation or editing an existing published schedule. These buttons are demonstration controls, not proposed product navigation.

## Walkthrough

1. Choose **Create a new schedule**, then **Create schedule**.
2. Inspect an exception's source and return to preparation.
3. Generate the example draft.
4. Open Anna's shift, change its end time from 13:00 to 11:00, and save.
5. Select **Ask AI to cover the gap**. Compare the dashed proposed shift with the unchanged draft status.
6. Discard or apply the proposal; try undo after application.
7. Continue to publication review and publish the example.
8. Open the published schedule and select **Edit schedule** to see the revision state.

The separate existing-schedule walkthrough starts with a read-only published version. Its edit action opens a revision without running fresh generation.

## What the reference establishes

- The separate entry flows and shared calendar workspace.
- Ownership and automatic inclusion of relevant exceptions.
- Manual editing, visible coverage consequences, and explicit AI preview/application.
- Published versus draft-revision state, save/resume, and separate publication review.

## What must become real during implementation

- Dates, staff, exceptions, shifts, AI proposals, and validation are illustrative and held only in local demo state. The date fields are read-only examples; production date selection must work for arbitrary valid ranges.
- The demo shows one selected Tuesday. Production week/day navigation, actual dated data, all relevant days, and all calendar mutations must work.
- Only Anna's edit form and the prescribed coverage proposal are interactive. Implement free-text assistance, additional edits, drag/resize, accessible alternatives, locks, undo, refine, and real source management according to the specs.
- The demo's generation, weekly-hour checks, full-period checks, history, and publication do not access a server. Do not reuse them as production validators or persistence.
- The sample shifts illustrate coverage and can violate the existing FIFO end-order rule. Use different deterministic-valid fixtures for application verification. The approved flow does not authorize a FIFO exemption.
- The source pages are explanatory sketches. Implement actual owner records/forms and return navigation.
- The overview in the demo uses one group/period; the application must list real groups and periods.
- Typography, spacing, exact route names, and assistant placement can follow the existing product components. The flow and domain behavior are the reference's purpose.

The editable fragment is [planning-journey.fragment.html](planning-journey.fragment.html). The standalone preview includes the rendering wrapper and does not depend on the original chat's visualization directory. The optional host-only layout tweak control is inert outside a supporting host.
