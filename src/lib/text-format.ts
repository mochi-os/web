// Mochi: parser for the Markdown subset used in short messages
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/*
 * A small Markdown subset for chat-style messages: bold, italic,
 * strikethrough, inline code, fenced code blocks, quotes, bulleted and
 * numbered lists, and links. No headings, tables, images or raw HTML.
 *
 * It is deliberately not a full CommonMark parser. Message bodies were plain
 * text until now, so the rules lean towards leaving text alone:
 *
 * - `*`, `_` and `__` inside a word never format (`snake_case_name`,
 *   `2*3*4`). `**` and `~~` do, as in GFM, so part of a word can be bold or
 *   struck through: the composer's editor writes `un**believ**able`.
 * - A marker needs non-space text right inside it (`* not italic *`).
 * - Unclosed markers and unclosed code fences stay literal.
 * - `>` only starts a quote when a space or the end of the line follows it,
 *   so emoticons such as `>_<` stay text.
 * - `@[Name]` mention tokens are atomic: nothing inside one formats, and a
 *   token always reaches a text node whole, so callers can render it.
 * - Only http, https and mailto links become links; anything else stays as
 *   the literal source text.
 *
 * The output is a plain tree, rendered by components/formatted-text.tsx as
 * React elements. Nothing here produces HTML.
 */

export type FormattedInline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | {
      type: 'strong' | 'emphasis' | 'strike'
      children: FormattedInline[]
    }
  | { type: 'link'; href: string; children: FormattedInline[] }

export type FormattedBlock =
  | { type: 'paragraph'; children: FormattedInline[] }
  | { type: 'code'; text: string }
  | { type: 'quote'; children: FormattedBlock[] }
  | {
      type: 'list'
      ordered: boolean
      start: number
      items: FormattedInline[][]
    }

// Quotes nest by recursion and emphasis by recursion; past this depth the
// rest is left as text, which bounds the work on a hostile body.
const MAX_DEPTH = 8

const FENCE_OPEN = /^ {0,3}```[^`]*$/
const FENCE_CLOSE = /^ {0,3}```\s*$/
const QUOTE_LINE = /^ {0,3}>(?: (.*)|$)/
const BULLET_LINE = /^ {0,3}[-*+] +(\S.*)$/
const NUMBERED_LINE = /^ {0,3}(\d{1,9})[.)] +(\S.*)$/

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * A line of plain text with a backslash before its first character when that
 * character would otherwise start a quote, list or code fence. For writers
 * of this format, so a paragraph that begins `- ` stays a paragraph.
 */
export function escapeBlockStart(line: string): string {
  if (
    QUOTE_LINE.test(line) ||
    BULLET_LINE.test(line) ||
    NUMBERED_LINE.test(line) ||
    FENCE_OPEN.test(line)
  ) {
    // The digits of a numbered line are plain; its dot or bracket is what
    // makes it a list, so that is what gets escaped.
    const numbered = /^( {0,3}\d{1,9})([.)])/.exec(line)
    if (numbered) {
      return numbered[1] + '\\' + line.slice(numbered[1].length)
    }
    const indent = /^ */.exec(line)![0]
    return indent + '\\' + line.slice(indent.length)
  }
  return line
}

/** Parse a message body into blocks. */
export function parseFormattedText(source: string): FormattedBlock[] {
  return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'), 0)
}

function parseBlocks(lines: string[], depth: number): FormattedBlock[] {
  const blocks: FormattedBlock[] = []
  let paragraph: string[] = []

  const flush = () => {
    let start = 0
    let end = paragraph.length
    while (start < end && !paragraph[start].trim()) start++
    while (end > start && !paragraph[end - 1].trim()) end--
    if (start < end) {
      blocks.push({
        type: 'paragraph',
        children: parseInline(paragraph.slice(start, end).join('\n'), depth),
      })
    }
    paragraph = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (FENCE_OPEN.test(line)) {
      let close = i + 1
      while (close < lines.length && !FENCE_CLOSE.test(lines[close])) close++
      if (close < lines.length) {
        flush()
        blocks.push({
          type: 'code',
          text: lines.slice(i + 1, close).join('\n'),
        })
        i = close + 1
        continue
      }
      // Unclosed fence: the line is ordinary text.
    }

    if (depth < MAX_DEPTH && QUOTE_LINE.test(line)) {
      flush()
      const inner: string[] = []
      while (i < lines.length) {
        const match = QUOTE_LINE.exec(lines[i])
        if (!match) break
        inner.push(match[1] ?? '')
        i++
      }
      blocks.push({ type: 'quote', children: parseBlocks(inner, depth + 1) })
      continue
    }

    const bullet = BULLET_LINE.exec(line)
    const numbered = bullet ? null : NUMBERED_LINE.exec(line)
    if (bullet || numbered) {
      flush()
      const ordered = Boolean(numbered)
      const pattern = ordered ? NUMBERED_LINE : BULLET_LINE
      const items: FormattedInline[][] = []
      const start = numbered ? Number(numbered[1]) : 1
      while (i < lines.length) {
        const match = pattern.exec(lines[i])
        if (!match) break
        items.push(parseInline(ordered ? match[2] : match[1], depth))
        i++
      }
      blocks.push({ type: 'list', ordered, start, items })
      continue
    }

    paragraph.push(line)
    i++
  }
  flush()
  return blocks
}

// Characters a backslash may escape, as in CommonMark. A backslash before
// anything else is kept, so a Windows path reads as typed.
const ESCAPABLE = new Set('\\`*_~[]()>#+-.!|{}@'.split(''))

