import { asc } from "drizzle-orm"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"

import { db } from "@/lib/db"
import { institutionOpeningHours } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { ExceptionList } from "@/components/planning/planning-components"
import { Link } from "@/i18n/navigation"
import { getOwnerPlanningExceptions } from "@/lib/planning/view"
import { planningReturnTo } from "@/lib/planning/return-to"
import { OpeningHoursForm } from "./opening-hours-form"

export default async function OpeningHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  await connection()
  const query = await searchParams
  const t = await getTranslations("openingHours")
  const tPlanning = await getTranslations("planning")
  const intervals = await db
    .select()
    .from(institutionOpeningHours)
    .orderBy(
      asc(institutionOpeningHours.dayOfWeek),
      asc(institutionOpeningHours.startTime)
    )
  const planningExceptions = await getOwnerPlanningExceptions(
    "institution",
    "1"
  )
  const returnTo = planningReturnTo(query.returnTo, "")

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      {returnTo ? (
        <Button asChild variant="outline" className="w-fit">
          <Link href={returnTo as "/planning"}>
            {tPlanning("returnToPreparation")}
          </Link>
        </Button>
      ) : null}
      <div>
        <h1 className="text-2xl font-medium tracking-normal">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <OpeningHoursForm intervals={intervals} />
      <section className="rounded-lg border border-dashed p-4">
        <h2 className="font-medium">{tPlanning("exceptionsAffectingOwner")}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {tPlanning("institutionExceptionsDescription")}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link
            href={
              returnTo
                ? {
                    pathname: "/settings/opening-hours/exceptions/new",
                    query: { returnTo },
                  }
                : "/settings/opening-hours/exceptions/new"
            }
          >
            {tPlanning("addOpeningException")}
          </Link>
        </Button>
        <ExceptionList
          items={planningExceptions}
          baseHref="/settings/opening-hours"
          returnTo={returnTo || undefined}
        />
      </section>
    </div>
  )
}
