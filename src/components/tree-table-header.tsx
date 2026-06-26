// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

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

function columnWidthClass(field: TreeTableHeaderField, isTitle: boolean): string {
  if (isTitle) return 'min-w-[12rem]'
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

export function TreeTableHeader({
  fields,
  showClass,
  showId,
  titleFieldId,
  classLabel,
  idLabel,
}: TreeTableHeaderProps) {
  return (
    <thead className="border-b border-border">
      <tr className="text-xs text-muted-foreground">
        <th className="sticky top-0 z-10 w-10 min-w-10 py-2 ps-2 pe-2 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]" aria-hidden="true" />
        {showClass ? (
          <th className="sticky top-0 z-10 px-2 py-2 text-start font-medium whitespace-nowrap w-24 shrink-0 bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
            {classLabel}
          </th>
        ) : null}
        {showId ? (
          <th className="sticky top-0 z-10 px-2 py-2 text-start font-medium whitespace-nowrap w-20 shrink-0 font-mono bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
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
              )}
            >
              {field.name || field.id}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
