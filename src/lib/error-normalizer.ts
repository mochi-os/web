// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { i18n } from '@lingui/core'

type JsonRecord = Record<string, unknown>

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred'

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object'
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function extractErrorFromPayloadWithSource(payload: unknown): {
  message?: string
  code?: string
  source?: string
} {
  if (!isRecord(payload)) return {}

  // Mochi error envelope is { error: <machine-readable code>, message:
  // <localized human-readable string> } as produced by respond_error
  // (core/server/labels.go). When both are present, prefer message for
  // display; keep error as the code so callers can switch on it.
  // Falling through to "error as message" when message is absent
  // preserves backwards compatibility with handlers that haven't yet
  // adopted respond_error.
  const topError = asNonEmptyString(payload.error)
  const topMessage = asNonEmptyString(payload.message)
  if (topError && topMessage) {
    return {
      message: topMessage,
      code: topError,
      source: 'payload.error+message',
    }
  }
  if (topError) {
    return { message: topError, code: topError, source: 'payload.error' }
  }
  if (topMessage) {
    return { message: topMessage, source: 'payload.message' }
  }

  const topTitle = asNonEmptyString(payload.title)
  if (topTitle) {
    return { message: topTitle, source: 'payload.title' }
  }

  const nestedData = payload.data
  if (!isRecord(nestedData)) return {}

  const nestedError = asNonEmptyString(nestedData.error)
  const nestedMessage = asNonEmptyString(nestedData.message)
  if (nestedError && nestedMessage) {
    return {
      message: nestedMessage,
      code: nestedError,
      source: 'payload.data.error+message',
    }
  }
  if (nestedError) {
    return {
      message: nestedError,
      code: nestedError,
      source: 'payload.data.error',
    }
  }
  if (nestedMessage) {
    return { message: nestedMessage, source: 'payload.data.message' }
  }

  const nestedTitle = asNonEmptyString(nestedData.title)
  if (nestedTitle) {
    return { message: nestedTitle, source: 'payload.data.title' }
  }

  return {}
}

export function extractErrorMessageFromPayload(payload: unknown): {
  message?: string
  code?: string
} {
  const extracted = extractErrorFromPayloadWithSource(payload)
  return {
    ...(extracted.message ? { message: extracted.message } : {}),
    ...(extracted.code ? { code: extracted.code } : {}),
  }
}

/**
 * Detect an HTML document served where data was expected, and pull out
 * whatever explanation the page carries.
 *
 * A Mochi request that names a path with no matching action falls through to
 * the SPA catch-all, which answers 200 with index.html. Left alone that
 * surfaces far from its cause - as a parse error, or a component rendering
 * nothing - so the response interceptor turns it into an error that names it.
 *
 * Returns null when the body is not an HTML document. Bodies that are not
 * strings (a Blob or ArrayBuffer from a download) are never HTML by this test,
 * so binary responses are unaffected.
 *
 * The message itself is built by the caller: this file is imported by tests
 * without babel, so it cannot use the Lingui macro.
 */
export function detectHtmlResponse(body: unknown): { detail?: string } | null {
  if (typeof body !== 'string') return null

  const trimmed = body.trimStart()
  const lowered = trimmed.slice(0, 16).toLowerCase()
  if (!lowered.startsWith('<!') && !lowered.startsWith('<html')) return null

  // A Go error page puts the cause in <pre>; otherwise the title is the best
  // hint available.
  //
  // Development only. The detail is shown to the user by the response
  // interceptor, and on a panic page that <pre> is a stack trace with
  // filesystem paths in it. The signal that matters in production - that an
  // HTML body arrived where JSON was expected - is the non-null return, which
  // is unaffected; only the internals are withheld.
  if (!import.meta.env.DEV) return {}

  const pre = asNonEmptyString(trimmed.match(/<pre>([^<]*)<\/pre>/i)?.[1])
  const title = asNonEmptyString(trimmed.match(/<title>([^<]*)<\/title>/i)?.[1])
  const detail = pre ?? title

  return detail ? { detail } : {}
}

export function extractStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined

  const response = error.response
  if (isRecord(response)) {
    const responseStatus = toFiniteNumber(response.status)
    if (responseStatus !== undefined) {
      return responseStatus
    }
  }

  const directStatus = toFiniteNumber(error.status)
  if (directStatus !== undefined) {
    return directStatus
  }

  return undefined
}

export interface NormalizedError {
  message: string
  status?: number
  code?: string
  source: string
}

export function normalizeError(
  error: unknown,
  fallback: string = DEFAULT_ERROR_MESSAGE
): NormalizedError {
  if (typeof error === 'string') {
    const direct = asNonEmptyString(error)
    if (direct) {
      return { message: direct, source: 'string' }
    }
  }

  let status = extractStatus(error)
  let message: string | undefined
  let code: string | undefined
  let source = 'fallback'

  if (isRecord(error)) {
    const responsePayload = isRecord(error.response)
      ? (error.response as JsonRecord).data
      : undefined
    const dataPayload = error.data

    for (const payload of [responsePayload, dataPayload]) {
      if (payload === undefined) continue

      const extracted = extractErrorFromPayloadWithSource(payload)
      if (extracted.message && !message) {
        message = extracted.message
        code = extracted.code
        source = extracted.source ?? 'payload'
      }
    }

    // Conservative app-level envelope handling: only treat as error when
    // status is present and >= 400. Same error/message preference as the
    // extractor above - prefer the localized message field for display.
    const envelopePayload = responsePayload ?? dataPayload
    if (isRecord(envelopePayload)) {
      const envelopeStatus = toFiniteNumber(envelopePayload.status)
      const envelopeError = asNonEmptyString(envelopePayload.error)
      const envelopeMessage = asNonEmptyString(envelopePayload.message)
      if (
        envelopeError &&
        envelopeStatus !== undefined &&
        envelopeStatus >= 400
      ) {
        message = envelopeMessage ?? envelopeError
        code = envelopeError
        source = envelopeMessage
          ? 'payload.status-error-envelope+message'
          : 'payload.status-error-envelope'
        status = status ?? envelopeStatus
      }
    }

    if (!message) {
      const extracted = extractErrorFromPayloadWithSource(error)
      if (extracted.message) {
        message = extracted.message
        code = extracted.code
        source = extracted.source ?? 'error-object'
      }
    }
  }

  if (!message && error instanceof Error) {
    const errorMessage = asNonEmptyString(error.message)
    if (errorMessage) {
      if (errorMessage.toLowerCase() === 'network error' || errorMessage.toLowerCase() === 'failed to fetch') {
        // Runtime lookup, not a macro: this file is imported by tests without
        // babel. The msgid stays in every catalog via the identical <Trans>
        // sentence in general-error.tsx.
        message = i18n._('Please check your internet connection and try again.')
        source = 'error.message (network)'
      } else {
        message = errorMessage
        source = 'error.message'
      }
    }
  }

  const fallbackMessage =
    asNonEmptyString(fallback) ?? DEFAULT_ERROR_MESSAGE

  return {
    message: message ?? fallbackMessage,
    ...(status !== undefined ? { status } : {}),
    ...(code ? { code } : {}),
    source: message ? source : 'fallback',
  }
}

