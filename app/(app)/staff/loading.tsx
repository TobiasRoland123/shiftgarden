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
import { useTranslations } from "next-intl"

const skeletonRows = Array.from({ length: 6 })
const availabilityDays = Array.from({ length: 5 })

export default function Loading() {
  const t = useTranslations("StaffPage")
  return (
    <>
      <PageHeader title={t("title")} subtitle="Loading staff members..." />

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
                  <Skeleton className="h-3 w-12" />
                </TableHead>
                <TableHead>
                  <Skeleton className="mx-auto h-3 w-10" />
                </TableHead>
                <TableHead>
                  <Skeleton className="mx-auto h-3 w-24" />
                </TableHead>
                <TableHead>
                  <Skeleton className="mx-auto h-3 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="mx-auto h-3 w-12" />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {skeletonRows.map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-[30px] rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="mx-auto h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="mx-auto h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-0.5">
                      {availabilityDays.map((_, dayIndex) => (
                        <Skeleton key={dayIndex} className="size-5.5 rounded" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="mx-auto h-5 w-16 rounded-full" />
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
