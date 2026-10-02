// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Frame of the design page for the object/class/field apps (crm, projects):
// the editor beside the live preview from `lg` up, and below it one of the
// two at full width, picked by a tab. A 320 px editor beside a preview leaves
// the preview nothing on a phone, and the table in it cannot be read on a
// tablet either.

import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

export interface EntityDesignLayoutProps {
  /** Views, classes and fields. Scrolls inside its panel. */
  editor: ReactNode
  /** Usually `EntityDesignPreview`, which fills the panel and scrolls itself. */
  preview: ReactNode
  /** Tab names, shown below `lg` only. */
  labels: { edit: string; preview: string }
}

export function EntityDesignLayout({
  editor,
  preview,
  labels,
}: EntityDesignLayoutProps) {
  const [tab, setTab] = useState('edit')

  // Both panels stay mounted, so switching tabs keeps the editor's scroll and
  // the view picked in the preview. They are tab panels below `lg` and sit
  // side by side from it, which is why each is force-mounted and hidden by
  // class rather than by Radix. tabIndex -1: the panels are not stops of
  // their own, the controls inside them are.
  return (
    <Tabs
      variant='underline'
      value={tab}
      onValueChange={setTab}
      className='h-full gap-0 lg:flex-row'
    >
      <TabsList className='shrink-0 px-4 lg:hidden'>
        <TabsTrigger value='edit'>{labels.edit}</TabsTrigger>
        <TabsTrigger value='preview'>{labels.preview}</TabsTrigger>
      </TabsList>
      <TabsContent
        value='edit'
        forceMount
        tabIndex={-1}
        className='flex min-h-0 flex-col overflow-hidden max-lg:data-[state=inactive]:hidden lg:w-80 lg:flex-none lg:border-e'
      >
        <div className='flex-1 space-y-6 overflow-auto p-4'>{editor}</div>
      </TabsContent>
      <TabsContent
        value='preview'
        forceMount
        tabIndex={-1}
        className='min-h-0 min-w-0 overflow-hidden max-lg:data-[state=inactive]:hidden'
      >
        {preview}
      </TabsContent>
    </Tabs>
  )
}
