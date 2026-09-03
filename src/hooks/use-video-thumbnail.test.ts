// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useVideoThumbnailCached } from './use-video-thumbnail'

// jsdom decodes no video, so the element is a stub that lets the test fire
// the two events the hook listens for.
type Listener = () => void
type FakeVideo = {
  listeners: Map<string, Listener>
  addEventListener: (name: string, fn: Listener) => void
  removeEventListener: (name: string) => void
  load: () => void
  src: string
  preload: string
  muted: boolean
  playsInline: boolean
  currentTime: number
  duration: number
  videoWidth: number
  videoHeight: number
}

const videos: FakeVideo[] = []

function fakeVideo(): FakeVideo {
  const listeners = new Map<string, Listener>()
  const video: FakeVideo = {
    listeners,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    load: () => {},
    src: '',
    preload: '',
    muted: false,
    playsInline: false,
    currentTime: 0,
    duration: 30,
    videoWidth: 16,
    videoHeight: 9,
  }
  videos.push(video)
  return video
}

let thumbnails = 0

describe('useVideoThumbnailCached', () => {
  beforeEach(() => {
    videos.length = 0
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'video' ? (fakeVideo() as unknown as HTMLElement) : create(tag)
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      () => `data:image/jpeg;base64,${++thumbnails}`
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Drive one URL through decode so its thumbnail lands in the cache.
  function generate(url: string) {
    const rendered = renderHook(() => useVideoThumbnailCached(url))
    const video = videos.at(-1)!
    act(() => {
      video.listeners.get('loadedmetadata')?.()
      video.listeners.get('seeked')?.()
    })
    const state = rendered.result.current
    rendered.unmount()
    return state
  }

  it('answers a repeat request from the cache without decoding again', () => {
    const state = generate('/videos/a.mp4')
    expect(state.loading).toBe(false)
    expect(state.url).toMatch(/^data:image\/jpeg/)
    const decodes = videos.length

    const again = renderHook(() => useVideoThumbnailCached('/videos/a.mp4'))
    expect(again.result.current).toMatchObject({ loading: false, url: state.url })
    expect(videos.length).toBe(decodes)
  })

  it('bounds the cache: the oldest thumbnail is dropped once the cap is passed', () => {
    const cap = 200
    for (let i = 0; i < cap + 1; i++) {
      generate(`/videos/bounded-${i}.mp4`)
    }
    // The newest entry is cached...
    const newest = renderHook(() => useVideoThumbnailCached(`/videos/bounded-${cap}.mp4`))
    expect(newest.result.current.loading).toBe(false)
    // ...and the oldest has been evicted, so it decodes afresh.
    const oldest = renderHook(() => useVideoThumbnailCached('/videos/bounded-0.mp4'))
    expect(oldest.result.current.loading).toBe(true)
    expect(oldest.result.current.url).toBeNull()
  })
})
