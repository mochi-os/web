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

/**
 * Images and video: the attachments that render as a preview rather than as a
 * named row. One predicate rather than the pair spelled out at each site, so
 * the composer and the gallery cannot come to disagree about which block an
 * attachment belongs in.
 */
export function isMedia(type: string): boolean {
  return isImage(type) || isVideo(type)
}

// Keys are handed out per File object and remembered here, so the same file
// answers the same key for as long as it is staged and two files never share
// one. Weak, so a key costs nothing once the composer has let the file go.
const pendingKeys = new WeakMap<globalThis.File, string>()
let pendingKeyCount = 0

/**
 * Stable React key for a pending File before upload.
 *
 * Identity, not metadata: the pickers reset the input so the same file can be
 * chosen twice, and two picks are two File objects with the same name, size and
 * timestamp. Keyed on those three they collided, which React answers by
 * duplicating or omitting a tile — and a colliding key also gave the drag two
 * tiles it could not tell apart.
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
 * What makes two picks the same file to a person: the name, the size and the
 * timestamp. This is the question `mergePendingFiles` asks, and it is the one
 * `pendingFileKey` deliberately does not answer.
 */
export function pendingFileSignature(file: globalThis.File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/**
 * Remove one pending file without relying on array index.
 *
 * By identity: removing the second of two identical picks has to take the
 * second, and matching on metadata always took the first.
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
