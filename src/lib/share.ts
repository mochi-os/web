// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The ways from an app's Share to a post in one of the user's feeds or a
// message in one of their chats. The app hands over a copy of what it shares,
// its words and its page's address, and Feeds or Chat opens its own composer
// filled in; nothing is sent until the user sends it, and nothing ties the
// post or message back to what it was shared from.

export interface Share {
  text: string
  url?: string
}

function address(base: string, { text, url }: Share): string {
  const params = new URLSearchParams()
  if (text) params.set('text', text)
  if (url) params.set('url', url)
  const query = params.toString()
  return base + (query ? `?${query}` : '')
}

/** Feeds' new post dialog, filled in with what an app shares. */
export function feedSharePath(share: Share): string {
  return address('/feeds/share', share)
}

/** Chat's choice of chat, whose message box is filled in with it. */
export function chatSharePath(share: Share): string {
  return address('/chat/share', share)
}

/** What an app shared, as Feeds or Chat reads it back from its address. */
export function shareRead(search: string): Required<Share> {
  const params = new URLSearchParams(search)
  return { text: params.get('text') ?? '', url: params.get('url') ?? '' }
}

/**
 * A share as one message: its words, then after a blank line its address
 * where the words do not already hold it, as Feeds' new post puts it.
 */
export function shareMessage({ text, url }: Share): string {
  const words = text.trim()
  if (!url || words.includes(url)) return words
  return words ? `${words}\n\n${url}` : url
}
