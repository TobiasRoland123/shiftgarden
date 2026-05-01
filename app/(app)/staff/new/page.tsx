import { StaffForm } from "@/app/(app)/staff/_components/staff-form"

export default function NewStaffPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">New staff</h1>
      <StaffForm mode="create" />
    </div>
  )
}
