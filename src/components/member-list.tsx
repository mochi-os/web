// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { LogOut, UserMinus } from 'lucide-react'
import { Button } from './ui/button'
import { ListSkeleton } from './ui/list-skeleton'
import { EntityAvatar } from './entity-avatar'
import { GeneralError } from '../features/errors/general-error'
import { naturalCompare } from '../lib/utils'

export interface MemberListMember {
  id: string
  name: string
}

export interface MemberListProps {
  members: MemberListMember[]
  // Marks this member's row "(you)". Leave it out where the row already says
  // Owner and only the owner can see the list; it would restate the tag.
  currentUserId?: string
  // Pinned first, tagged Owner, never removable.
  ownerId?: string
  // Avatar and style URLs. Apps without a person-asset route leave it out and
  // the rows show initials.
  avatarUrls?: (id: string) => { src: string; styleUrl?: string }
  // Omitted, no row offers a removal.
  onRemove?: (member: MemberListMember) => void
  // Offered on the current user's own row in place of a removal.
  leave?: { label: string; onClick: () => void }
  disabled?: boolean
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
}

// The row action stays hidden until the row is hovered or focused so a long
// list reads as names, not a column of buttons. Touch screens cannot hover,
// so it is always shown there.
const ACTION_CLASS =
  'text-muted-foreground size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'

export function MemberList({
  members,
  currentUserId,
  ownerId,
  avatarUrls,
  onRemove,
  leave,
  disabled = false,
  isLoading = false,
  error,
  onRetry,
}: MemberListProps) {
  const { t } = useLingui()

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.id === ownerId) return -1
        if (b.id === ownerId) return 1
        return naturalCompare(a.name || a.id, b.name || b.id)
      }),
    [members, ownerId]
  )

  if (error) {
    return <GeneralError error={error} minimal mode='inline' reset={onRetry} />
  }
  if (isLoading) {
    // Same height and spacing as the rows below, so the list does not jump
    // when it loads.
    return (
      <ListSkeleton
        variant='simple'
        height='h-12'
        count={3}
        className='gap-1 py-1'
      />
    )
  }

  return (
    <ul className='space-y-1 py-1'>
      {sorted.map((member) => {
        const name = member.name || member.id
        const isOwner = member.id === ownerId
        const isSelf = member.id === currentUserId
        const urls = avatarUrls?.(member.id)

        let action: React.ReactNode = null
        if (isOwner) {
          action = (
            <span className='text-muted-foreground shrink-0 text-sm'>
              <Trans>Owner</Trans>
            </span>
          )
        } else if (isSelf) {
          if (leave) {
            action = (
              <Button
                variant='ghost'
                size='icon'
                aria-label={leave.label}
                disabled={disabled}
                onClick={leave.onClick}
                className={ACTION_CLASS}
              >
                <LogOut className='size-4' />
              </Button>
            )
          }
        } else if (onRemove) {
          action = (
            <Button
              variant='ghost'
              size='icon'
              aria-label={t`Remove ${name}`}
              disabled={disabled}
              onClick={() => onRemove(member)}
              className={ACTION_CLASS}
            >
              <UserMinus className='size-4' />
            </Button>
          )
        }

        return (
          <li
            key={member.id}
            className='group hover:bg-hover flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors'
          >
            <div className='flex min-w-0 items-center gap-3'>
              <EntityAvatar
                src={urls?.src ?? null}
                styleUrl={urls?.styleUrl ?? null}
                seed={member.id}
                name={name}
                size='md'
              />
              <span className='truncate font-medium'>{name}</span>
              {isSelf && (
                <span className='text-muted-foreground shrink-0 text-xs'>
                  <Trans>(you)</Trans>
                </span>
              )}
            </div>
            {action}
          </li>
        )
      })}
    </ul>
  )
}
