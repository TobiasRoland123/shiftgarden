import { getTranslations } from "next-intl/server"

export default async function StaffPage() {
  const t = await getTranslations("staff")

  return (
    <div className="flex min-h-svh flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-medium tracking-normal">{t("title")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>
    </div>
  )
}