const WORD = /[\p{L}\p{N}]/u
const isWord = (char: string | undefined) =>
  char !== undefined && WORD.test(char)
const isSpace = (char: string | undefined) =>
  char === undefined || /\s/.test(char)

type Delimiter = '**' | '__' | '~~' | '*' | '_'

// Delimiters that may sit inside a word.
const INTRAWORD = new Set<Delimiter>(['**', '~~'])

const DELIMITER_TYPE: Record<Delimiter, 'strong' | 'emphasis' | 'strike'> = {
  '**': 'strong',
  __: 'strong',
  '~~': 'strike',
  '*': 'emphasis',
  _: 'emphasis',
}

/** Parse one paragraph or list item. Exported for tests. */
export function parseInline(source: string, depth = 0): FormattedInline[] {
  const out: FormattedInline[] = []
  let text = ''
  // The first position from which a closer for a delimiter was looked for
  // and not found. A later opener of the same kind cannot find one either,
  // which keeps a body full of stray asterisks linear rather than quadratic.
  const noCloser: Partial<Record<Delimiter, number>> = {}

  const flush = () => {
    if (text) out.push({ type: 'text', text })
    text = ''
  }

  let i = 0
  while (i < source.length) {
    const char = source[i]

    if (char === '\\' && ESCAPABLE.has(source[i + 1])) {
      text += source[i + 1]
      i += 2
      continue
    }

    if (char === '`') {
      const span = matchCodeSpan(source, i)
      if (span) {
        flush()
        out.push({ type: 'code', text: span.text })
        i = span.end
      } else {
        // An unmatched run of backticks is literal as a whole.
        const run = runLength(source, i, '`')
        text += source.slice(i, i + run)
        i += run
      }
      continue
    }

    if (char === '@') {
      const end = mentionEnd(source, i)
      if (end > 0) {
        text += source.slice(i, end)
        i = end
        continue
      }
    }

    if (char === '[') {
      const link = matchLink(source, i)
      if (link) {
        flush()
        out.push({
          type: 'link',
          href: link.href,
          children:
            depth < MAX_DEPTH
              ? parseInline(link.label, depth + 1)
              : [{ type: 'text', text: link.label }],
        })
        i = link.end
        continue
      }
    }

    if (depth < MAX_DEPTH && (char === '*' || char === '_' || char === '~')) {
      const match = matchEmphasis(source, i, noCloser)
      if (match) {
        flush()
        out.push({
          type: DELIMITER_TYPE[match.delimiter],
          children: parseInline(
            source.slice(match.innerStart, match.innerEnd),
            depth + 1
          ),
        })
        i = match.end
        continue
      }
    }

    text += char
    i++
  }
  flush()
  return out
}

function runLength(source: string, start: number, char: string): number {
  let end = start
  while (source[end] === char) end++
  return end - start
}

function matchCodeSpan(
  source: string,
  start: number
): { text: string; end: number } | null {
  const run = runLength(source, start, '`')
  let j = start + run
  while (j < source.length) {
    const close = source.indexOf('`', j)
    if (close < 0) return null
    const closeRun = runLength(source, close, '`')
    if (closeRun === run) {
      let text = source.slice(start + run, close)
      // As in CommonMark, one space inside each end is padding, so a span
      // can start or end with a backtick.
      if (text.length > 1 && text.startsWith(' ') && text.endsWith(' ')) {
        if (text.trim()) text = text.slice(1, -1)
      }
      if (!text) return null
      return { text, end: close + run }
    }
    j = close + closeRun
  }
  return null
}

