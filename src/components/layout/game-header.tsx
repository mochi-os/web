// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { EntityAvatar } from '../entity-avatar'
import { useAccent } from '../../hooks/use-accent'

interface GameHeaderProps {
  title: ReactNode
  status: ReactNode
  meta?: ReactNode
  stats?: ReactNode
  actions?: ReactNode
  banner?: ReactNode
  myTurn?: boolean
  statusLive?: 'off' | 'polite' | 'assertive'
  variant?: 'card' | 'strip'
  className?: string
  // Opponent entity fingerprint — renders their avatar next to the title and
  // tints the header border with their accent colour (if set).
  opponentFingerprint?: string | null
  // Fallback name for the avatar initials when the opponent has no avatar set.
  opponentName?: string
  // Avatar and style URLs on the CALLING app, for a game that proxies its
  // players' assets through its own action: a cross-app fetch from the
  // sandboxed iframe carries Origin: null and no cookies.
  opponentAvatarUrl?: string | null
  opponentStyleUrl?: string | null
}

export function GameHeader({
  title,
  status,
  meta,
  stats,
  actions,
  banner,
  myTurn,
  statusLive = 'polite',
  variant = 'card',
  className,
  opponentFingerprint,
  opponentName,
  opponentAvatarUrl,
  opponentStyleUrl,
}: GameHeaderProps) {
  // The opponent's avatar/style live on the people app and need to be proxied
  // (direct entity URLs only resolve locally; remote opponents 404 there).
  const proxyBase = opponentFingerprint ? `/people/${opponentFingerprint}` : null
  const avatarUrl = opponentAvatarUrl ?? (proxyBase ? `${proxyBase}/-/avatar` : null)
  const styleUrl = opponentStyleUrl ?? (proxyBase ? `${proxyBase}/-/style` : null)
  const { accent } = useAccent(undefined, styleUrl ?? undefined)
  const accentStyle: CSSProperties | undefined = accent
    ? { borderColor: accent }
    : undefined

  return (
    // The header sizes against its own box, not the viewport. The chat column
    // takes 320px out of the row, so a wide window can still leave the header
    // under 600px, and the viewport-width version overlapped its own title
    // with the stats there.
    <div className='@container/game-header'>
      <section
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2',
          'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none',
          '@[640px]/game-header:grid-cols-[minmax(0,1fr)_auto_auto] @[640px]/game-header:items-center',
          variant === 'card'
            ? 'rounded-xl border border-border/70 bg-surface-1/80 px-3 py-3 shadow-sm'
            : 'border-b border-border/50 px-3 py-2.5',
          className
        )}
        style={accentStyle}
      >
        <div className='flex min-w-0 items-center gap-3'>
          {avatarUrl ? (
            <EntityAvatar
              src={avatarUrl}
              styleUrl={styleUrl}
              name={opponentName}
              size="md"
              className='shrink-0'
            />
          ) : null}
          <div className='min-w-0 space-y-1'>
            <h1 className='min-w-0 line-clamp-2 text-base leading-tight font-semibold @[600px]/game-header:line-clamp-1 @[640px]/game-header:text-lg'>
              {title}
            </h1>
            <p
              aria-live={statusLive}
              className='text-sm leading-tight font-medium @[640px]/game-header:text-[0.9375rem]'
            >
              {myTurn != null && (
                <span
                  aria-hidden='true'
                  className={cn(
                    'me-1.5 inline-block size-2 rounded-full align-middle',
                    myTurn ? 'bg-success' : 'bg-muted-foreground/30'
                  )}
                />
              )}
              {status}
            </p>
            {meta ? (
              <p className='text-sm leading-tight text-muted-foreground'>{meta}</p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className='col-start-2 row-start-1 flex shrink-0 items-center gap-1 self-start justify-self-end @[640px]/game-header:col-start-3'>
            {actions}
          </div>
        ) : null}

        {stats ? (
          <div
            className={cn(
              'col-span-2 flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              '@[600px]/game-header:flex-wrap @[600px]/game-header:overflow-visible @[600px]/game-header:pb-0',
              '@[640px]/game-header:col-span-1 @[640px]/game-header:col-start-2 @[640px]/game-header:row-start-1 @[640px]/game-header:self-center',
              '[&>*]:inline-flex [&>*]:shrink-0 [&>*]:items-center [&>*]:gap-1.5 [&>*]:rounded-full [&>*]:border [&>*]:border-border/70 [&>*]:bg-surface-2',
              '[&>*]:px-2.5 [&>*]:py-1 [&>*]:text-sm [&>*]:font-medium [&>*]:tabular-nums [&>*]:shadow-xs',
              '[&>*]:transition-[background-color,border-color,color,box-shadow] [&>*]:duration-150 [&>*]:ease-out motion-reduce:[&>*]:transition-none'
            )}
          >
            {stats}
          </div>
        ) : null}

        {banner ? (
          <div className='col-span-2 @[640px]/game-header:col-span-3'>{banner}</div>
        ) : null}
      </section>
    </div>
  )
}
