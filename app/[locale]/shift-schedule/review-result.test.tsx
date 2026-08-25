import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithIntl } from "@/lib/test/render-with-intl"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type { SchedulePlanReview } from "@/lib/shift-schedule/review-types"
import { ReviewResult } from "./review-result"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const scheduleInput = {
  group: { id: "group-1", name: "Blue room" },
  openingHours: daysOfWeek.map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "07:00",
    endTime: "17:00",
  })),
  rules: [
    {
      dayOfWeek: "monday",
      startTime: "09:00",
      endTime: "12:00",
      minPedagogs: 1,
      minStaff: 2,
    },
  ],
  staff: [
    {
      id: "staff-1",
      firstName: "Ada",
      lastName: "Lovelace",
      role: "pedagog",
      maxHoursPerWeek: 37,
      active: true,
      availability: [
        {
          dayOfWeek: "monday",
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        },
      ],
    },
  ],
} as unknown as ScheduleInput

function createPlan(warnings: string[] = []): GeneratedSchedule {
  return {
    groupId: "group-1",
    warnings,
    days: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      shifts:
        dayOfWeek === "monday"
          ? [{ staffId: "staff-1", startTime: "09:00", endTime: "12:00" }]
          : [],
    })),
  }
}

function createReview(
  overrides: Partial<SchedulePlanReview> = {}
): SchedulePlanReview {
  return {
    plan: createPlan(),
    scheduleInput,
    validationErrors: [],
    validationWarnings: [],
    generationId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1,
    ...overrides,
  }
}

function renderReview(
  review: SchedulePlanReview,
  acceptState: Parameters<typeof ReviewResult>[0]["acceptState"] = {
    status: "idle",
  }
) {
  return renderWithIntl(
    <ReviewResult
      acceptState={acceptState}
      formAction={() => {}}
      isAccepting={false}
      review={review}
    />
  )
}

describe("ReviewResult", () => {
  it("offers the accept action for a plan with zero validation errors", () => {
    renderReview(createReview())

    expect(screen.getByText("Accepted plan")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Accept and save plan" })
    ).toBeInTheDocument()
  })

  it("hides the accept action when the plan has validation errors", () => {
    renderReview(
      createReview({
        validationErrors: [
          {
            code: "max_hours_exceeded",
            severity: "error",
            message: "fallback",
            staffId: "staff-1",
          },
        ],
      })
    )

    expect(screen.getByText("Plan cannot be accepted")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Accept and save plan" })
    ).not.toBeInTheDocument()
  })

  it("keeps the verdict unchanged by AI warnings", () => {
    renderReview(
      createReview({
        plan: createPlan(["Coverage is tight on Friday", "Consider a sub"]),
      })
    )

    expect(screen.getByText("Accepted plan")).toBeInTheDocument()
    expect(screen.getByText("AI warnings")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Notes from the model. They are not validation results and do not decide whether this plan is accepted."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Accept and save plan" })
    ).toBeInTheDocument()
  })

  it("omits result sections that are empty", () => {
    renderReview(createReview())

    expect(screen.queryByText("AI warnings")).not.toBeInTheDocument()
    expect(screen.queryByText("Validation warnings")).not.toBeInTheDocument()
    expect(screen.queryByText("Validation errors")).not.toBeInTheDocument()
  })

  it("keeps the accept action available when only validation warnings exist", () => {
    renderReview(
      createReview({
        validationWarnings: [
          {
            code: "max_hours_exceeded",
            severity: "warning",
            message: "fallback",
            staffId: "staff-1",
          },
        ],
      })
    )

    expect(screen.getByText("Validation warnings")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Accept and save plan" })
    ).toBeInTheDocument()
  })

  it("confirms the saved plan after acceptance", () => {
    renderReview(createReview(), {
      status: "accepted",
      planId: "11111111-1111-4111-8111-111111111111",
    })

    expect(screen.getByText("Plan saved")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Accept and save plan" })
    ).not.toBeInTheDocument()
  })

  it("keeps the raw JSON closed by default", () => {
    renderReview(createReview())

    expect(screen.getByText("Developer details")).toBeInTheDocument()
    expect(screen.queryByText("Schedule input JSON")).not.toBeInTheDocument()
  })

  it("renders one timeline row per staff member with a coverage strip", () => {
    renderReview(createReview())

    expect(screen.getByText("Week overview")).toBeInTheDocument()
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("Pedagog")).toBeInTheDocument()
    expect(
      screen.getByLabelText("Ada Lovelace: 09:00 to 12:00")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("09:00-12:00: 1 of 2 staff, 1 of 1 pedagogs")
    ).toBeInTheDocument()
  })
})
