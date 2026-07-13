// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    mochi?: {
      showGlobalErrorToast?: boolean
      toastDedupeKey?: string
      toastDedupeTtlMs?: number
    }
  }
}
