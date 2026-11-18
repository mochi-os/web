// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import {
  escapeBlockStart,
  parseFormattedText,
  parseInline,
  safeHref,
  stripFormatting,
} from './text-format'

const text = (value: string) => ({ type: 'text', text: value })

describe('parseInline', () => {
  it('reads each inline format', () => {
    expect(parseInline('**bold** _italic_ ~~gone~~ `code`')).toEqual([
      { type: 'strong', children: [text('bold')] },
      text(' '),
      { type: 'emphasis', children: [text('italic')] },
      text(' '),
      { type: 'strike', children: [text('gone')] },
      text(' '),
      { type: 'code', text: 'code' },
    ])
  })

  it('reads the alternative markers typed by hand', () => {
    expect(parseInline('*a* __b__')).toEqual([
      { type: 'emphasis', children: [text('a')] },
      text(' '),
      { type: 'strong', children: [text('b')] },
    ])
  })

  it('nests formats', () => {
    expect(parseInline('**bold _and italic_**')).toEqual([
      {
        type: 'strong',
        children: [
          text('bold '),
          { type: 'emphasis', children: [text('and italic')] },
        ],
      },
    ])
    expect(parseInline('***both***')).toEqual([
      {
        type: 'strong',
        children: [{ type: 'emphasis', children: [text('both')] }],
      },
    ])
  })

  it('leaves intraword markers alone', () => {
    expect(parseInline('snake_case_name')).toEqual([text('snake_case_name')])
    expect(parseInline('2*3*4')).toEqual([text('2*3*4')])
    expect(parseInline('a__b__c')).toEqual([text('a__b__c')])
    // Only the opener is inside a word here, so the closer alone allows it.
    expect(parseInline('file_name and more_')).toEqual([
      text('file_name and more_'),
    ])
    expect(parseInline('x*y z*')).toEqual([text('x*y z*')])
  })

  it('lets bold and strikethrough cover part of a word', () => {
    expect(parseInline('un**believ**able')).toEqual([
      text('un'),
      { type: 'strong', children: [text('believ')] },
      text('able'),
    ])
    expect(parseInline('re~~do~~ne')).toEqual([
      text('re'),
      { type: 'strike', children: [text('do')] },
      text('ne'),
    ])
  })

  it('needs text right inside a marker', () => {
    expect(parseInline('* not italic *')).toEqual([text('* not italic *')])
    expect(parseInline('** **')).toEqual([text('** **')])
  })

  it('leaves unclosed markers literal', () => {
    expect(parseInline('**open')).toEqual([text('**open')])
    expect(parseInline('`open')).toEqual([text('`open')])
    expect(parseInline('~single~')).toEqual([text('~single~')])
  })

  it('does not format inside code', () => {
    expect(parseInline('`**x**`')).toEqual([{ type: 'code', text: '**x**' }])
    expect(parseInline('`` a ` b ``')).toEqual([
      { type: 'code', text: 'a ` b' },
    ])
  })

  it('keeps a mention token whole, even with markers in the name', () => {
    expect(parseInline('hi @[a_b_c] there')).toEqual([
      text('hi @[a_b_c] there'),
    ])
    expect(parseInline('**@[Ann Lee]**')).toEqual([
      { type: 'strong', children: [text('@[Ann Lee]')] },
    ])
    expect(parseInline('_x @[a_] y_')).toEqual([
      { type: 'emphasis', children: [text('x @[a_] y')] },
    ])
  })

  it('honours backslash escapes', () => {
    expect(parseInline('\\*not\\*')).toEqual([text('*not*')])
    expect(parseInline('C:\\Users')).toEqual([text('C:\\Users')])
  })

  it('reads links with safe schemes only', () => {
    expect(parseInline('[site](https://example.com/a_(b))')).toEqual([
      {
        type: 'link',
        href: 'https://example.com/a_(b)',
        children: [text('site')],
      },
    ])
    expect(parseInline('[**x**](mailto:a@b.c)')).toEqual([
      {
        type: 'link',
        href: 'mailto:a@b.c',
        children: [{ type: 'strong', children: [text('x')] }],
      },
    ])
    expect(parseInline('[x](javascript:alert(1))')).toEqual([
      text('[x](javascript:alert(1))'),
    ])
    expect(parseInline('[x](/relative)')).toEqual([text('[x](/relative)')])
    expect(parseInline('[](https://a.b)')).toEqual([text('[](https://a.b)')])
  })

  it('stays fast on a body full of stray markers', () => {
    const body = '*a '.repeat(3000) + '_b '.repeat(3000)
    const started = performance.now()
    parseInline(body)
    expect(performance.now() - started).toBeLessThan(500)
  })
})

