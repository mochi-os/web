// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'

export type Style = { accent?: string }

// Fetches and parses the entity's style from `url`, an action on the CALLING
// app that proxies the person's style. There is no fallback to the people
// app: a cross-app request from the shell's sandboxed iframe carries no
// cookies and answers 403, and outside the shell it is a request this app
// has no business making.
export function useAccent(url?: string | null): Style {
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
