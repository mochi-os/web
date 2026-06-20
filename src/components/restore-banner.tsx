// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ExternalLink, X } from 'lucide-react'
import { getShellInitData, initShellBridge } from '../lib/shell-bridge'
import { requestHelpers } from '../lib/request'
import { Button } from './ui/button'

interface RestoreRelink {
  service: string
  identifier: string
}

// Brand names stay verbatim in Latin script (glossary rule); never show
// the raw service slug.
const serviceNames: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
  microsoft: 'Microsoft',
  facebook: 'Facebook',
  x: 'X',
  'stripe-customer': 'Stripe',
}

function serviceName(service: string): string {
  return serviceNames[service] ?? service.charAt(0).toUpperCase() + service.slice(1)
}

/**
 * Shown after an account is moved onto this server from another (a
 * restore from a migration backup). Nudges the user to delete the old
 * account so the network stops routing to it, and lists third-party
 * services to re-link here. Source server and the re-link list arrive in
 * the shell init payload (restoreSource / relinks). Dismissible for the
 * current view only - it returns until the move is finished, because the
 * work genuinely is not done yet.
 */
export function RestoreBanner() {
  const { t } = useLingui()
  const init = getShellInitData()
  const [source, setSource] = useState<string | null>(init?.restoreSource ?? null)
  const [relinks, setRelinks] = useState<RestoreRelink[]>(init?.relinks ?? [])
  const [passkeys, setPasskeys] = useState<boolean>(init?.restorePasskeys ?? false)
  const [dismissed, setDismissed] = useState(false)

  // Init data arrives asynchronously via postMessage after the tree
  // mounts, so a synchronous read can miss it.
  useEffect(() => {
    let cancelled = false
    void initShellBridge().then((data) => {
      if (cancelled) return
      setSource(data.restoreSource ?? null)
      setRelinks(data.relinks ?? [])
      setPasskeys(!!data.restorePasskeys)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (dismissed || !source) return null

  return (
    <div className='border-border bg-muted/40 relative mb-6 rounded-lg border p-4 text-center'>
      <button
        type='button'
        onClick={() => {
          // Persist the dismissal account-wide (best effort), then hide
          // immediately. The action sets the restore.show preference to
          // "false" so the banner stays gone after reload.
          void requestHelpers.post('-/restore/dismiss', {}).catch(() => {})
          setDismissed(true)
        }}
        aria-label={t`Dismiss`}
        className='text-muted-foreground hover:text-foreground absolute top-3 right-3'
      >
        <X className='h-4 w-4' />
      </button>
      <h2 className='mb-1 font-semibold'>
        <Trans>Finish moving your account</Trans>
      </h2>
      <p className='text-muted-foreground mb-3 text-sm'>
        <Trans>
          Your account was moved here from {source}. Until you delete it there, messages and
          notifications may reach both servers, some of your content keeps being served from the
          old server, and followers may take a few minutes to find you here.
        </Trans>
      </p>
      <Button asChild variant='outline' size='sm'>
        <a href={`${source}/settings`} target='_blank' rel='noopener noreferrer'>
          <Trans>Delete your account on the old server</Trans>
          <ExternalLink className='ml-1 h-3 w-3' />
        </a>
      </Button>

      {relinks.length > 0 && (
        <div className='mt-4'>
          <p className='mb-1 text-sm font-medium'>
            <Trans>Re-link your accounts on this server</Trans>
          </p>
          <ul className='space-y-0.5 text-sm'>
            {relinks.map((relink) => (
              <li key={relink.service}>
                <a
                  href='/settings/user/login#oauth'
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {relink.identifier
                    ? `${serviceName(relink.service)} (${relink.identifier})`
                    : serviceName(relink.service)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {passkeys && (
        <div className='mt-4'>
          <p className='mb-1 text-sm font-medium'>
            <Trans>Re-register your passkeys on this server</Trans>
          </p>
          <a
            href='/settings/user/login'
            className='text-primary text-sm underline-offset-4 hover:underline'
          >
            <Trans>Passkeys</Trans>
          </a>
        </div>
      )}
    </div>
  )
}
