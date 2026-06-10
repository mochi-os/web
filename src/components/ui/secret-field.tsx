import * as React from 'react'
import { Trans } from '@lingui/react/macro'
import { Loader2 } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { cn } from '../../lib/utils'

interface SecretFieldProps {
  // True when a value is already stored on the server. The field never receives
  // the value itself — secrets are write-only — it only reflects that one exists.
  configured: boolean
  // Persist a new value. Resolve on success (the field clears and marks itself
  // set); reject to keep the typed value so the caller can surface an error and
  // the user can retry.
  onSave: (value: string) => Promise<void> | void
  disabled?: boolean
  className?: string
  inputClassName?: string
}

// Masked, write-only credential input. Shared by the staff Stripe config and the
// system settings page so secrets are entered the same way everywhere: the
// stored value is never shown (a bullet placeholder marks that one is set), and
// the Save button appears only once the admin types a replacement.
export function SecretField({
  configured,
  onSave,
  disabled,
  className,
  inputClassName,
}: SecretFieldProps) {
  const [value, setValue] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [isSet, setIsSet] = React.useState(configured)

  // Keep in sync if the stored state changes underneath us (e.g. a refetch).
  React.useEffect(() => {
    setIsSet(configured)
  }, [configured])

  const changed = value !== ''

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(value)
      // Stored server-side but never echoed back: clear the input and show it as
      // set rather than leaving the typed secret sitting in the field.
      setValue('')
      setIsSet(true)
    } catch {
      // Keep the typed value so the user can retry; the caller surfaces the error.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      <Input
        type='password'
        autoComplete='off'
        placeholder={isSet ? '••••••••' : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled || saving}
        className={cn('flex-1 min-w-0', inputClassName)}
      />
      {changed && (
        <Button size='sm' onClick={handleSave} disabled={disabled || saving}>
          {saving ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <Trans>Save</Trans>
          )}
        </Button>
      )}
    </div>
  )
}
