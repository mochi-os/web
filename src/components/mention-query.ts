// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Match a mention query at the cursor: Unicode letters/marks/numbers,
 * underscore, and hyphen after `@`.
 */
export const mentionQueryPattern = /(^|[\s])@([\p{L}\p{M}\p{N}_-]*)$/u

export function getMentionQuery(text: string, cursorPos: number): string | null {
  const match = text.slice(0, cursorPos).match(mentionQueryPattern)
  return match ? match[2] : null
}

/**
 * True when `value` changed from outside the textarea (draft restore, parent
 * clear, etc.). Local keystrokes / insertMention update lastLocalValue first
 * so the sync effect can skip and avoid duplicate parse + stale cursor reads.
 */
export function shouldSyncMentionQueryFromValue(options: {
  propValue: string
  lastLocalValue: string
}): boolean {
  return options.propValue !== options.lastLocalValue
}
