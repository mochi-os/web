// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, it, expect } from 'vitest'
import { parseDiff } from './diff-parser'

const hunk =
  'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,2 +1,2 @@\n-old\n+new\n context\n'
const large =
  'diff --git a/big.bin b/big.bin\n# not compared: over the 1048576 byte limit\n'
const binary =
  'diff --git a/i.png b/i.png\nBinary files a/i.png and b/i.png differ\n'

describe('parseDiff', () => {
  it('takes quoted paths from the --- and +++ markers, unescaped', () => {
    const quoted =
      'diff --git "a/caf\\303\\251 one.txt" "b/caf\\303\\251 one.txt"\n' +
      '--- "a/caf\\303\\251 one.txt"\n+++ "b/caf\\303\\251 one.txt"\n@@ -1 +1 @@\n-x\n+y\n'
    const { files } = parseDiff(quoted)
    expect(files.map((f) => f.path)).toEqual(['caf\u00e9 one.txt'])
  })

  it("does not split a path holding ' b/' at the header", () => {
    const spaced =
      'diff --git a/src/a b/c.ts b/src/a b/c.ts\n--- a/src/a b/c.ts\n+++ b/src/a b/c.ts\n@@ -1 +1 @@\n-x\n+y\n'
    const { files } = parseDiff(spaced)
    expect(files.map((f) => f.path)).toEqual(['src/a b/c.ts'])
  })

  it('reads a pure rename from its rename lines', () => {
    const renamed =
      'diff --git a/old name.ts b/new name.ts\nsimilarity index 100%\nrename from old name.ts\nrename to new name.ts\n'
    const { files } = parseDiff(renamed)
    expect(files[0].path).toBe('new name.ts')
    expect(files[0].status).toBe('renamed')
  })

  it('ignores a removed line that begins with three dashes', () => {
    const tricky =
      'diff --git a/n.md b/n.md\n--- a/n.md\n+++ b/n.md\n@@ -1 +1 @@\n--- not a marker\n+kept\n'
    const { files } = parseDiff(tricky)
    expect(files[0].path).toBe('n.md')
  })

  it('answers an empty result for the repositories-unavailable object', () => {
    const answer = { diff: null, error: 'unavailable' } as unknown as string
    expect(parseDiff(answer)).toEqual({ files: [], truncated: 0 })
  })

  it('keeps a file core did not compare, with the ceiling it names', () => {
    const { files, truncated } = parseDiff(hunk + large)
    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'big.bin'])
    expect(files[1]).toMatchObject({
      skipped: true,
      limit: 1048576,
      hunks: [],
      additions: 0,
      deletions: 0,
      isBinary: false,
    })
    expect(files[0].skipped).toBe(false)
    expect(truncated).toBe(0)
  })

  it('reports the truncation count and keeps the marker out of the last hunk', () => {
    const { files, truncated } = parseDiff(
      hunk + '# diff truncated: 12 more files\n'
    )
    expect(truncated).toBe(12)
    expect(files).toHaveLength(1)
    const contents = files[0].hunks[0].lines.map((l) => l.content)
    expect(contents.some((c) => c.includes('diff truncated'))).toBe(false)
    expect(contents).toHaveLength(4)
  })

  it('reports a diff that is nothing but the marker', () => {
    expect(parseDiff('# diff truncated: 3 more files\n')).toEqual({
      files: [],
      truncated: 3,
    })
  })

  it('keeps a binary file, and a complete diff reports no truncation', () => {
    const { files, truncated } = parseDiff(binary + hunk)
    expect(files.map((f) => [f.path, f.isBinary, f.skipped])).toEqual([
      ['i.png', true, false],
      ['src/a.ts', false, false],
    ])
    expect(truncated).toBe(0)
  })
})
