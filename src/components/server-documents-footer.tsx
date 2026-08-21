// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans } from '@lingui/react/macro'

/**
 * Footer linking to the server-level documents. Links are relative, so the host
 * app must declare its own `document/rules|terms|privacy` SPA routes mounting
 * `<DocumentPage>` plus a `-/document/get` action.
 */
export function ServerDocumentsFooter() {
  return (
    <p className='text-muted-foreground space-x-2 pb-6 pt-2 text-center text-sm'>
      <a href='document/rules' className='hover:text-foreground transition-colors'>
        <Trans>Server rules</Trans>
      </a>
      <span aria-hidden='true'>·</span>
      <a href='document/terms' className='hover:text-foreground transition-colors'>
        <Trans>Terms and conditions</Trans>
      </a>
      <span aria-hidden='true'>·</span>
      <a href='document/privacy' className='hover:text-foreground transition-colors'>
        <Trans>Privacy</Trans>
      </a>
    </p>
  )
}
