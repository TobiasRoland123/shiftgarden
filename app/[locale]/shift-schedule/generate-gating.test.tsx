import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithIntl } from "@/lib/test/render-with-intl"
import type { GroupReadiness } from "@/lib/shift-schedule/readiness"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import { GenerateSchedulePlan } from "./generate-schedule-plan"
import { ReadinessPanel } from "./readiness-panel"

vi.mock("./actions", () => ({
  generateSchedulePlan: vi.fn(),
  acceptSchedulePlan: vi.fn(),
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const scheduleInput = {
  group: { id: "group-1", name: "Blue room" },
  openingHours: [],
  rules: [],
  staff: [],
} as unknown as ScheduleInput

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
    linkedStaffCount: 3,
    staffingRuleCount: 2,
    openingHoursCount: 7,
    canGenerate: true,
    ...overrides,
  }
}

function renderPage(readiness: GroupReadiness) {
  return renderWithIntl(
    <>
      <ReadinessPanel readiness={readiness} />
      <GenerateSchedulePlan
        canGenerate={readiness.canGenerate}
        groupId="group-1"
        scheduleInput={scheduleInput}
      />
    </>
  )
}

const blockingCases = [
  ["no_opening_hours", "The institution has no opening hours configured."],
  ["no_staffing_rules", "This group has no staffing rules."],
  ["no_linked_active_staff", "This group has no linked active staff members."],
] as const

describe("generation gating", () => {
  it.each(blockingCases)(
    "disables generation with a stated reason for %s",
    (code, reason) => {
      renderPage(
        createReadiness({
          canGenerate: false,
          blockingIssues: [{ code }],
        })
      )

      expect(
        screen.getByRole("button", { name: "Generate plan" })
      ).toBeDisabled()
      expect(screen.getByText(reason)).toBeInTheDocument()
      expect(
        screen.getByText(
          "Resolve the group readiness problems above before generating a plan."
        )
      ).toBeInTheDocument()
    }
  )

  it("disables generation for a staffing rule outside opening hours", () => {
    renderPage(
      createReadiness({
        canGenerate: false,
        blockingIssues: [
          {
            code: "staffing_rule_outside_opening_hours",
            dayOfWeek: "monday",
            startTime: "16:00",
            endTime: "18:00",
          },
        ],
      })
    )

    expect(screen.getByRole("button", { name: "Generate plan" })).toBeDisabled()
    expect(
      screen.getByText(
        "The Monday staffing rule 16:00-18:00 does not fit inside one opening hours interval."
      )
    ).toBeInTheDocument()
  })

  it("enables generation when only capacity shortfalls are present", () => {
    renderPage(
      createReadiness({
        capacityShortfall: {
          ...noShortfall,
          totalCapacityHours: 10,
          totalDemandHours: 30,
          totalShortfallHours: 20,
          pedagogCapacityHours: 2,
          pedagogDemandHours: 12,
          pedagogShortfallHours: 10,
        },
      })
    )

    expect(screen.getByRole("button", { name: "Generate plan" })).toBeEnabled()
    expect(
      screen.getByText("Weekly staff capacity shortfall")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Weekly pedagog capacity shortfall")
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "Resolve the group readiness problems above before generating a plan."
      )
    ).not.toBeInTheDocument()
  })
})
