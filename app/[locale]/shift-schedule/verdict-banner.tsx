"use client"

import { CircleAlert, CircleCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * The single acceptance verdict. It is determined only by the validation error
 * count; AI warnings and validation warnings never change it.
 */
function VerdictBanner({
  validationErrorCount,
}: {
  validationErrorCount: number
}) {
  const t = useTranslations("shiftSchedule.verdict")
  const isAccepted = validationErrorCount === 0

  return (
    <Alert variant={isAccepted ? "default" : "destructive"}>
      {isAccepted ? <CircleCheck /> : <CircleAlert />}
      <AlertTitle>
        {isAccepted ? t("acceptedTitle") : t("blockedTitle")}
      </AlertTitle>
      <AlertDescription>
        {isAccepted
          ? t("acceptedDescription")
          : t("blockedDescription", { count: validationErrorCount })}
      </AlertDescription>
    </Alert>
  )
}

export { VerdictBanner }
