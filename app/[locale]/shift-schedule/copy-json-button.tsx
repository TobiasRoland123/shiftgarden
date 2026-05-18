"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type CopyJsonButtonProps = {
  copiedLabel: string
  copyLabel: string
  value: string
}

function CopyJsonButton({
  copiedLabel,
  copyLabel,
  value,
}: CopyJsonButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copyJson() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button
      aria-label={copied ? copiedLabel : copyLabel}
      onClick={copyJson}
      size="sm"
      type="button"
      variant="outline"
    >
      {copied ? <Check /> : <Copy />}
      <span>{copied ? copiedLabel : copyLabel}</span>
    </Button>
  )
}

export { CopyJsonButton }
