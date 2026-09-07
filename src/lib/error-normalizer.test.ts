// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The Mochi envelope is { error: <code>, message: <localized text> }: message
// wins for display, the code survives for callers that switch on it. Handlers
// that send only one field must keep working.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { i18n } from '@lingui/core'
import { normalizeError, detectHtmlResponse, GENERIC_ERROR_MESSAGE } from './error-normalizer'

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

  // ===== Handlers that predate respond_error return only one field.

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

// A path naming no action falls through to the SPA catch-all, which answers
// 200 with index.html. Two apps had independently worked around that (the
// repositories client and the wikis page component) before the shared response
// interceptor started rejecting it.
describe('detectHtmlResponse', () => {
  const indexHtml = '<!doctype html>\n<html><head><title>Feeds</title></head><body><div id="root"></div></body></html>'

  it('detects a served SPA document and takes its title', () => {
    expect(detectHtmlResponse(indexHtml)).toEqual({ detail: 'Feeds' })
  })

  it('prefers the pre block, which carries the server-side cause', () => {
    const errorPage = '<!doctype html><html><head><title>Error</title></head><body><pre>no such action</pre></body></html>'
    expect(detectHtmlResponse(errorPage)).toEqual({ detail: 'no such action' })
  })

  it('withholds the server-side cause outside development', () => {
    // The <pre> on a Go panic page is a stack trace with filesystem paths in
    // it, and the response interceptor shows the detail to the user. In
    // production the detection must still fire - an HTML body where JSON was
    // expected is the signal callers act on - but carry nothing.
    const panic = '<!doctype html><html><head><title>Error</title></head><body>' +
      '<pre>runtime error: index out of range\n\t/home/build/core/server/web.go:412</pre></body></html>'

    vi.stubEnv('DEV', false)
    try {
      const production = detectHtmlResponse(panic)
      expect(production).not.toBeNull()
      expect(production).toEqual({})
    } finally {
      vi.unstubAllEnvs()
    }

    // Companion: the same body still yields its cause in development, so the
    // check above means "withheld", not "detection stopped working".
    expect(detectHtmlResponse(panic)).toEqual({
      detail: 'runtime error: index out of range\n\t/home/build/core/server/web.go:412',
    })
  })

  it('reports HTML with no usable explanation as detail-free', () => {
    expect(detectHtmlResponse('<!doctype html><html><body>x</body></html>')).toEqual({})
    expect(detectHtmlResponse('<html><body>x</body></html>')).toEqual({})
    // Present but empty must not become the detail.
    expect(detectHtmlResponse('<!doctype html><title>   </title>')).toEqual({})
  })

  it('tolerates leading whitespace and mixed case', () => {
    expect(detectHtmlResponse('\n\n  <!DOCTYPE HTML><TITLE>Wikis</TITLE>')).toEqual({ detail: 'Wikis' })
  })

  it('passes over anything that is not an HTML document', () => {
    expect(detectHtmlResponse({ data: { id: 1 } })).toBeNull()
    expect(detectHtmlResponse('{"data":{"id":1}}')).toBeNull()
    expect(detectHtmlResponse('')).toBeNull()
    expect(detectHtmlResponse(null)).toBeNull()
    expect(detectHtmlResponse(undefined)).toBeNull()
    expect(detectHtmlResponse(42)).toBeNull()
    // A string that merely mentions markup is not a document.
    expect(detectHtmlResponse('the page contains <html> in its body')).toBeNull()
  })

  it('passes over binary bodies, so downloads are unaffected', () => {
    expect(detectHtmlResponse(new Blob([indexHtml], { type: 'text/html' }))).toBeNull()
    expect(detectHtmlResponse(new ArrayBuffer(8))).toBeNull()
  })
})

// The generic fallback is what every caller that passes no fallback shows,
// GeneralError's fullscreen mode included. It used to be an English constant.
describe('the generic fallback is translated', () => {
  afterEach(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} })
  })

  it('resolves the fallback through the active catalogue at call time', () => {
    // Keyed on the descriptor's id: this config hashes ids while the app
    // builds use the source text, and the lookup must work under either.
    i18n.loadAndActivate({
      locale: 'xx',
      messages: { [GENERIC_ERROR_MESSAGE.id]: 'Boom in another language' },
    })
    expect(normalizeError({}).message).toBe('Boom in another language')
    expect(normalizeError(new Error('')).message).toBe('Boom in another language')
  })

  it('still reads as English under the empty catalogue', () => {
    expect(normalizeError({}).message).toBe('An unexpected error occurred')
  })
})
