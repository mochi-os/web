// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Two picks of the same file are two distinct File objects carrying identical
// metadata, and the pickers deliberately allow the second pick. Everything here
// is about telling those two apart.

import { describe, it, expect } from 'vitest'
import { pendingFileKey, removePendingFile } from './attachment-utils'

function pick(name: string, size = 10, lastModified = 1_700_000_000_000): File {
  const file = new File(['x'.repeat(size)], name, { type: 'image/png' })
  Object.defineProperty(file, 'lastModified', { value: lastModified })
  return file
}

describe('removePendingFile', () => {
  it('removes the file that was asked for, not the first that looks like it', () => {
    const first = pick('photo.png')
    const second = pick('photo.png')

    const left = removePendingFile([first, second], second)

    expect(left).toHaveLength(1)
    expect(left[0]).toBe(first)
  })

  it('removes only one entry when the same file object is staged twice', () => {
    const file = pick('photo.png')

    expect(removePendingFile([file, file], file)).toHaveLength(1)
  })

  it('leaves the list alone when the file is not in it', () => {
    const staged = [pick('a.png'), pick('b.png')]

    expect(removePendingFile(staged, pick('c.png'))).toEqual(staged)
  })
})

describe('pendingFileKey', () => {
  it('gives two separate picks of the same file two separate keys', () => {
    expect(pendingFileKey(pick('photo.png'))).not.toBe(
      pendingFileKey(pick('photo.png'))
    )
  })

  it('answers the same key every time for one file', () => {
    const file = pick('photo.png')

    expect(pendingFileKey(file)).toBe(pendingFileKey(file))
  })
})
