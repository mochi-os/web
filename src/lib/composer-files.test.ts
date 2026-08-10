// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { mergePendingFiles, newPendingFiles } from './composer-files'

function pick(name: string, size = 10, lastModified = 1_700_000_000_000): File {
  const file = new File(['x'.repeat(size)], name, { type: 'image/png' })
  Object.defineProperty(file, 'lastModified', { value: lastModified })
  return file
}

describe('mergePendingFiles', () => {
  it('appends files that are not staged yet', () => {
    const staged = [pick('a.png')]
    const b = pick('b.png')

    expect(mergePendingFiles(staged, [b])).toEqual([staged[0], b])
  })

  // The picker resets its value so the same file can be chosen again, which is
  // what makes this reachable at all.
  it('ignores a second pick of a file already staged', () => {
    const staged = [pick('photo.png')]

    expect(mergePendingFiles(staged, [pick('photo.png')])).toBe(staged)
  })

  it('keeps only the first of two identical files in one pick', () => {
    const first = pick('photo.png')

    const merged = mergePendingFiles([], [first, pick('photo.png')])

    expect(merged).toEqual([first])
  })

  it('takes files that only share a name', () => {
    const staged = [pick('photo.png', 10)]
    const bigger = pick('photo.png', 20)

    expect(mergePendingFiles(staged, [bigger])).toHaveLength(2)
  })
})

// The edit forms hold saved attachments and new files in one list, so they
// cannot merge File arrays. They ask which of a pick is new and wrap the answer
// themselves.
describe('newPendingFiles', () => {
  it('returns the files that are not staged yet', () => {
    const staged = [pick('a.png')]
    const b = pick('b.png')

    expect(newPendingFiles(staged, [b])).toEqual([b])
  })

  it('drops a pick that is already staged', () => {
    expect(newPendingFiles([pick('photo.png')], [pick('photo.png')])).toEqual([])
  })

  it('drops a repeat inside one pick', () => {
    const first = pick('photo.png')

    expect(newPendingFiles([], [first, pick('photo.png')])).toEqual([first])
  })
})
