# Shiftgarden MVP — Daycare staff planning platform

## Context

The user is building a planning tool for Danish daycares (vuggestue/børnehave) so a planner can ensure the right staff are present at the right times. The core pain is not "drawing a schedule" — it is **knowing whether coverage is legal and adequate**, and **reacting fast** when staff are absent. Existing tools in this market are either heavyweight HR suites or general shift apps that don't understand role mix (pedagog vs. medhjælper) or Danish norm periods.

The MVP must let a single daycase planner: define staff and groups, capture staff availability and maximum weekly planning hours, auto-generate a 4-week rolling plan respecting role mix and fairness, then manually adjust and react to absences.

The repo is currently empty (only `.idea` files). Everything below is greenfield.

## Decisions locked in

- **Region:** Denmark (terminology: stue, pædagog, medhjælper, norm)
- **Tenancy:** Single daycare (single org, single location)
- **Auto-generate:** Full — inputs are availability windows, weekly max hours, role mix per shift, fairness across early/late shifts
- **Children:** Group-level headcount only (no individual children in MVP)
- **Horizon:** Rolling 4 weeks
- **Auth:** Auth.js (NextAuth) with email + password (Credentials provider), single role = `planner`

## Stack

| Layer      | Choice                                                                               | Notes                                                     |
| ---------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + TS                                                         | already chosen                                            |
| UI         | shadcn/ui + Tailwind                                                                 | already chosen                                            |
| DB         | Postgres via Neon                                                                    | serverless, free tier fits MVP                            |
| ORM        | Drizzle                                                                              | lighter than Prisma, better TS inference, easy migrations |
| Auth       | Auth.js v5 + Drizzle adapter, Credentials provider (email + password, bcrypt-hashed) | one provider only                                         |
| Validation | Zod + react-hook-form                                                                | shared schemas client/server                              |
| Dates      | date-fns + date-fns-tz                                                               | TZ = `Europe/Copenhagen`, store UTC                       |
| Data layer | Server Actions                                                                       | no tRPC/REST at MVP size                                  |
| Solver     | Custom greedy + local-search in TS                                                   | no native deps; runs in Server Action                     |
| Hosting    | Vercel + Neon                                                                        | trivial deploy                                            |
| Testing    | Vitest for solver + ratio logic                                                      | UI tests deferred                                         |

## Data model (Drizzle)

- `users` — Auth.js standard tables
- `staff` — `id`, `name`, `email`, `role` ('pædagog' | 'medhjælper' | 'vikar'), `weeklyMaxHours`, `active`
- `staff_availability` — `staffId`, `weekday` (0–6), `startTime`, `endTime` (recurring weekly windows)
- `groups` (stuer) — `id`, `name`, `openTime`, `closeTime`, `expectedChildren` per weekday
- `staffing_rules` — per group per time-block: `minStaff`, `minPedagoger` (e.g. opening 06:30–08:00 needs 1 staff, 1 pedagog from 08:00 onward)
- `shifts` — `id`, `staffId`, `groupId`, `date`, `startTime`, `endTime`, `source` ('auto' | 'manual')
- `absences` — `staffId`, `date`, `type` ('sick' | 'vacation' | 'other')
- `plan_runs` — record of each generation (params, score, timestamp) for debugging

## Solver approach

A full ILP solver is overkill for MVP. Use a **two-phase TS implementation**:

1. **Construct** — greedy fill: walk each day chronologically, fill required staffing slots, prefer staff with most remaining weekly max hours and matching role; respect availability windows and absences.
2. **Improve** — local search: 1000s of random pairwise swaps, accept if score improves. Score = weighted sum of:
   - hard constraints (must be 0): availability violations, role-mix shortfall, double-booking
   - soft (minimize): weekly max-hour deviation, early/late shift imbalance per staff member

Run it inside a Server Action. For 4 weeks × ~10 staff this completes in <2 s. Surface infeasibilities (e.g. "Tuesday morning short 1 pædagog") in the UI rather than hiding them.

## Pages / routes

- `/login` — email + password
- `/` (dashboard) — current week coverage, alerts, today's absences
- `/staff` — staff list + create/edit (incl. availability & weekly max hours)
- `/groups` — groups + staffing rules
- `/plan` — 4-week grid view, generate button, manual drag/edit, conflict badges
- `/absences` — log sick/vacation; auto-recomputes affected days

## MVP feature checklist (build order)

1. Project bootstrap: Next.js, Tailwind, shadcn init, Drizzle, Neon connection
2. Auth.js with Credentials provider (email + password, bcrypt)
3. Staff CRUD + availability + weekly max hours
4. Groups CRUD + staffing rules
5. Manual shift assignment on a week grid (shadcn Table-based)
6. Coverage indicator (green/yellow/red per group per day)
7. Absence logging
8. Solver v1 (greedy construct only) → manual fix
9. Solver v2 (local search improvement)
10. 4-week rolling view + week-to-week navigation

Items 1–7 are the truly minimum usable product; 8–10 deliver the "magic" the user wants.

## Explicitly out of scope for MVP

- Mobile staff app, push notifications
- Swap requests / staff self-service
- Payroll/timesheet export
- Individual child tracking, parent-facing features
- Multi-location / multi-tenant
- SMS notifications
- i18n (Danish only initially)

## Verification

- Unit tests (Vitest) for solver scoring + constraint checks; seed fixtures with known-good and known-infeasible weeks
- Manual end-to-end:
  1. `pnpm dev`, sign in with email + password
  2. Create 8 staff (mix of roles, varied availability), 2 groups with rules
  3. Generate plan → verify no hard-constraint violations, weekly max-hour deltas reported
  4. Mark a pædagog sick on a Tuesday → coverage indicator turns red, regenerate fixes it
  5. Manually drag a shift → conflict badge appears if it breaks role mix
- Deploy preview on Vercel against Neon branch DB

## Critical files to be created

- `drizzle/schema.ts`
- `lib/auth.ts` (Auth.js config)
- `lib/solver/construct.ts`, `lib/solver/improve.ts`, `lib/solver/score.ts`
- `lib/coverage.ts` (shared green/yellow/red logic, used by UI + solver)
- `app/plan/page.tsx` + `app/plan/_components/week-grid.tsx`
- `app/staff/`, `app/groups/`, `app/absences/`
- `app/actions/` (Server Actions per resource)
