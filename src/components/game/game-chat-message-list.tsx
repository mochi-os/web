// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The in-game chat list chess and go each grew privately, 273 and 265 lines
// and twenty lines apart. Those twenty were the move line: chess tells a
// capture from a quiet move, go localises its "Pass" sentinel. Everything else
// — the date grouping, the two scroll effects, the skeleton, the error and
// empty states and the bubbles — was the same in both.
//
// words holds a third copy, 305 lines, and it is the reason the system labels
// are optional: words has no draw, so it supplies `resigned` alone and the
// other three events keep falling through to the stored body. Its move line is
// the richest of the three — plays, passes and exchanges all arrive as type
// 'move' and are told apart by the event marker — which is exactly what the
// render prop is for.
//
// The move line is a render prop, so each game keeps its own wording. Every
// other string arrives resolved from the app, so no app adds a message to the
// other apps' catalogs.

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import type {
  UseInfiniteQueryResult,
  InfiniteData,
} from '@tanstack/react-query'
import { GeneralError } from '../../features/errors/general-error'
import { LoadMoreTrigger } from '../load-more-trigger'
import { Skeleton } from '../ui/skeleton'
import { getChatBubbleToneClass } from '../../lib/chat-ui'
import { useFormat } from '../../hooks/use-format'
import { cn } from '../../lib/utils'

/** The message fields the list reads. Each game's own type is this. */
export interface GameChatMessage {
  id: string
  member: string
  name: string
  body: string
  type: string
  /**
   * For type 'system': the event kind (resign / draw_offer / draw_accept /
   * draw_decline). Empty or absent on legacy rows, which fall back to `body`.
   */
  event?: string
  created: number
}

/**
 * System events, resolved by the app. A legacy row with no `event` renders its
 * stored `body` instead, which is why none of these is a fallback.
 *
 * Each is optional, and an absent one — or a callback returning nullish — also
 * falls back to the body. That is how a game without draws (words) supplies
 * `resigned` alone, and how words keeps showing the body for a resignation
 * whose actor name is empty.
 */
export interface GameChatSystemLabels {
  resigned?: (name: string) => ReactNode
  drawOffered?: (name: string) => ReactNode
  drawAgreed?: ReactNode
  drawDeclined?: (name: string) => ReactNode
}

interface GameChatMessageListProps<M extends GameChatMessage> {
  messagesQuery: UseInfiniteQueryResult<InfiniteData<unknown>, unknown>
  chatMessages: M[]
  isLoadingMessages: boolean
  messagesError: unknown
  currentUserIdentity: string
  emptyLabel: string
  systemLabels?: GameChatSystemLabels
  /** The move line. chess marks captures, go localises "Pass". */
  renderMove: (message: M, isSent: boolean) => ReactNode
}

