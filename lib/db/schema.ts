import {
  boolean,
  check,
  date,
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

export const shiftScheduleGenerationAttemptStatus = pgEnum(
  "shift_schedule_generation_attempt_status",
  ["validation_failed", "accepted"]
)

/** Workflow state is deliberately separate from validation state. */
export const planningPeriodLifecycle = pgEnum("planning_period_lifecycle", [
  "preparation",
  "generating",
  "editing",
  "published",
  "discarded",
  "abandoned",
])

export const planningDraftState = pgEnum("planning_draft_state", [
  "preparation",
  "generating",
  "failed",
  "editing",
  "reviewing",
  "discarded",
])

export const planningGenerationStatus = pgEnum("planning_generation_status", [
  "pending",
  "running",
  "validation_failed",
  "accepted",
  "failed",
  "interrupted",
])

export const planningProposalState = pgEnum("planning_proposal_state", [
  "pending",
  "applied",
  "discarded",
  "superseded",
  "failed",
])

export const planningExceptionOwnerType = pgEnum(
  "planning_exception_owner_type",
  ["institution", "group", "staff"]
)

export const planningExceptionType = pgEnum("planning_exception_type", [
  "closed_date",
  "opening_replacement",
  "leave",
  "sickness",
  "partial_unavailability",
  "meeting",
  "training",
  "staffing_replacement",
])

export const planningSourceType = pgEnum("planning_source_type", [
  "institution_settings",
  "institution_opening_hours",
  "group",
  "group_staff_rules",
  "staff",
  "staff_availability",
  "staff_membership",
  "exception",
  "event",
  "published_version",
])

export const planningProposalOperationType = pgEnum(
  "planning_proposal_operation_type",
  ["create", "update", "delete"]
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

/** Singleton coordination rows make source writes and publication short, serializable critical sections. */
export const institutionSettings = pgTable(
  "institution_settings",
  {
    id: integer("id").primaryKey().default(1),
    timezone: text("timezone").notNull().default("Europe/Copenhagen"),
    revision: integer("revision").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("institution_settings_singleton_check", sql`${table.id} = 1`),
  ]
)

export const planningCoordination = pgTable(
  "planning_coordination",
  {
    id: integer("id").primaryKey().default(1),
    revision: integer("revision").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("planning_coordination_singleton_check", sql`${table.id} = 1`),
  ]
)

export const planningSourceRevisions = pgTable(
  "planning_source_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: planningSourceType("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    revision: integer("revision").notNull().default(1),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("planning_source_revisions_source_idx").on(
      table.sourceType,
      table.sourceId
    ),
    check(
      "planning_source_revisions_revision_check",
      sql`${table.revision} > 0`
    ),
  ]
)

export const planningPeriods = pgTable(
  "planning_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    timezone: text("timezone").notNull().default("Europe/Copenhagen"),
    lifecycle: planningPeriodLifecycle("lifecycle")
      .notNull()
      .default("preparation"),
    currentPublishedVersionId: uuid("current_published_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
  },
  (table) => [
    index("planning_periods_group_id_idx").on(table.groupId),
    index("planning_periods_dates_idx").on(table.startDate, table.endDate),
    index("planning_periods_current_version_idx").on(
      table.currentPublishedVersionId
    ),
    check(
      "planning_periods_date_order_check",
      sql`${table.endDate} >= ${table.startDate}`
    ),
  ]
)

export const planningDrafts = pgTable(
  "planning_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "restrict" }),
    basePublishedVersionId: uuid("base_published_version_id"),
    revision: integer("revision").notNull().default(1),
    state: planningDraftState("state").notNull().default("preparation"),
    inputSnapshot: jsonb("input_snapshot"),
    inputFingerprint: text("input_fingerprint"),
    lastValidation: jsonb("last_validation"),
    aiNotes: jsonb("ai_notes").$type<string[]>().notNull().default([]),
    undoSnapshot: jsonb("undo_snapshot").$type<unknown[] | null>(),
    undoActorId: uuid("undo_actor_id"),
    undoRevision: integer("undo_revision"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("planning_drafts_active_period_idx")
      .on(table.periodId)
      .where(sql`${table.discardedAt} IS NULL`),
    index("planning_drafts_period_id_idx").on(table.periodId),
    check("planning_drafts_revision_check", sql`${table.revision} > 0`),
  ]
)

export const planningDraftShifts = pgTable(
  "planning_draft_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => planningDrafts.id, { onDelete: "cascade" }),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id),
    actualDate: date("actual_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    locked: boolean("locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("planning_draft_shifts_draft_id_idx").on(table.draftId),
    index("planning_draft_shifts_staff_date_idx").on(
      table.staffMemberId,
      table.actualDate
    ),
    check(
      "planning_draft_shifts_time_order_check",
      sql`${table.endTime} > ${table.startTime}`
    ),
  ]
)

export const planningPublishedVersions = pgTable(
  "planning_published_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    priorVersionId: uuid("prior_version_id"),
    inputSnapshot: jsonb("input_snapshot").notNull(),
    inputFingerprint: text("input_fingerprint").notNull(),
    validationSnapshot: jsonb("validation_snapshot").notNull(),
    displaySnapshot: jsonb("display_snapshot").notNull(),
    publicationRequestId: uuid("publication_request_id").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("planning_published_versions_period_number_idx").on(
      table.periodId,
      table.versionNumber
    ),
    uniqueIndex("planning_published_versions_publication_request_idx").on(
      table.publicationRequestId
    ),
    index("planning_published_versions_period_id_idx").on(table.periodId),
  ]
)

