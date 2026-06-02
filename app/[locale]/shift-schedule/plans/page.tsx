import { desc, eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { db } from "@/lib/db"
import { groups, shiftSchedulePlans } from "@/lib/db/schema"

type SavedPlansPageProps = {
  params: Promise<{
    locale: string
  }>
}

function CellLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link href={href} className="block px-4 py-3">
      {children}
    </Link>
  )
}

function formatDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export default async function SavedPlansPage({ params }: SavedPlansPageProps) {
  const { locale } = await params
  const t = await getTranslations("shiftSchedule")
  const savedPlans = await db
    .select({
      id: shiftSchedulePlans.id,
      createdAt: shiftSchedulePlans.createdAt,
      groupName: groups.name,
      model: shiftSchedulePlans.model,
      warnings: shiftSchedulePlans.warnings,
    })
    .from(shiftSchedulePlans)
    .innerJoin(groups, eq(shiftSchedulePlans.groupId, groups.id))
    .orderBy(desc(shiftSchedulePlans.createdAt))

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/shift-schedule">{t("backToShiftSchedule")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-medium tracking-normal">
            {t("savedPlans")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("savedPlansDescription")}
          </p>
        </div>
      </div>

      {savedPlans.length === 0 ? (
        <section className="rounded-lg border border-dashed p-8">
          <h2 className="font-medium">{t("savedPlansEmptyTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {t("savedPlansEmptyDescription")}
          </p>
          <Button asChild className="mt-4">
            <Link href="/shift-schedule">{t("createPlan")}</Link>
          </Button>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {t("table.group")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("table.createdAt")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("table.model")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("table.warnings")}
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {savedPlans.map((plan) => {
                const href = `/shift-schedule/plans/${plan.id}`

                return (
                  <tr
                    key={plan.id}
                    className="group transition-colors hover:bg-muted/40"
                  >
                    <td className="p-0 font-medium">
                      <CellLink href={href}>{plan.groupName}</CellLink>
                    </td>
                    <td className="p-0">
                      <CellLink href={href}>
                        {formatDateTime(plan.createdAt, locale)}
                      </CellLink>
                    </td>
                    <td className="p-0">
                      <CellLink href={href}>{plan.model}</CellLink>
                    </td>
                    <td className="p-0">
                      <CellLink href={href}>{plan.warnings.length}</CellLink>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={href}>{t("table.view")}</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
