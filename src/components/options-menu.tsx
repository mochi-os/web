// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, type ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Check,
  Copy,
  Gavel,
  Link as LinkIcon,
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
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Button } from './ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './ui/responsive-dialog'
import { toast } from '../lib/toast-utils'
import { getErrorMessage } from '../lib/handle-server-error'
import { getAppPath } from '../lib/app-path'
import { shellClipboardWrite } from '../lib/shell-bridge'

interface OptionsMenuProps {
  entityId?: string
  /** Offer the RSS submenu for the whole app when there is no entity. */
  showRss?: boolean
  /** Heading for the share link dialog, e.g. "Feed link". */
  linkTitle: ReactNode
  onSources?: () => void
  onModeration?: () => void
  onSettings?: () => void
  onUnsubscribe?: () => void
  unsubscribePending?: boolean
  /** Show the share link entry — owner only, the action is owner-gated. */
  canShare?: boolean
  /** Creates a share link for the entity. */
  createShareLink: (entityId: string) => Promise<string>
  /** Issues an RSS token for the entity, or for the whole app when "*". */
  createRssToken: (entity: string, mode: 'posts' | 'all') => Promise<string>
  /** Revokes the entity's RSS token. */
  revokeRssToken: (entity: string) => Promise<void>
}

/**
 * The "⋯" entity menu shared by the feeds and forums apps.
 *
 * Navigation stays with the caller: the menu takes callbacks rather than
 * urls so each app keeps its own typed router. The share and RSS calls are
 * injected too, since each app's client returns a different response shape.
 */
export function OptionsMenu({
  entityId,
  showRss,
  linkTitle,
  onSources,
  onModeration,
  onSettings,
  onUnsubscribe,
  unsubscribePending,
  canShare,
  createShareLink,
  createRssToken,
  revokeRssToken,
}: OptionsMenuProps) {
  const { t } = useLingui()
  const rssEntity = entityId || (showRss ? '*' : null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const openLinkDialog = async () => {
    if (!entityId) return
    setLink('')
    setCopied(false)
    setLinkOpen(true)
    try {
      setLink(await createShareLink(entityId))
    } catch (error) {
      setLinkOpen(false)
      toast.error(getErrorMessage(error, t`Failed to create link`))
    }
  }

  const copyLink = async () => {
    if (!link) return
    const ok = await shellClipboardWrite(link)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyRssUrl = async (mode: 'posts' | 'all') => {
    if (!rssEntity) return
    try {
      const token = await createRssToken(rssEntity, mode)
      const url =
        rssEntity === '*'
          ? `${window.location.origin}${getAppPath()}/-/rss?token=${token}`
          : `${window.location.origin}${getAppPath()}/${rssEntity}/-/rss?token=${token}`
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
      toast.success(t`RSS access revoked`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to revoke RSS access`))
    }
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                aria-label={t`More options`}
                className='text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors'
              >
                <MoreHorizontal className='size-4' />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t`More options`}</TooltipContent>
        </Tooltip>
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
          {rssEntity && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Rss className='me-2 size-4' />
                <Trans>RSS feed</Trans>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => void handleCopyRssUrl('posts')}>
                  <Trans>Posts</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleCopyRssUrl('all')}>
                  <Trans>Posts and comments</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleRevokeRss()}>
                  <Trans>Revoke access</Trans>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {/* Canonical menu tail: Link, Design (n/a here), Settings, Unsubscribe. */}
          {canShare && entityId && (
            <DropdownMenuItem onSelect={() => void openLinkDialog()}>
              <LinkIcon className='size-4' />
              <Trans>Link</Trans>
            </DropdownMenuItem>
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

      <ResponsiveDialog open={linkOpen} onOpenChange={setLinkOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{linkTitle}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className='bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm'>
            <code className='flex-1 break-all'>{link || '…'}</code>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => void copyLink()}
              disabled={!link}
              className='shrink-0'
            >
              {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
