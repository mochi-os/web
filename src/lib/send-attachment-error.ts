// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { extractStatus } from './error-normalizer'
import { getErrorMessage } from './handle-server-error'

export interface SendAttachmentErrorMessages {
  fallback: string
  tooLargeForServer: string
  networkMaybeTooLarge: string
}

export function isAttachmentPayloadTooLargeError(error: unknown): boolean {
  return extractStatus(error) === 413
}

export function getSendAttachmentErrorMessage(
  error: unknown,
  messages: SendAttachmentErrorMessages
): string {
  const status = extractStatus(error)
  if (status === 413) {
    return messages.tooLargeForServer
  }

  const message = getErrorMessage(error, messages.fallback)
  if (message === 'Network Error') {
    return messages.networkMaybeTooLarge
  }

  return message
}
