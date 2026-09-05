/** @type {import('next').NextConfig} */
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import createNextIntlPlugin from "next-intl/plugin"

const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: __dirname,
  },
}

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

export default withNextIntl(nextConfig)
