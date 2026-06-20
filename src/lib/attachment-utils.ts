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
