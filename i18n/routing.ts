import { defineRouting } from "next-intl/routing"

export const locales = ["en", "da"] as const
export const defaultLocale = "en"

export type Locale = (typeof locales)[number]

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
})
