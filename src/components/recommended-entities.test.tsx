// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Four apps carried this block privately and none of them had a test, so the
// behaviour worth pinning is the behaviour the copies disagreed on: what a
// failed load shows, whether the retry actually re-runs it, and whether a
// subscribed row leaves the list.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { Rss } from 'lucide-react'
import {
  RecommendedEntities,
  type RecommendedEntityItem,
} from './recommended-entities'

interface Row extends RecommendedEntityItem {
  fingerprint: string
}

const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', blurb: 'first', fingerprint: 'aaa' },
  { id: 'b', name: 'Beta', blurb: 'second', fingerprint: 'bbb' },
]

function renderBlock(
  props: Partial<React.ComponentProps<typeof RecommendedEntities<Row>>> = {}
) {
  const load = props.load ?? vi.fn().mockResolvedValue(ROWS)
  const onSubscribe = props.onSubscribe ?? vi.fn().mockResolvedValue(undefined)
  const utils = render(
    <I18nProvider i18n={i18n}>
      <RecommendedEntities<Row>
        subscribedIds={new Set()}
        load={load as () => Promise<Row[]>}
        onSubscribe={onSubscribe}
        icon={Rss}
        title='Recommended feeds'
        errorMessage='Failed to load'
        subscribeLabel='Subscribe'
        {...props}
      />
    </I18nProvider>
  )
  return { ...utils, load, onSubscribe }
}

describe('RecommendedEntities', () => {
  it('renders what load returns', async () => {
    renderBlock()
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('first')).toBeInTheDocument()
  })

  it('hides rows already subscribed by id or fingerprint', async () => {
    renderBlock({ subscribedIds: new Set(['a', 'bbb']) })
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.queryByText('Beta')).toBeNull()
  })

  it('renders nothing once every recommendation is subscribed', async () => {
    const { container } = renderBlock({ subscribedIds: new Set(['a', 'b']) })
    await waitFor(() => expect(container.querySelector('hr')).toBeNull())
  })

  it('shows the failure and re-runs load on retry', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('directory unreachable'))
      .mockResolvedValueOnce(ROWS)
    renderBlock({ load })

    expect(await screen.findByText(/directory unreachable/)).toBeInTheDocument()
    // The heading stays visible in the error state; the rows do not.
    expect(screen.getByText('Recommended feeds')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('falls back to errorMessage when the thrown value is not an Error', async () => {
    renderBlock({ load: vi.fn().mockRejectedValue('boom') })
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument()
  })

  it('drops the row it just subscribed to and keeps the rest', async () => {
    const onSubscribe = vi.fn().mockResolvedValue(undefined)
    renderBlock({ onSubscribe })

    const rows = await screen.findAllByRole('button', { name: 'Subscribe' })
    fireEvent.click(rows[0])

    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(onSubscribe).toHaveBeenCalledWith(ROWS[0])
  })

  it('keeps the row when subscribing fails', async () => {
    const onSubscribe = vi.fn().mockRejectedValue(new Error('refused'))
    renderBlock({ onSubscribe })

    const rows = await screen.findAllByRole('button', { name: 'Subscribe' })
    fireEvent.click(rows[0])

    await waitFor(() => expect(onSubscribe).toHaveBeenCalled())
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})
