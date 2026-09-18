// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { TreeTableHeaderField } from './tree-table-header'

// The rem figures behind columnWidthClass in tree-table-header.tsx and
// tree-row.tsx; change them together. A fixed-layout table ignores min-width on
// its cells, so on a narrow screen the title column is squeezed to nothing
// unless the table as a whole carries the floor. The title's 18rem is half as
// wide again as a plain text column, so a title still reads when it is pinned.
function columnRem(field: TreeTableHeaderField, isTitle: boolean): number {
  if (isTitle) return 18
  switch (field.fieldtype) {
    case 'user':
      return 10
    case 'date':
      return 8
    case 'enumerated':
      return 9
    default:
      return 12
  }
}

/** Minimum width of the tree table: every column at its set width, the title
 *  at its 18rem floor. Wider screens still stretch the title to fill. */
export function treeTableMinWidth({
  fields,
  showClass,
  showId,
  titleFieldId,
}: {
  fields: TreeTableHeaderField[]
  showClass?: boolean
  showId?: boolean
  titleFieldId?: string
}): string {
  // Handle 2.5rem (w-10), class 6rem (w-24), id 5rem (w-20).
  let rem = 2.5 + (showClass ? 6 : 0) + (showId ? 5 : 0)
  for (const field of fields) rem += columnRem(field, field.id === titleFieldId)
  return `${rem}rem`
}
