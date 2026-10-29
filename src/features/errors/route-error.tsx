// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useLingui } from '@lingui/react/macro'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { isLoadFailure, loadPageAgain } from '../../lib/page-load-recovery'
import { isInShell } from '../../lib/shell-bridge'
import { GeneralError } from './general-error'

/**
 * A route's own error screen, for the router's defaultErrorComponent: the
 * inline card the pages use, drawn in the content pane beside the sidebar.
 * A page whose code failed to load asks the user to check the connection (the
 * sentence GeneralError already shows for a network error), and Try again
 * loads the page again from the server: lazyRouteComponent keeps the failed
 * import, so the router's reset would only throw it again. Any other error
 * loads the routes in view again, data included.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  // Loads the routes in view again. The boundary's own reset only draws the
  // page again, and a route whose data failed keeps that error until it loads.
  const retry = () => {
    void router.invalidate()
  }
  const { t } = useLingui()
  const failed = isLoadFailure(error)
  return (
    <div className='p-4'>
      <GeneralError
        error={
          failed
            ? new Error(t`Please check your internet connection and try again.`)
            : error
        }
        reset={failed ? () => loadPageAgain(router, isInShell()) : retry}
        minimal
        mode='inline'
      />
    </div>
  )
}
