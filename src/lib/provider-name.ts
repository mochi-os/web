// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Display names for the connected-service and network keys the server uses.
// Brand and protocol names stay verbatim in Latin script (glossary rule); a
// raw key is never shown. A hosted account on the fediverse is named by the
// protocol it speaks, as Matrix and XMPP are.
const names: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
  facebook: 'Facebook',
  x: 'X',
  'stripe-customer': 'Stripe',
  fediverse: 'ActivityPub',
  xmpp: 'XMPP',
}

export function providerName(key: string): string {
  return names[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}
