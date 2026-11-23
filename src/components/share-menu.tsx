// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Sharing something an app holds, as the user chooses: a post of it in one of
// the user's feeds, first as the likeliest; a message of it in one of their
// chats; or its link, copied. The post and the message are copies: Feeds and
// Chat open their own composer filled in with the words and the address, the
// user sends it, and it is tied to nothing, so a later edit of what was shared
// never reaches it. A ShareMenu is a menu of its own behind the app's trigger;
// a ShareSubmenu is the same entries inside a menu the app already has. The
// entries' words are the app's, from its own catalogue, so this adds no string
// to every app's.
import { useRef, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { Copy, MessageCircle, Newspaper, Share2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { toast } from '../lib/toast-utils'
import { getErrorMessage } from '../lib/handle-server-error'
import { shellClipboardWrite, shellNavigateExternal } from '../lib/shell-bridge'
import { chatSharePath, feedSharePath, type Share } from '../lib/share'

export interface ShareLabels {
  /** Post it to one of the user's feeds. */
  feed: string
  /** Send it in one of the user's chats. */
  chat: string
  /** Copy its link. */
  copy: string
}

export interface ShareProps {
  /** What is shared, read when an entry is chosen. */
  share: () => Share
  /**
   * The link Copy link copies where it is not the shared address: the
   * mochi:// address another server joins a whole feed, forum or wiki by. It
   * is asked for as the menu opens, so the copy is made within the press.
   */
  link?: () => Promise<string>
  labels: ShareLabels
}

function useShare({ share, link }: ShareProps) {
  const { t } = useLingui()
  const asked = useRef<Promise<string> | null>(null)
  const held = useRef('')

  // Each opening asks again, so the link is never one for another entity.
  const prepare = (open: boolean) => {
    if (!open || !link) return
    held.current = ''
    const promise = link()
    asked.current = promise
    promise.then(
      (value) => {
        if (asked.current === promise) held.current = value
      },
      () => undefined
    )
  }

  const write = (value: string) => {
    if (!value) {
      toast.error(t`Failed to create link`)
      return
    }
    void shellClipboardWrite(value).then((ok) => {
      if (ok) toast.success(t`Copied to clipboard`)
      else toast.error(t`Failed to copy`)
    })
  }

  const copy = () => {
    if (!link) return write(share().url ?? '')
    if (held.current) return write(held.current)
    ;(asked.current ?? link()).then(write, (error: unknown) =>
      toast.error(getErrorMessage(error, t`Failed to create link`))
    )
  }

  return {
    prepare,
    copyable: !!link || !!share().url,
    feed: () => shellNavigateExternal(feedSharePath(share())),
    chat: () => shellNavigateExternal(chatSharePath(share())),
    copy,
  }
}

function ShareItems({
  actions,
  labels,
}: {
  actions: ReturnType<typeof useShare>
  labels: ShareLabels
}) {
  return (
    <>
      <DropdownMenuItem onSelect={actions.feed}>
        <Newspaper className='size-4' />
        {labels.feed}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={actions.chat}>
        <MessageCircle className='size-4' />
        {labels.chat}
      </DropdownMenuItem>
      {actions.copyable && (
        <DropdownMenuItem onSelect={actions.copy}>
          <Copy className='size-4' />
          {labels.copy}
        </DropdownMenuItem>
      )}
    </>
  )
}

/** Share as a menu of its own, opened by the app's trigger. */
export function ShareMenu({
  children,
  align = 'end',
  ...props
}: ShareProps & {
  /** The trigger: a button whose name is Share. */
  children: ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  const actions = useShare(props)
  return (
    <DropdownMenu onOpenChange={actions.prepare}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <ShareItems actions={actions} labels={props.labels} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Share as an entry of a menu the app already has. */
export function ShareSubmenu(props: ShareProps) {
  const { t } = useLingui()
  const actions = useShare(props)
  return (
    <DropdownMenuSub onOpenChange={actions.prepare}>
      <DropdownMenuSubTrigger>
        <Share2 className='me-2 size-4' />
        {t`Share`}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <ShareItems actions={actions} labels={props.labels} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
