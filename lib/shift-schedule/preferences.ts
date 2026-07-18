import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import { timeToMinutes } from "@/lib/shift-schedule/validate-generated"

function scoreFifoEndOrder(schedule: GeneratedSchedule) {
  let inversions = 0

  for (const day of schedule.days) {
    for (let firstIndex = 0; firstIndex < day.shifts.length; firstIndex += 1) {
      const first = day.shifts[firstIndex]

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < day.shifts.length;
        secondIndex += 1
      ) {
        const second = day.shifts[secondIndex]

        if (first.staffId === second.staffId) {
          continue
        }

        const firstStart = timeToMinutes(first.startTime)
        const secondStart = timeToMinutes(second.startTime)
        const firstEnd = timeToMinutes(first.endTime)
        const secondEnd = timeToMinutes(second.endTime)

        if (
          (firstStart < secondStart && firstEnd > secondEnd) ||
          (secondStart < firstStart && secondEnd > firstEnd)
        ) {
          inversions += 1
        }
      }
    }
  }

  return inversions
}

function rankSchedulesByFifoEndOrder(schedules: GeneratedSchedule[]) {
  return schedules
    .map((schedule, index) => ({
      index,
      schedule,
      score: scoreFifoEndOrder(schedule),
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ schedule }) => schedule)
}

export { rankSchedulesByFifoEndOrder, scoreFifoEndOrder }
