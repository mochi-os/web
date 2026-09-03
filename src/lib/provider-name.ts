// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Display names for the connected-service keys the server uses. Brand names
// stay verbatim in Latin script (glossary rule); a raw key is never shown.
const names: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
  facebook: 'Facebook',
  x: 'X',
  'stripe-customer': 'Stripe',
}

export function providerName(key: string): string {
  return names[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}
