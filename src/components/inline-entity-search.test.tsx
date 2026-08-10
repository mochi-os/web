// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Six apps carried this panel privately and only two of them guarded against
// out-of-order search responses, so that guard is what these tests pin: a slow
// earlier response must not overwrite a fast later one. The rest cover the
// branches the copies disagreed on — the pasted-link probe, and what a failed
// search shows.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { Rss } from 'lucide-react'
import {
  InlineEntitySearch,
  type InlineEntitySearchItem,
} from './inline-entity-search'

interface Row extends InlineEntitySearchItem {
  fingerprint: string
}

const row = (id: string, name: string): Row => ({
  id,
  name,
  fingerprint: `${id}${id}${id}`,
})

/** A promise the test resolves by hand, so response order is controllable. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof InlineEntitySearch<Row>>> = {}
) {
  const search = props.search ?? vi.fn().mockResolvedValue([])
  const onSubscribe = props.onSubscribe ?? vi.fn().mockResolvedValue(undefined)
  const utils = render(
    <I18nProvider i18n={i18n}>
      <InlineEntitySearch<Row>
        subscribedIds={new Set()}
        search={search as (query: string) => Promise<Row[]>}
        onSubscribe={onSubscribe}
        icon={Rss}
        placeholder='Search for feeds...'
        emptyMessage='No feeds found'
        searchErrorMessage='Failed to search'
        subscribeLabel='Subscribe'
        {...props}
      />
    </I18nProvider>
  )
  const input = screen.getByPlaceholderText('Search for feeds...')
  return { ...utils, input, search, onSubscribe }
}

const type = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } })

describe('InlineEntitySearch', () => {
  it('debounces, then renders what search returns', async () => {
    const search = vi.fn().mockResolvedValue([row('a', 'Alpha')])
    const { input } = renderPanel({ search })

    type(input, 'al')
    expect(search).not.toHaveBeenCalled()

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(search).toHaveBeenCalledExactlyOnceWith('al')
  })

  it('ignores a slow earlier response that lands after a later one', async () => {
    const slow = deferred<Row[]>()
    const fast = deferred<Row[]>()
    const search = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise)
    const { input } = renderPanel({ search })

    type(input, 'sl')
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))

    type(input, 'slow')
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2))

    // The later query answers first, then the earlier one lands.
    fast.resolve([row('f', 'Fast')])
    expect(await screen.findByText('Fast')).toBeInTheDocument()

    slow.resolve([row('s', 'Stale')])
    await waitFor(() => expect(screen.queryByText('Stale')).toBeNull())
    expect(screen.getByText('Fast')).toBeInTheDocument()
  })

  it('sends a pasted link to probe instead of the directory search', async () => {
    const search = vi.fn().mockResolvedValue([])
    const probe = vi.fn().mockResolvedValue([row('p', 'Probed')])
    const { input } = renderPanel({ search, probe })

    type(input, 'mochi://peer/abc')

    expect(await screen.findByText('Probed')).toBeInTheDocument()
    expect(search).not.toHaveBeenCalled()
    expect(probe).toHaveBeenCalledWith('mochi://peer/abc')
  })

  it('shows the empty message when a link resolves to nothing', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('private'))
    const { input } = renderPanel({ probe })

    type(input, 'https://example.test/feeds/abc')

    expect(await screen.findByText('No feeds found')).toBeInTheDocument()
  })

  it('shows a failed search and re-runs it on retry', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('directory unreachable'))
      .mockResolvedValueOnce([row('a', 'Alpha')])
    const { input } = renderPanel({ search })

    type(input, 'al')
    expect(await screen.findByText(/directory unreachable/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('hides rows already subscribed by id or fingerprint', async () => {
    const search = vi
      .fn()
      .mockResolvedValue([row('a', 'Alpha'), row('b', 'Beta')])
    const { input } = renderPanel({
      search,
      subscribedIds: new Set(['a', 'bbb']),
    })

    type(input, 'al')
    expect(await screen.findByText('No feeds found')).toBeInTheDocument()
  })

  it('clears the list when the query is emptied', async () => {
    const search = vi.fn().mockResolvedValue([row('a', 'Alpha')])
    const { input } = renderPanel({ search })

    type(input, 'al')
    expect(await screen.findByText('Alpha')).toBeInTheDocument()

    type(input, '')
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.queryByText('No feeds found')).toBeNull()
  })
})
