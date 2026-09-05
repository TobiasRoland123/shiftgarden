import { LoaderCircle } from "lucide-react"
import { getTranslations } from "next-intl/server"

export default async function PlanningLoading() {
  const t = await getTranslations("planning")

  return (
    <main className="grid min-h-svh place-items-center p-6" aria-busy="true">
      <div
        className="flex items-center gap-3 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        <span className="sr-only">{t("loadingPlanning")}</span>
      </div>
    </main>
  )
}
