import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const healthChecks = pgTable("health_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull().default("database"),
  isHealthy: boolean("is_healthy").notNull().default(true),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
