// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { File, FileText, Image } from 'lucide-react'

// Get appropriate icon component for content type
export function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image
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

/** Stable React key for a pending File before upload. */
export function pendingFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/** Remove one matching pending file without relying on array index. */
export function removePendingFile(files: File[], target: File): File[] {
  const key = pendingFileKey(target)
  let removed = false
  return files.filter((file) => {
    if (!removed && pendingFileKey(file) === key) {
      removed = true
      return false
    }
    return true
  })
}
