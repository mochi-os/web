// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toastAction } from './toast-action'

const shown = vi.hoisted(() => ({
  loading: vi.fn(() => 'pending'),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('./toast-utils', () => ({ toast: shown }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toastAction', () => {
  it('shows a failure as an error toast', async () => {
    await expect(
      toastAction(Promise.reject(new Error('refused')), {
        loading: 'Creating...',
        error: () => 'Failed',
      })
    ).rejects.toThrow('refused')
    expect(shown.dismiss).toHaveBeenCalledWith('pending')
    expect(shown.error).toHaveBeenCalledWith('Failed', undefined)
  })

  it('shows no error toast where the caller answers the failure itself', async () => {
    // THE POINT: a chat refusal opens its own view, and a toast beside it
    // would say the same thing twice.
    await expect(
      toastAction(Promise.reject(new Error('refused')), {
        loading: 'Creating...',
        error: () => false,
      })
    ).rejects.toThrow('refused')
    expect(shown.dismiss).toHaveBeenCalledWith('pending')
    expect(shown.error).not.toHaveBeenCalled()
  })
})
