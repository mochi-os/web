// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { type ReactNode } from 'react'
import { cn } from '../lib/utils'

export const LIST_CARD_LINK_CLASS =
  'absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export interface ListCardProps {
  /** Icon node shown in the top-left badge (controls its own size, e.g. `size-5`). */
  icon: ReactNode
  /** Card title — rendered on a single truncated line. */
  title: ReactNode
  highlighted?: boolean

  renderLink: (className: string) => ReactNode
  /** Optional action menu (e.g. a `DropdownMenu`) shown top-right, above the link. */
  menu?: ReactNode
  /** Optional meta/subtitle content rendered below the title. */
  children?: ReactNode
}

export function ListCard({
  icon,
  title,
  highlighted,
  renderLink,
  menu,
  children,
}: ListCardProps) {
  return (
    <div className='group relative flex flex-col rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md'>
      {renderLink(LIST_CARD_LINK_CLASS)}

      <div className='mb-3 flex items-start justify-between'>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            highlighted ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
          )}
        >
          {icon}
        </div>
        {menu && <div className='relative z-10 -me-1 -mt-1'>{menu}</div>}
      </div>

      <p className='truncate font-semibold leading-snug'>{title}</p>
      {children}
    </div>
  )
}
