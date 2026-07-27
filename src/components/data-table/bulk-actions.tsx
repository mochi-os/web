// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useRef } from 'react'
import { Trans, Plural } from '@lingui/react/macro'
import { type Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip'
import { t, plural } from '@lingui/core/macro'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
  entityName: string
  entityNamePlural?: string
  children: React.ReactNode
}

/**
 * A modular toolbar for displaying bulk actions when table rows are selected.
 *
 * @template TData The type of data in the table.
 * @param {object} props The component props.
 * @param {Table<TData>} props.table The react-table instance.
 * @param {string} props.entityName Localized singular noun for the row type (e.g. t`task`).
 * @param {string} [props.entityNamePlural] Localized plural noun. Defaults to entityName.
 * @param {React.ReactNode} props.children The action buttons to be rendered inside the toolbar.
 * @returns {React.ReactNode | null} The rendered component or null if no rows are selected.
 */
export function DataTableBulkActions<TData>({
  table,
  entityName,
  entityNamePlural,
  children,
}: DataTableBulkActionsProps<TData>): React.ReactNode | null {
  const manyName = entityNamePlural ?? entityName
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')

  // Announce selection changes to screen readers
  useEffect(() => {
    if (selectedCount > 0) {
      const message = plural(selectedCount, {
        one: `# ${entityName} selected. Bulk actions toolbar is available.`,
        other: `# ${manyName} selected. Bulk actions toolbar is available.`,
      })
      setAnnouncement(message)

      // Clear announcement after a delay
      const timer = setTimeout(() => setAnnouncement(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [selectedCount, entityName, manyName])

  const handleClearSelection = () => {
    table.resetRowSelection()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const buttons = toolbarRef.current?.querySelectorAll('button')
    if (!buttons) return

    const currentIndex = Array.from(buttons).findIndex(
      (button) => button === document.activeElement
    )

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault()
        const nextIndex = (currentIndex + 1) % buttons.length
        buttons[nextIndex]?.focus()
        break
      }
      case 'ArrowLeft': {
        event.preventDefault()
        const prevIndex =
          currentIndex === 0 ? buttons.length - 1 : currentIndex - 1
        buttons[prevIndex]?.focus()
        break
      }
      case 'Home':
        event.preventDefault()
        buttons[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        buttons[buttons.length - 1]?.focus()
        break
      case 'Escape': {
        // Check if the Escape key came from a dropdown trigger or content
        // We can't check dropdown state because Radix UI closes it before our handler runs
        const target = event.target as HTMLElement
        const activeElement = document.activeElement as HTMLElement

        // Check if the event target or currently focused element is a dropdown trigger
        const isFromDropdownTrigger =
          target?.getAttribute('data-slot') === 'dropdown-menu-trigger' ||
          activeElement?.getAttribute('data-slot') ===
            'dropdown-menu-trigger' ||
          target?.closest('[data-slot="dropdown-menu-trigger"]') ||
          activeElement?.closest('[data-slot="dropdown-menu-trigger"]')

        // Check if the focused element is inside dropdown content (which is portaled)
        const isFromDropdownContent =
          activeElement?.closest('[data-slot="dropdown-menu-content"]') ||
          target?.closest('[data-slot="dropdown-menu-content"]')

        if (isFromDropdownTrigger || isFromDropdownContent) {
          // Escape was meant for the dropdown - don't clear selection
          return
        }

        // Escape was meant for the toolbar - clear selection
        event.preventDefault()
        handleClearSelection()
        break
      }
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
        role='status'
      >
        {announcement}
      </div>

      <div
        ref={toolbarRef}
        role='toolbar'
        aria-label={plural(selectedCount, {
          one: `Bulk actions for # selected ${entityName}`,
          other: `Bulk actions for # selected ${manyName}`,
        })}
        aria-describedby='bulk-actions-description'
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl',
          'transition-all delay-100 duration-300 ease-out hover:scale-105',
          'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none'
        )}
      >
        <div
          className={cn(
            'p-2 shadow-xl',
            'rounded-xl border',
            'bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur-lg',
            'flex items-center gap-x-2'
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                onClick={handleClearSelection}
                className='size-6 rounded-full'
                aria-label={t`Clear selection`}
                title={t`Clear selection (Escape)`}
              >
                <X />
                <span className='sr-only'><Trans>Clear selection</Trans></span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p><Trans>Clear selection (Escape)</Trans></p>
            </TooltipContent>
          </Tooltip>

          <Separator
            className='h-5'
            orientation='vertical'
            aria-hidden='true'
          />

          <div
            className='flex items-center gap-x-1 text-sm'
            id='bulk-actions-description'
          >
            <Badge
              variant='default'
              className='min-w-8 rounded-lg'
              aria-label={plural(selectedCount, {
                one: '# selected',
                other: '# selected',
              })}
            >
              {selectedCount}
            </Badge>{' '}
            <span className='hidden sm:inline'>
              <Plural
                value={selectedCount}
                one={`${entityName} selected`}
                other={`${manyName} selected`}
              />
            </span>{' '}
            <span className='sm:hidden'><Trans>selected</Trans></span>
          </div>

          <Separator
            className='h-5'
            orientation='vertical'
            aria-hidden='true'
          />

          {children}
        </div>
      </div>
    </>
  )
}
