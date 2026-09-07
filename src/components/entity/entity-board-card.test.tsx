// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { i18n } from '@lingui/core'
import {
  render,
  screen,
  createMockEntityField,
  createMockEntityObject,
} from './entity-test-utils'
import { EntityBoardCard } from './entity-board-card'

describe('EntityBoardCard', () => {
  it('formats a number field for the locale', () => {
    const field = createMockEntityField({ id: 'amount', name: 'Amount', fieldtype: 'number', card: 1 })
    render(
      <EntityBoardCard
        object={createMockEntityObject({ values: { title: 'Deal', amount: '1234567.5' } })}
        fields={[createMockEntityField({ id: 'title', name: 'Title', card: 1 }), field]}
        options={{}}
        fallbackTitle={() => 'Untitled'}
      />
    )
    expect(screen.getByText('1,234,567.5')).toBeInTheDocument()
  })

  it('counts the nested children below the depth cap with a plural form', () => {
    // The Plural macro hands the count to the catalogue; a template literal
    // renders the same English without reaching i18n.
    const original = i18n._.bind(i18n)
    const spy = vi.spyOn(i18n, '_').mockImplementation((...args: unknown[]) => {
      // The Trans component passes (id, values, { message }); the macro
      // passes one descriptor object.
      const descriptor = (
        typeof args[0] === 'object' ? args[0] : { id: args[0], values: args[1], ...(args[2] as object) }
      ) as { message?: string; values?: Record<string, unknown> }
      if (descriptor.message?.includes('plural')) return `PLURAL(${String(Object.values(descriptor.values ?? {})[0])})`
      return original(...(args as [string]))
    })
    const parent = createMockEntityObject({ id: 'p' })
    const kid = createMockEntityObject({ id: 'k', parent: 'p', values: { title: 'Kid' } })
    render(
      <EntityBoardCard
        object={parent}
        fields={[createMockEntityField({ id: 'title', name: 'Title', card: 1 })]}
        options={{}}
        fallbackTitle={() => 'Untitled'}
        depth={3}
        children={[kid]}
        childrenByParent={{ p: [kid] }}
      />
    )
    expect(screen.getByText('PLURAL(1)')).toBeInTheDocument()
    spy.mockRestore()
  })
})
