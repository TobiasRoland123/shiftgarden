# ShiftGarden

ShiftGarden manages staff, group staffing needs, and generated shift schedule plans. This context defines the scheduling language used when discussing whether a generated plan can be trusted and saved.

## Language

**Generated schedule plan**:
A proposed weekly schedule produced by the AI for one **Group** from the current staff, availability, and staffing rules.
_Avoid_: AI answer, AI schedule when referring to the persisted domain concept

**Accepted plan**:
A generated schedule plan that has zero **Validation errors** and is allowed to be saved as a schedule plan.
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
The future business-wide time range when staff coverage may be needed across one or more groups. Institution opening hours do not exist in the current scheduling model.
_Avoid_: Group staffing rule when referring to the broader institution boundary

## Example Dialogue

Developer: "The AI returned a generated schedule plan with two AI warnings. Is it accepted?"

Domain expert: "Only if deterministic validation finds zero validation errors. AI warnings can be useful, but they do not decide whether the plan is accepted."

Developer: "If validation finds a staff member scheduled outside availability, is that a warning?"

Domain expert: "No. That is a validation error because it breaks a hard scheduling rule and blocks saving."

Developer: "Anna is available 08:00-12:00 and 13:00-16:00. Can one shift run 11:00-14:00?"

Domain expert: "No. That shift crosses the unavailable gap, so it does not fit inside one availability interval."

Developer: "If Monday has one staffing rule from 09:00-12:00 and another from 10:00-14:00, which one wins?"

Domain expert: "Neither replaces the other. Both staffing rules must be satisfied during their own intervals."

Developer: "Can the AI schedule someone outside every staffing rule?"

Domain expert: "Not in the current model. Later, institution opening hours should define the broader allowed schedule window, while group staffing rules define minimum coverage."

Developer: "If a staffing rule needs 2 staff and 1 pedagog, can that be 1 pedagog and 1 assistant?"

Domain expert: "Yes. The pedagog counts as one of the 2 staff members and also satisfies the pedagog coverage requirement."
