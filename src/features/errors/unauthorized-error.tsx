// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useNavigate, useRouter } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { ChevronLeft, Home } from 'lucide-react'
import { Button } from '../../components/ui/button'

export function UnauthorisedError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>401</h1>
        <span className='font-medium'><Trans>Unauthorized Access</Trans></span>
        <p className='text-muted-foreground text-center'>
          Please log in with the appropriate credentials <br /> to access this
          resource.
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            <ChevronLeft className='size-4' />
            <Trans>Go back</Trans>
          </Button>
          <Button onClick={() => navigate({ to: '/' })}><Home className='size-4' /><Trans>Back to home</Trans></Button>
        </div>
      </div>
    </div>
  )
}
