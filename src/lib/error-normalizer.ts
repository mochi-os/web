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

  // respond_error's envelope is { error: <code>, message: <localized text> }.
  // Prefer message for display and keep error as the code; a payload carrying
  // only `error` falls back to it as the message.
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


/**
 * Detect an HTML document served where data was expected: a path with no
 * matching action falls through to the SPA catch-all, which answers 200 with
 * index.html. The caller builds the message - this file is imported without
 * babel, so no macro.
 */
export function detectHtmlResponse(body: unknown): { detail?: string } | null {
  if (typeof body !== 'string') return null

  const trimmed = body.trimStart()
  const lowered = trimmed.slice(0, 16).toLowerCase()
  if (!lowered.startsWith('<!') && !lowered.startsWith('<html')) return null

  // Development only: on a panic page the <pre> is a stack trace with
  // filesystem paths in it. Production keeps the signal that matters, the
  // non-null return.
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

