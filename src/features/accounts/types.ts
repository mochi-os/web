// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
// Connected accounts types for shared components

// Provider display labels. Built per call rather than as a module-level const:
// a const with t`` in it is evaluated when this module is first imported, before
// the shell has sent the user's language, so it would pin whatever locale was
// active then and never update on a language change.
function providerLabels(): Record<string, string> {
  return {
    browser: t`Browser notifications`,
    claude: 'Claude',
    email: t`Email`,
    fcm: t`Android push`,
    mcp: t`MCP server`,
    ntfy: 'ntfy',
    openai: 'OpenAI',
    pushbullet: 'Pushbullet',
    unifiedpush: t`Push notification`,
    url: t`External URL`,
    web: t`Mochi web`,
  }
}

// Get display label for a provider type
export function getProviderLabel(type: string): string {
  if (!type) return t`Unknown`
  return providerLabels()[type] || type
}

export interface Account {
  id: string
  type: string
  label: string
  identifier: string
  created: number
  verified: number
  enabled: number
  default: string
}

export interface ProviderField {
  name: string
  label: string
  type: 'email' | 'text' | 'password' | 'url'
  required: boolean
  placeholder: string
}

export interface Provider {
  type: string
  capabilities: string[]
  flow: 'form' | 'browser' | 'oauth'
  fields: ProviderField[]
  verify: boolean
}

export interface AccountTestResult {
  success: boolean
  message: string
}

export interface AccountsHookResult {
  providers: Provider[]
  accounts: Account[]
  isLoading: boolean
  isProvidersLoading: boolean
  isAccountsLoading: boolean
  /** Error from the providers query, if it failed */
  providersError: unknown
  /** Error from the accounts list query, if it failed */
  accountsError: unknown
  add: (type: string, fields: Record<string, string>, addToExisting?: boolean) => Promise<Account>
  remove: (id: string) => Promise<boolean>
  update: (id: string, fields: Record<string, string>) => Promise<boolean>
  verify: (id: string, code?: string) => Promise<boolean>
  test: (id: string) => Promise<AccountTestResult>
  refetch: () => void
  isAdding: boolean
  isRemoving: boolean
  isVerifying: boolean
  isTesting: boolean
}
