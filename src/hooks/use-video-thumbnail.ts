// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'

// Formats duration in seconds to mm:ss or h:mm:ss
export function formatVideoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

type ThumbnailState = {
  url: string | null
  loading: boolean
  error: boolean
  duration: number | null
}

// Captures a thumbnail frame from a video URL using the browser's video decoder
export function useVideoThumbnail(
  videoUrl: string | null,
  seekTime: number = 2
): ThumbnailState {
  const [state, setState] = useState<ThumbnailState>({
    url: null,
    loading: true,
    error: false,
    duration: null,
  })

  useEffect(() => {
    if (!videoUrl) {
      setState({ url: null, loading: false, error: false, duration: null })
      return
    }

    setState({ url: null, loading: true, error: false, duration: null })

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    let cancelled = false

    const handleLoadedMetadata = () => {
      if (cancelled) return
      // Seek to requested time, or near the start if video is short
      const targetTime = Math.min(seekTime, video.duration * 0.1, video.duration - 0.1)
      video.currentTime = Math.max(0, targetTime)
    }

    const handleSeeked = () => {
      if (cancelled) return

      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setState({ url: null, loading: false, error: true, duration: null })
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

        setState({ url: dataUrl, loading: false, error: false, duration: video.duration })
      } catch {
        setState({ url: null, loading: false, error: true, duration: null })
      } finally {
        video.src = ''
        video.load()
      }
    }

    const handleError = () => {
      if (cancelled) return
      setState({ url: null, loading: false, error: true, duration: null })
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('error', handleError)

    // Ensure absolute URL for video element
    const absoluteUrl = videoUrl.startsWith('http')
      ? videoUrl
      : `${window.location.origin}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`
    video.src = absoluteUrl

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
      video.src = ''
      video.load()
    }
  }, [videoUrl, seekTime])

  return state
}

// Cache for storing generated thumbnails to avoid re-generating
const thumbnailCache = new Map<string, { url: string; duration: number }>()

// Generates a video thumbnail with caching
export function useVideoThumbnailCached(
  videoUrl: string | null,
  seekTime: number = 2
): ThumbnailState {
  const [state, setState] = useState<ThumbnailState>(() => {
    if (videoUrl && thumbnailCache.has(videoUrl)) {
      const cached = thumbnailCache.get(videoUrl)!
      return { url: cached.url, loading: false, error: false, duration: cached.duration }
    }
    return { url: null, loading: !!videoUrl, error: false, duration: null }
  })

  useEffect(() => {
    if (!videoUrl) {
      setState({ url: null, loading: false, error: false, duration: null })
      return
    }

    // Skip data URLs or suspiciously long URLs (likely encoded data)
    if (videoUrl.startsWith('data:') || videoUrl.length > 2000) {
      setState({ url: null, loading: false, error: true, duration: null })
      return
    }

    // Check cache first
    if (thumbnailCache.has(videoUrl)) {
      const cached = thumbnailCache.get(videoUrl)!
      setState({ url: cached.url, loading: false, error: false, duration: cached.duration })
      return
    }

    setState({ url: null, loading: true, error: false, duration: null })

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    let cancelled = false

    const handleLoadedMetadata = () => {
      if (cancelled) return
      const targetTime = Math.min(seekTime, video.duration * 0.1, video.duration - 0.1)
      video.currentTime = Math.max(0, targetTime)
    }

    const handleSeeked = () => {
      if (cancelled) return

      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setState({ url: null, loading: false, error: true, duration: null })
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const duration = video.duration

        // Cache the result
        thumbnailCache.set(videoUrl, { url: dataUrl, duration })

        setState({ url: dataUrl, loading: false, error: false, duration })
      } catch {
        setState({ url: null, loading: false, error: true, duration: null })
      } finally {
        // Remove listeners before clearing src to avoid spurious error events
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('seeked', handleSeeked)
        video.removeEventListener('error', handleError)
        video.src = ''
        video.load()
      }
    }

    const handleError = () => {
      if (cancelled) return
      setState({ url: null, loading: false, error: true, duration: null })
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('error', handleError)

    // Ensure absolute URL for video element
    const absoluteUrl = videoUrl.startsWith('http')
      ? videoUrl
      : `${window.location.origin}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`
    video.src = absoluteUrl

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
      video.src = ''
      video.load()
    }
  }, [videoUrl, seekTime])

  return state
}
