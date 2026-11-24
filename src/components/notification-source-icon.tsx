// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { EntityAvatar } from './entity-avatar'
import { path, tryPath } from '../lib/request-path'

export function NotificationSourceIcon({
  app,
  name,
  sender,
  isUnread,
}: {
  /** The path the app is served at, which locates its icon: not its id, which
   *  on a server running published apps is an entity id no route serves. */
  app: string
  /** The app's display name. Without one the icon is decorative: the row's
   *  own text names the source, and an id is not a name. */
  name?: string
  sender?: string
  isUnread: boolean
}) {
  const [iconFailed, setIconFailed] = useState(false)
  // Undefined for a value that cannot be one path segment: initials, or the
  // app's name, instead of a fetch of another path.
  const assets = sender ? tryPath(() => path`/people/${sender}/-`) : undefined
  const icon = tryPath(() => path`/${app}/images/icon.svg`)

  return (
    <div className='relative mt-0.5 shrink-0'>
      <div className='bg-primary/15 dark:bg-hover/70 flex size-7 items-center justify-center rounded-md'>
        {sender ? (
          <EntityAvatar
            src={assets && `${assets}/avatar`}
            styleUrl={assets && `${assets}/style`}
            size='sm'
            className='shrink-0'
          />
        ) : iconFailed || !icon ? (
          name ? (
            <div className='text-hover-foreground flex size-6 items-center justify-center text-[10px] font-semibold uppercase'>
              {name.slice(0, 1)}
            </div>
          ) : (
            <Bell aria-hidden='true' className='text-hover-foreground size-4' />
          )
        ) : (
          <img
            src={icon}
            alt={name ?? ''}
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
