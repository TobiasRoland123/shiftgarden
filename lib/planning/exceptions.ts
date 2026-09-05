import { z } from "zod"

import {
  intervalsOverlap,
  isValidDate,
  isValidTimeInterval,
} from "@/lib/planning/dates"

const ownerReferenceSchema = z.discriminatedUnion("ownerType", [
  z.object({ ownerType: z.literal("institution"), ownerId: z.string().min(1) }),
  z.object({ ownerType: z.literal("group"), ownerId: z.string().min(1) }),
  z.object({ ownerType: z.literal("staff"), ownerId: z.string().min(1) }),
])

const exceptionTypeSchema = z.enum([
  "closed_date",
  "opening_replacement",
  "leave",
  "sickness",
  "partial_unavailability",
  "meeting",
  "training",
  "staffing_replacement",
])

const exceptionSchema = z
  .object({
    id: z.string().min(1).optional(),
    owner: ownerReferenceSchema,
    type: exceptionTypeSchema,
    startDate: z.string(),
    endDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    reason: z.string().max(500).optional(),
    countsTowardWeeklyHours: z.boolean().default(true),
    participantStaffIds: z.array(z.string().min(1)).default([]),
    intervals: z
      .array(z.object({ startTime: z.string(), endTime: z.string() }))
      .default([]),
    minStaff: z.number().int().nonnegative().optional(),
    minPedagogs: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    if (!isValidDate(value.startDate)) {
      context.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Expected an ISO date.",
      })
    }
    if (!isValidDate(value.endDate) || value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date.",
      })
    }
    const hasStart = Boolean(value.startTime)
    const hasEnd = Boolean(value.endTime)
    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Both times are required for a partial-day exception.",
      })
    } else if (
      hasStart &&
      hasEnd &&
      !isValidTimeInterval({
        startTime: value.startTime!,
        endTime: value.endTime!,
      })
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time.",
      })
    }
    const isEvent = value.type === "meeting" || value.type === "training"
    const allowedTypes = {
      institution: [
        "closed_date",
        "opening_replacement",
        "meeting",
        "training",
      ],
      group: ["staffing_replacement", "meeting", "training"],
      staff: [
        "leave",
        "sickness",
        "partial_unavailability",
        "meeting",
        "training",
      ],
    } as const
    if (
      !(allowedTypes[value.owner.ownerType] as readonly string[]).includes(
        value.type
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["type"],
        message: "This exception type does not belong to that owner.",
      })
    }
    if (
      isEvent &&
      value.owner.ownerType !== "staff" &&
      value.participantStaffIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["participantStaffIds"],
        message: "Shared events need at least one participant.",
      })
    }
    if (isEvent && (!value.startTime || !value.endTime)) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Events need a start and end time.",
      })
    }
    if (
      new Set(value.participantStaffIds).size !==
      value.participantStaffIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["participantStaffIds"],
        message: "Participants must be unique.",
      })
    }
    for (const [index, interval] of value.intervals.entries()) {
      if (!isValidTimeInterval(interval))
        context.addIssue({
          code: "custom",
          path: ["intervals", index],
          message: "Interval end time must be after start time.",
        })
    }
    for (let index = 0; index < value.intervals.length; index += 1) {
      for (let other = index + 1; other < value.intervals.length; other += 1) {
        if (
          isValidTimeInterval(value.intervals[index]) &&
          isValidTimeInterval(value.intervals[other]) &&
          intervalsOverlap(value.intervals[index], value.intervals[other])
        ) {
          context.addIssue({
            code: "custom",
            path: ["intervals", other],
            message: "Opening replacement intervals cannot overlap.",
          })
        }
      }
    }
    if (
      value.type === "closed_date" &&
      (hasStart || value.intervals.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["intervals"],
        message: "A closed date cannot contain opening intervals.",
      })
    }
    if (
      value.type === "opening_replacement" &&
      value.intervals.length === 0 &&
      !(hasStart && hasEnd)
    ) {
      context.addIssue({
        code: "custom",
        path: ["intervals"],
        message: "Replacement opening hours need at least one interval.",
      })
    }
    if (value.type === "partial_unavailability" && !(hasStart && hasEnd)) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Partial-day unavailability needs a start and end time.",
      })
    }
    if (
      value.type === "staffing_replacement" &&
      (value.minStaff === undefined || value.minPedagogs === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["minStaff"],
        message: "Staffing replacements need both minimum counts.",
      })
    }
    if (value.type === "staffing_replacement" && !(hasStart && hasEnd)) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Staffing replacements need a start and end time.",
      })
    }
  })

type PlanningExceptionInput = z.infer<typeof exceptionSchema>

function validateExceptionInput(value: unknown) {
  return exceptionSchema.safeParse(value)
}

function assertExceptionInput(value: unknown): PlanningExceptionInput {
  return exceptionSchema.parse(value)
}

export {
  assertExceptionInput,
  exceptionSchema,
  ownerReferenceSchema,
  validateExceptionInput,
}
export type { PlanningExceptionInput }
