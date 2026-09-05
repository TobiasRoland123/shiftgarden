"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"

export default function PlanningError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("planning")

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <section
        className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm"
        role="alert"
      >
        <AlertTriangle className="size-6 text-destructive" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {t("loadErrorTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("loadErrorDescription")}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={reset}>
            <RefreshCw />
            {t("tryAgain")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/planning">{t("backToPlanning")}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
