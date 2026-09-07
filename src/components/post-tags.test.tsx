// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { PostTagsTooltip } from './post-tags'

type Descriptor = { id?: string; message?: string; values?: Record<string, unknown> }

function show(props: Partial<React.ComponentProps<typeof PostTagsTooltip>> = {}) {
  const onAdd = vi.fn(async () => {})
  render(
    <I18nProvider i18n={i18n}>
      <PostTagsTooltip tags={[{ id: 't1', label: 'x', relevance: 3, interest: 5, qid: 'q' }]} onAdd={onAdd} {...props} />
    </I18nProvider>
  )
  fireEvent.click(screen.getByLabelText('Tags'))
  return { onAdd }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PostTagsTooltip', () => {
  it('builds the tag tooltip through the catalogue', async () => {
    const original = i18n._.bind(i18n)
    vi.spyOn(i18n, '_').mockImplementation((...args: unknown[]) => {
      const descriptor = (typeof args[0] === 'object' ? args[0] : { id: args[0], values: args[1] }) as Descriptor
      if (descriptor.message?.startsWith('Relevance')) {
        return `T(${String(descriptor.values?.relevance)},${String(descriptor.values?.weight)})`
      }
      return original(...(args as [string]))
    })
    show()
    const tag = await screen.findByText('#x')
    expect(tag.getAttribute('title')).toBe('T(3,5)')
  })

  it('names the slash among the characters a tag may hold', async () => {
    const { onAdd } = show()
    const input = await screen.findByPlaceholderText('Add tag...')
    fireEvent.change(input, { target: { value: 'a_b' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Letters, numbers, spaces, hyphens, and slashes only')).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'a/b' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('a/b'))
  })
})
