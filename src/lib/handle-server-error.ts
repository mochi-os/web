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

  toast.error(errMsg)
}
