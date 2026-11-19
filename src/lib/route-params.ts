// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Route parameters checked before a route loads. The router hands a route its
// parameters percent-decoded, so an address can make one hold `/`, `\`, `?`,
// `#` or `..`; a route whose parameter goes into a request path, a storage key
// or a link answers not-found for anything that is not the kind of id it
// names, and its loader never runs.

import { notFound } from '@tanstack/react-router'

/** A test a parameter must pass: a pattern, a predicate, or any one of several. */
export type ParamShape =
  RegExp | ((value: string) => boolean) | readonly ParamShape[]

/** The shapes core's own validators accept (`valid()` in core/server/utilities.go). */
export const paramShapes = {
  /** An entity id: core's "entity". */
  entity: /^[0-9A-Za-z_]{49,51}$/,
  /** A fingerprint (core's "fingerprint"), or the same with its display hyphens. */
  fingerprint:
    /^[0-9A-Za-z]{9}$|^[0-9A-Za-z]{3}-[0-9A-Za-z]{3}-[0-9A-Za-z]{3}$/,
  /** A row id such as a post, comment or game: core's "id". */
  id: /^[0-9a-z]{32}$/,
} as const

function matches(shape: ParamShape, value: string): boolean {
  if (shape instanceof RegExp) return shape.test(value)
  if (typeof shape === 'function') return shape(value)
  return shape.some((one) => matches(one, value))
}

/**
 * A route's `params.parse`: the parameters as they are when each named one
 * fits its shape, else not-found, so the route renders its not-found page and
 * its loader sends nothing.
 *
 *   params: { parse: guardParams({ feedId: [paramShapes.entity, paramShapes.fingerprint] }) }
 */
export function guardParams<K extends string>(shapes: Record<K, ParamShape>) {
  return <T extends Record<K, string>>(params: T): T => {
    for (const name of Object.keys(shapes) as K[]) {
      const value: unknown = params[name]
      if (typeof value !== 'string' || !matches(shapes[name], value)) {
        throw notFound()
      }
    }
    return params
  }
}
