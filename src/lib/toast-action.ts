// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ExternalToast } from 'sonner'
import { toast } from './toast-utils'
import { getErrorMessage } from './handle-server-error'

export type ToastActionMessages<T> = {
  loading: string
  success?: string | ((data: T) => string) | false
  successOptions?: (data: T) => ExternalToast | undefined
  error?: string | ((err: unknown) => string)
  errorOptions?: (err: unknown) => ExternalToast | undefined
}

export function toastAction<T>(
  promise: Promise<T>,
  messages: ToastActionMessages<T>
): Promise<T> {
  const resolveError = (err: unknown) =>
    typeof messages.error === 'function'
      ? messages.error(err)
      : getErrorMessage(err, messages.error)

  const id = toast.loading(messages.loading)

  return promise
    .then((data) => {
      toast.dismiss(id)
      if (messages.success !== false && messages.success !== undefined) {
        const msg =
          typeof messages.success === 'function'
            ? messages.success(data)
            : messages.success
        const options = messages.successOptions?.(data)
        toast.success(msg, options)
      }
      return data
    })
    .catch((err) => {
      toast.dismiss(id)
      const options = messages.errorOptions?.(err)
      toast.error(resolveError(err), options)
      throw err
    })
}
