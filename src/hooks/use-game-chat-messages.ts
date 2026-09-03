// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The flatten-reverse-dedupe pass every game ran over its infinite message
// query. The query pages arrive newest-first, the list renders oldest-first,
// and a message can appear on two pages when one arrives over the websocket
// while an older page is being fetched.

import { useMemo } from 'react'

export function useGameChatMessages<M extends { id: string }>(
  pages: { messages: M[] }[] | undefined
): M[] {
  return useMemo(() => {
    if (!pages) return []
    const all = [...pages].reverse().flatMap((p) => p.messages)
    const seen = new Set<string>()
    return all.filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
  }, [pages])
}
