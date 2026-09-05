"use server"

import { revalidatePath } from "next/cache"
import { planningCommandSchema } from "@/lib/planning/action-schema"
import {
  generatePeriod,
  requestPlanningProposal,
  discardPlanningProposal,
  refinePlanningProposal,
} from "@/lib/planning/ai-service"
import {
  applyProposal,
  createRevision,
  discardWorkingDraft,
  mutateShifts,
  publishDraft,
  refreshDraftInputs,
  saveInstitutionTimezone,
  savePreparation,
  undoDraft,
  updatePreparation,
} from "@/lib/planning/service"
import {
  createPlanningException,
  updatePlanningException,
  deletePlanningException,
} from "@/lib/planning/exception-service"
import { PlanningConflictError } from "@/lib/planning/repository"
import type { ValidationIssue } from "@/lib/planning/contracts"
import type {
  PlanningActionCommand,
  PlanningActionResult,
} from "@/components/planning/types"

export async function planningAction(
  raw: PlanningActionCommand
): Promise<PlanningActionResult> {
  const parsed = planningCommandSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid_request",
      error: parsed.error.issues.map((issue) => issue.message).join(" "),
    }
  const command = parsed.data
  try {
    let periodId = "periodId" in command ? command.periodId : undefined
    let proposalId: string | undefined
    switch (command.type) {
      case "savePreparation":
        periodId = (await savePreparation(command)).id
        break
      case "updatePreparation":
        await updatePreparation(command)
        break
      case "generate":
        await generatePeriod(command)
        break
      case "saveShift":
      case "createShift":
      case "deleteShift":
      case "moveShift":
      case "toggleLock":
        await mutateShifts({
          ...command,
          mutate: (shifts) => {
            if (command.type === "createShift") {
              if (shifts.some((shift) => shift.id === command.shift.id))
                throw new PlanningConflictError(
                  "duplicate_shift",
                  "This shift already exists."
                )
              return [...shifts, command.shift]
            }
            const id =
              command.type === "saveShift" ? command.shift.id : command.shiftId
            const index = shifts.findIndex((shift) => shift.id === id)
            if (index < 0)
              throw new PlanningConflictError(
                "missing_shift",
                "This shift is no longer in the draft."
              )
            if (command.type === "deleteShift")
              return shifts.filter((shift) => shift.id !== id)
            shifts[index] =
              command.type === "saveShift"
                ? command.shift
                : command.type === "toggleLock"
                  ? { ...shifts[index], locked: command.locked }
                  : {
                      ...shifts[index],
                      date: command.date,
                      startTime: command.startTime,
                      endTime: command.endTime,
                    }
            return shifts
          },
        })
        break
      case "undo":
        await undoDraft(command)
        break
      case "refreshInputs":
        await refreshDraftInputs(command)
        break
      case "createRevision":
        await createRevision(command.periodId)
        break
      case "discardDraft":
        await discardWorkingDraft(command)
        break
      case "requestAi":
        proposalId = await requestPlanningProposal(command)
        break
      case "applyProposal":
        await applyProposal(command)
        break
      case "discardProposal":
        await discardPlanningProposal(
          command.periodId,
          command.proposalId,
          command.expectedRevision
        )
        break
      case "refineProposal": {
        proposalId = await refinePlanningProposal(command)
        break
      }
      case "publish":
        await publishDraft(command)
        break
      case "saveTimezone":
        await saveInstitutionTimezone(command.timezone)
        break
      case "saveException": {
        const kinds = {
          closure: "closed_date",
          opening: "opening_replacement",
          staffing: "staffing_replacement",
          unavailability: "partial_unavailability",
          leave: "leave",
          sickness: "sickness",
          meeting: "meeting",
          training: "training",
        } as const
        const input = {
          owner: { ownerType: command.ownerType, ownerId: command.ownerId },
          type: kinds[command.kind],
          startDate: command.date,
          endDate: command.endDate ?? command.date,
          startTime: command.startTime,
          endTime: command.endTime,
          reason: command.description,
          participantStaffIds:
            command.ownerType === "staff" &&
            ["meeting", "training"].includes(command.kind)
              ? [command.ownerId]
              : (command.participantStaffIds ?? []),
          countsTowardWeeklyHours: command.countsTowardWeeklyHours ?? true,
          intervals: command.openingIntervals ?? [],
          minStaff: command.minStaff,
          minPedagogs: command.minPedagogs,
        }
        if (command.exceptionId) {
          if (!command.expectedRevision)
            throw new PlanningConflictError(
              "stale_source",
              "Reload the exception before changing it."
            )
          await updatePlanningException(
            command.exceptionId,
            input,
            command.expectedRevision
          )
        } else await createPlanningException(input)
        break
      }
      case "deleteException":
        await deletePlanningException(
          command.exceptionId,
          command.expectedRevision
        )
        break
    }
    revalidatePath("/[locale]/planning", "layout")
    if (
      ["saveException", "deleteException", "saveTimezone"].includes(
        command.type
      )
    ) {
      revalidatePath("/[locale]/staff", "layout")
      revalidatePath("/[locale]/groups", "layout")
      revalidatePath("/[locale]/settings/opening-hours", "page")
    }
    return { ok: true, periodId, proposalId }
  } catch (error) {
    if (error instanceof PlanningConflictError)
      return {
        ok: false,
        code: error.code,
        error: error.message,
        conflictPeriodId: error.details?.periodId as string | undefined,
        issues: error.details?.issues as ValidationIssue[] | undefined,
      }
    if (error instanceof Error && error.name === "ZodError")
      return {
        ok: false,
        code: "invalid_request",
        error:
          "Some values are invalid. Check the dates, times, owner, and participants.",
      }
    return {
      ok: false,
      code: "operation_failed",
      error:
        "The operation could not finish. Saved work is preserved. Refresh to check its outcome before retrying.",
    }
  }
}
