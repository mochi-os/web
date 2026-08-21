// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './ui/responsive-dialog'
import { shellWebauthnGet } from '../lib/shell-bridge'

// Result of a single factor verification: a proof token once every
// required factor is satisfied, otherwise the factors still outstanding.
export interface StepUpResult {
  token?: string
  remaining?: string[]
}

// The app supplies a StepUpClient wired to its own actions (a lib/web
// component must not reference an app's action paths). Each verify returns
// a StepUpResult; the dialog calls onVerified with the token once complete.
export interface StepUpClient {
  methods: () => Promise<string[]>
  send: () => Promise<void>
  verifyEmail: (code: string) => Promise<StepUpResult>
  verifyTotp: (code: string) => Promise<StepUpResult>
  passkeyBegin: () => Promise<{ ceremony: string; options: unknown }>
  passkeyFinish: (ceremony: string, assertion: unknown) => Promise<StepUpResult>
  // Linked OAuth providers (e.g. ['google']) the user can re-verify with, and
  // the popup verification that returns a proof for the oauth factor.
  oauthProviders: () => Promise<string[]>
  oauthVerify: (provider: string) => Promise<StepUpResult>
}

// Display label for an OAuth provider key. Brand names stay verbatim.
const OAUTH_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
  facebook: 'Facebook',
  x: 'X',
}

