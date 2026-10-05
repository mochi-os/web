// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger } from './tabs'

function box(left: number, right: number): DOMRect {
  return { left, right, width: right - left } as DOMRect
}

// jsdom lays nothing out, so the strip is given a width narrower than its
// tabs and each tab a position along it.
function layOut(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
    scrollWidth
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
    clientWidth
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute('role') === 'tablist') return box(0, clientWidth)
      if (this.textContent === 'Third') return box(400, 500)
      return box(0, 100)
    }
  )
}

function renderStrip(value: string) {
  render(
    <Tabs variant='underline' value={value}>
      <TabsList>
        <TabsTrigger value='first'>First</TabsTrigger>
        <TabsTrigger value='third'>Third</TabsTrigger>
      </TabsList>
    </Tabs>
  )
  return screen.getByRole('tablist')
}

describe('TabsList', () => {
  afterEach(() => vi.restoreAllMocks())

  it('scrolls a strip wider than its space to show the active tab', () => {
    layOut(500, 300)
    expect(renderStrip('third').scrollLeft).toBe(200)
  })

  it('leaves a strip that fits where it is', () => {
    layOut(300, 300)
    expect(renderStrip('third').scrollLeft).toBe(0)
  })

  it('scrolls sideways rather than widening the page', () => {
    const list = renderStrip('first')
    expect(list.className).toContain('overflow-x-auto')
    expect(screen.getByRole('tab', { name: 'First' }).className).toContain(
      'shrink-0'
    )
  })
})
