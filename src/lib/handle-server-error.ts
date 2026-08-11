// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import { toast } from './toast-utils'
import { normalizeError } from './error-normalizer'

// Extract error message from various error types
export function getErrorMessage(error: unknown, fallback?: string): string {
  return normalizeError(error, fallback).message
}

export function handleServerError(error: unknown) {
  const normalized = normalizeError(error)
  let errMsg = normalized.message

  if (normalized.status === 204) {
    errMsg = t`Content not found.`
  }

  // A refused body reached the toast as whatever the server happened to put in
  // it, which for an oversized upload is not something anyone can act on. The
  // ceiling is the account's remaining storage, so the answer is always to send
  // less rather than to try again.
  if (normalized.status === 413) {
    errMsg = t`That was too large to upload. Remove or shrink files and try again.`
  }

  toast.error(errMsg)
}
