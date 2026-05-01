'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Download, FileWarning, ImageOff, Loader2, X } from 'lucide-react'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { cn } from '../../lib/utils'
import { t } from '@lingui/core/macro'

export type LightboxMedia = {
  id: string
  name: string
  url: string
  type: 'image' | 'video'
}

// Legacy type alias for backwards compatibility
export type LightboxImage = LightboxMedia

type ImageLightboxProps = {
  images: LightboxMedia[]
  currentIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
}

// Displays images and videos in a full-screen lightbox with navigation controls
export function ImageLightbox({
  images,
  currentIndex,
  open,
  onOpenChange,
  onIndexChange,
}: ImageLightboxProps) {
  const hasMultiple = images.length > 1
  const currentMedia = images[currentIndex]
  const isVideo = currentMedia?.type === 'video'

  // Track media loading and error state
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const [currentScale, setCurrentScale] = useState(1)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  // Reset loading/error state, zoom, and pause video when media changes
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    setCurrentScale(1)
    setNaturalSize(null)
    // Reset zoom to default
    if (transformRef.current) {
      transformRef.current.resetTransform()
    }
    // Pause any playing video when navigating away
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }, [currentIndex])

  // Handle double-click to toggle between fit-to-screen and 1:1 pixel scale
  const handleDoubleClick = useCallback(() => {
    if (!transformRef.current || !imgRef.current || !naturalSize) return

    const img = imgRef.current
    const displayedWidth = img.clientWidth
    const displayedHeight = img.clientHeight

    // Calculate scale needed to show image at 1:1 (1 image pixel = 1 screen pixel)
    const scaleForWidth = naturalSize.width / displayedWidth
    const scaleForHeight = naturalSize.height / displayedHeight
    const oneToOneScale = Math.max(scaleForWidth, scaleForHeight)

    // Toggle between 1x and 1:1 scale
    if (currentScale < oneToOneScale - 0.1) {
      // Zoom to 1:1
      transformRef.current.centerView(oneToOneScale, 300)
    } else {
      // Reset to fit
      transformRef.current.resetTransform(300)
    }
  }, [naturalSize, currentScale])

  // Preload adjacent images for smoother navigation (skip videos)
  useEffect(() => {
    if (!open || images.length <= 1) return

    const preload = (index: number) => {
      const media = images[index]
      if (media.type === 'image') {
        const img = new Image()
        img.src = media.url
      }
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0

    preload(prevIndex)
    preload(nextIndex)
  }, [open, currentIndex, images])

  const goToPrevious = useCallback(() => {
    onIndexChange(currentIndex > 0 ? currentIndex - 1 : images.length - 1)
  }, [currentIndex, images.length, onIndexChange])

  const goToNext = useCallback(() => {
    onIndexChange(currentIndex < images.length - 1 ? currentIndex + 1 : 0)
  }, [currentIndex, images.length, onIndexChange])

  // Handle keyboard navigation (capture phase so Escape fires before parent dialog handlers)
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onOpenChange(false)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [open, goToPrevious, goToNext, onOpenChange])

  // Handle controls visibility with auto-hide
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const HIDE_DELAY = 3000

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, HIDE_DELAY)
  }, [])

  // Set up activity listeners for showing controls
  useEffect(() => {
    if (!open) return

    showControls()

    const handleActivity = () => showControls()

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('touchstart', handleActivity)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [open, showControls])

  // Handle swipe gestures for mobile
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const SWIPE_THRESHOLD = 50

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return

      // Don't navigate when zoomed in - allow panning instead
      if (currentScale > 1) {
        touchStartX.current = null
        touchStartY.current = null
        return
      }

      const deltaX = e.changedTouches[0].clientX - touchStartX.current
      const deltaY = e.changedTouches[0].clientY - touchStartY.current

      // Only trigger if horizontal swipe is dominant and exceeds threshold
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX > 0) {
          goToPrevious()
        } else {
          goToNext()
        }
      }

      touchStartX.current = null
      touchStartY.current = null
    },
    [goToPrevious, goToNext, currentScale]
  )

  if (!currentMedia) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className='fixed inset-0 z-[60] bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0' />
        <DialogPrimitive.Content
          className='fixed inset-0 z-[60] outline-none'
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className='sr-only'>
            {isVideo ? "Video" : "Image"} viewer: {currentMedia.name}
          </DialogPrimitive.Title>

          {/* Full-screen media area */}
          <div
            className='flex h-full w-full items-center justify-center'
            onTouchStart={hasMultiple ? handleTouchStart : undefined}
            onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
          >
            {isLoading && !hasError && (
              <Loader2 className='absolute size-8 animate-spin text-white/70' />
            )}
            {hasError ? (
              <div className='flex flex-col items-center gap-3 text-white/70'>
                {isVideo ? <FileWarning className='size-12' /> : <ImageOff className='size-12' />}
                <span className='text-sm'>Failed to load {isVideo ? 'video' : 'image'}</span>
              </div>
            ) : isVideo ? (
              <video
                ref={videoRef}
                src={currentMedia.url}
                controls
                autoPlay
                className={cn(
                  'max-h-full max-w-full transition-opacity duration-200',
                  isLoading ? 'opacity-0' : 'opacity-100'
                )}
                onLoadedData={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                }}
              />
            ) : (
              <div onDoubleClick={handleDoubleClick} className='h-full w-full'>
                <TransformWrapper
                  ref={transformRef}
                  initialScale={1}
                  minScale={1}
                  maxScale={8}
                  centerOnInit
                  doubleClick={{ disabled: true }}
                  onTransformed={(_, state) => setCurrentScale(state.scale)}
                >
                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <img
                      ref={imgRef}
                      src={currentMedia.url}
                      alt={currentMedia.name}
                      className={cn(
                        'max-h-full max-w-full object-contain transition-opacity duration-200',
                        isLoading ? 'opacity-0' : 'opacity-100'
                      )}
                      onLoad={(e) => {
                        const img = e.currentTarget
                        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
                        setIsLoading(false)
                      }}
                      onError={() => {
                        setIsLoading(false)
                        setHasError(true)
                      }}
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            )}
          </div>

          {/* Top bar overlay with filename, counter, and controls */}
          <div
            className={cn(
              'absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/50 px-4 py-2 text-white transition-opacity duration-300',
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <span className='min-w-0 truncate text-sm text-white/70'>
              {hasMultiple && <>{currentIndex + 1}/{images.length} · </>}
              {currentMedia.name}
            </span>
            <div className='flex shrink-0 items-center gap-1 text-white/70'>
              <a
                href={currentMedia.url}
                download={currentMedia.name}
                className='rounded-full p-2 transition-colors hover:bg-white/20 hover:text-white'
                title={t`Download`}
              >
                <Download className='size-5' />
              </a>
              <DialogPrimitive.Close className='rounded-full p-2 outline-none transition-colors hover:bg-white/20 hover:text-white'>
                <X className='size-5' />
                <span className='sr-only'><Trans>Close</Trans></span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Navigation buttons */}
          {hasMultiple && (
            <>
              <button
                onClick={goToPrevious}
                className={cn(
                  'absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/70 transition-all duration-300 hover:bg-black/70 hover:text-white sm:left-4 sm:p-3',
                  controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                aria-label={t`Previous image`}
              >
                <ChevronLeft className='size-6 sm:size-8 rtl:rotate-180' />
              </button>
              <button
                onClick={goToNext}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/70 transition-all duration-300 hover:bg-black/70 hover:text-white sm:right-4 sm:p-3',
                  controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                aria-label={t`Next image`}
              >
                <ChevronRight className='size-6 sm:size-8 rtl:rotate-180' />
              </button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
