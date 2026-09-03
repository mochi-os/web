// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { PersonPicker, type Person } from './person-picker'

vi.mock('../lib/request', () => ({
  requestHelpers: { get: vi.fn(), post: vi.fn() },
}))
import { requestHelpers } from '../lib/request'

type Descriptor = { id?: string; message?: string; values?: Record<string, unknown> }

function show(props: Partial<React.ComponentProps<typeof PersonPicker>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <PersonPicker mode='multiple' value={[]} onChange={() => {}} open onOpenChange={() => {}} {...props} />
      </I18nProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(requestHelpers.get).mockReset()
})

describe('PersonPicker', () => {
  it('counts a selection it cannot name through the plural macro', () => {
    // The macro hands the count to the catalogue; a template literal never
    // reaches i18n at all, so the marker below can only come from plural().
    const original = i18n._.bind(i18n)
    vi.spyOn(i18n, '_').mockImplementation((...args: unknown[]) => {
      const descriptor = (typeof args[0] === 'object' ? args[0] : { id: args[0], values: args[1] }) as Descriptor
      if (descriptor.message?.includes('selected')) {
        const count = Object.values(descriptor.values ?? {})[0]
        return `SELECTED(${String(count)})`
      }
      return original(...(args as [string]))
    })
    show({ value: ['x', 'y', 'z'] })
    expect(screen.getByRole('combobox')).toHaveTextContent('SELECTED(3)')
  })

  it('heads the local list with the label the caller gives it', async () => {
    const local: Person[] = [{ id: 'a', name: 'Ann' }]
    show({ local, localLabel: 'Team', friendsFn: async () => [{ id: 'b', name: 'Bob' }] })
    await screen.findByText('Bob')
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.queryByText('Project members')).not.toBeInTheDocument()
  })

  it('fetches nothing when the caller supplies only local people', async () => {
    show({ local: [{ id: 'a', name: 'Ann' }] })
    await act(async () => {})
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(requestHelpers.get).not.toHaveBeenCalled()
  })
})
