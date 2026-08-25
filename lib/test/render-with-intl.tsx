import type { ReactElement } from "react"
import { render } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import da from "@/messages/da.json"
import en from "@/messages/en.json"

const messagesByLocale = { da, en } as const

type TestLocale = keyof typeof messagesByLocale

/**
 * Renders a component against the real message catalogue so tests fail when a
 * translation key is missing rather than silently rendering a key name.
 */
function renderWithIntl(
  ui: ReactElement,
  { locale = "en" as TestLocale }: { locale?: TestLocale } = {}
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messagesByLocale[locale]}
      onError={(error) => {
        throw error
      }}
    >
      {ui}
    </NextIntlClientProvider>
  )
}

export { renderWithIntl }

export type { TestLocale }
