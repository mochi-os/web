// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Match a mention query at the cursor: Unicode letters/marks/numbers,
 * underscore, and hyphen after `@`.
 */
export const mentionQueryPattern = /(^|[\s])@([\p{L}\p{M}\p{N}_-]*)$/u

/** Display markup `@[Name]` — same shape as highlightMentions / bubble render. */
export const mentionDisplayTokenPattern = /@\[([^\]]+)\]/g

/** Minimal person shape for resolving `@[Name]` tokens to ids. */
export type MentionResolvePerson = {
  id: string
  name: string
}

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

/**
 * Display names from `@[Name]` tokens in document order (duplicates allowed).
 */
export function extractMentionDisplayNames(body: string): string[] {
  const names: string[] = []
  const re = new RegExp(mentionDisplayTokenPattern.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    names.push(match[1])
  }
  return names
}

/**
 * Resolve `@[Name]` tokens in `body` to people from `people`.
 *
 * Unique display name → that person. Ambiguous names (multiple roster
 * members share the name) → only ids already in `preferred` that still
 * have a matching token. Never guess on collisions.
 */
export function resolveMentionsFromBody(options: {
  body: string
  people: MentionResolvePerson[]
  preferred?: MentionResolvePerson[]
}): MentionResolvePerson[] {
  const namesInBody = new Set(extractMentionDisplayNames(options.body))
  if (namesInBody.size === 0) return []

  const preferred = options.preferred ?? []
  const result: MentionResolvePerson[] = []
  const seen = new Set<string>()

  for (const name of namesInBody) {
    const matches = options.people.filter((person) => person.name === name)
    if (matches.length === 1) {
      const person = matches[0]
      if (!seen.has(person.id)) {
        seen.add(person.id)
        result.push(person)
      }
      continue
    }
    if (matches.length > 1) {
      const matchIds = new Set(matches.map((person) => person.id))
      for (const person of preferred) {
        if (
          person.name === name &&
          matchIds.has(person.id) &&
          !seen.has(person.id)
        ) {
          seen.add(person.id)
          result.push(person)
        }
      }
    }
  }

  return result
}
