# ShiftGarden

ShiftGarden plans staff schedules for one group over an inclusive range of dates. It uses Next.js, Drizzle/PostgreSQL, next-intl, and the Vercel AI SDK.

## Planning

Choose a group in Planning, save dates, and review recurring settings and relevant owned exceptions. Generate a fresh draft, edit shifts in the calendar, and review any AI proposal before applying it. Publish only after current deterministic validation passes. To change an official schedule, create a draft revision; previous published versions retain their snapshots.

Institution, group, and staff pages own their settings and dated exceptions. Shared events have explicit participants and affect every linked group. Weekly caps include current published commitments and counted event attendance across the full Monday-Sunday week, even for a partial period. See [the domain language](CONTEXT.md) and [calendar behavior](docs/shift-schedule-timeline.md).

Existing undated plans remain available in the legacy area. They are not converted into dated or published schedules.

## Local development

Install dependencies with `pnpm install`. Configure `DATABASE_URL` and AI Gateway authentication (`AI_GATEWAY_API_KEY` or Vercel OIDC) in `.env.local`, apply migrations with `pnpm db:migrate`, then start with `pnpm dev`. The deployment represents one institution with `Europe/Copenhagen` as its initial timezone.

The scheduling model defaults to `openai/gpt-5.6-luna`; `PLANNING_AI_MODEL` can select another enabled Gateway model. Generation uses at most one deterministic correction retry. Failed or interrupted generation retains preparation for retry and never accepts partial output.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` before publishing changes. Database migration and concurrency verification use isolated local PostgreSQL databases; no test should target the application database. The default unit run skips database suites. Run them with `PLANNING_SOURCES_TEST_DATABASE_URL=<local-source-test-url> PLANNING_TEST_DATABASE_URL=<separate-local-service-test-url> pnpm test`. Both suites migrate their own databases and require localhost URLs. The source suite resets its fixture tables; use disposable databases.

For a separate verification server, set `NEXT_DIST_DIR=.next/planning-check` and run `pnpm dev --port 3100` with an isolated `DATABASE_URL`.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Institution opening hours

The deployment represents one institution. Its opening hours are global and
support multiple intervals on every day of the week. Migration `0005` backfills
`00:00-23:59` for all seven days so existing staffing rules and generated-plan
behavior remain compatible until an administrator configures narrower hours.
