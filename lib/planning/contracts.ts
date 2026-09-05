import type { ScheduleInput } from "@/lib/shift-schedule/schemas"

/** Calendar dates and wall-clock times are deliberately strings. They must not
 * be passed through the browser's timezone when they are persisted. */
type ISODateString = string
type ClockTime = string
type TimeInterval = { startTime: ClockTime; endTime: ClockTime }

type PlanningPeriod = {
  id: string
  groupId: string
  startDate: ISODateString
  endDate: ISODateString
  timezone: string
  lifecycle?:
    | "preparation"
    | "generating"
    | "editing"
    | "published"
    | "abandoned"
  currentPublishedVersionId?: string | null
}
type Period = PlanningPeriod

type PlanningShift = {
  id: string
  groupId?: string
  staffId: string
  date: ISODateString
  startTime: ClockTime
  endTime: ClockTime
  locked: boolean
}
type DatedShift = PlanningShift
type DraftShift = PlanningShift
type Shift = PlanningShift
type DatedSchedule = {
  periodId?: string
  groupId: string
  days: Array<{
    date: ISODateString
    shifts: Array<
      Omit<PlanningShift, "date" | "groupId" | "locked"> &
        Partial<Pick<PlanningShift, "date" | "groupId" | "locked">>
    >
  }>
  warnings?: string[]
}

type PlanningStaff = {
  id: string
  firstName?: string
  lastName?: string
  role: "pedagog" | "assistant" | "substitute"
  active: boolean
  maxHoursPerWeek: number
  availability?: Array<TimeInterval & { dayOfWeek?: string }>
}

type SourceReference = {
  sourceId: string
  sourceRevision?: number | string
  sourceType?: string
  ownerId?: string
  label?: string
}

type EffectiveOpeningInterval = TimeInterval & { source?: SourceReference }
type EffectiveAvailabilityInterval = TimeInterval & {
  staffId: string
  date: ISODateString
  sources?: SourceReference[]
}
type StaffingDemandSegment = TimeInterval & {
  date: ISODateString
  minStaff: number
  minPedagogs: number
  openingSourceIds: string[]
  ruleSourceIds: string[]
  replacementSourceId?: string
  suppressedRuleSourceIds?: string[]
}

type StaffUnavailability = TimeInterval & {
  id: string
  staffId: string
  kind:
    | "leave"
    | "sickness"
    | "unavailability"
    | "partial_unavailability"
    | "meeting"
    | "training"
    | "staffing_replacement"
    | "closed_date"
    | "opening_replacement"
  date: ISODateString
  sourceRevision?: number | string
  description?: string
  source?: SourceReference
}

type OwnerReference =
  | { ownerType: "institution"; ownerId: string }
  | { ownerType: "group"; ownerId: string }
  | { ownerType: "staff"; ownerId: string }

type PlanningEvent = TimeInterval &
  OwnerReference & {
    id: string
    date: ISODateString
    kind: "meeting" | "training"
    participantStaffIds: string[]
    countsTowardWeeklyHours: boolean
    sourceRevision?: number | string
    description?: string
    source?: SourceReference
  }
type SharedEvent = PlanningEvent

type GroupRequirementReplacement = TimeInterval & {
  id: string
  groupId: string
  date: ISODateString
  minStaff: number
  minPedagogs: number
  sourceRevision?: number | string
  source?: SourceReference
}
type OpeningReplacement = {
  id: string
  institutionId: string
  date: ISODateString
  intervals: EffectiveOpeningInterval[]
  sourceRevision?: number | string
  source?: SourceReference
}

type PublishedCommitment = PlanningShift & {
  versionId?: string
  sourceGroupId: string
  sourcePeriodId?: string
  authoritative?: boolean
}

type EffectiveDay = {
  date: ISODateString
  dayOfWeek: string
  openingIntervals: EffectiveOpeningInterval[]
  demandSegments: StaffingDemandSegment[]
  availability: EffectiveAvailabilityInterval[]
  openingReplacementSourceIds?: string[]
}

