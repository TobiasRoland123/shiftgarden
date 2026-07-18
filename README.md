# Next.js template

This is a Next.js template with shadcn/ui.

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
