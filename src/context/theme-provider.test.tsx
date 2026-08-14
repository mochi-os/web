// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ThemeProvider } from './theme-provider'

// The server resolves "follow the system" to a class before first paint so the
// page does not flash. That class is a RESOLUTION, not the preference — and
// reading it as the preference is what froze a page loaded while the OS was
// dark, because the change listener only runs for 'system'. The effect was that
// the same stored preference behaved differently depending on the time of day:
// load in daylight and the page followed the OS, load after sunset and it never
// moved again until reload.

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
          addEventListener: (_event: string, handler: () => void) => query!.handlers.push(handler),
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
