// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { EntityAvatar } from './entity-avatar'
import { GameHeader } from './layout/game-header'

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// The style is fetched directly (useAccent's fetchStyle), never through the
// app client and its token. The page sits under the app the style URL names:
// only this app's own resources are fetched.
const fetched = vi.fn(
  async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ data: { accent: '#123456' } }))
)

function under(page: string) {
  window.history.replaceState({}, '', page)
  fetched.mockClear()
  vi.stubGlobal('fetch', fetched)
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

// The accent ring is fetched from a style URL on the CALLING app. There is
// deliberately no fallback to /<fingerprint>/-/style on the people app: from
// the shell's sandboxed iframe that cross-app request carries no cookies and
// answers 403, and every app that renders an avatar was making it.
describe('EntityAvatar accent', () => {
  beforeEach(() => {
    under('/chat/')
  })

  it('fetches the accent from the style URL the app supplies', async () => {
    render(
      wrap(
        <EntityAvatar
          fingerprint='9AbCdEfGh'
          name='A'
          styleUrl='/chat/-/person/x/asset/style'
        />
      )
    )
    await waitFor(() =>
      expect(fetched).toHaveBeenCalledWith(
        `${window.location.origin}/chat/-/person/x/asset/style`,
        expect.anything()
      )
    )
  })

  it('makes no request at all from a bare fingerprint', async () => {
    render(wrap(<EntityAvatar fingerprint='9AbCdEfGh' name='A' />))
    // The avatar itself still resolves from the fingerprint.
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/9AbCdEfGh/-/avatar'
    )
    await Promise.resolve()
    expect(fetched).not.toHaveBeenCalled()
  })

  it('makes no request when the caller already knows the accent', async () => {
    render(
      wrap(
        <EntityAvatar
          fingerprint='9AbCdEfGh'
          name='A'
          styleUrl='/chat/x'
          accent='#abcdef'
        />
      )
    )
    await Promise.resolve()
    expect(fetched).not.toHaveBeenCalled()
  })
})

describe('GameHeader opponent assets', () => {
  beforeEach(() => {
    under('/chess/g1')
  })

  it('renders the avatar and fetches the accent from the game-bound URLs', async () => {
    render(
      wrap(
        <GameHeader
          title='Opponent'
          status='Your move'
          opponentName='Opponent'
          opponentAvatarUrl='/chess/g1/-/user/p2/asset/avatar'
          opponentStyleUrl='/chess/g1/-/user/p2/asset/style'
        />
      )
    )
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/chess/g1/-/user/p2/asset/avatar'
    )
    await waitFor(() =>
      expect(fetched).toHaveBeenCalledWith(
        `${window.location.origin}/chess/g1/-/user/p2/asset/style`,
        expect.anything()
      )
    )
  })

  it('shows no avatar and asks the people app nothing when the game supplies no URLs', async () => {
    render(
      wrap(
        <GameHeader
          title='Opponent'
          status='Your move'
          opponentName='Opponent'
        />
      )
    )
    expect(screen.queryByRole('img')).toBeNull()
    await Promise.resolve()
    expect(fetched).not.toHaveBeenCalled()
  })
})
