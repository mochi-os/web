// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The shell the games render before there is a board: the loading skeletons
// and the no-game empty state. The title is a prop so no lingui string lives
// here, and `mainClassName` exists only because the loading branch pads and
// the empty branch does not.

import { type ReactNode } from 'react'
import { PageHeader } from '../layout/page-header'
import { Main } from '../layout/main'
import { cn } from '../../lib/utils'

export function GamePlaceholderPage({
  title,
  mainClassName,
  children,
}: {
  /** The app's name. Already translated by the caller. */
  title: ReactNode
  mainClassName?: string
  children: ReactNode
}) {
  return (
    <div className='flex h-full flex-col overflow-hidden'>
      <PageHeader title={title} />
      <Main
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden',
          mainClassName
        )}
      >
        {children}
      </Main>
    </div>
  )
}
