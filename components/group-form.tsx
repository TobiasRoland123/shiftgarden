"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { createGroup, deleteGroup, updateGroup } from "@/app/actions/groups"
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
import { type GroupInput, groupInputSchema } from "@/lib/validation/groups"

type Props = {
  mode: "create" | "edit"
  groupId?: string
  initial?: Partial<GroupInput>
}

export function GroupForm({ mode, groupId, initial }: Props) {
  const router = useRouter()
  const t = useTranslations("GroupsForm")
  const tValidation = useTranslations("Validation")
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<GroupInput>({
    resolver: standardSchemaResolver(groupInputSchema),
    defaultValues: {
      name: initial?.name ?? "",
      openTime: initial?.openTime ?? "06:30",
      closeTime: initial?.closeTime ?? "17:00",
    },
  })

  function translateError(message: string | undefined) {
    if (!message) return undefined
    if (message.startsWith("Validation.")) {
      const key = message.slice("Validation.".length)
      return tValidation(key as Parameters<typeof tValidation>[0])
    }
    return message
  }

  function normalizeTime(value: string) {
    return value.length >= 5 ? value.slice(0, 5) : value
  }

  async function onSubmit(values: GroupInput) {
    const payload: GroupInput = {
      ...values,
      openTime: normalizeTime(values.openTime),
      closeTime: normalizeTime(values.closeTime),
    }
    setSubmitting(true)
    try {
      if (mode === "create") {
        const { id } = await createGroup(payload)
        toast.success(t("toasts.created"))
        router.push(`/groups/${id}`)
        router.refresh()
      } else if (groupId) {
        await updateGroup(groupId, payload)
        toast.success(t("toasts.saved"))
        form.reset(payload)
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      toast.error(t("toasts.saveFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!groupId) return
    if (!window.confirm(t("deleteConfirm"))) return
    setSubmitting(true)
    try {
      await deleteGroup(groupId)
      toast.success(t("toasts.deleted"))
      router.push("/groups")
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error(t("toasts.deleteFailed"))
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="openTime"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("labels.openTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage>
                  {translateError(fieldState.error?.message)}
                </FormMessage>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="closeTime"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("labels.closeTime")}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage>
                  {translateError(fieldState.error?.message)}
                </FormMessage>
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={
              submitting || (mode === "edit" && !form.formState.isDirty)
            }
          >
            {submitting
              ? t("buttons.saving")
              : mode === "create"
                ? t("buttons.create")
                : t("buttons.save")}
          </Button>
          {mode === "edit" && groupId ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={submitting}
            >
              {t("buttons.delete")}
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  )
}
