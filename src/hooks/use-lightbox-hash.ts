// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LightboxMedia } from '../components/ui/image-lightbox'

type UseLightboxHashOptions = {
  hashPrefix?: string
}

type UseLightboxHashReturn = {
  open: boolean
  currentIndex: number
  openLightbox: (index: number) => void
  closeLightbox: () => void
  setCurrentIndex: (index: number) => void
}

// Syncs lightbox state with URL hash for shareable links and back button support
export function useLightboxHash(
  images: LightboxMedia[],
  options: UseLightboxHashOptions = {}
): UseLightboxHashReturn {
  const { hashPrefix = 'attachment' } = options
  const [open, setOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Parse hash to get attachment ID
  const parseHash = useCallback(() => {
    const hash = window.location.hash.slice(1) // Remove #
    const prefix = `${hashPrefix}-`
    if (hash.startsWith(prefix)) {
      return hash.slice(prefix.length)
    }
    return null
  }, [hashPrefix])

  // Find index of image by ID
  const findIndexById = useCallback(
    (id: string) => {
      return images.findIndex((img) => img.id === id)
    },
    [images]
  )

  // Update hash without triggering navigation
  const updateHash = useCallback(
    (id: string | null) => {
      const base = window.location.pathname + window.location.search
      if (id) {
        const newHash = `#${hashPrefix}-${id}`
        if (window.location.hash !== newHash) {
          window.history.pushState(null, '', base + newHash)
        }
      } else {
        if (window.location.hash) {
          window.history.pushState(null, '', base)
        }
      }
    },
    [hashPrefix]
  )

  // Open lightbox to a specific index
  const openLightbox = useCallback(
    (index: number) => {
      if (index >= 0 && index < images.length) {
        setCurrentIndex(index)
        setOpen(true)
        updateHash(images[index].id)
      }
    },
    [images, updateHash]
  )

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setOpen(false)
    updateHash(null)
  }, [updateHash])

  // Change current index while open
  const handleSetCurrentIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < images.length) {
        setCurrentIndex(index)
        updateHash(images[index].id)
      }
    },
    [images, updateHash]
  )

  // Handle initial hash on mount and images change
  useEffect(() => {
    const id = parseHash()
    if (id && images.length > 0) {
      const index = findIndexById(id)
      if (index >= 0) {
        // Delay opening to avoid flash during initial render
        requestAnimationFrame(() => {
          setCurrentIndex(index)
          setOpen(true)
        })
      }
    }
  }, [images, parseHash, findIndexById])

  // Handle back/forward button (hashchange event)
  useEffect(() => {
    const handleHashChange = () => {
      const id = parseHash()
      if (id) {
        const index = findIndexById(id)
        if (index >= 0) {
          setCurrentIndex(index)
          setOpen(true)
        } else {
          setOpen(false)
        }
      } else {
        setOpen(false)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [parseHash, findIndexById])

  return {
    open,
    currentIndex,
    openLightbox,
    closeLightbox,
    setCurrentIndex: handleSetCurrentIndex,
  }
}
