import { GroupForm } from "@/components/group-form"

export default function NewGroupPage() {
  return (
    <div className="grid gap-6 p-6">
      <h1 className="text-2xl font-semibold">New group</h1>
      <GroupForm mode="create" />
    </div>
  )
}
