// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The sidebar inside the shell's sandboxed iframe: window.parent is the shell,
// whose document is out of reach (see shell-image.test.tsx). The bridge keeps
// its init in module state, so each test imports the sidebar afresh.
let posted: Array<Record<string, unknown>>
let frames: FrameRequestCallback[]
const innerWidth = window.innerWidth

beforeEach(() => {
  posted = []
  frames = []
  const parent = {
    postMessage: (message: unknown) => {
      posted.push(message as Record<string, unknown>)
    },
    get document(): never {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return parent
    },
  })
  // Frames run only when the test says, so the settling window can be seen.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  window.innerWidth = 1280
})

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return window
    },
  })
  window.innerWidth = innerWidth
  vi.unstubAllGlobals()
  vi.resetModules()
})

function fromParent(data: unknown) {
  const event = new MessageEvent('message', {
    data,
    origin: window.location.origin,
  })
  Object.defineProperty(event, 'source', {
    value: window.parent,
    configurable: true,
  })
  window.dispatchEvent(event)
}

function runFrame() {
  const pending = frames
  frames = []
  act(() => {
    for (const cb of pending) cb(0)
  })
}

async function renderInShell() {
  const { SidebarProvider, SidebarResizeHandle } = await import('./sidebar')
  const result = render(
    <I18nProvider i18n={i18n}>
      <SidebarProvider defaultOpen>
        <div data-slot='sidebar' data-side='left'>
          <div data-slot='sidebar-container'>
            <SidebarResizeHandle />
          </div>
        </div>
      </SidebarProvider>
    </I18nProvider>
  )
  const wrapper = result.container.querySelector<HTMLElement>(
    '[data-slot=sidebar-wrapper]'
  )!
  return {
    wrapper,
    width: () => wrapper.style.getPropertyValue('--sidebar-width'),
  }
}

describe('Sidebar width in the shell', () => {
  it('takes the saved width from init at once, without easing into it', async () => {
    const { wrapper, width } = await renderInShell()
    // The first paint comes before the shell's init.
    expect(width()).toBe('16rem')
    expect(wrapper).not.toHaveAttribute('data-settling')

    await act(async () => {
      fromParent({
        type: 'init',
        token: 'app-token',
        inShell: true,
        sidebarOpen: true,
        sidebarWidth: 320,
      })
    })
    expect(width()).toBe('320px')
    // Easing is off for the frame that paints the saved width...
    expect(wrapper).toHaveAttribute('data-settling', 'true')
    runFrame()
    expect(wrapper).toHaveAttribute('data-settling', 'true')
    // ...and back on after it, for the user's own changes.
    runFrame()
    expect(wrapper).not.toHaveAttribute('data-settling')
    expect(width()).toBe('320px')
  })

  it('sends a new width to the shell to keep for every app', async () => {
    await renderInShell()
    await act(async () => {
      fromParent({
        type: 'init',
        token: 'app-token',
        inShell: true,
        sidebarWidth: 320,
      })
    })
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(posted).toContainEqual({ type: 'sidebar-width', width: 336 })
    fireEvent.doubleClick(handle)
    expect(posted).toContainEqual({ type: 'sidebar-width', width: null })
  })
})
