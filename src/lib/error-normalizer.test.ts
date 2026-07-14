// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Tests for error-normalizer. The Mochi server's respond_error helper
// returns { error: <machine-readable code>, message: <localized
// human-readable string> } - the localizer should surface the message
// for display while preserving the code for callers that switch on it.
// Bug pinned: previously the extractor returned the code as the message
// because it short-circuited on the error field, so users saw raw
// labels like "username_taken" instead of the localized text.
//
// The tests below cover the matrix of payload shapes the extractor has
// to handle and assert no regression on shapes that don't match the
// Mochi envelope (handlers that haven't yet adopted respond_error).

import { describe, it, expect } from 'vitest'
import { normalizeError } from './error-normalizer'

function axios(status: number, data: unknown) {
  return { response: { status, data } }
}

describe('normalizeError', () => {
  // ===== The Mochi error envelope: { error, message }. This is the
  // bug-fix path - message must win for display.

  it('prefers localized message over error code when both are present', () => {
    const e = axios(409, {
      error: 'username_taken',
      message: 'Email already in use',
    })
    const n = normalizeError(e)
    expect(n.message).toBe('Email already in use')
    expect(n.code).toBe('username_taken')
    expect(n.status).toBe(409)
  })

  it('preserves code so callers can switch on it', () => {
    const e = axios(403, {
      error: 'signup_disabled',
      message: 'New user signup is disabled.',
    })
    expect(normalizeError(e).code).toBe('signup_disabled')
  })

  it('handles the same envelope nested under data', () => {
    const e = axios(409, {
      data: {
        error: 'username_taken',
        message: 'Email already in use',
      },
    })
    const n = normalizeError(e)
    expect(n.message).toBe('Email already in use')
    expect(n.code).toBe('username_taken')
  })

  // ===== Backwards compatibility: handlers that haven't yet adopted
  // respond_error return only one field. Behaviour must not regress for
  // those.

  it('falls back to error as message when message is absent', () => {
    const e = axios(400, { error: 'invalid_request' })
    const n = normalizeError(e)
    expect(n.message).toBe('invalid_request')
    expect(n.code).toBe('invalid_request')
  })

  it('uses message as message when error is absent', () => {
    const e = axios(500, { message: 'Internal server error' })
    const n = normalizeError(e)
    expect(n.message).toBe('Internal server error')
    expect(n.code).toBeUndefined()
  })

  it('uses title when neither error nor message is present', () => {
    const e = axios(404, { title: 'Not Found' })
    expect(normalizeError(e).message).toBe('Not Found')
  })

  it('uses nested data.error when present and no top-level error/message', () => {
    const e = axios(400, { data: { error: 'bad_request' } })
    const n = normalizeError(e)
    expect(n.message).toBe('bad_request')
    expect(n.code).toBe('bad_request')
  })

  it('uses nested data.message when nested data has only message', () => {
    const e = axios(500, { data: { message: 'Database unavailable' } })
    expect(normalizeError(e).message).toBe('Database unavailable')
  })

  // ===== Edge cases that must keep working.

  it('falls back to the supplied fallback when payload is empty', () => {
    const e = axios(503, {})
    expect(normalizeError(e, 'Try again later').message).toBe('Try again later')
  })

  it('handles string error directly', () => {
    expect(normalizeError('Network error').message).toBe('Network error')
  })

  it('handles raw Error object', () => {
    const e = new Error('Something went wrong')
    expect(normalizeError(e).message).toBe('Something went wrong')
  })

  it('handles axios timeout (no response field)', () => {
    const e = { message: 'timeout of 30000ms exceeded' }
    expect(normalizeError(e).message).toBe('timeout of 30000ms exceeded')
  })

  // ===== Status-error envelope: { status: 4xx/5xx, error: <code>,
  // message: <localized> } - some app endpoints wrap response with an
  // explicit status field. Same preference rule applies.

  it('status-error envelope prefers message when present', () => {
    const e = axios(200, {
      status: 409,
      error: 'username_taken',
      message: 'Email already in use',
    })
    const n = normalizeError(e)
    expect(n.message).toBe('Email already in use')
    expect(n.code).toBe('username_taken')
  })

  it('status-error envelope falls back to error when message absent', () => {
    const e = axios(200, {
      status: 409,
      error: 'username_taken',
    })
    const n = normalizeError(e)
    expect(n.message).toBe('username_taken')
    expect(n.code).toBe('username_taken')
  })

  // ===== Make sure status is surfaced.

  it('surfaces HTTP status', () => {
    const e = axios(409, { error: 'x', message: 'X' })
    expect(normalizeError(e).status).toBe(409)
  })
})
