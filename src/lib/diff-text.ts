// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { createTwoFilesPatch, diffWordsWithSpace } from 'diff'
import { parseDiff, type DiffFile } from './diff-parser'

// One piece of a word-level comparison of two lines.
export interface DiffWordChange {
  value: string
  added?: boolean
  removed?: boolean
}

// Below this share of unchanged text, two lines are different lines rather
// than two versions of one line, and marking nearly every word says less than
// marking none.
const WORDS_MINIMUM = 0.3

// The changed words of an edited line and its replacement, or undefined when
// the two have too little in common to be read as one edited line. The view
// draws each side from these pieces, so they have to rebuild both lines
// exactly. The whitespace-keeping comparison does; the plain one moves and
// merges spaces, which in code changes what the line shows.
export function lineWords(
  before: string,
  after: string
): DiffWordChange[] | undefined {
  const changes = diffWordsWithSpace(before, after)
  let common = 0
  for (const change of changes) {
    if (!change.added && !change.removed) common += change.value.trim().length
  }
  const shorter = Math.min(before.trim().length, after.trim().length)
  if (shorter === 0 || common / shorter < WORDS_MINIMUM) return undefined
  return changes
}

export interface CompareOptions {
  /** Unchanged lines kept around each change, or 'all' for the whole text. */
  context?: number | 'all'
  /** Treat lines that differ only in whitespace as unchanged, as `git diff -w`. */
  whitespace?: 'ignore'
  /** Milliseconds to spend before giving up; no limit when left out. */
  timeout?: number
}

// The shared parser reads git's format, which opens each file with this line.
// Every line of the text itself carries a prefix in the patch, so nothing the
// text contains can be taken for a header.
const FILE_HEADER = 'diff --git a/text b/text\n'

// Two versions of one text compared, in the shape the diff view draws:
// undefined when they hold the same text, null when the comparison ran past
// the timeout.
export function compareText(
  before: string,
  after: string,
  options: CompareOptions = {}
): DiffFile | undefined | null {
  const context =
    options.context === 'all' ? Number.MAX_SAFE_INTEGER : (options.context ?? 3)
  const ignore = options.whitespace === 'ignore'
  // The library's own whitespace option only trims each line's ends. Ignoring
  // whitespace the way git does compares the lines with all of it removed,
  // then shows the lines as written: removing whitespace never joins or splits
  // a line, so the numbers still name the same lines.
  const strip = (text: string) =>
    text
      .split('\n')
      .map((line) => line.replace(/\s+/g, ''))
      .join('\n')
  const old = ignore ? strip(before) : before
  const current = ignore ? strip(after) : after
  // Two calls, as the library types them: with a timeout it may give up.
  const patch =
    options.timeout === undefined
      ? createTwoFilesPatch('a/text', 'b/text', old, current, '', '', {
          context,
        })
      : createTwoFilesPatch('a/text', 'b/text', old, current, '', '', {
          context,
          timeout: options.timeout,
        })
  if (patch === undefined) return null
  const file = parseDiff(FILE_HEADER + patch).files[0]
  if (!file || !ignore) return file
  const written = { before: before.split('\n'), after: after.split('\n') }
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'remove' && line.oldNum) {
        line.content = written.before[line.oldNum - 1] ?? line.content
      } else if (line.newNum) {
        line.content = written.after[line.newNum - 1] ?? line.content
      }
    }
  }
  return file
}
