"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { createStaff, updateStaff } from "@/app/actions/staff"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ROLES,
  type StaffInput,
  staffInputSchema,
} from "@/lib/validation/staff"

type Props = {
  mode: "create" | "edit"
  staffId?: string
  initial?: Partial<StaffInput>
}

export function StaffForm({ mode, staffId, initial }: Props) {
  const router = useRouter()
  const t = useTranslations("StaffForm")
  const tValidation = useTranslations("Validation")
  const tRoles = useTranslations("Roles")
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<StaffInput>({
    resolver: standardSchemaResolver(staffInputSchema),
    defaultValues: {
      name: initial?.name ?? "",
      email: initial?.email ?? "",
      role: initial?.role ?? "pedagogue",
      weeklyContractHours: initial?.weeklyContractHours ?? 37,
      active: initial?.active ?? true,
    },
  })

  // Resolve any validation message that's a known translation key.
  function translateError(message: string | undefined) {
    if (!message) return undefined
    if (message.startsWith("Validation.")) {
      const key = message.slice("Validation.".length)
      return tValidation(key as Parameters<typeof tValidation>[0])
    }
    return message
  }

  async function onSubmit(values: StaffInput) {
    setSubmitting(true)
    try {
      if (mode === "create") {
        const { id } = await createStaff(values)
        toast.success(t("toasts.created"))
        router.push(`/staff/${id}`)
        router.refresh()
      } else if (staffId) {
        await updateStaff(staffId, values)
        toast.success(t("toasts.saved"))
        form.reset(values)
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      toast.error(t("toasts.saveFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-xl gap-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("labels.name")}</FormLabel>
              <FormControl>
                <Input autoFocus {...field} />
              </FormControl>
              <FormMessage>
                {translateError(fieldState.error?.message)}
              </FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("labels.email")}</FormLabel>
              <FormControl>
                <Input type="email" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage>
                {translateError(fieldState.error?.message)}
              </FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("labels.role")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tRoles(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage>
                {translateError(fieldState.error?.message)}
              </FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="weeklyContractHours"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("labels.weeklyContractHours")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage>
                {translateError(fieldState.error?.message)}
              </FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field, fieldState }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="size-4"
                />
              </FormControl>
              <FormLabel className="!mt-0">{t("labels.active")}</FormLabel>
              <FormMessage>
                {translateError(fieldState.error?.message)}
              </FormMessage>
            </FormItem>
          )}
        />
        <div>
          <Button type="submit" disabled={submitting || (mode === "edit" && !form.formState.isDirty)}>
            {submitting
              ? t("buttons.saving")
              : mode === "create"
                ? t("buttons.create")
                : t("buttons.save")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
