// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'

export type Style = { accent?: string }

// Fetches the entity's style and returns the parsed style object. When a
// `styleUrl` is provided it is used directly (for remote entities routed
// through a proxy action on another app); otherwise `fingerprint` resolves
// to /<fingerprint>/-/style on the people app. Returns {} when no source
// is available or the request fails.
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
