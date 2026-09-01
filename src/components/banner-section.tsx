// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The markdown banner editor shared by feeds and forums. Both apps had a
// byte-for-byte copy of this apart from the api object and one null guard.

import { useEffect, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Section } from './layout/section'
import { toast } from '../lib/toast-utils'
import { getErrorMessage } from '../lib/handle-server-error'

/** The app's banner endpoints. Both apps already expose exactly this pair. */
export interface BannerApi {
  getBanner: (entityId: string) => Promise<{ data?: { banner?: string } }>
  setBanner: (entityId: string, banner: string) => Promise<unknown>
}

interface BannerSectionProps {
  entityId: string
  /**
   * Compared by reference in the load effect, so pass a module-level object.
   * An inline literal is a new reference every render and refetches forever.
   */
  api: BannerApi
}

export function BannerSection({ entityId, api }: BannerSectionProps) {
  const { t } = useLingui()
  const [banner, setBannerText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const savedRef = useRef('')

  useEffect(() => {
    // `active` keeps a response for a previous entityId from landing on the
    // current one, which would leave savedRef holding the wrong baseline and
    // the dirty check wrong with it. Both app copies had this gap.
    let active = true
    // Guarded read: feeds reached the same empty box through a swallowed
    // TypeError when `data` was absent, forums through this `?.`.
    api
      .getBanner(entityId)
      .then((res) => {
        if (!active) return
        const text = res.data?.banner ?? ''
        setBannerText(text)
        savedRef.current = text
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [entityId, api])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.setBanner(entityId, banner)
      savedRef.current = banner
      setDirty(false)
      toast.success(banner ? t`Banner updated` : t`Banner removed`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to update banner`))
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Section title={t`Banner`}>
      <div className='max-w-lg space-y-3'>
        <Textarea
          value={banner}
          onChange={(e) => {
            setBannerText(e.target.value)
            setDirty(e.target.value !== savedRef.current)
          }}
          placeholder={t`Enter banner text (markdown supported)...`}
          rows={3}
          className='font-mono text-sm'
        />
        <div className='flex items-center gap-2'>
          <Button size='sm' onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Check className='size-4' />
            )}
            <Trans>Save</Trans>
          </Button>
          {banner && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                setBannerText('')
                setDirty('' !== savedRef.current)
              }}
              disabled={saving}
            >
              <Trans>Clear</Trans>
            </Button>
          )}
        </div>
      </div>
    </Section>
  )
}
