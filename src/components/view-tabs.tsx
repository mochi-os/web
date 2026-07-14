// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { LayoutGrid, ListTree, Plus } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { cn } from '../lib/utils'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface View {
  id: string
  name: string
  viewtype: string
}

interface ViewTabsProps {
  views: View[]
  activeViewId: string
  onViewChange: (viewId: string) => void
  onAddView?: () => void
  variant?: 'underline' | 'pill'
}

function getViewIcon(viewtype: string, className = 'size-4') {
  switch (viewtype) {
    case 'list':
      return <ListTree className={className} />
    case 'board':
    default:
      return <LayoutGrid className={className} />
  }
}

export function ViewTabs({
  views,
  activeViewId,
  onViewChange,
  onAddView,
  variant = 'underline',
}: ViewTabsProps) {
  if (variant === 'pill') {
    return (
      <div className='inline-flex items-center gap-1 rounded-lg bg-muted p-[3px]'>
        {views.map((view) => (
          <button
            key={view.id}
            type='button'
            onClick={() => onViewChange(view.id)}
            data-state={activeViewId === view.id ? 'active' : 'inactive'}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 text-sm font-medium transition-[color,box-shadow]',
              activeViewId === view.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {getViewIcon(view.viewtype, 'size-3.5')}
            {view.name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <Tabs
      variant='underline'
      value={activeViewId}
      onValueChange={onViewChange}
      className='no-scrollbar border-border gap-0 overflow-x-auto border-b'
    >
      <div className='flex min-w-max items-center gap-1'>
        <TabsList className='w-auto border-b-0'>
          {views.map((view) => (
            <TabsTrigger key={view.id} value={view.id} className='gap-2'>
              {getViewIcon(view.viewtype)}
              {view.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {onAddView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={onAddView}
                aria-label={t`Add view`}
                className='text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-2 text-sm transition-colors'
              >
                <Plus className='size-4' />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t`Add view`}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </Tabs>
  )
}
