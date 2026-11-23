// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A network the server offers and the user has no account on yet, where an
// app would otherwise show that account: its name, and a button to Settings ›
// Networks, whose back button returns here. The app names the button.
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { providerName } from '../lib/provider-name'
import { shellNavigateExternal } from '../lib/shell-bridge'
import { networkSetupPath, pagePath } from '../lib/network-setup'

export function NetworkSetup({
  network,
  label,
  className,
}: {
  network: string
  label: string
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center justify-between gap-4 py-2', className)}
    >
      <span className='min-w-0 truncate text-sm font-medium'>
        {providerName(network)}
      </span>
      <Button
        variant='outline'
        size='sm'
        onClick={() =>
          shellNavigateExternal(networkSetupPath(network, pagePath()))
        }
      >
        {label}
      </Button>
    </div>
  )
}