function oauthLabel(key: string): string {
  return OAUTH_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

// Re-verifies the user with their login factors and hands the caller a
// single-use proof token. `children` renders below the factor controls, gated
// by `canVerify`; `submitLabel` replaces the inline Verify buttons with one
// footer button.
export function StepUpDialog({
  open,
  onOpenChange,
  title,
  description,
  client,
  onVerified,
  canVerify = true,
  submitLabel,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  client: StepUpClient
  onVerified: (token: string) => void | Promise<void>
  canVerify?: boolean
  submitLabel?: string
  children?: React.ReactNode
}) {
  const { t } = useLingui()
  const [remaining, setRemaining] = useState<string[]>([])
  const [providers, setProviders] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // A proof earned before the caller's extra input (e.g. the export
  // passphrase) is ready, held until the footer action fires it. Lets the
  // re-auth options stay enabled from the start while the action button
  // waits for everything required.
  const [earnedToken, setEarnedToken] = useState<string | null>(null)

  // Bumped on every open and close. An OAuth verify polls for up to two minutes
  // and dismissing the dialog does not stop it, so the generation is captured
  // before the await and compared after: a stale result is discarded.
  const generation = useRef(0)

  // On open: learn the user's factors and, if email is one, send the code.
  useEffect(() => {
    generation.current += 1
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    setEmailCode('')
    setTotpCode('')
    setProviders([])
    setSent(false)
    // The dialog instance is reused across method changes, and an abandoned
    // OAuth verify can leave busy=true and grey out every control. Nothing is
    // in progress at open time, so clear it.
    setBusy(false)
    setEarnedToken(null)
    ;(async () => {
      try {
        const methods = await client.methods()
        if (cancelled) return
        setRemaining(methods)
        // Linked OAuth providers are offered as a top-level alternative
        // whenever they can satisfy the step-up; the client returns none when
        // they can't, so fetch them regardless of which code factors show.
        const linked = await client.oauthProviders().catch(() => [])
        if (cancelled) return
        setProviders(linked)
        // Auto-send the emailed code only when email is offered and there is
        // no OAuth alternative; otherwise wait for the user to choose so we
        // don't send an unprompted email.
        if (methods.includes('email') && linked.length === 0) {
          await client.send().catch(() => {})
          if (!cancelled) setSent(true)
        }
      } catch {
        if (!cancelled) setError(t`Couldn't start re-authentication. Please try again.`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The dialog doesn't auto-focus on open (that would grab the export passphrase
  // field), but once the email-code field is actually shown — auto-sent, or
  // after the user clicks Send email — focus it so they can type the code right
  // away.
  const emailInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!loading && sent && remaining.includes('email')) {
      emailInputRef.current?.focus()
    }
  }, [loading, sent, remaining])

  // A completed factor yields a proof token. `defer` holds it so a flow with
  // its own action button keeps that button as the final step; otherwise run
  // the action now, awaiting it to keep the dialog busy.
  const apply = useCallback(
    async (r: StepUpResult, defer = false) => {
      if (r.token) {
        if (defer) {
          setEarnedToken(r.token)
        } else {
          await onVerified(r.token)
        }
      } else {
        setRemaining(r.remaining ?? [])
      }
    },
    [onVerified],
  )

  const resend = async () => {
    setError('')
    try {
      await client.send()
      setSent(true)
    } catch {
      setError(t`Couldn't send the code. Please try again.`)
    }
  }

  const verify = async (run: () => Promise<StepUpResult>, reset: () => void) => {
    setBusy(true)
    setError('')
    try {
      await apply(await run())
      reset()
    } catch {
      setError(t`That code is incorrect or has expired.`)
    } finally {
      setBusy(false)
    }
  }

  const usePasskey = async () => {
    setBusy(true)
    setError('')
    try {
      const { ceremony, options } = await client.passkeyBegin()
      const assertion = await shellWebauthnGet(options)
      await apply(await client.passkeyFinish(ceremony, assertion), !!submitLabel)
    } catch {
      setError(t`Passkey verification failed. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  const verifyOauth = async (provider: string) => {
    setBusy(true)
    setError('')
    const mine = generation.current
    try {
      const result = await client.oauthVerify(provider)
      // Dismissed, or reopened for something else, while the popup was open.
      if (generation.current !== mine) return
      await apply(result, !!submitLabel)
    } catch {
      if (generation.current !== mine) return
      setError(t`Couldn't verify with that account. Please try again.`)
    } finally {
      if (generation.current === mine) setBusy(false)
    }
  }

  // Footer submit: verify whichever code factor the user has filled,
  // advancing the accrual. Drives the footer Verify / submit button and the
  // code inputs' Enter key.
  const submitActive = () => {
    if (remaining.includes('email') && emailCode.trim()) {
      verify(() => client.verifyEmail(emailCode.trim()), () => setEmailCode(''))
    } else if (remaining.includes('totp') && totpCode.trim()) {
      verify(() => client.verifyTotp(totpCode.trim()), () => setTotpCode(''))
    }
  }

  // The footer action button: if a proof was already earned (e.g. via OAuth or
  // passkey before the passphrase was set), run the action with it now;
  // otherwise verify whichever code the user has filled.
  const submitFooter = async () => {
    if (earnedToken) {
      setBusy(true)
      setError('')
      try {
        await onVerified(earnedToken)
      } finally {
        setBusy(false)
      }
    } else {
      submitActive()
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmailCode('')
      setTotpCode('')
      setError('')
    }
    onOpenChange(next)
  }

  const need = (m: string) => remaining.includes(m)

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      {/* Don't auto-focus on open: while loading, the passphrase field (children)
          is the first focusable element and would grab focus. */}
      <ResponsiveDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          {description ? (
            <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
          ) : null}
        </ResponsiveDialogHeader>
        <div className='space-y-4 py-2'>
          {loading ? (
            <div className='flex justify-center py-4'>
              <Loader2 className='h-5 w-5 animate-spin' />
            </div>
          ) : (
            <>
              {need('email') && (
                <div className='space-y-2'>
                  {sent ? (
                    <>
                      <Label htmlFor='stepup-email' className='text-base font-semibold'>
                        <Trans>Email code</Trans>
                      </Label>
                      <Input
                        id='stepup-email'
                        ref={emailInputRef}
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !busy && canVerify) submitActive()
                        }}
                        placeholder={t`Enter the code from your email`}
                        className='font-mono'
                        autoComplete='one-time-code'
                        disabled={busy}
                      />
                    </>
                  ) : (
                    <Button variant='outline' className='w-full' onClick={resend} disabled={busy}>
                      <Trans>Send email</Trans>
                    </Button>
                  )}
                </div>
              )}
              {need('totp') && (
                <div className='space-y-2'>
                  <Label htmlFor='stepup-totp' className='text-base font-semibold'>
                    <Trans>Authenticator code</Trans>
                  </Label>
                  <Input
                    id='stepup-totp'
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !busy && canVerify) submitActive()
                    }}
                    placeholder={t`Enter your authenticator code`}
                    className='font-mono'
                    autoComplete='one-time-code'
                    disabled={busy}
                  />
                </div>
              )}
              {need('passkey') && (
                <div className='space-y-2'>
                  <Label className='text-base font-semibold'>
                    <Trans>Passkey</Trans>
                  </Label>
                  <Button variant='outline' className='w-full' onClick={usePasskey} disabled={busy}>
                    {busy ? <Loader2 className='me-2 h-4 w-4 animate-spin' /> : null}
                    <Trans>Use your passkey</Trans>
                  </Button>
                </div>
              )}
              {providers.map((p) => {
                const label = oauthLabel(p)
                return (
                  <Button
                    key={p}
                    variant='outline'
                    className='w-full'
                    onClick={() => verifyOauth(p)}
                    disabled={busy}
                  >
                    <Trans>Continue with {label}</Trans>
                  </Button>
                )
              })}
            </>
          )}
          {children}
          {error ? <p className='text-destructive text-sm leading-relaxed'>{error}</p> : null}
        </div>
        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)} disabled={busy}>
            <Trans>Cancel</Trans>
          </Button>
          {sent && need('email') ? (
            <Button variant='outline' onClick={resend} disabled={busy}>
              <Trans>Resend email</Trans>
            </Button>
          ) : null}
          {!loading && (need('email') || need('totp') || earnedToken) ? (
            <Button
              onClick={submitFooter}
              disabled={
                busy ||
                !canVerify ||
                !(
                  earnedToken ||
                  (need('email') && emailCode.trim()) ||
                  (need('totp') && totpCode.trim())
                )
              }
            >
              {busy ? (
                <Loader2 className='me-2 h-4 w-4 animate-spin' />
              ) : submitLabel ? null : (
                <Check className='me-2 h-4 w-4' />
              )}
              {submitLabel ?? <Trans>Verify</Trans>}
            </Button>
          ) : null}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
