# 🌱 Shiftgarden — AI-First Planning Roadmap (MVP)

## 🧠 Core Concept

Shiftgarden is a constraint-driven planning system where:

- Users define staff, availability, groups, and rules
- AI generates a complete shift plan
- The system validates correctness before saving
- Future: users can manually adjust plans and partially regenerate

---

## 🔒 System Rules

### Planning Model

- Fully flexible shifts (no fixed blocks)
- Staff can switch groups during a day
- AI generates full plans

### Constraints

- All constraints are hard
- Invalid plans are rejected

### Contract Hours

- Only maximum weekly hours enforced

### Break Rule

- If a shift exceeds 4.5 hours → must include 30-minute break

### Regeneration

- Only on user request
- Future: partial regeneration supported

### Performance

- AI generation can take 5 seconds to 2 minutes

---

## 🏗️ System Architecture

```
INPUT DATA
   ↓
FORMATTER
   ↓
AI GENERATION (Vercel AI SDK)
   ↓
VALIDATION ENGINE
   ↓
IF INVALID → retry or fail
   ↓
SAVE PLAN
```

---

## 📦 Phase 1 — Domain Model

### Staff

- id
- name
- role: "pedagogue" | "assistant" | "substitute"
- weeklyMaxHours

### Availability

- staffId
- weekday
- startTime
- endTime

### Groups

- id
- name
- childCount

### Global Rules

- minPedagogueRatio
- minStaffRatio
- breakMinutes (default 30)
- breakThresholdHours (default 4.5)

### Absences

- staffId
- start
- end
- type

### Shifts

- id
- staffId
- groupId
- start
- end
- source: "ai" | "manual"
- isLocked

### Plan Runs

- id
- inputSnapshot
- aiOutput
- validationResult
- status

---

## 📦 Phase 2 — AI Input Formatter

File: `lib/ai/format-input.ts`

Outputs structured planning data:

- period
- staff
- availability
- absences
- groups
- rules

Responsibilities:

- Normalize time to UTC
- Remove unavailable staff
- Keep payload minimal

---

## 📦 Phase 3 — AI Planner (Vercel AI SDK)

Install:

```
pnpm add ai @ai-sdk/openai zod
```

File: `lib/ai/generate-plan.ts`

Use `generateObject()` with strict schema:

```
Plan = {
  shifts: [
    {
      staffId: string
      groupId: string
      start: string
      end: string
    }
  ]
}
```

Prompt must include:

- All constraints
- Planning objectives
- Strict JSON output requirement

---

## 📦 Phase 4 — Validation Engine

File: `lib/validation/plan-validator.ts`

Checks:

- Availability violations
- Absence conflicts
- Max hours exceeded
- Coverage per group
- Pedagogue requirements
- Break rule enforcement
- Overlapping shifts

Output:

```
{
  valid: boolean
  errors: []
}
```

---

## 📦 Phase 5 — AI Retry Loop

Flow:

```
AI → validate → errors → retry (max 3 times)
```

---

## 📦 Phase 6 — Plan Persistence

Store:

- input snapshot
- AI output
- validation result
- normalized shifts

---

## 📦 Phase 7 — Planner UI

Flow:

1. Generate plan
2. Show loading
3. Display plan
4. Show validation status
5. Accept or reject

---

## 📦 Phase 8 — Future: Partial Regeneration

Support:

- locked shifts
- regenerate only affected areas

---

## 📁 Suggested File Structure

```
lib/
  ai/
    format-input.ts
    generate-plan.ts
    prompts.ts
  validation/
    plan-validator.ts

app/actions/
  generate-plan.ts
  approve-plan.ts
```

---

## ⚠️ Risks

- AI may violate constraints → validation required
- Large inputs → may require batching
- Non-deterministic output

---

## 🚀 MVP Goal

- Generate valid plans automatically
- Enforce all constraints
- Provide clear validation feedback
