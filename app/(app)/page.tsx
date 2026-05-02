import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Coverage and absences will appear here once staff and groups are
            configured.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>Nothing to show yet.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add staff and groups to start planning.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
