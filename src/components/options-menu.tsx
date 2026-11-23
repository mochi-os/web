// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Gavel,
  Link2,
  Loader2,
  MoreHorizontal,
  Rss,
  Settings,
  UserMinus,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { ConfirmDialog } from './confirm-dialog'
import { ShareSubmenu, type ShareLabels } from './share-menu'
import { toast } from '../lib/toast-utils'
import { getErrorMessage } from '../lib/handle-server-error'
import { getAppPath } from '../lib/app-path'
import { path } from '../lib/request-path'
import { shellClipboardWrite } from '../lib/shell-bridge'

interface OptionsMenuProps {
  entityId?: string
  /** Offer the RSS submenu for the whole app when there is no entity. */
  showRss?: boolean
  /** The app's words for Share's entries. */
  shareLabels: ShareLabels
  /** The entity's name, which a post of it in a feed starts with. */
  shareName?: string
  /** The full address of the entity's page, which that post links to. */
  shareUrl?: () => string
  onSources?: () => void
  onModeration?: () => void
  onSettings?: () => void
  onUnsubscribe?: () => void
  unsubscribePending?: boolean
  /** Show the Share entry — owner only, the action is owner-gated. */
  canShare?: boolean
  /** Creates the mochi:// link another server joins the entity by. */
  createShareLink: (entityId: string) => Promise<string>
  /** Issues an RSS token for the entity, or for the whole app when "*". */
  createRssToken: (entity: string, mode: 'posts' | 'all') => Promise<string>
  /** Revokes the entity's RSS token. */
  revokeRssToken: (entity: string) => Promise<void>
  /** The app's own entries, placed after Moderation. */
  children?: ReactNode
}

/**
 * The "..." entity menu shared by the feeds and forums apps. Navigation and the
 * share/RSS calls are injected, so each app keeps its own router and client.
 */
export function OptionsMenu({
  entityId,
  showRss,
  shareLabels,
  shareName,
  shareUrl,
  onSources,
  onModeration,
  onSettings,
  onUnsubscribe,
  unsubscribePending,
  canShare,
  createShareLink,
  createRssToken,
  revokeRssToken,
  children,
}: OptionsMenuProps) {
  const { t } = useLingui()
  const rssEntity = entityId || (showRss ? '*' : null)

  const [revokeRssOpen, setRevokeRssOpen] = useState(false)

  const handleCopyRssUrl = async (mode: 'posts' | 'all') => {
    if (!rssEntity) return
    try {
      const token = await createRssToken(rssEntity, mode)
      const url =
        rssEntity === '*'
          ? `${window.location.origin}${getAppPath()}/rss?token=${encodeURIComponent(token)}`
          : `${window.location.origin}${getAppPath()}/${path`${rssEntity}/rss`}?token=${encodeURIComponent(token)}`
      const ok = await shellClipboardWrite(url)
      if (ok) toast.success(t`RSS URL copied to clipboard`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to get RSS token`))
    }
  }

  const handleRevokeRss = async () => {
    if (!rssEntity) return
    try {
      await revokeRssToken(rssEntity)
      setRevokeRssOpen(false)
      toast.success(t`RSS access revoked`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to revoke RSS access`))
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            aria-label={t`More options`}
            className='text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors'
          >
            <MoreHorizontal className='size-4' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {onSources && (
            <DropdownMenuItem onSelect={onSources}>
              <Link2 className='size-4' />
              <Trans>Sources</Trans>
            </DropdownMenuItem>
          )}
          {onModeration && (
            <DropdownMenuItem onSelect={onModeration}>
              <Gavel className='size-4' />
              <Trans>Moderation</Trans>
            </DropdownMenuItem>
          )}
          {children}
          {rssEntity && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Rss className='me-2 size-4' />
                <Trans>RSS feed</Trans>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onSelect={() => void handleCopyRssUrl('posts')}
                >
                  <Trans>Posts</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleCopyRssUrl('all')}>
                  <Trans>Posts and comments</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRevokeRssOpen(true)}>
                  <Trans>Revoke access</Trans>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {/* Canonical menu tail: Share, Design (n/a here), Settings, Unsubscribe. */}
          {/* A post or message of the entity is its name and its page's
              address; its link is the mochi:// one another server joins by. */}
          {canShare && entityId && (
            <ShareSubmenu
              share={() => ({ text: shareName ?? '', url: shareUrl?.() })}
              link={() => createShareLink(entityId)}
              labels={shareLabels}
            />
          )}
          {onSettings && (
            <DropdownMenuItem onSelect={onSettings}>
              <Settings className='size-4' />
              <Trans>Settings</Trans>
            </DropdownMenuItem>
          )}
          {onUnsubscribe && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onUnsubscribe}
                disabled={unsubscribePending}
              >
                {unsubscribePending ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <UserMinus className='size-4' />
                )}
                <Trans>Unsubscribe</Trans>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={revokeRssOpen}
        onOpenChange={setRevokeRssOpen}
        title={t`Revoke RSS access?`}
        // The second sentence is doing real work. Revoking is also the only
        // way to reissue - minting returns the existing token unchanged, so a
        // feed whose token is gone stays broken until the row is cleared - and
        // nothing else in the interface says so.
        desc={t`Anything subscribed to this feed will stop receiving it. You can copy a new URL afterwards.`}
        confirmText={t`Revoke`}
        icon={<Link2 className='size-4' />}
        destructive
        handleConfirm={() => void handleRevokeRss()}
      />
    </>
  )
}