export function GameChatMessageList<M extends GameChatMessage>({
  messagesQuery,
  chatMessages,
  isLoadingMessages,
  messagesError,
  currentUserIdentity,
  emptyLabel,
  systemLabels = {},
  renderMove,
}: GameChatMessageListProps<M>) {
  const { formatDate, formatDateTime } = useFormat()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const isLoadingMoreRef = useRef(false)
  const skipNextAutoScrollRef = useRef(false)
  const isInitialLoadRef = useRef(true)
  const prevMessageCountRef = useRef<number>(0)

  const groupedMessages = useMemo(() => {
    const groups: Record<string, M[]> = {}
    chatMessages.forEach((message) => {
      const d = new Date(message.created * 1000)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })
    return groups
  }, [chatMessages])

  const handleLoadMore = useCallback(() => {
    if (messagesQuery.isFetchingNextPage || !messagesQuery.hasNextPage) return

    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight
      isLoadingMoreRef.current = true
    }

    messagesQuery.fetchNextPage()
  }, [messagesQuery])

  useLayoutEffect(() => {
    if (
      isLoadingMoreRef.current &&
      scrollContainerRef.current &&
      !messagesQuery.isFetchingNextPage
    ) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current
      scrollContainerRef.current.scrollTop += scrollDiff
      skipNextAutoScrollRef.current = true
      isLoadingMoreRef.current = false
    }
  }, [chatMessages, messagesQuery.isFetchingNextPage])

  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    const currentCount = chatMessages.length

    if (isInitialLoadRef.current && currentCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      isInitialLoadRef.current = false
    } else if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false
    } else if (!isLoadingMoreRef.current && currentCount > prevCount) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }

    prevMessageCountRef.current = currentCount
  }, [chatMessages])

  if (isLoadingMessages) {
    return (
      <div className="flex flex-1 w-full flex-col justify-end gap-3 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex w-full flex-col gap-1',
              i % 2 === 0 ? 'items-start' : 'items-end',
            )}
          >
            <Skeleton
              className={cn(
                'h-8 w-[70%] rounded-[12px]',
                i % 2 === 0 ? 'rounded-es-[4px]' : 'rounded-ee-[4px]',
              )}
            />
          </div>
        ))}
      </div>
    )
  }

  if (messagesError) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center py-4">
        <GeneralError
          error={messagesError}
          minimal
          mode="inline"
          reset={messagesQuery.refetch}
          className="w-full max-w-md"
        />
      </div>
    )
  }

  if (chatMessages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
        <p className="text-muted-foreground text-xs">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex w-full flex-1 flex-col justify-start gap-2 overflow-y-auto py-2 px-3 pb-3"
    >
      <LoadMoreTrigger
        onLoadMore={handleLoadMore}
        hasMore={messagesQuery.hasNextPage ?? false}
        isLoading={messagesQuery.isFetchingNextPage}
        rootMargin="100px"
      />

      {Object.keys(groupedMessages).map((key) => (
        <Fragment key={key}>
          <div className="my-2 flex items-center justify-center">
            {/* eslint-disable-next-line lingui/no-unlocalized-strings -- 'T00:00:00' is an ISO-8601 time component, not a UI label */}
            <div className="text-muted-foreground text-[10px]">
              {formatDate(new Date(key + 'T00:00:00'))}
            </div>
          </div>

          {groupedMessages[key].map((message, index) => {
            // System messages — localised per viewer from the event kind and
            // the actor name. Legacy rows (no event) fall back to the body.
            if (message.type === 'system') {
              const name = message.name
              let label: ReactNode = null
              if (message.event === 'resign') {
                label = systemLabels.resigned?.(name)
              } else if (message.event === 'draw_offer') {
                label = systemLabels.drawOffered?.(name)
              } else if (message.event === 'draw_accept') {
                label = systemLabels.drawAgreed
              } else if (message.event === 'draw_decline') {
                label = systemLabels.drawDeclined?.(name)
              }
              const text = label ?? message.body
              return (
                <div
                  key={`${message.id}-${index}`}
                  className="flex justify-center py-1"
                >
                  <span className="text-muted-foreground text-[11px] italic">
                    {text}
                  </span>
                </div>
              )
            }

            const isSent = Boolean(
              currentUserIdentity && message.member === currentUserIdentity,
            )

            if (message.type === 'move') {
              return (
                <div
                  key={`${message.id}-${index}`}
                  className="flex justify-center py-0.5"
                >
                  <span className="text-[11px] text-muted-foreground/60">
                    {renderMove(message, isSent)}
                  </span>
                </div>
              )
            }

            return (
              <div
                key={`${message.id}-${index}`}
                className={cn(
                  'group mb-1 flex w-full flex-col gap-0.5',
                  isSent ? 'items-end' : 'items-start',
                )}
              >
                <div className="flex items-end gap-1.5">
                  {isSent && (
                    <span className="text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 text-[9px]">
                      {formatDateTime(new Date(message.created * 1000))}
                    </span>
                  )}

                  <div
                    className={cn(
                      'relative max-w-[85%] px-2.5 py-1.5 text-sm wrap-break-word',
                      getChatBubbleToneClass(isSent),
                    )}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">
                      {message.body}
                    </p>
                  </div>

                  {!isSent && (
                    <span className="text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 text-[9px]">
                      {formatDateTime(new Date(message.created * 1000))}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </Fragment>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
