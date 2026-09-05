import { z } from "zod"
import {
  isValidDate,
  isValidTimeInterval,
  isoWeekKey,
  isoWeekStart,
} from "./dates"

const uuid = z.string().uuid()
const revision = z.number().int().positive()
const date = z.string().refine(isValidDate, "Choose a valid calendar date.")
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const expected = { periodId: uuid, expectedRevision: revision }
const request = { ...expected, requestId: uuid }
export const calendarScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("day"), date }),
  z.object({
    kind: z.literal("week"),
    week: z
      .string()
      .regex(/^\d{4}-W\d{2}$/)
      .refine((week) => {
        try {
          return isoWeekKey(isoWeekStart(week)) === week
        } catch {
          return false
        }
      }, "Choose a valid ISO week."),
  }),
  z.object({ kind: z.literal("period") }),
])
export const manualShiftSchema = z
  .object({
    id: uuid,
    groupId: uuid.optional(),
    staffId: uuid,
    date,
    startTime: time,
    endTime: time,
    locked: z.boolean(),
  })
  .refine(
    isValidTimeInterval,
    "The shift must end after it starts on the same date."
  )

const dateRange = { startDate: date, endDate: date }
const actor = { actorId: uuid }
export const planningCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("savePreparation"), groupId: uuid, ...dateRange }),
  z.object({ type: z.literal("updatePreparation"), ...expected, ...dateRange }),
  z.object({ type: z.literal("generate"), ...request }),
  z.object({
    type: z.literal("saveShift"),
    ...expected,
    ...actor,
    shift: manualShiftSchema,
  }),
  z.object({
    type: z.literal("createShift"),
    ...expected,
    ...actor,
    shift: manualShiftSchema,
  }),
  z.object({
    type: z.literal("deleteShift"),
    ...expected,
    ...actor,
    shiftId: uuid,
  }),
  z.object({
    type: z.literal("moveShift"),
    ...expected,
    ...actor,
    shiftId: uuid,
    date,
    startTime: time,
    endTime: time,
  }),
  z.object({
    type: z.literal("toggleLock"),
    ...expected,
    ...actor,
    shiftId: uuid,
    locked: z.boolean(),
  }),
  z.object({ type: z.literal("undo"), ...expected, ...actor }),
  z.object({ type: z.literal("refreshInputs"), ...expected }),
  z.object({
    type: z.literal("createRevision"),
    periodId: uuid,
    requestId: uuid,
  }),
  z.object({ type: z.literal("discardDraft"), ...expected }),
  z.object({
    type: z.literal("requestAi"),
    ...request,
    scope: calendarScopeSchema,
    prompt: z.string().trim().min(1).max(8000),
  }),
  z.object({
    type: z.literal("applyProposal"),
    ...request,
    ...actor,
    proposalId: uuid,
    reviewedFingerprint: z.string().min(1),
  }),
  z.object({
    type: z.literal("discardProposal"),
    ...expected,
    proposalId: uuid,
  }),
  z.object({
    type: z.literal("refineProposal"),
    ...request,
    proposalId: uuid,
    prompt: z.string().trim().min(1).max(8000),
  }),
  z.object({
    type: z.literal("publish"),
    ...request,
    reviewedFingerprint: z.string().min(1),
    expectedBaseVersionId: uuid.nullable(),
  }),
  z.object({
    type: z.literal("saveTimezone"),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value })
        return true
      } catch {
        return false
      }
    }, "Choose an IANA timezone, for example Europe/Copenhagen."),
  }),
  z.object({
    type: z.literal("saveException"),
    exceptionId: uuid.optional(),
    expectedRevision: revision.optional(),
    ownerType: z.enum(["institution", "group", "staff"]),
    ownerId: z.string().min(1),
    kind: z.enum([
      "closure",
      "opening",
      "staffing",
      "leave",
      "sickness",
      "unavailability",
      "meeting",
      "training",
    ]),
    date,
    endDate: date.optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    description: z.string().max(500).optional(),
    participantStaffIds: z.array(uuid).optional(),
    countsTowardWeeklyHours: z.boolean().optional(),
    openingIntervals: z
      .array(z.object({ startTime: time, endTime: time }))
      .optional(),
    minStaff: z.number().int().nonnegative().optional(),
    minPedagogs: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("deleteException"),
    exceptionId: uuid,
    expectedRevision: revision,
    ownerType: z.enum(["institution", "group", "staff"]),
    ownerId: z.string().min(1),
  }),
])
