// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'

export type Style = { accent?: string }

// Fetches and parses the entity's style. `styleUrl` is used directly, for a
// remote entity proxied through another app; otherwise `fingerprint` resolves
// to /<fingerprint>/-/style on the people app.
export function useAccent(fingerprint?: string | null, styleUrl?: string | null): Style {
  const url = styleUrl ?? (fingerprint ? `/${fingerprint}/-/style` : null)
  const { data } = useQuery<Style>({
    queryKey: ['accent', url],
    queryFn: async () => {
      if (!url) return {}
      try {
        return await requestHelpers.get<Style>(url)
      } catch {
        return {}
      }
    },
    enabled: !!url,
    staleTime: 5 * 60 * 1000,
  })
  return data ?? {}
}
