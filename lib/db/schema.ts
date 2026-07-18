import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import type { ScheduleValidationWarning } from "@/lib/shift-schedule/validation-types"

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

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
})

export const staffMemberGroups = pgTable(
  "staff_member_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("staff_member_groups_staff_member_id_idx").on(table.staffMemberId),
    index("staff_member_groups_group_id_idx").on(table.groupId),
    uniqueIndex("staff_member_groups_staff_member_id_group_id_idx").on(
      table.staffMemberId,
      table.groupId
    ),
  ]
)

export const groupStaffRules = pgTable(
  "group_staff_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    dayOfWeek: dayOfWeek("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    minPedagogs: integer("min_pedagogs").notNull(),
    minStaff: integer("min_staff").notNull(),
  },
  (table) => [
    index("group_staff_rules_group_id_idx").on(table.groupId),
    index("group_staff_rules_day_of_week_idx").on(table.dayOfWeek),
  ]
)

export const shiftSchedulePlans = pgTable(
  "shift_schedule_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    inputJson: jsonb("input_json").notNull(),
    warnings: jsonb("warnings").$type<string[]>().notNull(),
    validationWarnings: jsonb("validation_warnings")
      .$type<ScheduleValidationWarning[]>()
      .notNull()
      .default([]),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shift_schedule_plans_group_id_idx").on(table.groupId),
    index("shift_schedule_plans_created_at_idx").on(table.createdAt),
  ]
)

export const shiftScheduleShifts = pgTable(
  "shift_schedule_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => shiftSchedulePlans.id, { onDelete: "cascade" }),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    dayOfWeek: dayOfWeek("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("shift_schedule_shifts_plan_id_idx").on(table.planId),
    index("shift_schedule_shifts_staff_member_id_idx").on(table.staffMemberId),
    index("shift_schedule_shifts_day_of_week_idx").on(table.dayOfWeek),
  ]
)
