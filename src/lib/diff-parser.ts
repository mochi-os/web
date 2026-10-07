// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

export interface DiffFile {
  path: string
  oldPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: DiffHunk[]
  additions: number
  deletions: number
  /** Binary files carry no hunks — the viewer shows a placeholder instead. */
  isBinary: boolean
  /** Core lists a file over its compare ceiling with a note instead of hunks. */
  skipped: boolean
  /** The ceiling in bytes, when the file was skipped. */
  limit?: number
}

export interface ParsedDiff {
  files: DiffFile[]
  /** Files core left out after its file or size cap; 0 when the diff is complete. */
  truncated: number
}

interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'add' | 'remove' | 'header'
  content: string
  oldNum?: number
  newNum?: number
}

// Unquote a git-quoted path. Git quotes a path holding a space, a quote, a
// control character or a non-ASCII byte, as "..." with C escapes and octal
// bytes, so such a file's header reads `diff --git "a/x" "b/y"`.
function unquote(path: string): string {
  if (path.length < 2 || !path.startsWith('"') || !path.endsWith('"'))
    return path
  const inner = path.slice(1, -1)
  const escapes: Record<string, string> = {
    n: '\n',
    t: '\t',
    r: '\r',
    a: '\x07',
    b: '\b',
    f: '\f',
    v: '\v',
  }
  const encoder = new TextEncoder()
  const bytes: number[] = []
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch !== '\\') {
      bytes.push(...encoder.encode(ch))
      continue
    }
    const next = inner[i + 1] ?? ''
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(inner.slice(i + 1, i + 4), 8))
      i += 3
    } else {
      bytes.push(...encoder.encode(escapes[next] ?? next))
      i += 1
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

// The old and new paths of one file section. The "--- a/x" / "+++ b/y" lines
// carry them unambiguously, where the header line does not: a path holding
// " b/" splits the header at the wrong point. A pure rename has no ---/+++
// lines and names them as "rename from" / "rename to"; the header regex is the
// last resort. Only lines before the first hunk are read - a removed line that
// itself begins "-- " would otherwise look like a "---" marker.
function headerPaths(
  headerLine: string,
  lines: string[]
): { oldPath: string; newPath: string } {
  const hunk = lines.findIndex((l) => l.startsWith('@@'))
  const head = lines.slice(0, hunk === -1 ? lines.length : hunk)
  const marker = (line: string, prefix: string) => {
    const value = unquote(line.trim())
    return value.startsWith(prefix) ? value.slice(prefix.length) : value
  }
  const from = head.find((l) => l.startsWith('--- '))
  const to = head.find((l) => l.startsWith('+++ '))
  if (from && to) {
    const oldPath =
      from.slice(4).trim() === '/dev/null' ? '' : marker(from.slice(4), 'a/')
    const newPath =
      to.slice(4).trim() === '/dev/null' ? oldPath : marker(to.slice(4), 'b/')
    return { oldPath: oldPath || newPath, newPath }
  }
  const renameFrom = head.find((l) => l.startsWith('rename from '))
  const renameTo = head.find((l) => l.startsWith('rename to '))
  if (renameFrom && renameTo) {
    return {
      oldPath: unquote(renameFrom.slice(12).trim()),
      newPath: unquote(renameTo.slice(10).trim()),
    }
  }
  const match = headerLine.match(/^"?a\/(.+?)"? "?b\/(.+?)"?$/)
  const oldPath = match?.[1] || ''
  return { oldPath, newPath: match?.[2] || oldPath }
}

// Parse raw unified diff text into structured file sections
export function parseDiff(raw: string): ParsedDiff {
  const files: DiffFile[] = []
  // The repositories-unavailable answer is an object, not a diff (see
  // DiffResponse); the consumers branch on it, and this is the backstop.
  if (typeof (raw as unknown) !== 'string') {
    return { files, truncated: 0 }
  }

  // Core ends a capped diff with "# diff truncated: N more files". It sits
  // after the last section, where a hunk is still open, so take it out before
  // the sections are split or it would be read as a context line.
  let truncated = 0
  const text = raw.replace(
    /^# diff truncated: (\d+) more files\n?/m,
    (_, count: string) => {
      truncated = parseInt(count, 10)
      return ''
    }
  )
  const fileSections = text.split(/^diff --git /m).filter(Boolean)

  for (const section of fileSections) {
    const lines = section.split('\n')
    const headerLine = lines[0] || ''

    const { oldPath, newPath } = headerPaths(headerLine, lines)

    // Determine status from diff headers
    let status: DiffFile['status'] = 'modified'
    const headerText = lines.slice(0, 6).join('\n')
    if (headerText.includes('new file mode')) {
      status = 'added'
    } else if (headerText.includes('deleted file mode')) {
      status = 'deleted'
    } else if (headerText.includes('rename from')) {
      status = 'renamed'
    }

    // A binary file is encoded as a header plus a single "Binary files … differ"
    // line and no hunks at all, so it cannot be recognised by its hunks.
    const isBinary = lines.some((l) => l.startsWith('Binary files '))

    // A file over the compare ceiling is a header plus "# not compared: over
    // the N byte limit" and no hunks, in place of the comparison.
    const skip = lines.find((l) => l.startsWith('# not compared'))
    const limit = skip?.match(/over the (\d+) byte limit/)?.[1]

    // Parse hunks
    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null
    let oldNum = 0
    let newNum = 0
    let additions = 0
    let deletions = 0

    for (const line of lines) {
      // The trailing "" from splitting on "\n" is never a real hunk line - a
      // blank context line is " " - so skip it rather than render an extra
      // blank row.
      if (line === '') continue
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
        if (match) {
          oldNum = parseInt(match[1], 10)
          newNum = parseInt(match[2], 10)
          currentHunk = {
            header: line,
            lines: [{ type: 'header', content: line }],
          }
          hunks.push(currentHunk)
        }
      } else if (currentHunk) {
        if (line.startsWith('+')) {
          currentHunk.lines.push({
            type: 'add',
            content: line.substring(1),
            newNum: newNum++,
          })
          additions++
        } else if (line.startsWith('-')) {
          currentHunk.lines.push({
            type: 'remove',
            content: line.substring(1),
            oldNum: oldNum++,
          })
          deletions++
        } else if (line.startsWith('\\')) {
          // "\ No newline at end of file" - skip
        } else {
          // Context line (starts with space or is empty within a hunk)
          currentHunk.lines.push({
            type: 'context',
            content: line.substring(1),
            oldNum: oldNum++,
            newNum: newNum++,
          })
        }
      }
    }

    // Keep any section that names a file. Gating on hunks alone silently
    // dropped binary files, so adding an image to a merge request listed
    // nothing — and a binary-only change rendered "No changes to display".
    // A pure rename has no hunks either, and is still a change.
    if (
      hunks.length > 0 ||
      ((isBinary || skip || status === 'renamed') && newPath)
    ) {
      files.push({
        path: newPath,
        oldPath: oldPath !== newPath ? oldPath : undefined,
        status,
        hunks,
        additions,
        deletions,
        isBinary,
        skipped: !!skip,
        limit: limit ? parseInt(limit, 10) : undefined,
      })
    }
  }

  return { files, truncated }
}
