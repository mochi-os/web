// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ExternalLink, X } from 'lucide-react'
import { requestHelpers } from '../lib/request'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { providerName } from '../lib/provider-name'

interface RestoreRelink {
  service: string
  identifier: string
}

// What a.user.restore() answers, as the host app's -/restore action relays it.
interface RestoreState {
  source: string
  relinks: RestoreRelink[]
  passkeys: boolean
}

// The claimed source server comes from the restore bundle, which a crafted
// backup controls, so the delete-your-old-account link renders only for a bare
// https origin - the shape the exporting server writes.
function sourceOrigin(source: string): string | null {
  if (!URL.canParse(source)) return null
  const url = new URL(source)
  if (url.protocol !== 'https:' || url.username || url.password) return null
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return null
  return url.origin
}

/**
 * Shown after an account is restored onto this server from another: nudges the
 * user to delete the old account and lists services to re-link. The host app
 * answers -/restore from a.user.restore(), which its own grant covers - the
 * shell does not hand this to every app frame, since the re-link list names the
 * e-mail address used at each provider. Dismissal sets restore.show.
 */
export function RestoreBanner() {
  const { t } = useLingui()
  const [state, setState] = useState<RestoreState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void requestHelpers
      .get<RestoreState | null>('-/restore')
      .then((data) => {
        if (!cancelled) setState(data && data.source ? data : null)
      })
      .catch(() => {
        // No banner is the right answer to a host that cannot say.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (dismissed || !state) return null
  const { source, relinks, passkeys } = state

  const origin = sourceOrigin(source)

  return (
    <div className='border-border bg-muted/40 relative mb-6 rounded-lg border p-4 text-center'>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>{t`Dismiss`}</TooltipContent>
      </Tooltip>
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
      {origin && (
        <Button asChild variant='outline' size='sm'>
          <a href={`${origin}/settings`} target='_blank' rel='noopener noreferrer'>
            <Trans>Delete your account on the old server</Trans>
            <ExternalLink className='ml-1 h-3 w-3' />
          </a>
        </Button>
      )}

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
                    ? `${providerName(relink.service)} (${relink.identifier})`
                    : providerName(relink.service)}
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