export const planningPublishedVersionShifts = pgTable(
  "planning_published_version_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => planningPublishedVersions.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").notNull(),
    staffMemberId: uuid("staff_member_id").references(() => staffMembers.id),
    staffFirstName: text("staff_first_name").notNull(),
    staffLastName: text("staff_last_name").notNull(),
    staffRole: staffRole("staff_role").notNull(),
    actualDate: date("actual_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    uniqueIndex("planning_published_version_shifts_stable_shift_idx").on(
      table.versionId,
      table.shiftId
    ),
    index("planning_published_version_shifts_staff_date_idx").on(
      table.staffMemberId,
      table.actualDate
    ),
    check(
      "planning_published_version_shifts_time_order_check",
      sql`${table.endTime} > ${table.startTime}`
    ),
  ]
)

export const planningExceptions = pgTable(
  "planning_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerType: planningExceptionOwnerType("owner_type").notNull(),
    institutionId: integer("institution_id").references(
      () => institutionSettings.id
    ),
    groupId: uuid("group_id").references(() => groups.id),
    staffMemberId: uuid("staff_member_id").references(() => staffMembers.id),
    type: planningExceptionType("type").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    reason: text("reason"),
    minStaff: integer("min_staff"),
    minPedagogs: integer("min_pedagogs"),
    countsTowardWeeklyHours: boolean("counts_toward_weekly_hours")
      .notNull()
      .default(true),
    sourceRevision: integer("source_revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("planning_exceptions_group_dates_idx").on(
      table.groupId,
      table.startDate,
      table.endDate
    ),
    index("planning_exceptions_staff_dates_idx").on(
      table.staffMemberId,
      table.startDate,
      table.endDate
    ),
    check(
      "planning_exceptions_date_order_check",
      sql`${table.endDate} >= ${table.startDate}`
    ),
    check(
      "planning_exceptions_owner_check",
      sql`(
        (${table.ownerType} = 'institution' AND ${table.institutionId} IS NOT NULL AND ${table.groupId} IS NULL AND ${table.staffMemberId} IS NULL)
        OR (${table.ownerType} = 'group' AND ${table.institutionId} IS NULL AND ${table.groupId} IS NOT NULL AND ${table.staffMemberId} IS NULL)
        OR (${table.ownerType} = 'staff' AND ${table.institutionId} IS NULL AND ${table.groupId} IS NULL AND ${table.staffMemberId} IS NOT NULL)
      )`
    ),
    check(
      "planning_exceptions_time_pair_check",
      sql`(${table.startTime} IS NULL AND ${table.endTime} IS NULL) OR (${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL AND ${table.endTime} > ${table.startTime})`
    ),
    check(
      "planning_exceptions_minima_check",
      sql`(${table.minStaff} IS NULL AND ${table.minPedagogs} IS NULL) OR (${table.minStaff} IS NOT NULL AND ${table.minPedagogs} IS NOT NULL AND ${table.minStaff} >= 0 AND ${table.minPedagogs} >= 0)`
    ),
    check(
      "planning_exceptions_owner_type_check",
      sql`(
        (${table.ownerType} = 'institution' AND ${table.type} IN ('closed_date', 'opening_replacement', 'meeting', 'training'))
        OR (${table.ownerType} = 'group' AND ${table.type} IN ('staffing_replacement', 'meeting', 'training'))
        OR (${table.ownerType} = 'staff' AND ${table.type} IN ('leave', 'sickness', 'partial_unavailability', 'meeting', 'training'))
      )`
    ),
    check(
      "planning_exceptions_type_fields_check",
      sql`(
        (${table.type} = 'closed_date' AND ${table.startTime} IS NULL AND ${table.endTime} IS NULL AND ${table.minStaff} IS NULL AND ${table.minPedagogs} IS NULL)
        OR (${table.type} = 'opening_replacement' AND ${table.minStaff} IS NULL AND ${table.minPedagogs} IS NULL)
        OR (${table.type} = 'staffing_replacement' AND ${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL AND ${table.minStaff} IS NOT NULL AND ${table.minPedagogs} IS NOT NULL)
        OR (${table.type} IN ('leave', 'sickness') AND ${table.minStaff} IS NULL AND ${table.minPedagogs} IS NULL)
        OR (${table.type} = 'partial_unavailability' AND ${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL AND ${table.minStaff} IS NULL AND ${table.minPedagogs} IS NULL)
        OR (${table.type} IN ('meeting', 'training') AND ${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL AND ${table.minStaff} IS NULL AND ${table.minPedagogs} IS NULL)
      )`
    ),
  ]
)

