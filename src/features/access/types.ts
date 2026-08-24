import { t } from '@lingui/core/macro'
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Access control types for shared components

export interface AccessLevel {
  value: string // e.g., 'edit', 'view', 'comment', 'react', 'none'
  label: string // e.g., 'Edit and view', 'View only'
}

export interface AccessRule {
  id?: number
  subject: string
  operation: string
  grant: number
  name?: string // Resolved name for display
  isOwner?: boolean // True if this rule is for the resource owner (non-editable)
}
export interface UserSearchResult {
  id: string
  name: string
}

export interface Group {
  id: string
  name: string
  description?: string
}

// Special subject options. A function, not a const: t`` in a module-level
// const is resolved once at import, before the user's language is known.
export function specialSubjects() {
  return [
    { id: '+', name: t`Authenticated users`, description: t`Anyone who is logged in` },
    { id: '*', name: t`Anyone`, description: t`Including anonymous users` },
  ]
}
