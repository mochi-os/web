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

function video(name: string) {
  return new File(['x'], name, { type: 'video/mp4' })
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

  it('maps anything that is not media to null without minting a URL for it', () => {
    const { result } = renderHook(() =>
      useImageObjectUrls([image('a.png'), other('b.pdf')])
    )
    expect(result.current).toEqual(['blob:test/1', null])
    expect(calls.filter((c) => c.kind === 'create')).toHaveLength(1)
  })

  // A staged clip draws a <video> the same way a photo draws an <img>, and the
  // URL points at a local File, so the preview costs nothing to fetch.
  it('mints a URL for video as well as for images', () => {
    const { result } = renderHook(() =>
      useImageObjectUrls([image('a.png'), video('b.mp4'), other('c.pdf')])
    )
    expect(result.current).toEqual(['blob:test/1', 'blob:test/2', null])
  })

  it('revokes a video URL when its file leaves the list', () => {
    const clip = video('b.mp4')
    const { rerender } = renderHook(({ files }) => useImageObjectUrls(files), {
      initialProps: { files: [clip] },
    })

    rerender({ files: [] })

    expect(calls.filter((c) => c.kind === 'revoke').map((c) => c.url)).toEqual([
      'blob:test/1',
    ])
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

  // Drag-to-reorder rebuilds the array on every slot the pointer crosses. If a
  // URL were tied to its position rather than to the File, every image on
  // screen would be handed a new src mid-drag and reload.
  it('keeps each URL with its file when the list is reordered', () => {
    const a = image('a.png')
    const b = image('b.png')
    const { rerender, result } = renderHook(
      ({ files }) => useImageObjectUrls(files),
      { initialProps: { files: [a, b] } }
    )
    expect(result.current).toEqual(['blob:test/1', 'blob:test/2'])

    rerender({ files: [b, a] })

    expect(result.current).toEqual(['blob:test/2', 'blob:test/1'])
    expect(calls.filter((c) => c.kind === 'create')).toHaveLength(2)
    expect(calls.filter((c) => c.kind === 'revoke')).toHaveLength(0)
  })

  it('revokes only the file that was removed', () => {
    const a = image('a.png')
    const b = image('b.png')
    const { rerender, result } = renderHook(
      ({ files }) => useImageObjectUrls(files),
      { initialProps: { files: [a, b] } }
    )

    rerender({ files: [b] })

    expect(result.current).toEqual(['blob:test/2'])
    expect(calls.filter((c) => c.kind === 'revoke').map((c) => c.url)).toEqual([
      'blob:test/1',
    ])
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
