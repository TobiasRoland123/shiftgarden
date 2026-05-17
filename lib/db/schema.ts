import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const staffRole = pgEnum("staff_role", [
  "pedagog",
  "assistant",
  "substitute",
])

export const dayOfWeek = pgEnum("day_of_week", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])

export const healthChecks = pgTable("health_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull().default("database"),
  isHealthy: boolean("is_healthy").notNull().default(true),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: staffRole("role").notNull(),
    maxHoursPerWeek: integer("max_hours_per_week").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [index("staff_members_role_idx").on(table.role)]
)

export const staffMemberAvailability = pgTable(
  "staff_member_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    dayOfWeek: dayOfWeek("day_of_week").notNull(),
    startAvailabilityTime: time("start_availability_time").notNull(),
    endAvailabilityTime: time("end_availability_time").notNull(),
  },
  (table) => [
    index("staff_member_availability_staff_member_id_idx").on(
      table.staffMemberId
    ),
    index("staff_member_availability_day_of_week_idx").on(table.dayOfWeek),
  ]
)
