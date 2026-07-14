// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Common auth endpoints shared across all Mochi apps
// These are global endpoints that bypass app-specific routing

export const authEndpoints = {
  code: '/_/code',
  verify: '/_/verify',
  identity: '/_/identity',
  logout: '/_/logout',
} as const

export type AuthEndpoints = typeof authEndpoints
