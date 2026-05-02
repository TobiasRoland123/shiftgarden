import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireAuth } from "@/lib/auth-guard"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <div className="flex-1 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
