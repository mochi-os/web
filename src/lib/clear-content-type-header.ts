// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import type { InternalAxiosRequestConfig } from 'axios'

/** Let axios set multipart boundaries instead of the default application/json. */
export function clearContentTypeHeader(
  headers: InternalAxiosRequestConfig['headers']
) {
  if (!headers) return

  if (
    typeof headers === 'object' &&
    'delete' in headers &&
    typeof headers.delete === 'function'
  ) {
    headers.delete('Content-Type')
    headers.delete('content-type')
    return
  }

  const record = headers as Record<string, unknown>
  delete record['Content-Type']
  delete record['content-type']
}
