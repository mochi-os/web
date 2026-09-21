// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'

type TableProps = React.ComponentProps<'table'> & {
  /** Keep the first column visible while the table scrolls horizontally. */
  stickyFirstColumn?: boolean
  /** Draw the table's own border. Turn off inside a Card or another box. */
  bordered?: boolean
  /** Layout classes for the scrolling container around the table. */
  containerClassName?: string
}

function Table({
  className,
  containerClassName,
  stickyFirstColumn = false,
  bordered = true,
  ...props
}: TableProps) {
  return (
    <div
      data-slot='table-container'
      className={cn(
        'relative w-full overflow-x-auto',
        bordered && 'border-border rounded-lg border',
        stickyFirstColumn &&
          '[&>table>*>tr>:is(td,th):first-child]:sticky [&>table>*>tr>:is(td,th):first-child]:start-0 [&>table>*>tr>:is(td,th):first-child]:z-10',
        // The divider is drawn by the cell, not as a border-e: the table paints
        // collapsed borders itself, so a border stays where the column started
        // and scrolls away while the sticky cell stays put.
        stickyFirstColumn &&
          '[&>table>*>tr>:is(td,th):first-child]:after:absolute [&>table>*>tr>:is(td,th):first-child]:after:inset-y-0 [&>table>*>tr>:is(td,th):first-child]:after:end-0 [&>table>*>tr>:is(td,th):first-child]:after:w-px [&>table>*>tr>:is(td,th):first-child]:after:bg-border',
        // Scrolled cells pass under the sticky one, so it needs an opaque fill.
        // :where() drops the default to zero specificity so a background class
        // on the cell itself still wins.
        stickyFirstColumn &&
          '[:where(&>table>*>tr>:is(td,th):first-child)]:bg-background',
        // The header band is opaque, so its sticky cell has to match it rather
        // than the page.
        stickyFirstColumn &&
          '[:where(&>table>thead>tr>:is(td,th):first-child)]:bg-surface-2',
        // The opaque fill covers the row's own hover and selected colours, so
        // repeat them on the cell. Selected is 80% over the page, pre-mixed to
        // stay opaque.
        stickyFirstColumn &&
          '[&>table>tbody>tr[data-slot=table-row]:hover>:is(td,th):first-child]:bg-hover [&>table>tbody>tr[data-slot=table-row][data-state=selected]>:is(td,th):first-child]:bg-[color-mix(in_srgb,var(--color-interactive-active)_80%,var(--color-background))]',
        containerClassName
      )}
    >
      <table
        data-slot='table'
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot='table-header'
      className={cn('bg-surface-2 [&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot='table-body'
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn(
        'bg-surface-2 border-t border-border font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={cn(
        // No colour transition: a fade makes the hover feel like it lags the
        // pointer, and a sticky first column cannot fade with the row anyway,
        // so the cell would snap while the rest of the row eased.
        'hover:bg-hover data-[state=selected]:bg-interactive-active/80 border-b border-border',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={cn(
        'text-foreground h-12 px-4 text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={cn(
        'px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  )
}

type TableSortHeaderProps = Omit<
  React.ComponentProps<'th'>,
  'onClick' | 'align'
> & {
  active: boolean
  direction: 'asc' | 'desc'
  onToggle: () => void
  align?: 'start' | 'end'
}

// A header that sorts. The button spans the cell's width rather than hugging
// the label, so the hit target matches what the eye reads as the column title.
// Every sortable column shows an indicator; inactive columns use a dimmed
// neutral icon, while the active one shows its direction. Which direction a
// fresh column starts in belongs to the caller, since "most interesting first"
// differs per column.
function TableSortHeader({
  active,
  direction,
  onToggle,
  align = 'start',
  className,
  children,
  ...props
}: TableSortHeaderProps) {
  const Arrow = !active
    ? ChevronsUpDown
    : direction === 'asc'
      ? ArrowUp
      : ArrowDown
  const arrow = (
    <Arrow className={cn('size-3 shrink-0', !active && 'opacity-40')} />
  )
  return (
    <TableHead
      data-slot='table-sort-header'
      aria-sort={
        active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className={cn(align === 'end' && 'text-end', className)}
      {...props}
    >
      <button
        type='button'
        onClick={onToggle}
        className={cn(
          'hover:text-foreground focus-visible:ring-ring/50 -mx-1 flex w-full items-center gap-1 rounded px-1 outline-none focus-visible:ring-[3px]',
          align === 'end' && 'justify-end',
          active && 'text-foreground font-semibold'
        )}
      >
        {/* On an end-aligned column the arrow goes BEFORE the label, so the
            label itself ends flush with the numbers below it. Trailing it there
            pushed every heading an arrow's width off its own column. */}
        {align === 'end' && arrow}
        {children}
        {align === 'start' && arrow}
      </button>
    </TableHead>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableSortHeader,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
