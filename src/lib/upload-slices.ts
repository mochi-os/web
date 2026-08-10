// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Per-file progress derived from one aggregate byte counter.
 *
 * A send is a single multipart POST carrying every file, so axios reports one
 * `loaded` for the whole body and there are no per-file events to read. The
 * files are appended to the FormData in array order, which is the order they
 * sit in the body, so walking a cumulative sum of their sizes against the
 * counter says which one is on the wire and how far into it.
 *
 * `sent` counts bytes handed to the socket, not bytes the server has taken. On
 * a fast link every slice can read `sent` well before the response arrives —
 * which is why the terminal state here is `sent` and not `done`. The
 * `processing` phase on `Upload` remains the only thing that says the server is
 * still working, and only the response says the files were stored.
 */

export type UploadSliceState = 'waiting' | 'uploading' | 'sent'

export interface UploadSlice {
  /** 0..1 of this file's own bytes. */
  fraction: number
  state: UploadSliceState
}

/**
 * Split an aggregate byte count across the files that make up the body.
 *
 * Returns null when there is nothing to derive from — an unknown body size, no
 * files, or files that are all empty. Callers fall back to the aggregate bar
 * alone, which is what they showed before per-file progress existed.
 */
export function uploadSlices(
  sent: number,
  total: number | null,
  sizes: readonly number[]
): UploadSlice[] | null {
  if (total == null || total <= 0 || sizes.length === 0) return null

  const payload = sizes.reduce((a, b) => a + b, 0)
  if (payload <= 0) return null

  // The body is larger than the files: it also carries the text fields and a
  // boundary preamble per part. Scaling the counter by the ratio spreads that
  // overhead evenly instead of modelling where it actually falls. It is off by
  // at most the total overhead — a couple of hundred bytes per part — and it is
  // self-correcting, so the last file reaches 1 exactly when sent === total.
  // Modelling the framing byte-for-byte would depend on the browser's boundary
  // generation and header casing, and would drift the moment either changed.
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
