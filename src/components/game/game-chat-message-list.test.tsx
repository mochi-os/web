// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fixture strings only. No lingui macro in this file: every app's
// lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import type { ComponentProps } from 'react'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  GameChatMessageList,
  type GameChatMessage,
} from './game-chat-message-list'

// The device's zone is Tokyo, nine hours east of the user's.
const deviceZone = process.env.TZ
process.env.TZ = 'Asia/Tokyo'
afterAll(() => {
  if (deviceZone === undefined) delete process.env.TZ
  else process.env.TZ = deviceZone
})

// The user's zone, as their locale preference names it.
vi.mock('../../context/locale-provider', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../context/locale-provider')>()
  return {
    ...original,
    useLocale: () => {
      const value = original.useLocale()
      return { ...value, locale: { ...value.locale, timezone: 'UTC' } }
    },
  }
})

type Props = ComponentProps<typeof GameChatMessageList<GameChatMessage>>

// The list reads only the paging fields of the query.
const query = {
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
} as unknown as Props['messagesQuery']

const NOON = Date.UTC(2026, 2, 10, 12) / 1000

let sequence = 0
function chat(fields: Partial<GameChatMessage>): GameChatMessage {
  sequence += 1
  return {
    id: `m${sequence}`,
    member: 'alice',
    name: 'Alice',
    body: `message ${sequence}`,
    type: 'chat',
    created: NOON + sequence * 60,
    ...fields,
  }
}

function show(messages: GameChatMessage[], props: Partial<Props> = {}) {
  return render(
    <GameChatMessageList
      messagesQuery={query}
      chatMessages={messages}
      isLoadingMessages={false}
      messagesError={null}
      currentUserIdentity='me'
      emptyLabel='No messages'
      renderMove={(message) => message.body}
      {...props}
    />
  )
}

describe('the day headings', () => {
  it('put a message under the day it has in the user’s zone', () => {
    // 12:00 and 20:00 on the 10th in UTC; 21:00 on the 10th and 05:00 on the
    // 11th on the device.
    const evening = Date.UTC(2026, 2, 10, 20) / 1000
    expect(new Date(evening * 1000).getDate()).toBe(11)

    show([
      chat({ created: NOON, body: 'noon' }),
      chat({ created: evening, body: 'evening' }),
    ])

    const headings = screen
      .getAllByText(/^\d{4}-\d{2}-\d{2}$/)
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['2026-03-10'])
    expect(screen.getByText(/^2026-03-10 12:00/)).toBeInTheDocument()
    expect(screen.getByText(/^2026-03-10 20:00/)).toBeInTheDocument()
  })
})

describe('a message’s time', () => {
  it('shows where there is no hover', () => {
    show([
      chat({ created: NOON, member: 'me', name: 'Me' }),
      chat({ created: NOON + 60 }),
    ])

    const times = screen.getAllByText(/^2026-03-10 12:0[01]/)
    expect(times).toHaveLength(2)
    for (const time of times) {
      expect(time).toHaveClass('opacity-0')
      expect(time).toHaveClass('group-hover:opacity-100')
      expect(time).toHaveClass('[@media(hover:none)]:opacity-100')
    }
  })
})

describe('the sender’s name', () => {
  // Alice twice, Bob, a move, Alice again, then the viewer.
  const messages = [
    chat({ body: 'first' }),
    chat({ body: 'second' }),
    chat({ member: 'bob', name: 'Bob', body: 'third' }),
    chat({ type: 'move', body: 'Alice played' }),
    chat({ body: 'fourth' }),
    chat({ member: 'me', name: 'Me', body: 'fifth' }),
  ]

  it('is not shown unless asked for', () => {
    show(messages)

    expect(screen.queryByText('Alice')).toBeNull()
    expect(screen.queryByText('Bob')).toBeNull()
  })

  it('heads each run of received messages from one member, once', () => {
    show(messages, { showNames: true })

    const alice = screen.getAllByText('Alice')
    expect(alice).toHaveLength(2)
    expect(screen.getAllByText('Bob')).toHaveLength(1)
    expect(screen.queryByText('Me')).toBeNull()

    // Each name sits above the run's first bubble, in the same message.
    expect(alice[0].parentElement).toHaveTextContent('first')
    expect(alice[0].parentElement).not.toHaveTextContent('second')
    expect(screen.getByText('Bob').parentElement).toHaveTextContent('third')
    expect(alice[1].parentElement).toHaveTextContent('fourth')
  })

  it('starts again on a new day', () => {
    show(
      [
        chat({ created: NOON, body: 'today' }),
        chat({ created: NOON + 86400, body: 'tomorrow' }),
      ],
      { showNames: true }
    )

    const alice = screen.getAllByText('Alice')
    expect(alice).toHaveLength(2)
    expect(alice[1].parentElement).toHaveTextContent('tomorrow')
  })
})
