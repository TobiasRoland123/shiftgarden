"use client"

import { Check, ChevronDown } from "lucide-react"
import { Select } from "radix-ui"

import type { StaffOption } from "@/lib/staff"

function StaffSelect({
  options,
  placeholder,
  noLinkedGroupsLabel,
}: {
  options: StaffOption[]
  placeholder: string
  noLinkedGroupsLabel: string
}) {
  return (
    <Select.Root name="staffMemberId" required>
      <Select.Trigger
        id="staffMemberId"
        className="flex h-8 w-full min-w-56 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[placeholder]:text-muted-foreground sm:w-72"
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-80 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
        >
          <Select.Viewport className="p-1">
            {options.map((staffMember) => (
              <Select.Item
                key={staffMember.id}
                value={staffMember.id}
                className="relative flex cursor-default flex-col gap-1 rounded-md py-2 pr-2 pl-8 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent/60"
              >
                <Select.ItemIndicator className="absolute top-2.5 left-2.5">
                  <Check className="size-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{staffMember.name}</Select.ItemText>
                {staffMember.groups.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {staffMember.groups.map((group) => (
                      <span
                        key={group.id}
                        className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        title={group.name}
                      >
                        {group.name}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {noLinkedGroupsLabel}
                  </span>
                )}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

export { StaffSelect }
