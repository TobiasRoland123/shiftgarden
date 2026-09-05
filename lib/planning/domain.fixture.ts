import type { PlanningPeriod, RawRecurringInput } from "./contracts"

export const fixturePeriod: PlanningPeriod = {
  id: "period-1",
  groupId: "group-1",
  startDate: "2026-09-07",
  endDate: "2026-09-08",
  timezone: "Europe/Copenhagen",
}

export const fixtureRecurring: RawRecurringInput = {
  group: { id: "group-1", name: "Sunflowers" },
  openingHours: [
    { dayOfWeek: "monday", startTime: "08:00", endTime: "16:00" },
    { dayOfWeek: "tuesday", startTime: "08:00", endTime: "16:00" },
  ],
  staff: [
    {
      id: "staff-p",
      firstName: "Anna",
      lastName: "Pedagog",
      role: "pedagog",
      maxHoursPerWeek: 20,
      active: true,
      availability: [
        {
          dayOfWeek: "monday",
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        },
        {
          dayOfWeek: "tuesday",
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        },
      ],
    },
    {
      id: "staff-a",
      firstName: "Jonas",
      lastName: "Assistant",
      role: "assistant",
      maxHoursPerWeek: 20,
      active: true,
      availability: [
        {
          dayOfWeek: "monday",
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        },
        {
          dayOfWeek: "tuesday",
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        },
      ],
    },
  ],
  rules: [
    {
      dayOfWeek: "monday",
      startTime: "09:00",
      endTime: "12:00",
      minStaff: 2,
      minPedagogs: 1,
    },
    {
      dayOfWeek: "tuesday",
      startTime: "09:00",
      endTime: "12:00",
      minStaff: 2,
      minPedagogs: 1,
    },
  ],
}
