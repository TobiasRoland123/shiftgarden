import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { GroupForm } from "./group-form"

export default async function NewGroupPage() {
  const t = await getTranslations("groups")

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/groups">{t("backToGroups")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-medium tracking-normal">
            {t("newTitle")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("newDescription")}
          </p>
        </div>
      </div>

      <GroupForm />
    </div>
  )
}
