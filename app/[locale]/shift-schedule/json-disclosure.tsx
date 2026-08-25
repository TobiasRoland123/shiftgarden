"use client"

import { ChevronDown } from "lucide-react"

import { CopyJsonButton } from "./copy-json-button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type JsonDisclosureEntry = {
  title: string
  value: string
}

/**
 * Raw JSON stays reachable for debugging but is closed by default so it is no
 * longer the page's primary content.
 */
function JsonDisclosure({
  copiedLabel,
  copyLabel,
  entries,
  label,
}: {
  copiedLabel: string
  copyLabel: string
  entries: JsonDisclosureEntry[]
  label: string
}) {
  if (entries.length === 0) {
    return null
  }

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
        {label}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-4">
        {entries.map((entry) => (
          <div key={entry.title} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{entry.title}</h3>
              <CopyJsonButton
                copiedLabel={copiedLabel}
                copyLabel={copyLabel}
                value={entry.value}
              />
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-6">
              {entry.value}
            </pre>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export { JsonDisclosure }

export type { JsonDisclosureEntry }
