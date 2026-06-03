import type {
  ScheduleValidationIssue,
  ScheduleValidationResult,
} from "@/lib/shift-schedule/validation-types"

const maxValidationFeedbackExamplesPerCode = 3

function formatValidationIssue(issue: ScheduleValidationIssue) {
  const context = [
    issue.dayOfWeek,
    issue.staffId ? `staff ${issue.staffId}` : undefined,
    issue.startTime && issue.endTime
      ? `${issue.startTime}-${issue.endTime}`
      : undefined,
    issue.ruleIndex === undefined ? undefined : `rule ${issue.ruleIndex}`,
  ]
    .filter(Boolean)
    .join(", ")

  return context ? `${issue.message} (${context})` : issue.message
}

function formatValidationIssuesForUser(result: ScheduleValidationResult) {
  return result.issues.map(formatValidationIssue).join("\n")
}

function formatValidationFeedbackForRetry(result: ScheduleValidationResult) {
  const examplesByCode = new Map<string, string[]>()

  for (const issue of result.issues) {
    const examples = examplesByCode.get(issue.code) ?? []

    if (examples.length < maxValidationFeedbackExamplesPerCode) {
      examples.push(formatValidationIssue(issue))
      examplesByCode.set(issue.code, examples)
    }
  }

  return Array.from(examplesByCode.entries())
    .map(
      ([code, examples]) =>
        `- ${code}: ${examples
          .map((example) => example.replace(/\s+/g, " "))
          .join(" | ")}`
    )
    .join("\n")
}

export { formatValidationFeedbackForRetry, formatValidationIssuesForUser }
