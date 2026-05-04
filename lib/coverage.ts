// Pure coverage evaluator. No I/O, no framework imports.
// Inputs are plain values; the caller is responsible for resolving the
// target weekday and converting shift timestamps to minutes-from-midnight.

export type CoverageStatus = "green" | "yellow" | "red"

export type ShortfallKind = "staff" | "pedagogues"

export type Shortfall = {
  startMinute: number
  endMinute: number
  kind: ShortfallKind
  required: number
  actual: number
}

export type CoverageRule = {
  weekday: number
  startTime: string // "HH:mm" or "HH:mm:ss"
  endTime: string
  minStaff: number
  minPedagogues: number
}

export type CoverageShiftRole = "pedagogue" | "assistant" | "substitute"

export type CoverageShift = {
  startMinute: number
  endMinute: number
  role: CoverageShiftRole
}

export type CoverageInput = {
  weekday: number // 0 = Monday … 6 = Sunday
  group: { openTime: string; closeTime: string }
  rules: CoverageRule[]
  shifts: CoverageShift[]
}

export type CoverageResult = {
  status: CoverageStatus
  shortfalls: Shortfall[]
}

export function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(":")
  return Number(h) * 60 + Number(m)
}

export function evaluateCoverage(input: CoverageInput): CoverageResult {
  const open = hhmmToMinutes(input.group.openTime)
  const close = hhmmToMinutes(input.group.closeTime)
  const span = Math.max(0, close - open)
  if (span === 0) return { status: "green", shortfalls: [] }

  const reqStaff = new Int16Array(span)
  const reqPed = new Int16Array(span)
  const ruled = new Uint8Array(span) // 1 if any rule covers this minute

  for (const rule of input.rules) {
    if (rule.weekday !== input.weekday) continue
    const s = Math.max(open, hhmmToMinutes(rule.startTime))
    const e = Math.min(close, hhmmToMinutes(rule.endTime))
    for (let m = s; m < e; m++) {
      const i = m - open
      ruled[i] = 1
      // Non-overlap is enforced server-side, but use max() defensively.
      if (rule.minStaff > reqStaff[i]) reqStaff[i] = rule.minStaff
      if (rule.minPedagogues > reqPed[i]) reqPed[i] = rule.minPedagogues
    }
  }

  const actStaff = new Int16Array(span)
  const actPed = new Int16Array(span)
  for (const shift of input.shifts) {
    const s = Math.max(open, shift.startMinute)
    const e = Math.min(close, shift.endMinute)
    for (let m = s; m < e; m++) {
      const i = m - open
      actStaff[i]++
      if (shift.role === "pedagogue") actPed[i]++
    }
  }

  const shortfalls: Shortfall[] = []
  appendShortfalls(shortfalls, "staff", open, span, ruled, reqStaff, actStaff)
  appendShortfalls(shortfalls, "pedagogues", open, span, ruled, reqPed, actPed)

  const hasStaff = shortfalls.some((s) => s.kind === "staff")
  const hasPed = shortfalls.some((s) => s.kind === "pedagogues")
  const status: CoverageStatus = hasStaff ? "red" : hasPed ? "yellow" : "green"
  return { status, shortfalls }
}

function appendShortfalls(
  out: Shortfall[],
  kind: ShortfallKind,
  open: number,
  span: number,
  ruled: Uint8Array,
  required: Int16Array,
  actual: Int16Array
) {
  let runStart = -1
  let runReq = 0
  let runAct = 0
  for (let i = 0; i < span; i++) {
    const isShort = ruled[i] === 1 && actual[i] < required[i]
    if (isShort && runStart === -1) {
      runStart = i
      runReq = required[i]
      runAct = actual[i]
      continue
    }
    if (
      isShort &&
      runStart !== -1 &&
      (required[i] !== runReq || actual[i] !== runAct)
    ) {
      out.push({
        startMinute: open + runStart,
        endMinute: open + i,
        kind,
        required: runReq,
        actual: runAct,
      })
      runStart = i
      runReq = required[i]
      runAct = actual[i]
      continue
    }
    if (!isShort && runStart !== -1) {
      out.push({
        startMinute: open + runStart,
        endMinute: open + i,
        kind,
        required: runReq,
        actual: runAct,
      })
      runStart = -1
    }
  }
  if (runStart !== -1) {
    out.push({
      startMinute: open + runStart,
      endMinute: open + span,
      kind,
      required: runReq,
      actual: runAct,
    })
  }
}
