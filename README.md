# Shiftgarden

Single-tenant Danish daycare staff planner. See [plans/mvp.md](plans/mvp.md) and [plans/implementation-roadmap.md](plans/implementation-roadmap.md).

## Local setup

1. Create a Neon project + dev branch and copy its `DATABASE_URL`.
2. `cp .env.example .env.local` and fill in `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `SEED_PLANNER_EMAIL`, `SEED_PLANNER_PASSWORD`.
3. `pnpm install`
4. `pnpm db:generate && pnpm db:migrate`
5. `pnpm seed` — creates the planner user, default planning rules, and demo staff.
6. `pnpm dev` and sign in at <http://localhost:3000/login>.

## Scripts

- `pnpm dev` — Next.js dev server
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm db:generate` — generate Drizzle migration from `drizzle/schema.ts`
- `pnpm db:migrate` — apply migrations to `DATABASE_URL`
- `pnpm db:studio` — Drizzle Studio
- `pnpm seed` — seed the planner user from env, default planning rules, and demo staff

## Adding shadcn components

```bash
pnpm dlx shadcn add <component>
```
