import { asc } from "drizzle-orm"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"

import { db } from "@/lib/db"
import { institutionOpeningHours } from "@/lib/db/schema"
import { OpeningHoursForm } from "./opening-hours-form"

export default async function OpeningHoursPage() {
  await connection()
  const t = await getTranslations("openingHours")
  const intervals = await db
    .select()
    .from(institutionOpeningHours)
    .orderBy(
      asc(institutionOpeningHours.dayOfWeek),
      asc(institutionOpeningHours.startTime)
    )

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-medium tracking-normal">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <OpeningHoursForm intervals={intervals} />
    </div>
  )
}
