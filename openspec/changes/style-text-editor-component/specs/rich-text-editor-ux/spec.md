## ADDED Requirements

### Requirement: Toolbar icons match requested actions
The editor toolbar SHALL use clear icons for unordered list, ordered list, and link actions that match the requested Font Awesome-style list, list-ol, and link-simple symbols.

#### Scenario: List and link actions are visible
- **WHEN** a user views the text editor toolbar
- **THEN** the unordered list, ordered list, and link actions are represented by their updated icons

### Requirement: Active toolbar actions use Studica green icon state
The editor toolbar SHALL show selected formatting actions by changing the active icon color to Studica green, without relying on a selected background or underline as the primary selected indicator.

#### Scenario: Active list action is selected
- **WHEN** the cursor is inside a formatted list item
- **THEN** the matching list toolbar icon is shown in Studica green without a selected background or underline

### Requirement: Editor focused state is visible across editor and toolbar interactions
The editor component MUST show a selected/focused state using border and shadow while focus is inside the editor content area or interacting with editor toolbar controls.

#### Scenario: Content area receives focus
- **WHEN** a user focuses the editor content area
- **THEN** the full editor component displays the focused border and shadow state

#### Scenario: Toolbar receives focus
- **WHEN** a user clicks or tabs to an editor toolbar control
- **THEN** the full editor component keeps the focused border and shadow state

### Requirement: Font control follows Studica dropdown styling
The editor font control SHALL be presented as a Studica-styled dropdown with a green arrow when feasible, and MUST avoid overlaying the active control in a way that blocks interaction.

#### Scenario: Font dropdown opens
- **WHEN** a user opens the font control
- **THEN** the menu appears above or below the control without covering the active control

#### Scenario: Dropdown styling is visible
- **WHEN** the font control is closed
- **THEN** the control presents the Studica dropdown treatment, including the green arrow styling

### Requirement: Editor minimum height is compact
The editor content area SHALL use a minimum height of approximately three quarters of the previous minimum height while preserving usability for longer content.

#### Scenario: Empty editor on small screen
- **WHEN** a user views an empty editor on a small screen
- **THEN** the editor uses the reduced minimum height and leaves more surrounding page content visible

### Requirement: Toolbar controls are vertically centered
The editor toolbar SHALL center tool buttons vertically so the spacing to the toolbar border and underline area is visually balanced.

#### Scenario: Toolbar is rendered
- **WHEN** a user views the editor toolbar
- **THEN** toolbar buttons have balanced vertical spacing relative to the toolbar boundaries

### Requirement: List shortcuts are supported when available
The editor SHALL support markdown-like shortcuts for starting unordered and ordered lists when the selected editor library provides reliable shortcut support.

#### Scenario: Unordered list shortcut
- **WHEN** a user types `-` followed by a space at the start of an empty block
- **THEN** the editor converts the block into an unordered list item if the editor library supports that shortcut

#### Scenario: Ordered list shortcut
- **WHEN** a user types `1.` followed by a space at the start of an empty block
- **THEN** the editor converts the block into an ordered list item if the editor library supports that shortcut

### Requirement: Links render as blue text
The editor content area SHALL render inserted link text in conventional blue rather than Studica green.

#### Scenario: Link is inserted
- **WHEN** a user inserts a hyperlink in editor content
- **THEN** the linked text is rendered blue and remains visually identifiable as a link

### Requirement: Toolbar dividers are deferred
The implementation MUST NOT add divider lines between toolbar button groups as part of this change unless the revised toolbar hierarchy has first been evaluated and explicitly approved.

#### Scenario: Styling pass is implemented
- **WHEN** the toolbar icon, selected-state, dropdown, and layout updates are complete
- **THEN** divider lines are not added by default
