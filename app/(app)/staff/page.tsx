import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export default async function StaffPage() {
  const rows = await db.select().from(staff).orderBy(staff.name)
  const t = await getTranslations("StaffPage")
  const tRoles = await getTranslations("Roles")

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild>
          <Link href="/staff/new">{t("newStaff")}</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.role")}</TableHead>
            <TableHead>{t("columns.email")}</TableHead>
            <TableHead className="text-right">
              {t("columns.contractHours")}
            </TableHead>
            <TableHead>{t("columns.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
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
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{tRoles(s.role)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.email ?? t("emDash")}
                </TableCell>
                <TableCell className="text-right">
                  {s.weeklyContractHours}
                </TableCell>
                <TableCell>
                  {s.active ? (
                    <Badge variant="outline">{t("status.active")}</Badge>
                  ) : (
                    <Badge variant="destructive">{t("status.inactive")}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
