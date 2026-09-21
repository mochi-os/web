// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useLingui } from '@lingui/react/macro'
import { cn } from '../lib/utils'

export interface TreeTableHeaderField {
  id: string
  name: string
  fieldtype: string
}

export interface TreeTableHeaderProps {
  fields: TreeTableHeaderField[]
  showClass?: boolean
  showId?: boolean
  titleFieldId?: string
  classLabel?: string
  idLabel?: string
}

// Widths mirror tree-table-width.ts and tree-row.tsx; change them together.
function columnWidthClass(
  field: TreeTableHeaderField,
  isTitle: boolean
): string {
  if (isTitle) return 'min-w-[15rem]'
  switch (field.fieldtype) {
    case 'user':
      return 'w-40 shrink-0'
    case 'date':
      return 'w-32 shrink-0'
    case 'enumerated':
      return 'w-36 shrink-0'
    default:
      return 'w-48 shrink-0'
  }
}

// The handle column and the first content column stay put while the rest of
// the table scrolls sideways, so the title and the expand control are always
// in view. The handle is w-10, which is where the second pinned column starts.
// Pinned header cells sit above the other header cells, which sit above the
// pinned body cells as the rows scroll up beneath them.
const PINNED_HANDLE = 'start-0 z-[11]'
// The divider is drawn by the cell rather than as a border-e, which the
// collapsed-border table paints in place and so scrolls away (see TreeRow).
const PINNED_FIRST =
  'start-10 z-[11] after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-border'

export function TreeTableHeader({
  fields,
  showClass,
  showId,
  titleFieldId,
  classLabel,
  idLabel,
}: TreeTableHeaderProps) {
  const { t } = useLingui()
  const firstContentCol = showClass
    ? 'class'
    : showId
      ? 'id'
      : fields[0]?.id || ''
  return (
    <thead className='border-b border-border'>
      <tr className='text-xs text-muted-foreground'>
        <th
          className={cn(
            'sticky top-0 z-10 w-10 min-w-10 py-2 ps-2 pe-2 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
            PINNED_HANDLE
          )}
          aria-hidden='true'
        />
        {showClass ? (
          <th
            className={cn(
              'sticky top-0 z-10 px-2 py-2 text-start font-medium whitespace-nowrap w-24 shrink-0 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
              PINNED_FIRST
            )}
          >
            {classLabel}
          </th>
        ) : null}
        {showId ? (
          <th
            className={cn(
              'sticky top-0 z-10 px-2 py-2 text-start font-medium whitespace-nowrap w-20 shrink-0 font-mono bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
              firstContentCol === 'id' && PINNED_FIRST
            )}
          >
            {idLabel}
          </th>
        ) : null}
        {fields.map((field) => {
          const isTitle = field.id === titleFieldId
          return (
            <th
              key={field.id}
              className={cn(
                'sticky top-0 z-10 px-2 py-2 text-start font-medium whitespace-nowrap bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
                columnWidthClass(field, isTitle),
                isTitle && 'w-full',
                firstContentCol === field.id && PINNED_FIRST
              )}
            >
              {field.name || t`Unknown`}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
