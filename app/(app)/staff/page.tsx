import { Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { AvatarCircle } from "@/components/avatar-circle"
import { PageHeader } from "@/components/page-header"
import { RoleBadge } from "@/components/role-badge"
import { Badge } from "@/components/ui/badge"
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
import { staff, staffAvailability } from "@/drizzle/schema"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"

export default async function StaffPage() {
  const rows = await db.select().from(staff).orderBy(staff.name)
  const availabilityRows = await db
    .select({
      staffId: staffAvailability.staffId,
      weekday: staffAvailability.weekday,
    })
    .from(staffAvailability)
  const availabilityByStaff = new Map<string, boolean[]>()
  for (const row of availabilityRows) {
    if (row.weekday < 0 || row.weekday > 4) continue
    let avail = availabilityByStaff.get(row.staffId)
    if (!avail) {
      avail = [false, false, false, false, false]
      availabilityByStaff.set(row.staffId, avail)
    }
    avail[row.weekday] = true
  }
  const t = await getTranslations("StaffPage")
  const tRoles = await getTranslations("Roles")
  const tWeekdays = await getTranslations("Weekdays.Short")

  const dayLabels = [
    tWeekdays("m"),
    tWeekdays("tu"),
    tWeekdays("w"),
    tWeekdays("th"),
    tWeekdays("f"),
  ]
  const noAvailability: boolean[] = [false, false, false, false, false]
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: rows.length })}
      />

      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-5 py-2.5">
        <Input
          placeholder={t("search staff")}
          className="h-8 max-w-xs text-[13px]"
        />
        <div className="flex-1" />
        <Button size="sm" asChild>
          <Link href="/staff/new">
            <Plus className="size-3.5" />
            {t("newStaff")}
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
                  {t("columns.role")}
                </TableHead>
                <TableHead className="text-center text-[11px] tracking-wider uppercase">
                  {t("columns.contractHours")}
                </TableHead>
                <TableHead className="text-center text-[11px] tracking-wider uppercase">
                  {t("columns.availability")}
                </TableHead>
                <TableHead className="text-center text-[11px] tracking-wider uppercase">
                  {t("columns.status")}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((s) => {
                  const avail = availabilityByStaff.get(s.id) ?? noAvailability
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/staff/${s.id}`}
                          className="flex items-center gap-2.5"
                        >
                          <AvatarCircle name={s.name} size={30} />
                          <div>
                            <div className="text-[13px] font-medium hover:underline">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.email ?? t("emDash")}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <RoleBadge role={s.role} label={tRoles(s.role)} />
                      </TableCell>
                      <TableCell className="text-center text-[13px] font-medium">
                        {s.weeklyContractHours}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-0.5">
                          {dayLabels.map((d, di) => {
                            const on = avail[di]
                            return (
                              <span
                                key={di}
                                className={cn(
                                  "flex size-5.5 items-center justify-center rounded text-[9px] font-semibold",
                                  on
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {d}
                              </span>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            s.active
                              ? "border-success-border bg-success-muted text-success-foreground"
                              : "border-destructive-border bg-destructive-muted text-destructive-foreground"
                          )}
                        >
                          {s.active ? t("status.active") : t("status.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          asChild
                        >
                          <Link href={`/staff/${s.id}`}>
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
