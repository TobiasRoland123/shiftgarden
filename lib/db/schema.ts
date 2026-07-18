import {
  boolean,
  check,
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
import { sql } from "drizzle-orm"

import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type { ScheduleValidationIssue } from "@/lib/shift-schedule/validation-types"

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

export const shiftScheduleGenerationAttemptStatus = pgEnum(
  "shift_schedule_generation_attempt_status",
  ["validation_failed", "accepted"]
)

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

export const institutionOpeningHours = pgTable(
  "institution_opening_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dayOfWeek: dayOfWeek("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("institution_opening_hours_day_of_week_idx").on(table.dayOfWeek),
  ]
)

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

export const shiftScheduleGenerationAttempts = pgTable(
  "shift_schedule_generation_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    generationId: uuid("generation_id").notNull(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    status: shiftScheduleGenerationAttemptStatus("status").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    model: text("model").notNull(),
    inputJson: jsonb("input_json").$type<ScheduleInput>().notNull(),
    outputJson: jsonb("output_json").$type<GeneratedSchedule>().notNull(),
    validationErrors: jsonb("validation_errors")
      .$type<ScheduleValidationIssue[]>()
      .notNull(),
    acceptedPlanId: uuid("accepted_plan_id").references(
      () => shiftSchedulePlans.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
  },
  (table) => [
    check(
      "shift_schedule_generation_attempts_attempt_number_check",
      sql`${table.attemptNumber} > 0`
    ),
    uniqueIndex("shift_schedule_generation_attempts_generation_attempt_idx").on(
      table.generationId,
      table.attemptNumber
    ),
    index("shift_schedule_generation_attempts_group_id_idx").on(table.groupId),
    index("shift_schedule_generation_attempts_accepted_plan_id_idx").on(
      table.acceptedPlanId
    ),
    index("shift_schedule_generation_attempts_expires_at_idx").on(
      table.expiresAt
    ),
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
