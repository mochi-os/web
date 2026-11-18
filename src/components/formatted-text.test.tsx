// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormattedText } from './formatted-text'

describe('FormattedText', () => {
  it('renders each format as its element', () => {
    const { container } = render(
      <FormattedText
        text={
          '**b** _i_ ~~s~~ `c` [l](https://a.b)\n> q\n- one\n3. three\n```\npre\n```'
        }
      />
    )
    expect(container.querySelector('strong')?.textContent).toBe('b')
    expect(container.querySelector('em')?.textContent).toBe('i')
    expect(container.querySelector('s')?.textContent).toBe('s')
    expect(container.querySelector('p code')?.textContent).toBe('c')
    expect(container.querySelector('blockquote')?.textContent).toBe('q')
    expect(container.querySelector('ul li')?.textContent).toBe('one')
    expect(container.querySelector('ol')?.getAttribute('start')).toBe('3')
    expect(container.querySelector('pre code')?.textContent).toBe('pre')

    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('https://a.b')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('never renders markup from the text', () => {
    const { container } = render(
      <FormattedText
        text={'<img src=x onerror=alert(1)> [x](javascript:alert(1))'}
      />
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe(
      '<img src=x onerror=alert(1)> [x](javascript:alert(1))'
    )
  })

  it('passes plain runs to renderText, marking code', () => {
    const calls: [string, boolean][] = []
    render(
      <FormattedText
        text={'**hi @[Ann]** `x`'}
        renderText={(text, { code }) => {
          calls.push([text, code])
          return text
        }}
      />
    )
    expect(calls).toEqual([
      ['hi @[Ann]', false],
      [' ', false],
      ['x', true],
    ])
  })
})
