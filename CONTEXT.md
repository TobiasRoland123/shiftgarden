# ShiftGarden

ShiftGarden manages staff, group staffing needs, and generated shift schedule plans. This context defines the scheduling language used when discussing whether a generated plan can be trusted and saved.

## Language

**Generated schedule plan**:
A proposed schedule produced by the AI for one **Group** and an inclusive range of actual dates from current effective inputs. Undated weekly plans remain legacy records.
_Avoid_: AI answer, AI schedule when referring to the persisted domain concept

**Accepted plan**:
A generated schedule plan that has zero **Validation errors** and can be saved as an unpublished working draft. Acceptance does not publish it or guarantee that it remains valid after inputs change.
_Avoid_: Valid-looking plan, approved draft

**Validation error**:
A hard scheduling rule violation that prevents a generated schedule plan from becoming an **Accepted plan**.
_Avoid_: Warning, AI warning, note

**Validation warning**:
A non-blocking concern about a generated schedule plan that can be shown to a user without preventing acceptance.
_Avoid_: Error, hard failure

**AI warning**:
A model-generated note returned with a generated schedule plan. It is not authoritative and must not be treated as proof that a plan is valid or invalid.
_Avoid_: Validation result, validation error

**Availability interval**:
A weekday time range when a **Staff member** may be scheduled. A staff member can have multiple availability intervals on the same weekday, and a single shift must fit inside one interval.
_Avoid_: Available day, available hours when the exact interval matters

**Staffing rule**:
A weekday time range that states the minimum total staff and minimum pedagog staff required for a **Group**. When staffing rules overlap, each rule remains independently required.
_Avoid_: Coverage suggestion, preference

**Weekly staff capacity shortfall**:
A group-level concern where linked active staff members' weekly capacity is lower than the group's minimum total staffing-rule hours. It does not prove whether a **Generated schedule plan** can be accepted.
_Avoid_: Schedule validation failure, unschedulable group

**Weekly pedagog capacity shortfall**:
A group-level concern where linked active pedagog staff members' weekly capacity is lower than the group's minimum pedagog staffing-rule hours. It is separate from a **Weekly staff capacity shortfall** because pedagog capacity is a role-specific subset of total staff capacity.
_Avoid_: Pedagog validation error, total staff shortfall

**Pedagog coverage**:
The minimum number of covering staff members with role pedagog inside a **Staffing rule**. Pedagog coverage is a subset of total staff coverage, not additional staff on top of it.
_Avoid_: Extra pedagogs

**Institution opening hours**:
The institution-wide intervals that bound shifts on all seven days of the week. Dated opening replacements can close a date or replace its usual intervals. Staffing rules define minimum coverage inside those hours.
_Avoid_: Group staffing rule when referring to the broader institution boundary

**Planning period**:
One group's inclusive date range in the institution's snapshotted IANA timezone. Active periods for the same group cannot overlap. Adjacent periods are allowed.

**Working draft**:
The period's single editable schedule, with a monotonic revision. Structurally valid manual changes can be saved with scheduling errors. Generation, AI application, and publication require zero current errors.

**Published version**:
An immutable official schedule with shift, input, validation, and display-identity snapshots. Editing creates a draft revision. The current version remains official until replacement publication.

**Effective inputs**:
Recurring opening hours, requirements, and availability expanded onto actual dates, then composed with owned exceptions, event attendance, and current published commitments. A relevant-input fingerprint detects changes without replacing manual shifts.

**Owned exception**:
A dated change recorded on an institution, group, or staff member. Opening replacements can trim recurring demand. Explicit dated demand outside effective opening hours is a conflict. Absence and event attendance restrict availability across every linked group.

**Reviewed AI proposal**:
A separate patch tied to a draft revision, relevant-input fingerprint, and explicit calendar scope. Its preview does not edit the draft. Applying it requires current server validation and respects locked shifts.

**Weekly committed work**:
Candidate shifts, authoritative published shifts, and counted meeting or training attendance in one local Monday-Sunday week. Partial periods use the full week's cap and commitments. Other drafts warn but do not reserve staff. A revision substitutes for its own official version.

## Example Dialogue

Developer: "The AI returned a generated schedule plan with two AI warnings. Is it accepted?"

Domain expert: "Only if deterministic validation finds zero validation errors. AI warnings can be useful, but they do not decide whether the plan is accepted."

Developer: "If validation finds a staff member scheduled outside availability, is that a warning?"

Domain expert: "No. That is a validation error because it breaks a hard scheduling rule. A manual draft can retain it, but generation acceptance, AI application, and publication are blocked."

Developer: "Anna is available 08:00-12:00 and 13:00-16:00. Can one shift run 11:00-14:00?"

Domain expert: "No. That shift crosses the unavailable gap, so it does not fit inside one availability interval."

Developer: "If Monday has one staffing rule from 09:00-12:00 and another from 10:00-14:00, which one wins?"

Domain expert: "Neither replaces the other. Both staffing rules must be satisfied during their own intervals."

Developer: "Can the AI schedule someone outside every staffing rule?"

Domain expert: "Yes, inside an effective institution opening interval and subject to all other rules. Staffing rules define minimum coverage, not the outer shift boundary."

Developer: "If a staffing rule needs 2 staff and 1 pedagog, can that be 1 pedagog and 1 assistant?"

Domain expert: "Yes. The pedagog counts as one of the 2 staff members and also satisfies the pedagog coverage requirement."
