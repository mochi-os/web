// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { EntityAvatar } from './entity-avatar'

export function NotificationSourceIcon({
  app,
  sender,
  isUnread,
}: {
  app: string
  sender?: string
  isUnread: boolean
}) {
  const [iconFailed, setIconFailed] = useState(false)

  return (
    <div className='relative mt-0.5 shrink-0'>
      <div className='bg-primary/15 dark:bg-hover/70 flex size-7 items-center justify-center rounded-md'>
        {sender ? (
          <EntityAvatar
            src={`/people/${sender}/-/avatar`}
            styleUrl={`/people/${sender}/-/style`}
            size='sm'
            className='shrink-0'
          />
        ) : iconFailed ? (
          <div className='text-hover-foreground flex size-6 items-center justify-center text-[10px] font-semibold uppercase'>
            {app.slice(0, 1)}
          </div>
        ) : (
          <img
            src={`/${app}/images/icon.svg`}
            alt={app}
            width={18}
            height={18}
            onError={() => setIconFailed(true)}
            className='size-[18px] brightness-0 invert'
          />
        )}
      </div>
      {isUnread && (
        <span className='bg-primary absolute -right-1 -top-1 size-2 rounded-full ring-1 ring-background' />
      )}
    </div>
  )
}