describe('parseFormattedText', () => {
  it('keeps plain text as one paragraph with its line breaks', () => {
    expect(parseFormattedText('one\ntwo\n\nthree')).toEqual([
      { type: 'paragraph', children: [text('one\ntwo\n\nthree')] },
    ])
  })

  it('reads bulleted and numbered lists', () => {
    expect(parseFormattedText('- a\n- **b**\n\n3. c\n4. d')).toEqual([
      {
        type: 'list',
        ordered: false,
        start: 1,
        items: [[text('a')], [{ type: 'strong', children: [text('b')] }]],
      },
      {
        type: 'list',
        ordered: true,
        start: 3,
        items: [[text('c')], [text('d')]],
      },
    ])
  })

  it('does not read a bare dash or a number with no text as a list', () => {
    expect(parseFormattedText('-\n- \n-5 degrees')).toEqual([
      { type: 'paragraph', children: [text('-\n- \n-5 degrees')] },
    ])
  })

  it('reads quotes, with blocks inside', () => {
    expect(parseFormattedText('> said\n> - item\nafter')).toEqual([
      {
        type: 'quote',
        children: [
          { type: 'paragraph', children: [text('said')] },
          { type: 'list', ordered: false, start: 1, items: [[text('item')]] },
        ],
      },
      { type: 'paragraph', children: [text('after')] },
    ])
  })

  it('does not read an emoticon as a quote', () => {
    expect(parseFormattedText('>_< oh')).toEqual([
      { type: 'paragraph', children: [text('>_< oh')] },
    ])
  })

  it('reads fenced code blocks verbatim', () => {
    expect(parseFormattedText('```ts\nconst a = **b**\n  indent\n```')).toEqual(
      [{ type: 'code', text: 'const a = **b**\n  indent' }]
    )
  })

  it('leaves an unclosed fence as text', () => {
    expect(parseFormattedText('```\ncode')).toEqual([
      { type: 'paragraph', children: [text('```\ncode')] },
    ])
  })

  it('drops blank lines around blocks', () => {
    expect(parseFormattedText('a\n\n- b\n\nc')).toEqual([
      { type: 'paragraph', children: [text('a')] },
      { type: 'list', ordered: false, start: 1, items: [[text('b')]] },
      { type: 'paragraph', children: [text('c')] },
    ])
  })
})

describe('stripFormatting', () => {
  it('removes markers and keeps mention tokens', () => {
    expect(
      stripFormatting(
        '**Hi** @[Ann], see [docs](https://a.b)\n> `x`\n- one\n2. two'
      )
    ).toBe('Hi @[Ann], see docs\nx\n• one\n2. two')
  })
})

describe('escapeBlockStart', () => {
  it('escapes only lines that would start a block', () => {
    expect(escapeBlockStart('- item')).toBe('\\- item')
    expect(escapeBlockStart('> said')).toBe('\\> said')
    expect(escapeBlockStart('12. twelve')).toBe('12\\. twelve')
    expect(escapeBlockStart('```js')).toBe('\\```js')
    expect(escapeBlockStart('-5 degrees')).toBe('-5 degrees')
    expect(escapeBlockStart('>_<')).toBe('>_<')
    for (const line of ['- item', '> said', '12. twelve', '```js']) {
      expect(stripFormatting(escapeBlockStart(line))).toBe(line)
    }
  })
})

describe('safeHref', () => {
  it('allows http, https and mailto only', () => {
    expect(safeHref('https://a.b')).toBe('https://a.b')
    expect(safeHref('http://a.b')).toBe('http://a.b')
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,x')).toBeNull()
    expect(safeHref('nope')).toBeNull()
  })
})
