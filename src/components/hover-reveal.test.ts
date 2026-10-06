// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// Asserted against the source: jsdom evaluates neither hover nor
// `(hover: none)`, so a rendered test would pass whether the classes are there
// or not.
//
// A control hidden until the row is hovered never appears on a touch screen,
// which has no hover, and a keyboard user tabs onto it invisibly. Every
// hover reveal in the library must also reveal on touch and on focus.

const ROOT = resolve(__dirname, '..')

const HIDE = /(?:^|\s)(opacity-0|hidden|invisible|pointer-events-none)(?=\s|$)/
const HOVER_REVEAL = /(?:^|\s)group-hover(?:\/[\w-]+)?:/
const TOUCH_REVEAL = /\[@media\(hover:none\)\]:|pointer-coarse:/
const KEYBOARD_REVEAL = /focus-visible:|focus-within:|group-focus-within/

// Each entry is a file whose hover reveals are exempt, and why.
const EXEMPT: Record<string, string> = {
  // A tap sets data-active on the bubble, which reveals the labels.
  'components/action-pill.tsx': 'touch reveal via group-data-[active=true]',
  // Message times: decoration, nothing to press.
  'components/game/game-chat-message-list.tsx': 'decoration only',
  // The drag grip: decoration, and its touch reveal is a separate cn() argument.
  'components/tree-row.tsx': 'decoration only',
}

interface Reveal {
  file: string
  line: number
  classes: string
}

function sources(): string[] {
  return readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
    .filter(
      (path) => path.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(path)
    )
    .map((path) => join(ROOT, path))
}

function reveals(): Reveal[] {
  const found: Reveal[] = []
  for (const path of sources()) {
    const source = readFileSync(path, 'utf8')
    for (const match of source.matchAll(/(['"`])((?:(?!\1).)*?)\1/g)) {
      const classes = match[2]
      if (!HIDE.test(classes) || !HOVER_REVEAL.test(classes)) continue
      found.push({
        file: relative(ROOT, path),
        line: source.slice(0, match.index).split('\n').length,
        classes,
      })
    }
  }
  return found
}

describe('hover reveals', () => {
  const all = reveals()
  const checked = all.filter((reveal) => !(reveal.file in EXEMPT))

  it('finds the reveals it is meant to check', () => {
    // A broken pattern would otherwise pass by finding nothing.
    expect(
      all.some((reveal) => reveal.file === 'components/member-list.tsx')
    ).toBe(true)
  })

  it('also reveal on a touch screen', () => {
    const missing = checked
      .filter((reveal) => !TOUCH_REVEAL.test(reveal.classes))
      .map((reveal) => `${reveal.file}:${reveal.line}`)
    expect(missing).toEqual([])
  })

  it('also reveal on keyboard focus', () => {
    const missing = checked
      .filter((reveal) => !KEYBOARD_REVEAL.test(reveal.classes))
      .map((reveal) => `${reveal.file}:${reveal.line}`)
    expect(missing).toEqual([])
  })

  it('reveal display:none controls through a focusable sibling', () => {
    // An element with `hidden` cannot take focus, so focus-visible on it
    // never fires. Its group has to show it when something else in the
    // group is focused.
    const missing = checked
      .filter(
        (reveal) =>
          /(?:^|\s)hidden(?=\s|$)/.test(reveal.classes) &&
          !/group-focus-within/.test(reveal.classes)
      )
      .map((reveal) => `${reveal.file}:${reveal.line}`)
    expect(missing).toEqual([])
  })
})
