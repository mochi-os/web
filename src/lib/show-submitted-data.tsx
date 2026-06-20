// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { toast } from './toast-utils'

export function showSubmittedData(
  data: unknown,
  title: string = 'You submitted the following values:'
) {
  toast.message(title, {
    description: (
      <pre className="mt-2 w-full overflow-x-auto rounded-md bg-slate-950 p-4">
        <code className="text-white">{JSON.stringify(data, null, 2)}</code>
      </pre>
    ),
  })
}
