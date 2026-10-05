// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

type TabsVariant = 'segmented' | 'underline'

const TabsVariantContext = React.createContext<TabsVariant>('segmented')

const tabsListVariants = cva('text-muted-foreground inline-flex items-center', {
  variants: {
    variant: {
      // Both strips scroll sideways once their tabs outgrow a narrow screen,
      // rather than pushing the page wider. A strip that fits is unchanged.
      segmented:
        'bg-muted no-scrollbar h-9 w-fit max-w-full justify-start overflow-x-auto rounded-lg p-[3px]',
      // The rule under the strip is an inset shadow, not a border: a scroll
      // container clips at its padding edge, so a tab could no longer lay its
      // own underline over a real border.
      underline:
        'no-scrollbar h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 shadow-[inset_0_-1px_0_var(--border)]',
    },
  },
  defaultVariants: { variant: 'segmented' },
})

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        segmented:
          'data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground h-[calc(100%-1px)] flex-1 rounded-md border border-transparent px-2 py-1 focus-visible:ring-[3px] focus-visible:outline-1 data-[state=active]:shadow-sm',
        underline:
          'text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground focus-visible:ring-ring/40 focus-visible:rounded-t-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none shrink-0 rounded-none border-b-2 border-transparent px-4 py-2',
      },
    },
    defaultVariants: { variant: 'segmented' },
  }
)

function Tabs({
  className,
  variant = 'segmented',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & {
  variant?: TabsVariant
}) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.Root
        data-slot='tabs'
        className={cn('flex flex-col gap-2', className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const contextVariant = React.useContext(TabsVariantContext)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Bring the active tab into view when the strip scrolls, so a tab opened
  // from a link is not left off screen. Only the strip moves, never the page.
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list || list.scrollWidth <= list.clientWidth) return
    const active = list.querySelector<HTMLElement>('[data-state=active]')
    if (!active) return
    const listBox = list.getBoundingClientRect()
    const tabBox = active.getBoundingClientRect()
    if (tabBox.left < listBox.left) {
      list.scrollLeft -= listBox.left - tabBox.left
    } else if (tabBox.right > listBox.right) {
      list.scrollLeft += tabBox.right - listBox.right
    }
  })

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot='tabs-list'
      className={cn(
        tabsListVariants({ variant: variant ?? contextVariant }),
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants>) {
  const contextVariant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      data-slot='tabs-trigger'
      className={cn(
        tabsTriggerVariants({ variant: variant ?? contextVariant }),
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot='tabs-content'
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
