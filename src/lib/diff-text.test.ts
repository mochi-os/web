// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import { compareText, lineWords } from './diff-text'

describe('compareText', () => {
  const lines = (
    before: string,
    after: string,
    options?: Parameters<typeof compareText>[2]
  ) =>
    compareText(before, after, options)?.hunks.flatMap((hunk) =>
      hunk.lines
        .filter((line) => line.type !== 'header')
        .map((line) => [line.type, line.content])
    )

  const page = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`)
  const edited = [...page]
  edited[14] = 'changed'
  const before = page.join('\n') + '\n'
  const after = edited.join('\n') + '\n'

  it('keeps the whole text as context when asked', () => {
    const file = compareText(before, after, { context: 'all' })
    expect(file?.hunks).toHaveLength(1)
    expect(file?.additions).toBe(1)
    expect(file?.deletions).toBe(1)
    // 29 unchanged lines, one removed and one added.
    expect(lines(before, after, { context: 'all' })).toHaveLength(31)
  })

  it('keeps three lines either side of a change by default', () => {
    expect(lines(before, after)).toHaveLength(3 + 2 + 3)
  })

  it('keeps as many lines as asked', () => {
    expect(lines(before, after, { context: 10 })).toHaveLength(10 + 2 + 10)
  })

  it('numbers the lines of each side', () => {
    const file = compareText('one\ntwo\n', 'one\n2\nthree\n')
    const rows = file?.hunks[0].lines.filter((line) => line.type !== 'header')
    expect(rows).toEqual([
      { type: 'context', content: 'one', oldNum: 1, newNum: 1 },
      { type: 'remove', content: 'two', oldNum: 2 },
      { type: 'add', content: '2', newNum: 2 },
      { type: 'add', content: 'three', newNum: 3 },
    ])
  })

  it('reads text that looks like diff markup as plain lines', () => {
    const markup =
      'diff --git a/x b/x\n--- a rule\n# diff truncated: 3 more files\n'
    expect(lines(markup, markup + 'new\n', { context: 'all' })).toEqual([
      ['context', 'diff --git a/x b/x'],
      ['context', '--- a rule'],
      ['context', '# diff truncated: 3 more files'],
      ['add', 'new'],
    ])
  })

  it('keeps blank lines', () => {
    expect(lines('a\n\nb\n', 'a\n\nc\n')).toEqual([
      ['context', 'a'],
      ['context', ''],
      ['remove', 'b'],
      ['add', 'c'],
    ])
  })

  it('has nothing to show for two versions with the same text', () => {
    expect(compareText('same\n', 'same\n')).toBeUndefined()
  })

  // git diff -w: spacing inside a line counts for nothing, not only at its
  // ends, which is all the diff library's own option ignores.
  it('ignores a change in spacing anywhere in a line', () => {
    expect(
      compareText('if (a  &&  b) {\n', 'if (a && b) {\n', {
        whitespace: 'ignore',
      })
    ).toBeUndefined()
  })

  it('shows the lines as written when ignoring whitespace', () => {
    expect(
      lines('  keep  this\nold\n', 'keep this\nnew\n', {
        whitespace: 'ignore',
      })
    ).toEqual([
      ['context', 'keep this'],
      ['remove', 'old'],
      ['add', 'new'],
    ])
  })

  it('gives up past the timeout rather than holding the page', () => {
    const many = (prefix: string) =>
      Array.from({ length: 40000 }, (_, i) => `${prefix}${i}`).join('\n')
    expect(compareText(many('l'), many('m'), { timeout: 50 })).toBeNull()
  })
})

describe('lineWords', () => {
  const side = (
    changes: ReturnType<typeof lineWords>,
    drop: 'added' | 'removed'
  ) =>
    changes
      ?.filter((change) => !change[drop])
      .map((change) => change.value)
      .join('')

  it('marks only the words that changed in an edited line', () => {
    const changes = lineWords(
      'Mochi runs on a single server.',
      'Mochi runs on a small server.'
    )
    expect(changes?.filter((c) => c.removed).map((c) => c.value)).toEqual([
      'single',
    ])
    expect(changes?.filter((c) => c.added).map((c) => c.value)).toEqual([
      'small',
    ])
  })

  // The view draws each side from these pieces. The plain word comparison
  // rebuilt '    if (a  &&  b) {' as '    if (a &&  b) {'.
  it('rebuilds each side exactly, spacing included', () => {
    for (const [before, after] of [
      ['One  two   three four five', 'One  two   3 four five'],
      ['    if (a  &&  b) {', '    if (a && c) {'],
      ['\treturn foo(x,   y)', '\treturn bar(x, y)'],
    ]) {
      const changes = lineWords(before, after)
      expect(side(changes, 'added')).toBe(before)
      expect(side(changes, 'removed')).toBe(after)
    }
  })

  it('declines two lines with little in common', () => {
    expect(
      lineWords('Install from git.', 'Requirements are listed below.')
    ).toBeUndefined()
  })
})
