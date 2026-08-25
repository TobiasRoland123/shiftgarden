"use client"

import { useTransition } from "react"

import { useRouter } from "@/i18n/navigation"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type GroupOption = {
  id: string
  name: string
}

/**
 * Keeps `groupId` in the URL so readiness stays a server render and the page
 * remains linkable, while removing the full form submit the page used before.
 */
function GroupPicker({
  groups,
  label,
  placeholder,
  selectedGroupId,
}: {
  groups: GroupOption[]
  label: string
  placeholder: string
  selectedGroupId?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2 sm:max-w-md">
      <Label htmlFor="groupId">{label}</Label>
      <Select
        value={selectedGroupId ?? ""}
        disabled={isPending}
        onValueChange={(groupId) => {
          startTransition(() => {
            router.push(`/shift-schedule?groupId=${groupId}`)
          })
        }}
      >
        <SelectTrigger id="groupId" className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export { GroupPicker }

export type { GroupOption }
