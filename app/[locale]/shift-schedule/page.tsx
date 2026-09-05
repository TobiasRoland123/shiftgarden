import { redirect } from "next/navigation"

export default async function LegacyGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(locale === "en" ? "/planning" : `/${locale}/planning`)
}
