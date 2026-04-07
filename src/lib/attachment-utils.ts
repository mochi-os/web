import { File, FileText, Image } from 'lucide-react'

// Format file size in human readable format
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
