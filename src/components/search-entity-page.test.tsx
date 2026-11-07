// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable lingui/no-unlocalized-strings */
import { useEffect, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { Hash } from 'lucide-react'
import { FindEntityPage } from './search-entity-page'

vi.mock('../lib/request', () => ({
  requestHelpers: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('./layout/header', () => ({
  Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./layout/main', () => ({
  Main: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
import { requestHelpers } from '../lib/request'

// A supplement that has, or has not, something to show for the query.
function Elsewhere({ shows, found }: { shows: boolean; found: (yes: boolean) => void }) {
  useEffect(() => found(shows), [shows, found])
  return shows ? <div>Technology</div> : null
}

function show(query: string, shows: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <FindEntityPage
          onSubscribe={vi.fn()}
          entityClass='forum'
          searchEndpoint='-/directory/search'
          icon={Hash}
          title='Find forums'
          emptyMessage='No forums found'
          initialQuery={query}
          supplement={(_, found) => <Elsewhere shows={shows} found={found} />}
        />
      </QueryClientProvider>
    </I18nProvider>
  )
}

describe('FindEntityPage supplement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requestHelpers.get).mockResolvedValue([])
  })

  it('shows no empty message for a query the supplement has a result for', async () => {
    show('!technology@lemmy.world', true)
    expect(await screen.findByText('Technology')).toBeTruthy()
    await waitFor(() => expect(requestHelpers.get).toHaveBeenCalled())
    // THE POINT: the directory found nothing, but the page has an answer.
    await waitFor(() => expect(screen.queryByText('Searching...')).toBeNull())
    expect(screen.queryByText('No forums found')).toBeNull()
  })

  it('still says nothing was found where the supplement has nothing either', async () => {
    show('!nothing@lemmy.world', false)
    expect(await screen.findByText('No forums found')).toBeTruthy()
  })
})
