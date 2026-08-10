// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { pendingFileSignature } from './attachment-utils'

/**
 * Appends only the files that are not already staged.
 *
 * Picking or dropping the same file twice stages it twice and uploads it twice,
 * which is never what was meant. Matching is on the signature, not the React
 * key: the key is per File object precisely so a duplicate that gets past here
 * still renders, and asking it this question would find nothing. Returns `prev`
 * untouched when every incoming file was a duplicate, so the preview object
 * URLs keyed off the array reference are not rebuilt for nothing.
 */
export function mergePendingFiles(prev: File[], incoming: File[]): File[] {
  const added = newPendingFiles(prev, incoming)
  return added.length > 0 ? [...prev, ...added] : prev
}

/**
 * Which of a pick is not staged already, in the order it was picked.
 *
 * The same question `mergePendingFiles` answers, for the composers that cannot
 * use it: the edit forms hold saved attachments and new files in one list, so
 * there is no `File[]` to merge into. They pass the new files they are already
 * holding and wrap what comes back themselves.
 */
export function newPendingFiles(staged: File[], incoming: File[]): File[] {
  const seen = new Set(staged.map(pendingFileSignature))
  return incoming.filter((file) => {
    const signature = pendingFileSignature(file)
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}
