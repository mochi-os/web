// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Request paths built from data. A route parameter has been percent-decoded
// by the router and an id can come from another server, so either can hold a
// `/`, `\`, `?`, `#` or `..` that would make the request reach a different
// action, with inputs of its own. Tagging the template encodes each value as
// one segment: path`${feedId}/-/${postId}/image`. A value holding a slash is
// refused rather than encoded: core decodes the whole path before splitting
// it, so `%2F` reaches the server as a separator.

/* eslint-disable lingui/no-unlocalized-strings -- a caller's fault, never shown */
const reasons = {
  number: 'not a finite number',
  segment: 'not one path segment',
}
/* eslint-enable lingui/no-unlocalized-strings */

/**
 * An address or a request refused before anything was sent. Its message is
 * for developers: normalizeError gives the person the caller's own translated
 * words instead.
 */
export class Refusal extends Error {}

function refused(value: unknown, reason: string): Error {
  return new Refusal(
    // eslint-disable-next-line lingui/no-unlocalized-strings -- for developers; normalizeError shows the caller's words
    `path: refused ${JSON.stringify(String(value))}: ${reason}`
  )
}

function segment(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw refused(value, reasons.number)
    return String(value)
  }
  if (typeof value !== 'string') throw refused(value, typeof value)
  // encodeURIComponent leaves the dots alone, and the URL parser removes a
  // dot segment in any spelling, so these are refused rather than encoded.
  if (value === '' || value === '.' || value === '..' || value.includes('/')) {
    throw refused(value, reasons.segment)
  }
  return encodeURIComponent(value)
}

/**
 * A request path with every interpolated value passed through
 * encodeURIComponent, so no value can add a segment, a query or a fragment.
 * The literal parts are kept as written. Throws on a value that is empty,
 * `.` or `..`, holds a `/`, or is neither a string nor a finite number.
 */
export function path(
  strings: TemplateStringsArray,
  ...values: Array<string | number>
): string {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) {
    out += segment(values[i]) + strings[i + 1]
  }
  return out
}

/**
 * What build returns, or undefined when it throws: for an address made from
 * data during a render, where a value path refuses should leave the image or
 * link out rather than break the page.
 */
export function tryPath(build: () => string): string | undefined {
  try {
    return build()
  } catch {
    return undefined
  }
}
