// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

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
        message = 'Please check your internet connection and try again.'
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

