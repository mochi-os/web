// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { File, FileText, Image, Video } from 'lucide-react'

// Get appropriate icon component for content type
export function getFileIcon(type: string) {
  if (isImage(type)) return Image
  // Video answered with the generic file icon, so a clip that had no preview
  // yet was indistinguishable from an archive.
  if (isVideo(type)) return Video
  if (type.startsWith('text/')) return FileText
  return File
}

// Check if content type is an image
export function isImage(type: string): boolean {
  return type.startsWith('image/')
}

// Check if content type is a video
export function isVideo(type: string): boolean {
  return type.startsWith('video/')
}

export function isMedia(type: string): boolean {
  return isImage(type) || isVideo(type)
}

// Keys are handed out per File object and remembered here, so the same file
// answers the same key for as long as it is staged and two files never share
// one. Weak, so a key costs nothing once the composer has let the file go.
const pendingKeys = new WeakMap<globalThis.File, string>()
let pendingKeyCount = 0

/**
 * Stable React key for a pending File, keyed on object identity rather than
 * name, size and timestamp: the pickers allow the same file twice, and
 * colliding keys duplicate or omit a tile.
 */
export function pendingFileKey(file: globalThis.File): string {
  const known = pendingKeys.get(file)
  if (known !== undefined) return known

  pendingKeyCount += 1
  const key = `pending-${pendingKeyCount}`
  pendingKeys.set(file, key)
  return key
}

/**
 * What makes two picks the same file to a person. `pendingFileKey` deliberately
 * does not answer this.
 */
export function pendingFileSignature(file: globalThis.File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/**
 * Remove one pending file by object identity: removing the second of two
 * identical picks has to take the second, and matching on metadata took the
 * first.
 */
export function removePendingFile(
  files: globalThis.File[],
  target: globalThis.File
): globalThis.File[] {
  let removed = false
  return files.filter((file) => {
    if (!removed && file === target) {
      removed = true
      return false
    }
    return true
  })
}

/**
 * Why an attachment's bytes failed to load, judged by asking the server —
 * an <img>'s error event carries no status, so 404 and 503 look identical
 * until something fetches the same URL and reads the answer.
 *
 * 'unavailable' means the bytes may exist but cannot be served right now:
 * the server said 502/503/504 (its source host is unreachable — it retries
 * after a backoff), or the probe itself could not reach the server. A retry
 * later may simply work. Everything else — 404 above all — is 'missing':
 * the server answered, and the bytes are not to be had.
 */
export async function classifyAttachmentFailure(
  url: string
): Promise<'unavailable' | 'missing'> {
  try {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return 'unavailable'
    }
    return 'missing'
  } catch {
    return 'unavailable'
  }
}
