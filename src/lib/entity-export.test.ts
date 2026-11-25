// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { exportEntityArchive, type EntityArchiveApi } from './entity-export'

const archive = new Blob(['zip'])

function api(rounds: Array<{ remaining: number; failed?: number }>) {
  const warm = vi.fn()
  for (const round of rounds) warm.mockResolvedValueOnce({ data: round })
  return {
    warmExport: warm,
    exportData: vi.fn(async () => archive),
  } satisfies EntityArchiveApi
}

describe('exportEntityArchive', () => {
  it('warms until nothing remains, then exports', async () => {
    const client = api([{ remaining: 3 }, { remaining: 1 }, { remaining: 0 }])
    const result = await exportEntityArchive(client, 'c1')
    expect(client.warmExport).toHaveBeenCalledTimes(3)
    expect(client.exportData).toHaveBeenCalledWith('c1', undefined)
    expect(result).toEqual({ archive, missing: 0 })
  })

  // An earlier round's failures may since have been fetched; only the last
  // round says what the archive goes without.
  it('reports the attachments the last round could not fetch', async () => {
    const client = api([
      { remaining: 2, failed: 4 },
      { remaining: 0, failed: 1 },
    ])
    const result = await exportEntityArchive(client, 'c1')
    expect(result.missing).toBe(1)
  })

  it('counts none missing when the server does not say', async () => {
    const client = api([{ remaining: 0 }])
    expect((await exportEntityArchive(client, 'c1')).missing).toBe(0)
  })
})
