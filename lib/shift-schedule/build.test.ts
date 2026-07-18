import { describe, expect, it } from "vitest"

import { buildScheduleInput } from "@/lib/shift-schedule/build"

describe("buildScheduleInput", () => {
  it("builds the schedule input shape used by the preview and AI prompt", () => {
    const input = buildScheduleInput({
      group: {
        id: "group-1",
        name: "Blue room",
      },
      linkedStaff: [
        {
          id: "staff-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 32,
          active: true,
        },
        {
          id: "staff-2",
          firstName: "Grace",
          lastName: "Hopper",
          role: "assistant",
          maxHoursPerWeek: 30,
          active: true,
        },
      ],
      availability: [
        {
          staffMemberId: "staff-1",
          dayOfWeek: "monday",
          startAvailabilityTime: "08:00:00",
          endAvailabilityTime: "16:00:00",
        },
        {
          staffMemberId: "staff-2",
          dayOfWeek: "monday",
          startAvailabilityTime: "09:00:00",
          endAvailabilityTime: "15:00:00",
        },
      ],
      openingHours: [
        {
          dayOfWeek: "monday",
          startTime: "07:00:00",
          endTime: "18:00:00",
        },
      ],
      rules: [
        {
          dayOfWeek: "monday",
          startTime: "08:00:00",
          endTime: "16:00:00",
          minPedagogs: 1,
          minStaff: 2,
        },
      ],
    })

    expect(input).toEqual({
      group: {
        id: "group-1",
        name: "Blue room",
      },
      openingHours: [
        {
          dayOfWeek: "monday",
          startTime: "07:00",
          endTime: "18:00",
        },
      ],
      staff: [
        {
          id: "staff-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 32,
          active: true,
          availability: [
            {
              dayOfWeek: "monday",
              startAvailabilityTime: "08:00",
              endAvailabilityTime: "16:00",
            },
          ],
        },
        {
          id: "staff-2",
          firstName: "Grace",
          lastName: "Hopper",
          role: "assistant",
          maxHoursPerWeek: 30,
          active: true,
          availability: [
            {
              dayOfWeek: "monday",
              startAvailabilityTime: "09:00",
              endAvailabilityTime: "15:00",
            },
          ],
        },
      ],
      rules: [
        {
          dayOfWeek: "monday",
          startTime: "08:00",
          endTime: "16:00",
          minPedagogs: 1,
          minStaff: 2,
        },
      ],
    })
  })
})
