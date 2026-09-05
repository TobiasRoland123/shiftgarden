function planningReturnTo(value: string | undefined, fallback: string) {
  if (
    !value ||
    !value.startsWith("/planning/") ||
    value.startsWith("//") ||
    value.includes(":")
  )
    return fallback
  try {
    const parsed = new URL(value, "https://shiftgarden.local")
    return parsed.origin === "https://shiftgarden.local" &&
      parsed.pathname.startsWith("/planning/")
      ? `${parsed.pathname}${parsed.search}`
      : fallback
  } catch {
    return fallback
  }
}

export { planningReturnTo }
