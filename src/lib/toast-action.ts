// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { toast } from './toast-utils'
import { getErrorMessage } from './handle-server-error'

export type ToastActionMessages<T> = {
  loading: string
  success?: string | ((data: T) => string) | false
  error?: string | ((err: unknown) => string)
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
        toast.success(msg)
      }
      return data
    })
    .catch((err) => {
      toast.dismiss(id)
      toast.error(resolveError(err))
      throw err
    })
}