/** End of an `@[Name]` mention token starting at `start`, or -1. */
function mentionEnd(source: string, start: number): number {
  if (source[start] !== '@' || source[start + 1] !== '[') return -1
  const close = source.indexOf(']', start + 2)
  if (close <= start + 2) return -1
  if (source.slice(start + 2, close).includes('\n')) return -1
  return close + 1
}

/** A span the emphasis closer search must step over whole, or -1. */
function atomicEnd(source: string, start: number): number {
  if (source[start] === '`') {
    const span = matchCodeSpan(source, start)
    return span ? span.end : -1
  }
  if (source[start] === '@') return mentionEnd(source, start)
  return -1
}

function matchLink(
  source: string,
  start: number
): { label: string; href: string; end: number } | null {
  // The label: brackets balance, a backslash escapes, no line break.
  let depth = 0
  let close = -1
  for (let j = start; j < source.length; j++) {
    const char = source[j]
    if (char === '\n') return null
    if (char === '\\') {
      j++
      continue
    }
    if (char === '[') depth++
    else if (char === ']' && --depth === 0) {
      close = j
      break
    }
  }
  if (close < 0 || source[close + 1] !== '(') return null
  const label = source.slice(start + 1, close)
  if (!label.trim()) return null

  // The destination: no spaces, and one level of balanced parentheses so a
  // Wikipedia-style URL survives.
  const match = /^([^\s()]*(?:\([^\s()]*\)[^\s()]*)*)\)/.exec(
    source.slice(close + 2)
  )
  if (!match || !match[1]) return null
  const href = safeHref(match[1])
  if (!href) return null
  return { label, href, end: close + 2 + match[0].length }
}

/** The URL if it is an absolute http, https or mailto link, else null. */
export function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    return LINK_PROTOCOLS.has(parsed.protocol) ? url : null
  } catch {
    return null
  }
}

function matchEmphasis(
  source: string,
  start: number,
  noCloser: Partial<Record<Delimiter, number>>
): {
  delimiter: Delimiter
  innerStart: number
  innerEnd: number
  end: number
} | null {
  const char = source[start]
  const afterWord = isWord(source[start - 1])

  const candidates: Delimiter[] =
    char === '*' ? ['**', '*'] : char === '_' ? ['__', '_'] : ['~~']

  for (const delimiter of candidates) {
    const length = delimiter.length
    if (!source.startsWith(delimiter, start)) continue
    // Only `**` and `~~` may open inside a word.
    if (afterWord && !INTRAWORD.has(delimiter)) continue
    // A single marker must not be half of a double one.
    if (length === 1 && source[start + 1] === char) continue
    const innerStart = start + length
    if (isSpace(source[innerStart])) continue
    const failed = noCloser[delimiter]
    if (failed !== undefined && innerStart >= failed) continue

    const close = findCloser(source, innerStart, delimiter)
    if (close < 0) {
      noCloser[delimiter] = Math.min(failed ?? Infinity, innerStart)
      continue
    }
    return { delimiter, innerStart, innerEnd: close, end: close + length }
  }
  return null
}

function findCloser(
  source: string,
  from: number,
  delimiter: Delimiter
): number {
  const length = delimiter.length
  const char = delimiter[0]
  let j = from
  while (j < source.length) {
    if (source[j] === '\\') {
      j += 2
      continue
    }
    const atomic = atomicEnd(source, j)
    if (atomic > 0) {
      j = atomic
      continue
    }
    if (
      j > from &&
      source.startsWith(delimiter, j) &&
      !isSpace(source[j - 1]) &&
      source[j + length] !== char &&
      (length === 2 || source[j - 1] !== char) &&
      (INTRAWORD.has(delimiter) || !isWord(source[j + length]))
    ) {
      return j
    }
    j++
  }
  return -1
}

/**
 * The body as plain text, markers removed, for one-line previews such as a
 * reply quote. Mention tokens are kept as `@[Name]` for the caller to render.
 */
export function stripFormatting(source: string): string {
  return blocksToText(parseFormattedText(source)).join('\n')
}

function blocksToText(blocks: FormattedBlock[]): string[] {
  const lines: string[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        lines.push(inlineToText(block.children))
        break
      case 'code':
        lines.push(block.text)
        break
      case 'quote':
        lines.push(...blocksToText(block.children))
        break
      case 'list':
        block.items.forEach((item, index) => {
          const marker = block.ordered ? `${block.start + index}. ` : '• '
          lines.push(marker + inlineToText(item))
        })
        break
    }
  }
  return lines
}

function inlineToText(nodes: FormattedInline[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' || node.type === 'code'
        ? node.text
        : inlineToText(node.children)
    )
    .join('')
}
