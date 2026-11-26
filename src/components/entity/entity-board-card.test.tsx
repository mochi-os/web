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
  // A loaded people list always holds the reader, so an empty one is still
  // loading; one that lacks the person never will name them.
  it('reads a person a loaded list lacks as unknown, never as the id', () => {
    const person = 'p'.repeat(50)
    const card = (peopleMap: Record<string, string>) => (
      <EntityBoardCard
        object={createMockEntityObject({
          values: { title: 'Deal', reviewer: person },
        })}
        fields={[
          createMockEntityField({ id: 'title', name: 'Title', card: 1 }),
          createMockEntityField({
            id: 'reviewer',
            name: 'Reviewer',
            fieldtype: 'user',
            card: 1,
          }),
        ]}
        options={{}}
        peopleMap={peopleMap}
        fallbackTitle={() => 'Untitled'}
      />
    )
    const { rerender } = render(card({}))
    expect(screen.queryByText('Unknown')).toBeNull()
    rerender(card({ reader: 'Reader' }))
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.queryByText(person)).toBeNull()
    rerender(card({ reader: 'Reader', [person]: 'Ada' }))
    expect(screen.getByText('Ada')).toBeInTheDocument()
  })

  it('formats a number field for the locale', () => {
    const field = createMockEntityField({
      id: 'amount',
      name: 'Amount',
      fieldtype: 'number',
      card: 1,
    })
    render(
      <EntityBoardCard
        object={createMockEntityObject({
          values: { title: 'Deal', amount: '1234567.5' },
        })}
        fields={[
          createMockEntityField({ id: 'title', name: 'Title', card: 1 }),
          field,
        ]}
        options={{}}
        fallbackTitle={() => 'Untitled'}
      />
    )
    expect(screen.getByText('1,234,567.5')).toBeInTheDocument()
  })

  it('counts the done items of a checklist written with checked', () => {
    render(
      <EntityBoardCard
        object={createMockEntityObject({
          values: {
            title: 'Deal',
            steps: JSON.stringify([
              { text: 'Draft', checked: true },
              { text: 'Review', checked: false },
            ]),
          },
        })}
        fields={[
          createMockEntityField({ id: 'title', name: 'Title', card: 1 }),
          createMockEntityField({
            id: 'steps',
            name: 'Steps',
            fieldtype: 'checklist',
            card: 1,
          }),
        ]}
        options={{}}
        fallbackTitle={() => 'Untitled'}
      />
    )
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('counts the nested children below the depth cap with a plural form', () => {
    // The Plural macro hands the count to the catalogue; a template literal
    // renders the same English without reaching i18n.
    const original = i18n._.bind(i18n)
    const spy = vi.spyOn(i18n, '_').mockImplementation((...args: unknown[]) => {
      // The Trans component passes (id, values, { message }); the macro
      // passes one descriptor object.
      const descriptor = (
        typeof args[0] === 'object'
          ? args[0]
          : { id: args[0], values: args[1], ...(args[2] as object) }
      ) as { message?: string; values?: Record<string, unknown> }
      if (descriptor.message?.includes('plural'))
        return `PLURAL(${String(Object.values(descriptor.values ?? {})[0])})`
      return original(...(args as [string]))
    })
    const parent = createMockEntityObject({ id: 'p' })
    const kid = createMockEntityObject({
      id: 'k',
      parent: 'p',
      values: { title: 'Kid' },
    })
    render(
      <EntityBoardCard
        object={parent}
        fields={[
          createMockEntityField({ id: 'title', name: 'Title', card: 1 }),
        ]}
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
