// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Parse the mochi: URI scheme (see the URI-scheme wiki page). Only the forms
// an app subscribe/join flow accepts are handled here:
//
//   mochi:/<entity>[/<sub>...]                 — entity on the current session
//   mochi://<peer>/<entity>[/<sub>...]         — entity on a specific libp2p peer
//
// The 2-slash form carries a peer, letting a subscriber reach a PRIVATE entity
// that isn't directory-listed: the peer bootstraps first contact (the ACL still
// decides access). System-intent forms (0 slashes) are not parsed here.

export interface MochiEntityUri {
  entity: string
  /** libp2p peer id from the 2-slash form; empty for the 1-slash form. */
  peer: string
  /** nested sub-resource segments after the entity, if any. */
  sub: string[]
}

/**
 * Parse a mochi: entity URI. Returns null if the string is not a mochi: entity
 * reference (including the system-intent 0-slash form, which has no entity).
 */
export function parseMochiEntityUri(input: string): MochiEntityUri | null {
  const s = input.trim()
  if (!s.toLowerCase().startsWith('mochi:')) return null
  const rest = s.slice('mochi:'.length)

  // 2-slash: mochi://<peer>/<entity>[/<sub>...]
  if (rest.startsWith('//')) {
    const afterAuthority = rest.slice(2)
    const slash = afterAuthority.indexOf('/')
    if (slash < 0) return null // authority but no path — not an entity reference
    const peer = afterAuthority.slice(0, slash)
    const path = afterAuthority.slice(slash + 1)
    const segments = path.split('/').filter(Boolean)
    if (!peer || segments.length === 0) return null
    return { entity: segments[0], peer, sub: segments.slice(1) }
  }

  // 1-slash: mochi:/<entity>[/<sub>...]
  if (rest.startsWith('/')) {
    const segments = rest.slice(1).split('/').filter(Boolean)
    if (segments.length === 0) return null
    return { entity: segments[0], peer: '', sub: segments.slice(1) }
  }

  // 0-slash (system intent) — no entity to subscribe to.
  return null
}

/** True when the string looks like a mochi: entity URI (either slashed form). */
export function isMochiEntityUri(input: string): boolean {
  return parseMochiEntityUri(input) !== null
}

/** Build the 2-slash share URI for an entity on a given peer. */
export function mochiEntityUri(peer: string, entity: string): string {
  return `mochi://${peer}/${entity}`
}
