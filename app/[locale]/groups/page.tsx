import { getTranslations } from "next-intl/server"
import { asc } from "drizzle-orm"
import type { ReactNode } from "react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { groups } from "@/lib/db/schema"

function CellLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link href={href} className="block px-4 py-3">
      {children}
    </Link>
  )
}

export default async function GroupsPage() {
  const t = await getTranslations("groups")
  const groupList = await db.select().from(groups).orderBy(asc(groups.name))

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-normal">{t("title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button asChild>
          <Link href="/groups/new">{t("createNew")}</Link>
        </Button>
      </div>

      {groupList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8">
          <h2 className="font-medium">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {t("emptyDescription")}
          </p>
          <Button asChild className="mt-4">
            <Link href="/groups/new">{t("createFirst")}</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("table.name")}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groupList.map((group) => {
                const href = `/groups/${group.id}`

                return (
                  <tr
                    key={group.id}
                    className="group transition-colors hover:bg-muted/40"
                  >
                    <td className="p-0 font-medium">
                      <CellLink href={href}>{group.name}</CellLink>
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
