const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function isMondayWeekStart(value: string) {
  if (!isoDatePattern.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(value) &&
    date.getUTCDay() === 1
  )
}

function currentMonday() {
  const date = new Date()
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)

  return date.toISOString().slice(0, 10)
}

export { currentMonday, isMondayWeekStart }
