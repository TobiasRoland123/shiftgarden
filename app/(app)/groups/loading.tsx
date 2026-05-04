import { useTranslations } from "next-intl"

import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const skeletonRows = Array.from({ length: 4 })

export default function Loading() {
  const t = useTranslations("GroupsPage")
  return (
    <>
      <PageHeader title={t("title")} subtitle="…" />

      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-5 py-2.5">
        <Skeleton className="h-8 w-full max-w-xs" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      <div className="flex-1 overflow-auto bg-muted/40 p-5">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>
                  <Skeleton className="h-3 w-16" />
                </TableHead>
                <TableHead>
                  <Skeleton className="mx-auto h-3 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="mx-auto h-3 w-24" />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {skeletonRows.map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="mx-auto h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="mx-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
