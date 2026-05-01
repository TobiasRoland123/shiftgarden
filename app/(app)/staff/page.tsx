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
import { staff } from "@/drizzle/schema"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
//TODO: Daylabels should be
const dayLabels = ["M", "T", "O", "T", "F"]
const fallbackAvail: boolean[] = [true, true, true, true, true]

export default async function StaffPage() {
  const rows = await db.select().from(staff).orderBy(staff.name)
  const t = await getTranslations("StaffPage")
  const tRoles = await getTranslations("Roles")

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: rows.length })}
      />

      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-5 py-2.5">
        <Input placeholder={t("search")} className="h-8 max-w-xs text-[13px]" />
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
                rows.map((s) => (
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
                      {s.weeklyContractHours}t
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-0.5">
                        {dayLabels.map((d, di) => {
                          const on = fallbackAvail[di]
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
                            ? //TODO colors should be using variables
                              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
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
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
