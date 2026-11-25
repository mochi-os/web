// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A container's full backup archive, as Export data and Duplicate both take it.

import type { EntityTransferOptions } from './entity-api'

/** The two createEntityApi calls an archive export makes. */
export interface EntityArchiveApi {
  warmExport: (
    entityId: string,
    options?: Pick<EntityTransferOptions, 'signal'>
  ) => Promise<{ data?: { remaining: number; failed?: number } | null }>
  exportData: (
    entityId: string,
    options?: EntityTransferOptions
  ) => Promise<Blob>
}

/** The archive, and how many attachments it lacks. */
export interface EntityArchive {
  archive: Blob
  /** Attachments whose bytes could not be fetched, which the export leaves out. */
  missing: number
}

/**
 * Warm the server's attachment cache, then download the archive.
 *
 * A remote container fetches attachment bytes over P2P in bounded server
 * rounds of up to a minute each, so the cache is warmed until nothing remains
 * (at most 120 rounds) before the export, or a large one would time out. The
 * last round's failures are the attachments the export cannot include.
 */
export async function exportEntityArchive(
  api: EntityArchiveApi,
  entityId: string,
  options?: EntityTransferOptions
): Promise<EntityArchive> {
  let missing = 0
  for (let round = 0; round < 120; round++) {
    const warm = await api.warmExport(entityId, { signal: options?.signal })
    missing = warm.data?.failed ?? 0
    if (!warm.data || warm.data.remaining === 0) break
  }
  return { archive: await api.exportData(entityId, options), missing }
}
