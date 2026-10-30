// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './theme-provider'

// The server-rendered class is a RESOLUTION of "follow the system", not the
// preference: reading it as the preference freezes a page loaded while the OS
// was dark, because the change listener only runs for 'system'.

// One MediaQueryList per media string, reused across calls: the provider holds
// the object it got from matchMedia and reads `.matches` off THAT when the
// change fires, so a flip has to mutate the existing object rather than swap
// the factory.
interface Query {
  matches: boolean
  media: string
  addEventListener: (event: string, handler: () => void) => void
  removeEventListener: () => void
  handlers: (() => void)[]
}

let queries: Map<string, Query>

function setColorScheme(dark: boolean) {
  queries = new Map()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (text: string) => {
      let query = queries.get(text)
      if (!query) {
        query = {
          matches: text.includes('dark') ? dark : !dark,
          media: text,
          handlers: [],
          addEventListener: (_event: string, handler: () => void) =>
            query!.handlers.push(handler),
          removeEventListener: () => {},
        }
        queries.set(text, query)
      }
      return query
    },
  })
}

function flipColorScheme(dark: boolean) {
  act(() => {
    for (const query of queries.values()) {
      query.matches = query.media.includes('dark') ? dark : !dark
      query.handlers.forEach((h) => h())
    }
  })
}

const root = () => document.documentElement

afterEach(() => {
  root().classList.remove('light', 'dark')
  delete root().dataset.appearance
})

describe('ThemeProvider initial appearance', () => {
  it('keeps following the system when the server says the preference is auto', () => {
    // How the server renders auto on a dark desktop: the resolved class AND
    // the preference that produced it.
    setColorScheme(true)
    root().classList.add('dark')
    root().dataset.appearance = 'auto'

    render(<ThemeProvider>{null}</ThemeProvider>)
    expect(root().classList.contains('dark')).toBe(true)

    // The OS goes light. Before the preference was stated, this page was stuck
    // on dark until it was reloaded.
    flipColorScheme(false)
    expect(root().classList.contains('light')).toBe(true)
    expect(root().classList.contains('dark')).toBe(false)
  })

  it('follows the system when auto resolved to light too', () => {
    // The half that always worked — it worked only because an unset class
    // happened to fall through to 'system', not by design.
    setColorScheme(false)
    root().dataset.appearance = 'auto'

    render(<ThemeProvider>{null}</ThemeProvider>)
    expect(root().classList.contains('light')).toBe(true)

    flipColorScheme(true)
    expect(root().classList.contains('dark')).toBe(true)
  })

  it('does not follow the system for an explicit preference', () => {
    // No marker: the user chose dark, and sunrise must not undo that.
    setColorScheme(true)
    root().classList.add('dark')

    render(<ThemeProvider>{null}</ThemeProvider>)
    expect(root().classList.contains('dark')).toBe(true)

    flipColorScheme(false)
    expect(root().classList.contains('dark')).toBe(true)
    expect(root().classList.contains('light')).toBe(false)
  })
})

// The shell used to post one colour-theme message per style property it set,
// 66 for one theme change, and the provider took a new object from each, so
// the whole app re-rendered 66 times. A theme equal to the one held is kept.
describe('ThemeProvider: a colour theme it already holds', () => {
  let parent: { postMessage: () => void; readonly document: never }

  beforeEach(() => {
    parent = {
      postMessage: () => {},
      get document(): never {
        throw new DOMException('Blocked', 'SecurityError')
      },
    }
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => parent,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => window,
    })
  })

  function fromShell(data: unknown) {
    const event = new MessageEvent('message', {
      data,
      origin: window.location.origin,
    })
    Object.defineProperty(event, 'source', {
      value: parent,
      configurable: true,
    })
    window.dispatchEvent(event)
  }

  const THEME = { hue: '250', chroma: '0.1', background: '250' }

  it('re-renders nothing for an equal theme, and once for a new one', async () => {
    setColorScheme(false)
    let renders = 0
    function Consumer() {
      useTheme()
      renders++
      return null
    }
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )
    await act(async () => {
      fromShell({ type: 'color-theme-change', colorTheme: THEME })
    })
    const settled = renders

    await act(async () => {
      for (let i = 0; i < 10; i++)
        fromShell({ type: 'color-theme-change', colorTheme: { ...THEME } })
    })
    expect(renders).toBe(settled)

    await act(async () => {
      fromShell({
        type: 'color-theme-change',
        colorTheme: { ...THEME, hue: '140' },
      })
    })
    expect(renders).toBe(settled + 1)
  })
})
