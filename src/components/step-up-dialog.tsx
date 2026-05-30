import { useCallback, useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Loader2 } from 'lucide-react'
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
  // the popup verification that returns a proof for the email factor.
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

// StepUpDialog re-verifies the user with the same factor(s) they log in
// with (email code / TOTP / passkey) before a sensitive action, then hands
// the caller a single-use proof token via onVerified. `children` renders
// below the factor controls (e.g. the export passphrase field, kept beneath
// the identity check); `canVerify` gates submission until any such extra
// input is ready. When `submitLabel` is set the per-factor inline Verify
// buttons are replaced by one labelled action button in the footer (e.g.
// "Download backup" for export); without it each factor verifies inline.
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

  // On open: learn the user's factors and, if email is one, send the code.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    setEmailCode('')
    setTotpCode('')
    setProviders([])
    setSent(false)
    ;(async () => {
      try {
        const methods = await client.methods()
        if (cancelled) return
        setRemaining(methods)
        if (methods.includes('email')) {
          // Linked OAuth providers are an alternative to the emailed code.
          const linked = await client.oauthProviders().catch(() => [])
          if (cancelled) return
          setProviders(linked)
          // Only auto-send the code when email is the sole option; if the user
          // can re-verify with a provider, don't send an unprompted email.
          if (linked.length === 0) {
            await client.send().catch(() => {})
            if (!cancelled) setSent(true)
          }
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

  // Await onVerified so the action it performs (e.g. building the export
  // bundle, which can take a while) keeps the dialog in its busy state —
  // spinner on, inputs disabled — until it finishes and closes the dialog.
  const apply = useCallback(
    async (r: StepUpResult) => {
      if (r.token) {
        await onVerified(r.token)
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
      await apply(await client.passkeyFinish(ceremony, assertion))
    } catch {
      setError(t`Passkey verification failed. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  const useOauth = async (provider: string) => {
    setBusy(true)
    setError('')
    try {
      await apply(await client.oauthVerify(provider))
    } catch {
      setError(t`Couldn't verify with that account. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  // Footer submit (when submitLabel is set): verify whichever code factor
  // the user has filled, advancing the accrual exactly as an inline button.
  const submitActive = () => {
    if (remaining.includes('email') && emailCode.trim()) {
      verify(() => client.verifyEmail(emailCode.trim()), () => setEmailCode(''))
    } else if (remaining.includes('totp') && totpCode.trim()) {
      verify(() => client.verifyTotp(totpCode.trim()), () => setTotpCode(''))
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
      <ResponsiveDialogContent>
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
                      <div className='flex items-center gap-2'>
                        <Input
                          id='stepup-email'
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value)}
                          placeholder={t`Enter the code from your email`}
                          className='font-mono'
                          autoComplete='one-time-code'
                          disabled={busy}
                        />
                        <Button variant='outline' size='sm' onClick={resend} disabled={busy}>
                          <Trans>Resend</Trans>
                        </Button>
                        {!submitLabel && (
                          <Button
                            size='sm'
                            onClick={() => verify(() => client.verifyEmail(emailCode.trim()), () => setEmailCode(''))}
                            disabled={busy || !canVerify || !emailCode.trim()}
                          >
                            <Trans>Verify</Trans>
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <Button variant='outline' className='w-full' onClick={resend} disabled={busy}>
                      <Trans>Send email</Trans>
                    </Button>
                  )}
                  {providers.map((p) => {
                    const label = oauthLabel(p)
                    return (
                      <Button
                        key={p}
                        variant='outline'
                        className='w-full'
                        onClick={() => useOauth(p)}
                        disabled={busy || !canVerify}
                      >
                        <Trans>Continue with {label}</Trans>
                      </Button>
                    )
                  })}
                </div>
              )}
              {need('totp') && (
                <div className='space-y-2'>
                  <Label htmlFor='stepup-totp' className='text-base font-semibold'>
                    <Trans>Authenticator code</Trans>
                  </Label>
                  <div className='flex items-center gap-2'>
                    <Input
                      id='stepup-totp'
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder={t`Enter your authenticator code`}
                      className='font-mono'
                      autoComplete='one-time-code'
                      disabled={busy}
                    />
                    {!submitLabel && (
                      <Button
                        size='sm'
                        onClick={() => verify(() => client.verifyTotp(totpCode.trim()), () => setTotpCode(''))}
                        disabled={busy || !canVerify || !totpCode.trim()}
                      >
                        <Trans>Verify</Trans>
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {need('passkey') && (
                <div className='space-y-2'>
                  <Label className='text-base font-semibold'>
                    <Trans>Passkey</Trans>
                  </Label>
                  <Button variant='outline' className='w-full' onClick={usePasskey} disabled={busy || !canVerify}>
                    {busy ? <Loader2 className='me-2 h-4 w-4 animate-spin' /> : null}
                    <Trans>Use your passkey</Trans>
                  </Button>
                </div>
              )}
            </>
          )}
          {children}
          {error ? <p className='text-destructive text-sm leading-relaxed'>{error}</p> : null}
        </div>
        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)} disabled={busy}>
            <Trans>Cancel</Trans>
          </Button>
          {submitLabel && !loading && (need('email') || need('totp')) ? (
            <Button
              onClick={submitActive}
              disabled={
                busy ||
                !canVerify ||
                !((need('email') && emailCode.trim()) || (need('totp') && totpCode.trim()))
              }
            >
              {busy ? <Loader2 className='me-2 h-4 w-4 animate-spin' /> : null}
              {submitLabel}
            </Button>
          ) : null}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