type EffectiveInputs = {
  group: { id: string; name: string }
  period?: PlanningPeriod
  timezone: string
  staff: PlanningStaff[]
  days: EffectiveDay[]
  commitments: PublishedCommitment[]
  events: PlanningEvent[]
  unavailability?: StaffUnavailability[]
  demand?: StaffingDemandSegment[]
  sourceReferences?: SourceReference[]
  fingerprint: string
  issues: ValidationIssue[]
}
type EffectiveInput = EffectiveInputs

type RawRecurringInput = ScheduleInput & {
  timezone?: string
  sourceReferences?: SourceReference[]
}

type ValidationIssueCode =
  | "invalid_period_range"
  | "invalid_date"
  | "invalid_time"
  | "missing_date"
  | "duplicate_date"
  | "out_of_range_date"
  | "duplicate_shift_id"
  | "group_id_mismatch"
  | "unknown_staff"
  | "inactive_staff"
  | "invalid_shift_time"
  | "outside_availability"
  | "max_hours_exceeded"
  | "overlapping_shift"
  | "external_overlap"
  | "shift_outside_opening_hours"
  | "fifo_end_order_inversion"
  | "min_staff_unmet"
  | "min_pedagogs_unmet"
  | "staffing_rule_outside_opening_hours"
  | "conflicting_replacement"
  | "replacement_outside_opening_hours"
  | "overlapping_counted_event"
  | "invalid_owner"
  | "invalid_participant"
  | "invalid_event"
  | "group_capacity_shortfall"
  | "group_pedagog_capacity_shortfall"
  | "stale_proposal"
  | "out_of_scope"
  | "locked_shift"
  | "missing_shift"
  | "malformed_patch"
  | "other_draft_conflict"

type ValidationIssue = {
  code: ValidationIssueCode | string
  severity: "error" | "warning"
  message: string
  date?: ISODateString
  startTime?: ClockTime
  endTime?: ClockTime
  staffId?: string
  shiftId?: string
  sourceIds?: string[]
  ruleIds?: string[]
  details?: Record<string, unknown>
}
type DatedValidationResult = {
  valid: boolean
  issues: ValidationIssue[]
  warnings?: ValidationIssue[]
}

type CalendarScope =
  | { kind: "day"; date: ISODateString }
  | { kind: "week"; week: string }
  | { kind: "period" }

type ShiftPatchOperation =
  | { type: "create"; shift: PlanningShift }
  | {
      type: "update"
      shiftId: string
      changes: Partial<Omit<PlanningShift, "id">>
    }
  | { type: "delete"; shiftId: string }

type ProposalPatch = {
  id?: string
  requestId: string
  periodId: string
  groupId: string
  baseDraftRevision: number
  inputFingerprint: string
  scope: CalendarScope
  operations: ShiftPatchOperation[]
}

type ProposalCheck = DatedValidationResult & { candidate?: PlanningShift[] }

export type {
  CalendarScope,
  ClockTime,
  DatedSchedule,
  DatedShift,
  DatedValidationResult,
  DraftShift,
  EffectiveAvailabilityInterval,
  EffectiveDay,
  EffectiveInputs,
  EffectiveOpeningInterval,
  GroupRequirementReplacement,
  ISODateString,
  OpeningReplacement,
  OwnerReference,
  PlanningEvent,
  PlanningPeriod,
  PlanningShift,
  PlanningStaff,
  Period,
  ProposalCheck,
  ProposalPatch,
  PublishedCommitment,
  RawRecurringInput,
  SharedEvent,
  ShiftPatchOperation,
  SourceReference,
  StaffUnavailability,
  Shift,
  StaffingDemandSegment,
  TimeInterval,
  ValidationIssue,
  ValidationIssueCode,
  EffectiveInput,
}
