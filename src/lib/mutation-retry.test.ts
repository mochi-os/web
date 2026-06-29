// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import {
  callWithServerFallback,
  getMutationErrorStatus,
} from './mutation-retry'

describe('getMutationErrorStatus', () => {
  it('reads status from plain error objects', () => {
    expect(getMutationErrorStatus({ status: 502 })).toBe(502)
    expect(getMutationErrorStatus({ response: { status: 404 } })).toBe(404)
  })

  it('reads status from Error instances with status', () => {
    const err = Object.assign(new Error('fail'), { status: 403 })
    expect(getMutationErrorStatus(err)).toBe(403)
  })
})

describe('callWithServerFallback', () => {
  it('retries once without server on 502 when server was provided', async () => {
    const call = vi
      .fn<(server?: string) => Promise<string>>()
      .mockRejectedValueOnce({ status: 502 })
      .mockResolvedValueOnce('ok')

    const result = await callWithServerFallback(call, 'https://peer.example')

    expect(result).toBe('ok')
    expect(call).toHaveBeenCalledTimes(2)
    expect(call).toHaveBeenNthCalledWith(1, 'https://peer.example')
    expect(call).toHaveBeenNthCalledWith(2, undefined)
  })

  it('does not retry on 502 when no server was provided', async () => {
    const err = { status: 502 }
    const call = vi.fn<(server?: string) => Promise<string>>().mockRejectedValue(err)

    await expect(callWithServerFallback(call, undefined)).rejects.toBe(err)
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith(undefined)
  })

  it('does not retry non-502 errors', async () => {
    const err = { status: 404 }
    const call = vi.fn<(server?: string) => Promise<string>>().mockRejectedValue(err)

    await expect(
      callWithServerFallback(call, 'https://peer.example'),
    ).rejects.toBe(err)
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith('https://peer.example')
  })

  it('does not retry when the first call succeeds', async () => {
    const call = vi
      .fn<(server?: string) => Promise<string>>()
      .mockResolvedValue('ok')

    const result = await callWithServerFallback(call, 'https://peer.example')

    expect(result).toBe('ok')
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith('https://peer.example')
  })

  it('rethrows the fallback error when the retry fails', async () => {
    const firstErr = { status: 502 }
    const fallbackErr = { status: 500, message: 'fallback failed' }
    const call = vi
      .fn<(server?: string) => Promise<string>>()
      .mockRejectedValueOnce(firstErr)
      .mockRejectedValueOnce(fallbackErr)

    await expect(
      callWithServerFallback(call, 'https://peer.example'),
    ).rejects.toBe(fallbackErr)
    expect(call).toHaveBeenCalledTimes(2)
  })
})
