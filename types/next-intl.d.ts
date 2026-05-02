import type messages from "@/messages/da.json"

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages
  }
}
