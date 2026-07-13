// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans } from '@lingui/react/macro'
export function SkipToMain() {
  return (
    <a
      className={`bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring fixed start-44 z-999 -translate-y-52 px-4 py-2 text-sm font-medium whitespace-nowrap opacity-95 shadow-sm transition focus:translate-y-3 focus:transform focus-visible:ring-1`}
      href='#content'
    >
      <Trans>Skip to Main</Trans>
    </a>
  )
}
