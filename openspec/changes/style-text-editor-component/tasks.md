## 1. Discovery

- [ ] 1.1 Locate the rich text editor component, toolbar controls, editor content styles, and any editor-library configuration used by the app.
- [ ] 1.2 Identify the editor library's APIs for active formatting state, toolbar commands, dropdown/menu placement, link rendering, and markdown-like input shortcuts.
- [ ] 1.3 Confirm whether the requested Font Awesome-style icons can be represented with existing icon dependencies or whether a small icon dependency/update is needed.

## 2. Toolbar Icons and Selected States

- [ ] 2.1 Replace the unordered list, ordered list, and link toolbar icons with the requested list, list-ol, and link-simple visual equivalents.
- [ ] 2.2 Update toolbar active-state styling so selected actions use Studica green icon color without selected background or underline as the primary indicator.
- [ ] 2.3 Verify active-state styling for at least one list action while the cursor is inside matching formatted content.

## 3. Editor Focus and Layout Styling

- [ ] 3.1 Add a full-component focused state with border and shadow when focus is inside the editor content area.
- [ ] 3.2 Preserve the focused state while users interact with toolbar controls.
- [ ] 3.3 Reduce the editor content area's minimum height to approximately three quarters of the current value while preserving growth or scrolling for longer content.
- [ ] 3.4 Center toolbar buttons vertically so spacing relative to the toolbar boundaries is balanced.

## 4. Font Control

- [ ] 4.1 Restyle the font control as a Studica-aligned dropdown with green arrow treatment.
- [ ] 4.2 Ensure the opened font menu is positioned above or below the control without covering the active control.
- [ ] 4.3 If the dropdown cannot meet the requirement, document the constraint and implement the second-priority `AA` icon popover approach.

## 5. Editor Behavior

- [ ] 5.1 Enable the unordered list shortcut where typing `-` followed by a space at the start of an empty block creates a bullet list item, if supported by the editor library.
- [ ] 5.2 Enable the ordered list shortcut where typing `1.` followed by a space at the start of an empty block creates a numbered list item, if supported by the editor library.
- [ ] 5.3 Style inserted links in editor content as conventional blue link text instead of Studica green.
- [ ] 5.4 Leave toolbar divider lines out of scope unless the updated visual hierarchy is reviewed and explicitly approved.

## 6. Verification

- [ ] 6.1 Run the relevant automated checks for the changed files, such as linting, type checking, and focused component tests if available.
- [ ] 6.2 Verify the editor visually at desktop and small-screen widths, including toolbar alignment, compact height, focus state, dropdown placement, selected icons, and link color.
- [ ] 6.3 Verify keyboard and editor interactions for focus retention, toolbar activation, list shortcuts, and link insertion.
