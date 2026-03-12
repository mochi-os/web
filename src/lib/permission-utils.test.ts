import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock shell-bridge module before importing permission-utils
vi.mock('./shell-bridge', () => ({
  isInShell: vi.fn(() => false),
  shellRequestPermission: vi.fn(() => Promise.resolve('granted')),
}))

import { isPermissionError, getCurrentAppId, handlePermissionError } from './permission-utils'
import { isInShell, shellRequestPermission } from './shell-bridge'

const mockIsInShell = vi.mocked(isInShell)
const mockShellRequestPermission = vi.mocked(shellRequestPermission)

beforeEach(() => {
  mockIsInShell.mockReturnValue(false)
  mockShellRequestPermission.mockReturnValue(Promise.resolve('granted'))
  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: { pathname: '/feeds/settings', search: '', reload: vi.fn(), href: '' },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// isPermissionError
// =============================================================================

describe('isPermissionError', () => {
  it('detects a permission_required error', () => {
    const result = isPermissionError({
      error: 'permission_required',
      app: 'feeds',
      permission: 'accounts/read',
      restricted: false,
    })
    expect(result).toEqual({
      app: 'feeds',
      permission: 'accounts/read',
      restricted: false,
    })
  })

  it('detects restricted permission error', () => {
    const result = isPermissionError({
      error: 'permission_required',
      app: 'feeds',
      permission: 'user/read',
      restricted: true,
    })
    expect(result).toEqual({
      app: 'feeds',
      permission: 'user/read',
      restricted: true,
    })
  })

  it('returns null for non-permission errors', () => {
    expect(isPermissionError({ error: 'not_found' })).toBeNull()
    expect(isPermissionError({ error: 'forbidden' })).toBeNull()
  })

  it('returns null for missing permission field', () => {
    expect(isPermissionError({ error: 'permission_required' })).toBeNull()
  })

  it('returns null for null/undefined/non-object input', () => {
    expect(isPermissionError(null)).toBeNull()
    expect(isPermissionError(undefined)).toBeNull()
    expect(isPermissionError('string')).toBeNull()
    expect(isPermissionError(42)).toBeNull()
  })

  it('defaults app to empty string when missing', () => {
    const result = isPermissionError({
      error: 'permission_required',
      permission: 'accounts/read',
    })
    expect(result?.app).toBe('')
  })

  it('defaults restricted to false when missing', () => {
    const result = isPermissionError({
      error: 'permission_required',
      permission: 'accounts/read',
    })
    expect(result?.restricted).toBe(false)
  })
})

// =============================================================================
// getCurrentAppId
// =============================================================================

describe('getCurrentAppId', () => {
  it('extracts app ID from pathname', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/feeds/settings', search: '' },
      writable: true,
      configurable: true,
    })
    expect(getCurrentAppId()).toBe('feeds')
  })

  it('handles root path', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', search: '' },
      writable: true,
      configurable: true,
    })
    expect(getCurrentAppId()).toBe('')
  })

  it('handles entity paths', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/repositories/abc123def/-/settings', search: '' },
      writable: true,
      configurable: true,
    })
    expect(getCurrentAppId()).toBe('repositories')
  })
})

// =============================================================================
// handlePermissionError
// =============================================================================

describe('handlePermissionError', () => {
  it('returns false for non-permission errors', () => {
    expect(handlePermissionError({ error: 'not_found' })).toBe(false)
    expect(handlePermissionError(null)).toBe(false)
    expect(handlePermissionError('string')).toBe(false)
  })

  describe('when in shell', () => {
    beforeEach(() => {
      mockIsInShell.mockReturnValue(true)
    })

    it('calls shellRequestPermission for standard permissions', () => {
      const result = handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'accounts/read',
        restricted: false,
      })

      expect(result).toBe(true)
      expect(mockShellRequestPermission).toHaveBeenCalledWith('feeds', 'accounts/read', false)
    })

    it('calls shellRequestPermission for restricted permissions too', () => {
      const result = handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'user/read',
        restricted: true,
      })

      expect(result).toBe(true)
      expect(mockShellRequestPermission).toHaveBeenCalledWith('feeds', 'user/read', true)
    })

    it('uses provided appId when error has no app', () => {
      handlePermissionError(
        { error: 'permission_required', permission: 'accounts/read' },
        'my-app'
      )

      expect(mockShellRequestPermission).toHaveBeenCalledWith('my-app', 'accounts/read', false)
    })

    it('falls back to URL app ID when no app provided', () => {
      handlePermissionError({
        error: 'permission_required',
        permission: 'accounts/read',
      })

      // getCurrentAppId() returns 'feeds' from our mock pathname
      expect(mockShellRequestPermission).toHaveBeenCalledWith('feeds', 'accounts/read', false)
    })

    it('reloads the page when permission is granted', async () => {
      mockShellRequestPermission.mockReturnValue(Promise.resolve('granted'))

      handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'accounts/read',
        restricted: false,
      })

      // Wait for the promise to resolve
      await vi.waitFor(() => {
        expect(window.location.reload).toHaveBeenCalled()
      })
    })

    it('does not reload when permission is denied', async () => {
      mockShellRequestPermission.mockReturnValue(Promise.resolve('denied'))

      handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'accounts/read',
        restricted: false,
      })

      // Wait for promise to settle
      await new Promise((r) => setTimeout(r, 10))
      expect(window.location.reload).not.toHaveBeenCalled()
    })
  })

  describe('when not in shell', () => {
    beforeEach(() => {
      mockIsInShell.mockReturnValue(false)
    })

    it('does not call shellRequestPermission', () => {
      handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'accounts/read',
        restricted: false,
      })

      expect(mockShellRequestPermission).not.toHaveBeenCalled()
    })

    it('returns true for standard permissions', () => {
      const result = handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'accounts/read',
        restricted: false,
      })

      expect(result).toBe(true)
    })

    it('calls onRestricted callback for restricted permissions', () => {
      const onRestricted = vi.fn()

      handlePermissionError(
        {
          error: 'permission_required',
          app: 'feeds',
          permission: 'user/read',
          restricted: true,
        },
        undefined,
        { onRestricted }
      )

      expect(onRestricted).toHaveBeenCalledWith('user/read')
    })

    it('returns true for restricted permissions even without callback', () => {
      const result = handlePermissionError({
        error: 'permission_required',
        app: 'feeds',
        permission: 'user/read',
        restricted: true,
      })

      expect(result).toBe(true)
    })
  })
})
