import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { staff } from "@/drizzle/schema"

type Role = (typeof staff.$inferSelect)["role"]
//TODO: should be using color variables instead of hardcoding colors here

const styles: Record<Role, string> = {
  pedagogue: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/15",
  assistant:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900",
  substitute:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
}

export function RoleBadge({
  role,
  label,
  className,
}: {
  role: Role
  label: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", styles[role], className)}
    >
      {label}
    </Badge>
  )
}
