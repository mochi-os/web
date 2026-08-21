// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Per-file progress from one aggregate byte counter: the send is a single
 * multipart POST, so a cumulative sum of the file sizes against `loaded` says
 * which file is on the wire. `sent` counts bytes handed to the socket, not
 * bytes the server stored.
 */

export type UploadSliceState = 'waiting' | 'uploading' | 'sent'

export interface UploadSlice {
  /** 0..1 of this file's own bytes. */
  fraction: number
  state: UploadSliceState
}

/**
 * Split an aggregate byte count across the files in the body. Null when there
 * is nothing to derive from - unknown body size, no files, all empty - and
 * callers fall back to the aggregate bar.
 */
export function uploadSlices(
  sent: number,
  total: number | null,
  sizes: readonly number[]
): UploadSlice[] | null {
  if (total == null || total <= 0 || sizes.length === 0) return null

  const payload = sizes.reduce((a, b) => a + b, 0)
  if (payload <= 0) return null

  // The body is larger than the files: text fields and a boundary preamble per
  // part. Scaling by the ratio spreads that overhead evenly and self-corrects,
  // so the last file reaches 1 exactly when sent === total.
  const effective = Math.min(Math.max(sent, 0) * (payload / total), payload)

  let consumed = 0
  let claimed = false

  return sizes.map((size): UploadSlice => {
    const start = consumed
    consumed += size

    // An empty file has no bytes to wait for, so it is never the one in
    // flight — it is sent the moment the counter reaches its position.
    if (effective >= consumed) return { fraction: 1, state: 'sent' }

    // Exactly one file is on the wire: the first that is not fully sent. On a
    // boundary that is the next file at zero, not the finished one at 1.
    if (!claimed) {
      claimed = true
      const fraction = size > 0 ? Math.max(0, (effective - start) / size) : 0
      return { fraction, state: 'uploading' }
    }

    return { fraction: 0, state: 'waiting' }
  })
}
