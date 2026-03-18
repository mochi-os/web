import { useEffect, useMemo } from 'react'

/**
 * Creates object URLs for image files and revokes them on cleanup.
 * Array index matches the input `files` array.
 */
export function useImageObjectUrls(files: readonly File[]): (string | null)[] {
  const urls = useMemo(
    () =>
      files.map((file) =>
        file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      ),
    [files]
  )

  useEffect(() => {
    return () => {
      urls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [urls])

  return urls
}
