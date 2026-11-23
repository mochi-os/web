// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Shared object model for the object/class/field apps (crm, projects). Apps
// intersect these types with their own container key (`crm` / `project`), which
// the shared components never read.

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
  min?: string
  max?: string
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

/** Fields every object carries. `number` and `readable` are optional:
 *  projects issues human-readable identifiers (PROJ-14), crm does not. */
export interface EntityObject {
  id: string
  class: string
  parent: string
  // Fractional-index ordering key: an opaque base-62 string, compared
  // lexicographically. A move names the object it was dropped beside and the
  // server mints the key.
  rank: string
  created: number
  updated: number
  values: Record<string, string>
  number?: number
  readable?: string
}

/**
 * Where a drop puts an object: directly after the object `after`, or, with
 * nothing above it, directly before `before`, as the list showed them. Neither
 * is the end of a list with nothing in it.
 */
export interface EntityPlace {
  after?: string
  before?: string
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

/**
 * What copying an object opens the new-item form on: the original's class,
 * parent and values, and the attachments Create copies onto the new one.
 */
export interface EntityObjectCopy {
  class: string
  parent: string
  values: Record<string, string>
  attachments: { id: string; name: string }[]
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

/**
 * What an activity entry names, as the server resolved it: the name and type
 * of the field it changed in the object's class, and readable old and new
 * values - an option's or a person's name, an object's title (a move's
 * parents, a link's target) or a class's name (a change of class). A side is
 * absent where the value is formatted by its field's type, or names nothing
 * that still exists.
 */
export interface EntityActivityDisplay {
  field?: string
  type?: string
  old?: string
  new?: string
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
  display?: EntityActivityDisplay
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
 * An entity's schema: an app's details object minus its own container key, so
 * the shared component never sees the container. The id it needs arrives
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
