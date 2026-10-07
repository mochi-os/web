// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from './entity-test-utils'
import { EntityContentScroller } from './entity-content-scroller'

function classesOf(element: Element | null): string[] {
  return (element?.className ?? '').split(/\s+/)
}

describe('EntityContentScroller', () => {
  it('keeps the list gutter outside the scroller', () => {
    // Pinned columns and the sticky header stick to the scroller's edge. A
    // gutter inside it would let 16 px of scrolled table show past them.
    render(
      <EntityContentScroller layout='list'>
        <span>table</span>
      </EntityContentScroller>
    )
    const inner = screen.getByText('table').parentElement
    const scroller = inner?.parentElement ?? null
    expect(scroller?.getAttribute('data-slot')).toBe(
      'entity-content-scroll-area'
    )
    expect(classesOf(scroller)).toEqual(
      expect.arrayContaining(['flex-1', 'min-h-0', 'overflow-auto', 'mx-4'])
    )
    expect(classesOf(scroller)).not.toContain('p-4')
    expect(classesOf(inner)).toEqual(['py-4'])
  })

  it('lets a board scroll sideways at its full width', () => {
    render(
      <EntityContentScroller layout='board'>
        <span>board</span>
      </EntityContentScroller>
    )
    const inner = screen.getByText('board').parentElement
    expect(classesOf(inner?.parentElement ?? null)).toEqual(
      expect.arrayContaining(['flex-1', 'min-h-0', 'overflow-x-auto'])
    )
    expect(classesOf(inner)).toEqual(
      expect.arrayContaining(['px-4', 'w-fit', 'min-w-full'])
    )
  })

  it('puts bare content straight into the scroller', () => {
    render(
      <EntityContentScroller layout='list' bare>
        <span>loading</span>
      </EntityContentScroller>
    )
    expect(
      screen.getByText('loading').parentElement?.getAttribute('data-slot')
    ).toBe('entity-content-scroll-area')
  })

  it('is the one scroller the list page and the design preview share', () => {
    // The preview drifted once to padding inside its scroller, which broke
    // the pinned columns. Both now have to render this component.
    for (const file of [
      'entity-objects-page.tsx',
      'entity-design-preview.tsx',
    ]) {
      const source = readFileSync(resolve(__dirname, file), 'utf8')
      expect(source).toContain('<EntityContentScroller')
      expect(source).not.toContain("data-slot='entity-content-scroll-area'")
      expect(source).not.toContain('p-4 overflow-auto')
    }
  })
})
