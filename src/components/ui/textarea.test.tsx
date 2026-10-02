// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Textarea } from './textarea'

// jsdom lays nothing out, so the box's measurements are given: 96px of
// content and padding inside a 1px border on each side.
function measure(scroll: number, border: number) {
  const prototype = HTMLTextAreaElement.prototype
  const restore = ['scrollHeight', 'offsetHeight', 'clientHeight'].map(
    (name) => [name, Object.getOwnPropertyDescriptor(prototype, name)] as const
  )
  Object.defineProperty(prototype, 'scrollHeight', {
    configurable: true,
    get: () => scroll,
  })
  Object.defineProperty(prototype, 'clientHeight', {
    configurable: true,
    get: () => 40,
  })
  Object.defineProperty(prototype, 'offsetHeight', {
    configurable: true,
    get: () => 40 + border,
  })
  return () => {
    for (const [name, descriptor] of restore) {
      if (descriptor) Object.defineProperty(prototype, name, descriptor)
      else delete (prototype as unknown as Record<string, unknown>)[name]
    }
  }
}

let restore: (() => void) | null = null
afterEach(() => {
  restore?.()
  restore = null
})

describe('Textarea', () => {
  it('grows to its content and its border, so it does not scroll', () => {
    restore = measure(96, 2)
    const { container } = render(
      <Textarea value={'one\ntwo\nthree\nfour'} onChange={() => {}} />
    )
    expect(container.querySelector('textarea')!.style.height).toBe('98px')
  })
})
