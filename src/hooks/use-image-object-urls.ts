import { useEffect, useRef } from 'react'

/**
 * Creates object URLs for image files and revokes them on cleanup.
 * Array index matches the input `files` array.
 *
 * URLs are created synchronously during render (keyed by the files array
 * reference) so callers always receive valid URLs in the same render that
 * files changed — no flash, no extra render cycle. Revocation happens when
 * the files reference changes or the component unmounts.
 */
export function useImageObjectUrls(files: readonly File[]): (string | null)[] {
  const prevFilesRef = useRef<readonly File[] | null>(null)
  const urlsRef = useRef<(string | null)[]>([])

  if (prevFilesRef.current !== files) {
    urlsRef.current.forEach((url) => { if (url) URL.revokeObjectURL(url) })
    urlsRef.current = files.map((file) =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    )
    prevFilesRef.current = files
  }

  useEffect(() => {
    return () => {
      // Revoke on unmount; reset refs so Strict Mode remount recreates URLs.
      urlsRef.current.forEach((url) => { if (url) URL.revokeObjectURL(url) })
      urlsRef.current = []
      prevFilesRef.current = null
    }
  }, [])

  return urlsRef.current
}
