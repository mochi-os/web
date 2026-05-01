import { Telescope } from 'lucide-react'

import { Trans } from '@lingui/react/macro'
export function ComingSoon() {
  return (
    <div className="h-svh">
      <div className="m-auto flex h-full w-full flex-col items-center justify-center gap-2">
        <Telescope size={72} />
        <h1 className="text-4xl leading-tight font-bold"><Trans>Coming Soon!</Trans></h1>
        <p className="text-muted-foreground text-center">
          This page has not been created yet. <br />
          <Trans>Stay tuned though!</Trans>
        </p>
      </div>
    </div>
  )
}
