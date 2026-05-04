import { sql } from "drizzle-orm"
import { Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { groups, staffingRules } from "@/drizzle/schema"
import { db } from "@/lib/db"

function formatTime(time: string) {
  return time.length >= 5 ? time.slice(0, 5) : time
}

export default async function GroupsPage() {
  const rows = await db.select().from(groups).orderBy(groups.name)
  const ruleCounts = await db
    .select({
      groupId: staffingRules.groupId,
      count: sql<number>`count(*)::int`,
    })
    .from(staffingRules)
    .groupBy(staffingRules.groupId)
  const ruleCountByGroup = new Map(
    ruleCounts.map((r) => [r.groupId, Number(r.count)])
  )

  const t = await getTranslations("GroupsPage")

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: rows.length })}
      />

      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-5 py-2.5">
        <Input
          placeholder={t("search")}
          className="h-8 max-w-xs text-[13px]"
        />
        <div className="flex-1" />
        <Button size="sm" asChild>
          <Link href="/groups/new">
            <Plus className="size-3.5" />
            {t("newGroup")}
          </Link>
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-muted/40 p-5">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="text-[11px] tracking-wider uppercase">
                  {t("columns.name")}
                </TableHead>
                <TableHead className="text-center text-[11px] tracking-wider uppercase">
                  {t("columns.openHours")}
                </TableHead>
                <TableHead className="text-center text-[11px] tracking-wider uppercase">
                  {t("columns.rules")}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((g) => {
                  const count = ruleCountByGroup.get(g.id) ?? 0
                  return (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Link
                          href={`/groups/${g.id}`}
                          className="text-[13px] font-medium hover:underline"
                        >
                          {g.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-[13px]">
                        {formatTime(g.openTime)}–{formatTime(g.closeTime)}
                      </TableCell>
                      <TableCell className="text-center text-[13px]">
                        {t("rulesCount", { count })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          asChild
                        >
                          <Link href={`/groups/${g.id}`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
