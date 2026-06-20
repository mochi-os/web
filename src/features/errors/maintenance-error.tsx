// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'

import { Trans } from '@lingui/react/macro'
export function MaintenanceError() {
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'><Trans>Website is under maintenance!</Trans></span>
        <p className='text-muted-foreground text-center'>
          The site is not available at the moment. <br />
          <Trans>We'll be back online shortly.</Trans>
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => window.location.reload()}><RefreshCw className='size-4' /><Trans>Try again</Trans></Button>
        </div>
      </div>
    </div>
  )
}
