// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Text that arrives as HTML from outside - a subscribed calendar's event
// description, say - shown where only text can go. Nothing here renders
// markup: the reduction reads it through the browser's own parser, on an
// inert document that runs no script and loads nothing.

// A tag with a real name, opening or closing, with attributes or not. "a < b"
// and "<3" are not markup, and neither is an unknown angle-bracketed word.
const TAG =
  /<\/?(?:a|b|blockquote|br|code|div|em|font|h[1-6]|hr|i|img|li|ol|p|pre|small|span|strong|sub|sup|table|td|th|tr|u|ul)\b[^>]*>/i

const BREAK = /<br\s*\/?>/gi
const BLOCK = /<\/(?:blockquote|div|h[1-6]|li|p|pre|table|tr)\s*>/gi

/** Whether the text holds HTML markup, as Google's calendar descriptions do. */
export function isHtml(text: string): boolean {
  return TAG.test(text)
}

/**
 * The text of an HTML fragment: line breaks and block ends become newlines,
 * every other tag drops, entities decode, styles and scripts vanish, and
 * runs of blank lines collapse to one.
 */
export function textFromHtml(html: string): string {
  const marked = html.replace(BREAK, '\n').replace(BLOCK, '\n')
  const document = new DOMParser().parseFromString(marked, 'text/html')
  for (const element of document.querySelectorAll('script, style')) {
    element.remove()
  }
  return (document.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The text of a description, whether it came as HTML or as plain text. */
export function descriptionText(description: string): string {
  return isHtml(description) ? textFromHtml(description) : description
}
