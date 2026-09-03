// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../lib/request', () => ({
  requestHelpers: { get: vi.fn(async () => ({ accent: '#123456' })) },
}))

import { requestHelpers } from '../lib/request'
import { EntityAvatar } from './entity-avatar'
import { GameHeader } from './layout/game-header'

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// The accent ring is fetched from a style URL on the CALLING app. There is
// deliberately no fallback to /<fingerprint>/-/style on the people app: from
// the shell's sandboxed iframe that cross-app request carries no cookies and
// answers 403, and every app that renders an avatar was making it.
describe('EntityAvatar accent', () => {
  beforeEach(() => {
    vi.mocked(requestHelpers.get).mockClear()
  })

  it('fetches the accent from the style URL the app supplies', async () => {
    render(wrap(<EntityAvatar fingerprint="9AbCdEfGh" name="A" styleUrl="/chat/-/person/x/asset/style" />))
    await waitFor(() => expect(requestHelpers.get).toHaveBeenCalledWith('/chat/-/person/x/asset/style'))
  })

  it('makes no request at all from a bare fingerprint', async () => {
    render(wrap(<EntityAvatar fingerprint="9AbCdEfGh" name="A" />))
    // The avatar itself still resolves from the fingerprint.
    expect(screen.getByRole('img')).toHaveAttribute('src', '/9AbCdEfGh/-/avatar')
    await Promise.resolve()
    expect(requestHelpers.get).not.toHaveBeenCalled()
  })

  it('makes no request when the caller already knows the accent', async () => {
    render(wrap(<EntityAvatar fingerprint="9AbCdEfGh" name="A" styleUrl="/chat/x" accent="#abcdef" />))
    await Promise.resolve()
    expect(requestHelpers.get).not.toHaveBeenCalled()
  })
})

describe('GameHeader opponent assets', () => {
  beforeEach(() => {
    vi.mocked(requestHelpers.get).mockClear()
  })

  it('renders the avatar and fetches the accent from the game-bound URLs', async () => {
    render(
      wrap(
        <GameHeader
          title="Opponent"
          status="Your move"
          opponentName="Opponent"
          opponentAvatarUrl="/chess/g1/-/user/p2/asset/avatar"
          opponentStyleUrl="/chess/g1/-/user/p2/asset/style"
        />
      )
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', '/chess/g1/-/user/p2/asset/avatar')
    await waitFor(() => expect(requestHelpers.get).toHaveBeenCalledWith('/chess/g1/-/user/p2/asset/style'))
  })

  it('shows no avatar and asks the people app nothing when the game supplies no URLs', async () => {
    render(wrap(<GameHeader title="Opponent" status="Your move" opponentName="Opponent" />))
    expect(screen.queryByRole('img')).toBeNull()
    await Promise.resolve()
    expect(requestHelpers.get).not.toHaveBeenCalled()
  })
})
