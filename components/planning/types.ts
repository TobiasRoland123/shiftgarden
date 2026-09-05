import type {
  EffectiveAvailabilityInterval,
  EffectiveOpeningInterval,
  PlanningEvent,
  PlanningPeriod,
  PlanningShift,
  PlanningStaff,
  ProposalPatch,
  SourceReference,
  ValidationIssue,
} from "@/lib/planning/contracts"
import type { z } from "zod"
import type { planningCommandSchema } from "@/lib/planning/action-schema"

export type PlanningActionResult =
  | { ok: true; periodId?: string; proposalId?: string; message?: string }
  | {
      ok: false
      code?: string
      error: string
      issues?: ValidationIssue[]
      conflictPeriodId?: string
    }

export type PlanningActionCommand = z.infer<typeof planningCommandSchema>

export type PlanningAction = (
  command: PlanningActionCommand
) => Promise<PlanningActionResult>

export type GroupSummary = {
  id: string
  name: string
  staffCount: number
  activeStaffCount: number
  periods: PlanningPeriodSummary[]
}

export type PlanningPeriodSummary = PlanningPeriod & {
  status:
    | "not-planned"
    | "preparation"
    | "draft"
    | "published"
    | "revision"
    | "stale"
  uncoveredDates: string[]
  draftRevision?: number
  publishedVersion?: number
}

export type PlanningOverviewData = {
  groups: GroupSummary[]
  legacyPlanCount: number
}

export type PreparationData = {
  period: PlanningPeriod
  group: { id: string; name: string }
  staff: PlanningStaff[]
  effectiveOpeningSummary: string
  demandSummary: string
  sources: Array<
    SourceReference & {
      date: string
      description?: string
      effect: string
      href: string
      participantCount?: number
      minStaff?: number
      minPedagogs?: number
    }
  >
  affectedDates: string[]
  inputIssues: ValidationIssue[]
  draftRevision?: number
  inputsStale: boolean
  staffInputs: Array<{
    id: string
    name: string
    role: PlanningStaff["role"]
    availabilityDates: number
    intervalCount: number
    href: string
  }>
}

export type ProposalView = ProposalPatch & {
  candidate: PlanningShift[]
  before: PlanningShift[]
  issues: ValidationIssue[]
  warnings?: ValidationIssue[]
  prompt: string
  notes: string[]
  state: "pending" | "applied" | "discarded" | "superseded" | "failed"
}

export type PeriodViewData = {
  period: PlanningPeriod
  group: { id: string; name: string }
  staff: PlanningStaff[]
  shifts: PlanningShift[]
  events: PlanningEvent[]
  issues: ValidationIssue[]
  warnings: ValidationIssue[]
  draftRevision: number
  draftState:
    | "preparation"
    | "generating"
    | "failed"
    | "editing"
    | "reviewing"
    | "discarded"
  publishedVersion?: number
  proposal?: ProposalView
  weeklyBudgets: Array<{
    week: string
    shiftMinutes: number
    attendanceMinutes: number
    externalMinutes: number
    maxMinutes: number
    staffId: string
  }>
  history: Array<{
    version: number
    publishedAt: string
    publishedBy?: string
    shiftCount: number
  }>
  readOnly?: boolean
  reviewedFingerprint: string
  expectedBaseVersionId: string | null
  effectiveFingerprint: string
  inputsStale: boolean
  aiNotes: string[]
  sourceChanges: Array<{
    sourceId: string
    sourceType?: string
    description: string
    href?: string
  }>
  sourceLinks: Array<{ sourceId: string; href: string; label?: string }>
  publicationChanges: Array<{
    type: "create" | "update" | "delete"
    before?: PlanningShift
    after?: PlanningShift
  }>
  undoAvailable: boolean
  coverageSegments: Array<{
    date: string
    startTime: string
    endTime: string
    actualStaff: number
    requiredStaff: number
    actualPedagogs: number
    requiredPedagogs: number
    eligibleStaffIds: string[]
    sourceIds: string[]
  }>
  calendarDays: Array<{
    date: string
    openingIntervals: EffectiveOpeningInterval[]
    demandSegments: Array<{
      startTime: string
      endTime: string
      minStaff: number
      minPedagogs: number
      sourceIds: string[]
    }>
    availability: EffectiveAvailabilityInterval[]
  }>
}

export type ExceptionFormProps = {
  ownerType: "institution" | "group" | "staff"
  ownerId: string
  staff?: PlanningStaff[]
  returnHref: string
  existing?: {
    id: string
    revision: number
    kind:
      | "closure"
      | "opening"
      | "staffing"
      | "leave"
      | "sickness"
      | "unavailability"
      | "meeting"
      | "training"
    date: string
    endDate: string
    startTime?: string
    endTime?: string
    description?: string
    participantStaffIds?: string[]
    countsTowardWeeklyHours?: boolean
    openingIntervals?: Array<{ startTime: string; endTime: string }>
    minStaff?: number
    minPedagogs?: number
  }
  onAction?: PlanningAction
}

export type PlanningExceptionSummary = NonNullable<
  ExceptionFormProps["existing"]
> & {
  ownerType: ExceptionFormProps["ownerType"]
  ownerId: string
}
