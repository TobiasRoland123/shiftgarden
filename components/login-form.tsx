"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

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
import { credentialsSchema, type CredentialsInput } from "@/lib/validation/auth"

export function LoginForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CredentialsInput>({
    resolver: standardSchemaResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: CredentialsInput) {
    setSubmitting(true)
    try {
      const res = await signIn("credentials", {
        ...values,
        redirect: false,
      })

      if (!res || res.error) {
        toast.error("Invalid email or password")
        return
      }

      router.push("/")
      router.refresh()
    } catch {
      toast.error("Sign-in failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  )
}
