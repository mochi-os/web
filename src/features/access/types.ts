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

export interface AccessOwner {
  id: string
  name?: string
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

// Special subject options
export const SPECIAL_SUBJECTS = [
  { id: '+', name: "Authenticated users", description: "Anyone who is logged in" },
  { id: '*', name: "Anyone", description: "Including anonymous users" },
]