export const planningExceptionParticipants = pgTable(
  "planning_exception_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => planningExceptions.id, { onDelete: "cascade" }),
    staffMemberId: uuid("staff_member_id")
      .notNull()
      .references(() => staffMembers.id),
  },
  (table) => [
    uniqueIndex("planning_exception_participants_exception_staff_idx").on(
      table.exceptionId,
      table.staffMemberId
    ),
    index("planning_exception_participants_staff_idx").on(table.staffMemberId),
  ]
)

export const planningExceptionIntervals = pgTable(
  "planning_exception_intervals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => planningExceptions.id, { onDelete: "cascade" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("planning_exception_intervals_exception_idx").on(table.exceptionId),
    check(
      "planning_exception_intervals_time_order_check",
      sql`${table.endTime} > ${table.startTime}`
    ),
  ]
)

export const planningGenerationRequests = pgTable(
  "planning_generation_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => planningPeriods.id, { onDelete: "restrict" }),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => planningDrafts.id, { onDelete: "restrict" }),
    expectedDraftRevision: integer("expected_draft_revision").notNull(),
    inputFingerprint: text("input_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    model: text("model").notNull(),
    status: planningGenerationStatus("status").notNull().default("pending"),
    outcomeDraftRevision: integer("outcome_draft_revision"),
    outcomeJson: jsonb("outcome_json"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("planning_generation_requests_request_id_idx").on(
      table.requestId
    ),
    index("planning_generation_requests_draft_id_idx").on(table.draftId),
    check(
      "planning_generation_requests_expected_revision_check",
      sql`${table.expectedDraftRevision} > 0`
    ),
  ]
)

export const planningGenerationAttempts = pgTable(
  "planning_generation_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => planningGenerationRequests.requestId, {
        onDelete: "cascade",
      }),
    attemptNumber: integer("attempt_number").notNull(),
    sliceStartDate: date("slice_start_date", { mode: "string" }),
    sliceEndDate: date("slice_end_date", { mode: "string" }),
    model: text("model").notNull(),
    inputSnapshot: jsonb("input_snapshot").notNull(),
    outputSnapshot: jsonb("output_snapshot"),
    validationSnapshot: jsonb("validation_snapshot"),
    status: planningGenerationStatus("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("planning_generation_attempts_request_number_idx").on(
      table.requestId,
      table.attemptNumber
    ),
    check(
      "planning_generation_attempts_number_check",
      sql`${table.attemptNumber} > 0`
    ),
  ]
)

export const planningProposals = pgTable(
  "planning_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => planningDrafts.id, { onDelete: "cascade" }),
    draftRevision: integer("draft_revision").notNull(),
    inputFingerprint: text("input_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    requestText: text("request_text").notNull(),
    beforeValidation: jsonb("before_validation").notNull(),
    afterValidation: jsonb("after_validation").notNull(),
    notes: jsonb("notes").$type<string[]>().notNull().default([]),
    state: planningProposalState("state").notNull().default("pending"),
    applicationOutcome: jsonb("application_outcome"),
    applicationRequestId: uuid("application_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("planning_proposals_request_id_idx").on(table.requestId),
    index("planning_proposals_draft_id_idx").on(table.draftId),
    check("planning_proposals_revision_check", sql`${table.draftRevision} > 0`),
    uniqueIndex("planning_proposals_application_request_idx").on(
      table.applicationRequestId
    ),
  ]
)

export const planningProposalOperations = pgTable(
  "planning_proposal_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => planningProposals.id, { onDelete: "cascade" }),
    operationIndex: integer("operation_index").notNull(),
    operation: planningProposalOperationType("operation").notNull(),
    targetShiftId: uuid("target_shift_id"),
    actualDate: date("actual_date", { mode: "string" }),
    staffMemberId: uuid("staff_member_id"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    beforeSnapshot: jsonb("before_snapshot"),
    afterSnapshot: jsonb("after_snapshot"),
  },
  (table) => [
    uniqueIndex("planning_proposal_operations_order_idx").on(
      table.proposalId,
      table.operationIndex
    ),
    index("planning_proposal_operations_target_idx").on(table.targetShiftId),
    check(
      "planning_proposal_operations_index_check",
      sql`${table.operationIndex} >= 0`
    ),
  ]
)
