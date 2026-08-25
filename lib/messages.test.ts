import { describe, expect, it } from "vitest"

import da from "@/messages/da.json"
import en from "@/messages/en.json"

type MessageTree = { [key: string]: string | MessageTree }

function collectKeys(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key

    return typeof value === "string"
      ? [path]
      : collectKeys(value as MessageTree, path)
  })
}

function collectPlaceholders(tree: MessageTree, prefix = "") {
  const placeholders = new Map<string, string[]>()

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (typeof value === "string") {
      placeholders.set(
        path,
        Array.from(value.matchAll(/\{(\w+)/g))
          .map((match) => match[1])
          .sort()
      )
      continue
    }

    for (const [nested, names] of collectPlaceholders(
      value as MessageTree,
      path
    )) {
      placeholders.set(nested, names)
    }
  }

  return placeholders
}

describe("message catalogues", () => {
  it("defines the same keys in every locale", () => {
    const enKeys = collectKeys(en as MessageTree).sort()
    const daKeys = collectKeys(da as MessageTree).sort()

    expect(daKeys).toEqual(enKeys)
  })

  it("uses the same placeholders for the same key in every locale", () => {
    const enPlaceholders = collectPlaceholders(en as MessageTree)
    const daPlaceholders = collectPlaceholders(da as MessageTree)
    const mismatches = Array.from(enPlaceholders.entries())
      .filter(
        ([key, names]) =>
          JSON.stringify(daPlaceholders.get(key)) !== JSON.stringify(names)
      )
      .map(([key]) => key)

    expect(mismatches).toEqual([])
  })
})
