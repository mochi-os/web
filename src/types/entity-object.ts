// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Shared object model for the object/class/field apps (crm, projects).
//
// Each app keeps its own container type — a CRM has no prefix, a project has no
// classes with requests — but the pieces the shared components actually touch
// are identical between them, so they live here. Apps intersect these with
// their own container key (`crm: string` / `project: string`), which the shared
// components deliberately never read.

export type EntityAccess = 'owner' | 'design' | 'write' | 'comment' | 'view'

export interface EntityField {
  id: string
  name: string
  fieldtype: string
  flags: string
  multi: number
  rank: number
  card: number
  position: string
  rows: number
  pattern?: string
  minlength?: number
  maxlength?: number
}

export interface EntityFieldOption {
  id: string
  name: string
  colour: string
  icon: string
  rank: number
}

export interface EntityView {
  id: string
  name: string
  viewtype: string
  filter: string
  columns: string
  rows: string
  fields: string
  sort: string
  direction: string
  classes: string[]
  rank: number
  border: string
}

export interface EntityClass {
  id: string
  name: string
  rank: number
  title: string
}

/**
 * The fields every object carries, whichever app owns it. `number` and
 * `readable` are optional because projects issues human-readable identifiers
 * (PROJ-14) and crm does not.
 */
export interface EntityObject {
  id: string
  class: string
  parent: string
  // Fractional-index ordering key (#53): an opaque base-62 string, compared
  // lexicographically. Not a position — the move action still sends a 1-based
  // target index, the server computes the key.
  rank: string
  created: number
  updated: number
  values: Record<string, string>
  number?: number
  readable?: string
}

export interface EntityObjectLink {
  target?: string
  source?: string
  linktype: string
  created: number
  number?: number
  type?: string
  title?: string
}

export interface EntityAttachment {
  id: string
  name: string
  size: number
  type: string
  created: number
}

export interface EntityComment {
  id: string
  parent: string
  author: string
  name: string
  content: string
  created: number
  edited: number
  children: EntityComment[]
  attachments: EntityAttachment[]
}

export interface EntityChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface EntityActivity {
  id: string
  user: string
  name: string
  action: string
  field: string
  oldvalue: string
  newvalue: string
  created: number
}

export interface EntityWatcher {
  user: string
  created: number
}

export interface EntitySortState {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * An entity's schema: everything crm's `CrmDetails` and projects'
 * `ProjectDetails` hold apart from the container itself.
 *
 * Both app types are structurally this plus their own container key (`crm: Crm`
 * / `project: Project`), so an app passes its details object straight in and
 * the shared component never sees the container. The id it does need arrives
 * separately as `containerId`.
 */
export interface EntityDesign {
  classes: EntityClass[]
  fields: Record<string, EntityField[]>
  options: Record<string, Record<string, EntityFieldOption[]>>
  views: EntityView[]
  hierarchy: Record<string, string[]>
}

/**
 * In-flight board drag. Describes where the card would land if dropped now, so
 * columns and cards can render a gap without committing the move.
 */
export interface EntityDragPreview {
  draggedId: string
  sourceColumn: string
  sourceRow: string
  targetColumn: string
  targetRow: string
  targetIndex: number
  mode: 'between' | 'on'
  dropOnCardId?: string
  cardHeight: number
  childReorder?: { parentId: string; rank: number }
}
