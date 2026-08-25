import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithIntl } from "@/lib/test/render-with-intl"
import type { GroupReadiness } from "@/lib/shift-schedule/readiness"
import { ReadinessPanel } from "./readiness-panel"
import { ValidationIssueList } from "./validation-issue-list"
import { VerdictBanner } from "./verdict-banner"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import type { ScheduleValidationIssue } from "@/lib/shift-schedule/validation-types"

const noShortfall = {
  totalDemandHours: 10,
  totalCapacityHours: 40,
  totalShortfallHours: 0,
  pedagogDemandHours: 5,
  pedagogCapacityHours: 20,
  pedagogShortfallHours: 0,
}

function createReadiness(
  overrides: Partial<GroupReadiness> = {}
): GroupReadiness {
  return {
    blockingIssues: [],
    capacityShortfall: noShortfall,
    linkedActiveStaffCount: 3,
    linkedStaffCount: 4,
    staffingRuleCount: 5,
    openingHoursCount: 7,
    canGenerate: true,
    ...overrides,
  }
}

const scheduleInput = {
  group: { id: "group-1", name: "Blue room" },
  openingHours: [],
  rules: [],
  staff: [
    {
      id: "staff-1",
      firstName: "Ada",
      lastName: "Lovelace",
      role: "pedagog",
      maxHoursPerWeek: 37,
      active: true,
      availability: [],
    },
  ],
} as unknown as ScheduleInput

describe("ReadinessPanel", () => {
  it("states each blocking reason", () => {
    renderWithIntl(
      <ReadinessPanel
        readiness={createReadiness({
          canGenerate: false,
          blockingIssues: [
            { code: "no_opening_hours" },
            { code: "no_staffing_rules" },
            { code: "no_linked_active_staff" },
            {
              code: "staffing_rule_outside_opening_hours",
              dayOfWeek: "monday",
              startTime: "16:00",
              endTime: "18:00",
            },
          ],
        })}
      />
    )

    expect(screen.getByText("Generation is blocked")).toBeInTheDocument()
    expect(
      screen.getByText("The institution has no opening hours configured.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("This group has no staffing rules.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("This group has no linked active staff members.")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "The Monday staffing rule 16:00-18:00 does not fit inside one opening hours interval."
      )
    ).toBeInTheDocument()
  })

  it("presents a capacity shortfall as non-blocking", () => {
    renderWithIntl(
      <ReadinessPanel
        readiness={createReadiness({
          capacityShortfall: {
            ...noShortfall,
            totalCapacityHours: 10,
            totalDemandHours: 30,
            totalShortfallHours: 20,
          },
        })}
      />
    )

    expect(screen.getByText("Ready to generate")).toBeInTheDocument()
    expect(
      screen.getByText("Weekly staff capacity shortfall")
    ).toBeInTheDocument()
    expect(screen.queryByText("Generation is blocked")).not.toBeInTheDocument()
  })

  it("reports the pedagog shortfall separately from the staff shortfall", () => {
    renderWithIntl(
      <ReadinessPanel
        readiness={createReadiness({
          capacityShortfall: {
            ...noShortfall,
            pedagogCapacityHours: 2,
            pedagogDemandHours: 12,
            pedagogShortfallHours: 10,
          },
        })}
      />
    )

    expect(
      screen.getByText("Weekly pedagog capacity shortfall")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Weekly staff capacity shortfall")
    ).not.toBeInTheDocument()
  })

  it("shows the readiness counts", () => {
    renderWithIntl(<ReadinessPanel readiness={createReadiness()} />)

    expect(screen.getByText("Linked active staff")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
  })
})

describe("VerdictBanner", () => {
  it("reports an accepted plan when there are no validation errors", () => {
    renderWithIntl(<VerdictBanner validationErrorCount={0} />)

    expect(screen.getByText("Accepted plan")).toBeInTheDocument()
    expect(
      screen.getByText("This plan has zero validation errors and can be saved.")
    ).toBeInTheDocument()
  })

  it("reports the validation error count when the plan is blocked", () => {
    renderWithIntl(<VerdictBanner validationErrorCount={4} />)

    expect(screen.getByText("Plan cannot be accepted")).toBeInTheDocument()
    expect(
      screen.getByText("4 validation errors block this plan from being saved.")
    ).toBeInTheDocument()
  })
})

function createIssue(
  overrides: Partial<ScheduleValidationIssue> = {}
): ScheduleValidationIssue {
  return {
    code: "outside_availability",
    severity: "error",
    message: "fallback",
    dayOfWeek: "monday",
    staffId: "staff-1",
    startTime: "09:00",
    endTime: "12:00",
    ...overrides,
  }
}

describe("ValidationIssueList", () => {
  it("renders one entry per issue rather than one joined string", () => {
    renderWithIntl(
      <ValidationIssueList
        issues={[
          createIssue({ startTime: "09:00", endTime: "12:00" }),
          createIssue({ startTime: "13:00", endTime: "15:00" }),
          createIssue({ dayOfWeek: "tuesday" }),
          createIssue({ code: "max_hours_exceeded" }),
        ]}
        scheduleInput={scheduleInput}
      />
    )

    expect(screen.getAllByRole("listitem")).toHaveLength(6)
    expect(screen.getByText("3 issues")).toBeInTheDocument()
    expect(screen.getByText("1 issue")).toBeInTheDocument()
  })

  it("resolves the staff id to a name and includes issue context", () => {
    renderWithIntl(
      <ValidationIssueList
        issues={[createIssue()]}
        scheduleInput={scheduleInput}
      />
    )

    expect(
      screen.getByText(
        "Ada Lovelace is scheduled 09:00-12:00 on Monday, which does not fit inside one availability interval."
      )
    ).toBeInTheDocument()
  })

  it("renders issue text in the active locale", () => {
    renderWithIntl(
      <ValidationIssueList
        issues={[createIssue()]}
        scheduleInput={scheduleInput}
      />,
      { locale: "da" }
    )

    expect(
      screen.getByText(
        "Ada Lovelace er sat på vagt 09:00-12:00 om Mandag, hvilket ikke passer ind i ét tilgængelighedsinterval."
      )
    ).toBeInTheDocument()
  })

  it("reports the failing coverage segment and rule number", () => {
    renderWithIntl(
      <ValidationIssueList
        issues={[
          createIssue({
            code: "min_staff_unmet",
            staffId: undefined,
            startTime: "11:00",
            endTime: "12:00",
            ruleIndex: 1,
          }),
        ]}
        scheduleInput={scheduleInput}
      />
    )

    expect(
      screen.getByText(
        "Monday 11:00-12:00 does not have enough staff for staffing rule 2."
      )
    ).toBeInTheDocument()
  })

  it("selects and deselects an issue when it is interactive", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    renderWithIntl(
      <ValidationIssueList
        issues={[createIssue()]}
        onSelect={onSelect}
        scheduleInput={scheduleInput}
      />
    )

    await user.click(screen.getByRole("button"))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "outside_availability",
        dayOfWeek: "monday",
        staffId: "staff-1",
      })
    )
  })

  it("renders nothing when there are no issues", () => {
    const { container } = renderWithIntl(
      <ValidationIssueList issues={[]} scheduleInput={scheduleInput} />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
