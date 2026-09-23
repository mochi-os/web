// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { descriptionText, isHtml, textFromHtml } from './html'

describe('isHtml', () => {
  it('sees a tag with a real name', () => {
    expect(isHtml('PNR: 2YHEIJ <br>Class: Business')).toBe(true)
    expect(isHtml('<span style="font-family: x">Ref</span>')).toBe(true)
    expect(isHtml('one</p>')).toBe(true)
    expect(isHtml('<BR/>')).toBe(true)
  })

  it('leaves plain text alone, angle brackets and all', () => {
    for (const text of ['a < b', '<3 you', 'plain\ntext', '<unknown>', '', 'x > y']) {
      expect(isHtml(text)).toBe(false)
    }
  })
})

describe('textFromHtml', () => {
  it('turns breaks into newlines and drops the tags', () => {
    expect(textFromHtml('PNR: 2YHEIJ&nbsp;<br>Class: Business<br>Seats: 2K')).toBe(
      'PNR: 2YHEIJ\nClass: Business\nSeats: 2K'
    )
  })

  it('ends a block with a newline and decodes entities', () => {
    expect(textFromHtml('<p>One &amp; two</p><p>Three &lt; four</p>')).toBe(
      'One & two\nThree < four'
    )
    expect(textFromHtml('<ul><li>A</li><li>B</li></ul>')).toBe('A\nB')
  })

  it('keeps the text of a styled span and nothing of a style or script', () => {
    expect(
      textFromHtml(
        '<span style="font-family: Helvetica; color:#1A1A1A">Ref: 9738995219</span><style>.x{color:red}</style><script>alert(1)</script>'
      )
    ).toBe('Ref: 9738995219')
  })

  it('collapses runs of blank lines and trims', () => {
    expect(textFromHtml('<br><br>Top<br><br><br>Bottom<br>')).toBe('Top\n\nBottom')
  })
})

describe('descriptionText', () => {
  it('reduces HTML and passes plain text through untouched', () => {
    expect(descriptionText('Line one<br>Line two')).toBe('Line one\nLine two')
    expect(descriptionText('a < b\nc > d')).toBe('a < b\nc > d')
  })
})
