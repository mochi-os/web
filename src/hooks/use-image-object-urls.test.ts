// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The property under test is ORDER: the replacement URLs must exist before the
// ones they replace are torn down. Revoking while rendering can invalidate a
// URL the committed tree is still displaying, which shows up as broken images;
// revoking in effect cleanup cannot, because the replacement has committed by
// the time it runs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useImageObjectUrls } from './use-image-object-urls'

type Call = { kind: 'create' | 'revoke'; url: string }

let calls: Call[]
let counter: number

function image(name: string) {
  return new File(['x'], name, { type: 'image/png' })
}

function other(name: string) {
  return new File(['x'], name, { type: 'application/pdf' })
}

beforeEach(() => {
  calls = []
  counter = 0
  // jsdom implements neither, so both are stubbed rather than spied.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => {
      const url = `blob:test/${++counter}`
      calls.push({ kind: 'create', url })
      return url
    },
    revokeObjectURL: (url: string) => {
      calls.push({ kind: 'revoke', url })
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useImageObjectUrls', () => {
  it('returns a URL per image, synchronously on first render', () => {
    const { result } = renderHook(({ files }) => useImageObjectUrls(files), {
      initialProps: { files: [image('a.png'), image('b.png')] },
    })

    // Positive control: URLs are available in the render that produced them,
    // which is the property the hook exists to provide and the reason its work
    // is not simply moved into an effect.
    expect(result.current).toEqual(['blob:test/1', 'blob:test/2'])
    expect(calls.filter((c) => c.kind === 'create')).toHaveLength(2)
  })

  it('maps a non-image to null without minting a URL for it', () => {
    const { result } = renderHook(() =>
      useImageObjectUrls([image('a.png'), other('b.pdf')])
    )
    expect(result.current).toEqual(['blob:test/1', null])
    expect(calls.filter((c) => c.kind === 'create')).toHaveLength(1)
  })

  it('creates the replacements BEFORE revoking what they replace', () => {
    const first = [image('a.png')]
    const { rerender } = renderHook(({ files }) => useImageObjectUrls(files), {
      initialProps: { files: first },
    })

    rerender({ files: [image('b.png')] })

    // Revoking during render puts the revoke first; revoking in effect cleanup
    // puts it after the replacement has been created and committed.
    const creates = calls.map((c, i) => ({ ...c, i })).filter((c) => c.kind === 'create')
    const revokes = calls.map((c, i) => ({ ...c, i })).filter((c) => c.kind === 'revoke')

    expect(creates.map((c) => c.url)).toEqual(['blob:test/1', 'blob:test/2'])
    expect(revokes.map((c) => c.url)).toEqual(['blob:test/1'])
    expect(revokes[0].i).toBeGreaterThan(creates[1].i)
  })

  it('does not recreate URLs when handed the same files array', () => {
    const files = [image('a.png')]
    const { rerender, result } = renderHook(({ files }) => useImageObjectUrls(files), {
      initialProps: { files },
    })

    rerender({ files })
    rerender({ files })

    expect(calls.filter((c) => c.kind === 'create')).toHaveLength(1)
    expect(calls.filter((c) => c.kind === 'revoke')).toHaveLength(0)
    expect(result.current).toEqual(['blob:test/1'])
  })

  it('revokes everything on unmount', () => {
    const { unmount } = renderHook(() =>
      useImageObjectUrls([image('a.png'), image('b.png')])
    )
    expect(calls.filter((c) => c.kind === 'revoke')).toHaveLength(0)

    unmount()

    expect(calls.filter((c) => c.kind === 'revoke').map((c) => c.url)).toEqual([
      'blob:test/1',
      'blob:test/2',
    ])
  })
})
