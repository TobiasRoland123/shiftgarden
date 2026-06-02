## Why

The rich text editor needs to better match Studica design principles and teacher workflows, especially on smaller screens where overview and compact controls matter. Story 2159177 identifies several visual and interaction issues that should be planned together so the editor feels consistent, accessible, and predictable.

## What Changes

- Update the text editor toolbar icons for bullet list, ordered list, and link actions to the requested Font Awesome-style symbols.
- Style selected toolbar actions so the icon changes to Studica green instead of using the current background and underline treatment.
- Add a selected/focused state for the whole editor component using border and shadow while the editor or its toolbar is active.
- Restyle the font dropdown to match Studica design principles, prioritizing a dropdown with a green arrow and using an `AA` icon popover only if the primary approach is not feasible.
- Reduce the editor minimum height to about three quarters of the current height to improve overview on small screens.
- Center toolbar buttons vertically so spacing from the border and underline is balanced.
- Investigate and, where supported by the editor library, enable markdown-like shortcuts for `-` bullet lists and `1.` ordered lists.
- Ensure inserted links render as conventional blue link text instead of Studica green.
- Defer toolbar divider changes until the revised visual hierarchy can be evaluated.

## Capabilities

### New Capabilities

- `rich-text-editor-ux`: Covers the rich text editor's toolbar styling, selected/focused states, dropdown presentation, compact layout, text shortcuts, and link color behavior.

### Modified Capabilities

- None.

## Impact

- Affected code will likely include the rich text editor component, editor toolbar controls, editor content styles, and any shared UI primitives used by dropdowns, tool buttons, focus rings, or link rendering.
- The implementation may require adding or updating icon imports if the editor currently lacks the requested icons.
- The implementation should avoid backend, database, and API changes unless discovery shows the editor content model depends on them.
- Verification should cover desktop and small-screen layouts, keyboard/focus behavior, toolbar selected states, dropdown placement, markdown-style list shortcuts, and rendered link color.
