// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { PageHeader } from './page-header'
import { StickyBar } from './sticky-bar'

function strip(sticky: boolean, variant: 'segmented' | 'underline') {
  return render(
    <Tabs variant={variant} value='one'>
      <TabsList sticky={sticky} className='custom'>
        <TabsTrigger value='one'>One</TabsTrigger>
      </TabsList>
      <TabsContent value='one'>Panel</TabsContent>
    </Tabs>
  )
}

describe('StickyBar', () => {
  it('pins under the page header, at the top when there is none', () => {
    const { container } = render(<StickyBar className='pb-4' />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.className).toContain('sticky')
    expect(bar.className).toContain(
      'top-[calc(var(--sticky-top,0px)+var(--page-header-height,0px))]'
    )
    expect(bar.className).toContain('bg-background')
    expect(bar.className).toContain('pb-4')
  })
})

describe('TabsList sticky', () => {
  it('leaves a strip that did not ask for it unwrapped', () => {
    const { container } = strip(false, 'underline')
    expect(container.querySelector('[data-slot=sticky-bar]')).toBeNull()
    const list = container.querySelector('[data-slot=tabs-list]')
    expect(list?.parentElement?.getAttribute('data-slot')).toBe('tabs')
  })

  it('puts the strip in a sticky bar beside its panels', () => {
    const { container } = strip(true, 'underline')
    const bar = container.querySelector('[data-slot=sticky-bar]')
    const list = container.querySelector('[data-slot=tabs-list]')
    expect(list?.parentElement).toBe(bar)
    // The bar, not the strip, is the child of Tabs: it shares a parent with
    // the panels, which is what keeps it pinned while they scroll.
    expect(bar?.parentElement?.getAttribute('data-slot')).toBe('tabs')
    // className still styles the strip itself.
    expect(list?.className).toContain('custom')
    expect(bar?.className).not.toContain('custom')
    expect(bar?.className).not.toContain('pb-2')
  })

  it('pads under a pill strip, which has no rule to end on', () => {
    const { container } = strip(true, 'segmented')
    const bar = container.querySelector('[data-slot=sticky-bar]')
    expect(bar?.className).toContain('pb-2')
    expect(bar?.className).toContain('-mb-2')
  })
})

describe('PageHeader height', () => {
  it('publishes its height while mounted and clears it after', () => {
    const root = document.documentElement
    const { unmount } = render(<PageHeader title='Title' />)
    expect(root.style.getPropertyValue('--page-header-height')).toMatch(
      /^\d+(\.\d+)?px$/
    )
    unmount()
    expect(root.style.getPropertyValue('--page-header-height')).toBe('')
  })
})
