# Shiftgarden — Implementation roadmap (current → MVP)

## Context

The repo today is a bootstrapped Next.js 15 + TS + Tailwind v4 + shadcn scaffold (`app/page.tsx`, one shadcn button, theme-provider, no DB, no auth, no domain code). [mvp.md](mvp.md) defines the target: a single-tenant Danish daycare staff planner with auto-generated 4-week rolling shift plans, role-mix-aware coverage, and absence reactivity.

This plan sequences mvp.md's feature checklist into milestones that each end in a runnable, demonstrable state — so the user can sanity-check progress before the next slice begins. Design (visual/UX) is handled separately; this plan covers implementation only.

---

## Phase 0 — Foundations (infra + auth shell)

Goal: a deployable app where the planner can sign in. No domain features yet.

1. **Install runtime deps** — `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `pg`, `next-auth@beta` (v5), `@auth/drizzle-adapter`, `bcryptjs`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `date-fns-tz`. Dev: `vitest`, `@types/bcryptjs`, `tsx` (for seed script).
2. **Neon project** — create project + a `dev` branch DB. Put `DATABASE_URL` in `.env.local`. Add `.env.example`.
3. **Drizzle wiring**
    - `drizzle.config.ts` (schema path, out dir `drizzle/migrations`, Neon driver)
    - `lib/db.ts` — Neon serverless client + drizzle instance
    - `drizzle/schema.ts` — start with Auth.js tables only (`users`, `accounts`, `sessions`, `verificationTokens`) using the official Drizzle-adapter shape
    - Wire `pnpm db:generate`, `db:migrate`, `db:studio` scripts
4. **Auth.js v5**
    - `lib/auth.ts` — Drizzle adapter, Credentials provider, bcrypt compare, JWT session (Credentials requires JWT not DB sessions), `authorize` validates with Zod
    - Add `password` column to `users` (Auth.js doesn't include it by default; extend the adapter's user table)
    - `middleware.ts` — protect everything except `/login` and `/api/auth/*`
    - `app/login/page.tsx` — react-hook-form + Zod, calls `signIn("credentials", …)`
    - `app/api/auth/[...nextauth]/route.ts`
5. **Seed script** — `scripts/seed.ts` creates one planner user (email + bcrypt-hashed password from env). Document `pnpm seed`.
6. **shadcn components needed across the app** — `pnpm dlx shadcn add input label form table dialog select badge toast sonner card dropdown-menu` so later phases don't keep stopping.
7. **App shell** — `app/(app)/layout.tsx` with sidebar nav (Dashboard / Staff / Groups / Plan / Absences / Sign out). Move existing `app/page.tsx` under the protected segment.

**Done when:** `pnpm dev` → redirected to `/login` → seeded user signs in → lands on empty dashboard. `pnpm typecheck` and `pnpm build` clean.

---

## Phase 1 — Domain schema + Staff CRUD

Goal: planner can manage staff with availability + contract hours.

1. **Extend `drizzle/schema.ts`** with the full domain per mvp.md §Data model:
   `staff`, `staff_availability`, `groups`, `staffing_rules`, `shifts`, `absences`, `plan_runs`. Use `pgEnum` for `role`, `shift.source`, `absence.type`. All times stored as `time` (Postgres) for recurring availability and as `timestamptz` for shifts (UTC, mvp.md §Stack: TZ Europe/Copenhagen, store UTC).
2. **Shared Zod schemas** — `lib/validation/staff.ts` etc. (mvp.md says shared client/server).
3. **Server Actions** — `app/actions/staff.ts`: `createStaff`, `updateStaff`, `deactivateStaff`, `setAvailability`. All wrapped with an `auth()` guard helper in `lib/auth-guard.ts`.
4. **UI**
    - `app/(app)/staff/page.tsx` — list (shadcn Table)
    - `app/(app)/staff/[id]/page.tsx` — edit form: basic fields + availability editor (7 weekday rows × start/end pairs, allow multiple windows per day) + contracted hours
    - `app/(app)/staff/new/page.tsx`
5. **Migration + regenerate**.

**Done when:** create 8 staff with mixed roles, varied availability, contract hours; data persists; reload shows it.

---

## Phase 2 — Groups + staffing rules

Goal: planner can define stuer and the role-mix requirements per time block.

1. **Server Actions** — `app/actions/groups.ts`: CRUD for groups + nested rules. A staffing rule is `{ groupId, weekday, startTime, endTime, minStaff, minPedagoger }`.
2. **UI**
    - `app/(app)/groups/page.tsx` — list
    - `app/(app)/groups/[id]/page.tsx` — group fields (name, open/close, expectedChildren per weekday) + rules editor (rows of time blocks per weekday with min staff / min pædagog).
3. **`lib/coverage.ts`** — pure function `evaluateCoverage(date, group, shifts, rules) → { status: 'green'|'yellow'|'red', shortfalls: […] }`. Pure so both UI and solver consume it (mvp.md §Critical files). Unit-tested in Phase 5.

**Done when:** create 2 groups with rules covering 06:30–17:00 weekdays.

---

## Phase 3 — Manual planning + coverage indicator + absences

Goal: planner can hand-build a week, see coverage badges, and log absences. This is the "minimum usable" line per mvp.md (items 1–7).

1. **Week grid** — `app/(app)/plan/page.tsx` with `?week=YYYY-Www`; default to current ISO week. `_components/week-grid.tsx` renders a Mon–Sun × group rows table; each cell shows existing shifts as chips. Use date-fns `startOfISOWeek` and Europe/Copenhagen TZ for display.
2. **Shift CRUD** — `app/actions/shifts.ts`: create/update/delete a shift via dialog (staff select, group, date, start, end). Server-side validates against availability + double-booking; surfaces errors via toast.
3. **Coverage badges** — per group per day cell, call `evaluateCoverage`; render shadcn `Badge` (green = met, yellow = met but tight, red = shortfall). Hover tooltip lists shortfalls.
4. **Absences** — `app/(app)/absences/page.tsx` list + create dialog. `app/actions/absences.ts`. Coverage logic must subtract any shift whose staff has an absence for that date.
5. **Dashboard** — `app/(app)/page.tsx`: today's coverage per group, today's absences, week-at-a-glance summary count of red days.

**Done when:** hand-assign shifts for one week; toggling a sick absence flips an affected day red.

---

## Phase 4 — Solver v1 (greedy construct)

Goal: one click generates a 4-week plan; planner manually fixes the rest. Corresponds to mvp.md item 8.

1. **`lib/solver/types.ts`** — input/output types: `SolverInput { staff[], availability[], groups[], rules[], absences[], horizon: { start, weeks: 4 } }`, `SolverOutput { shifts[], infeasibilities[], score }`.
2. **`lib/solver/construct.ts`** — greedy fill per mvp.md §Solver:
    - Walk days chronologically; for each `(group, weekday-rule-block)` produce required slots
    - Candidates = active staff, not absent that date, available in that window, role matches, not already double-booked
    - Score candidates by `remainingContractHours desc`, then earliness/lateness fairness counter
    - Emit a shift; if no candidate, emit an `infeasibility` record
3. **`lib/solver/score.ts`** — pure scoring used by both v1 (for tie-breaks) and v2: hard violations + soft (contract-hour deviation, early/late imbalance).
4. **Server Action** — `app/actions/plan.ts`: `generatePlan(weekStart)`. Wipes existing `auto`-source shifts in horizon, inserts new ones in a transaction, records a `plan_runs` row with score and timing. Manual (`source='manual'`) shifts are preserved.
5. **UI** — "Generate plan" button on `/plan` with confirm dialog (warns it overwrites auto shifts). Infeasibilities surface as a red banner listing each `(date, group, shortfall)` (mvp.md: "Surface infeasibilities … rather than hiding them").

**Done when:** 8 staff + 2 groups → click generate → grid populates in under 2 s with most slots filled and any gaps clearly listed.

---

## Phase 5 — Solver v2 (local search) + tests

Goal: better-quality plans + confidence. mvp.md items 9 + verification.

1. **`lib/solver/improve.ts`** — random pairwise swaps for N iterations (cap by wall-clock e.g. 1.5 s); accept if `score()` improves; keep best.
2. Wire into `generatePlan` after construct.
3. **Vitest setup** — `vitest.config.ts`, `tests/` dir.
4. **Unit tests** (mvp.md §Verification):
    - `lib/coverage.test.ts` — green/yellow/red boundaries
    - `lib/solver/score.test.ts` — each constraint contributes correctly
    - `lib/solver/construct.test.ts` — fixtures: known-good week (no infeasibilities), known-infeasible week (one too few pædagoger Tuesday morning) → reports it
5. Add `pnpm test` script.

**Done when:** `pnpm test` green; regenerated plan beats v1 on contract-hour deviation in the test fixture.

---

## Phase 6 — 4-week rolling view + polish

mvp.md item 10 + last gaps.

1. Week navigation (prev/next/today) on `/plan` driven by URL `?week=`.
2. "Show 4 weeks" toggle that vertically stacks 4 week grids (the rolling horizon).
3. Drag-or-edit conflict badges: when manually moving a shift, re-run `evaluateCoverage` for the affected day and surface a badge if role mix breaks (mvp.md verification step 5). Drag is a stretch — click-to-edit dialog is acceptable for MVP.
4. Empty-state copy + loading skeletons on each page.
5. Sign-out, 404, error boundary.

---

## Phase 7 — Deploy

1. Vercel project linked to repo. Env vars: `DATABASE_URL` (Neon prod branch), `AUTH_SECRET`, `AUTH_URL`.
2. `pnpm db:migrate` step in build, or run once via Drizzle's CLI against prod branch before first deploy.
3. Run seed against prod branch to create the planner login.
4. Walk the mvp.md §Verification manual end-to-end checklist on the preview URL.

---

## Critical files (per mvp.md, mapped to phases)

| File | Phase |
|---|---|
| `drizzle/schema.ts` | 0 (auth tables) → 1 (domain) |
| `lib/auth.ts`, `middleware.ts`, `lib/auth-guard.ts` | 0 |
| `lib/db.ts`, `drizzle.config.ts` | 0 |
| `lib/coverage.ts` (+ test) | 2, 5 |
| `lib/solver/{types,construct,score,improve}.ts` (+ tests) | 4, 5 |
| `app/actions/{staff,groups,shifts,absences,plan}.ts` | 1–4 |
| `app/(app)/{staff,groups,plan,absences}/...` | 1–3, 6 |
| `app/plan/_components/week-grid.tsx` | 3 |
| `scripts/seed.ts` | 0 |

## Out of scope (per mvp.md, do not build)

Mobile app, swap requests, payroll export, individual children, multi-tenant, SMS, i18n. Resist adding these even when tempting.

## Verification (overall, end-to-end)

Run mvp.md §Verification manual flow after Phase 6 against a Neon dev branch and again after Phase 7 against the Vercel preview. Required to pass: sign in → create 8 staff + 2 groups + rules → generate plan → no hard-constraint violations → mark a Tuesday pædagog absence → that day flips red → regenerate → green again → manually move a shift that breaks role mix → conflict badge appears.
