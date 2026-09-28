// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from 'react'
import { Trans } from '@lingui/react/macro'
import { ExternalLink, Plus } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '../../components/ui/responsive-dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { getProviderLabel, type Provider } from './types'
import { t } from '@lingui/core/macro'

interface AccountAddProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: Provider[]
  onAdd: (
    type: string,
    fields: Record<string, string>,
    addToExisting: boolean,
    setAsDefault?: boolean
  ) => Promise<void>
  // An OAuth provider is not added by this form: the caller takes the user
  // through the provider's consent instead. Without this the oauth providers
  // are left out of the list altogether.
  onLink?: (type: string) => void
  isAdding: boolean
  appBase: string
  hasExistingAiAccount?: boolean
}

export function AccountAdd({
  open,
  onOpenChange,
  providers,
  onAdd,
  onLink,
  isAdding,
  appBase: _appBase,
  hasExistingAiAccount = false,
}: AccountAddProps) {
  const [selectedType, setSelectedType] = useState<string>('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [addToExisting, setAddToExisting] = useState(true)
  const [setAsDefault, setSetAsDefault] = useState(false)

  // Ensure providers is always an array (defensive check). Memoised on the
  // prop: rebuilt each render it would be a new array every time, so the
  // useMemo below - which depends on it - would recompute on every render
  // and memoise nothing.
  const providersList = useMemo(
    () => (Array.isArray(providers) ? providers : []),
    [providers]
  )

  // Filter out browser provider from the add dialog, and the oauth ones when
  // the caller cannot take the user through a provider's consent.
  const availableProviders = useMemo(
    () =>
      providersList.filter(
        (p) => p.type !== 'browser' && (onLink !== undefined || p.flow !== 'oauth')
      ),
    [providersList, onLink]
  )

  // Pre-populate non-required text fields that have a placeholder value
  const getDefaultFields = (provider: Provider | undefined) => {
    if (!provider) return {}
    const defaults: Record<string, string> = {}
    for (const field of provider.fields) {
      if (!field.required && field.type === 'text' && field.placeholder) {
        defaults[field.name] = field.placeholder
      }
    }
    return defaults
  }

  const isAiType = (type: string) => type === 'claude' || type === 'openai'

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const type =
        availableProviders.length === 1 ? availableProviders[0].type : ''
      setSelectedType(type)
      setFields(getDefaultFields(providersList.find((p) => p.type === type)))
      setAddToExisting(true)
      setSetAsDefault(isAiType(type) && !hasExistingAiAccount)
    }
    // Deliberately keyed on the dialog opening: this RESETS the form to its
    // defaults, so it must read hasExistingAiAccount and providersList as they
    // are at that moment rather than re-running whenever they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, availableProviders])

  const selectedProvider = providersList.find((p) => p.type === selectedType)
  const providerLabel = selectedProvider
    ? getProviderLabel(selectedProvider.type)
    : ''

  // Reset fields with defaults when provider type changes
  useEffect(() => {
    setFields(getDefaultFields(selectedProvider))
    setSetAsDefault(isAiType(selectedType) && !hasExistingAiAccount)
    // Same: this resets the fields when the chosen provider type changes, and
    // must not re-run because a value it reads happened to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedProvider?.flow === 'oauth') {
      onLink?.(selectedType)
      return
    }
    await onAdd(
      selectedType,
      fields,
      addToExisting,
      isAiType(selectedType) ? setAsDefault : undefined
    )
  }

  const handleFieldChange = (name: string, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }))
  }

  const isFormValid = () => {
    if (!selectedProvider) return false
    for (const field of selectedProvider.fields) {
      if (field.required && !fields[field.name]) {
        return false
      }
    }
    return true
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit} autoComplete='off'>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              <Trans>Add account</Trans>
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className='sr-only'>
              <Trans>Add a new account</Trans>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className='grid gap-4 py-4'>
            {availableProviders.length > 1 && (
              <div className='grid gap-2'>
                <Label htmlFor='type'>
                  <Trans>Account type</Trans>
                </Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id='type' className='w-full'>
                    <SelectValue placeholder={t`Select account type`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((provider) => (
                      <SelectItem key={provider.type} value={provider.type}>
                        {getProviderLabel(provider.type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProvider &&
              [...selectedProvider.fields]
                .sort((a, b) =>
                  a.name === 'label' ? -1 : b.name === 'label' ? 1 : 0
                )
                .map((field) => (
                  <div key={field.name} className='grid gap-2'>
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      type={
                        field.type === 'password' || field.type === 'email'
                          ? field.type
                          : 'text'
                      }
                      autoComplete='off'
                      value={fields[field.name] || ''}
                      onChange={(e) =>
                        handleFieldChange(field.name, e.target.value)
                      }
                      placeholder={field.placeholder || undefined}
                      required={field.required}
                    />
                  </div>
                ))}

            {selectedProvider &&
              selectedProvider.capabilities.includes('notify') && (
                <div className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='font-medium'>
                    <Trans>Add to existing notifications</Trans>
                  </div>
                  <Switch
                    checked={addToExisting}
                    onCheckedChange={setAddToExisting}
                  />
                </div>
              )}

            {selectedProvider && isAiType(selectedType) && (
              <div className='flex items-center justify-between'>
                <Label htmlFor='set-default'>
                  <Trans>Default AI account</Trans>
                </Label>
                <Switch
                  id='set-default'
                  checked={setAsDefault}
                  onCheckedChange={setSetAsDefault}
                />
              </div>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            {selectedProvider?.flow === 'oauth' ? (
              <Button
                type='submit'
                icon={<ExternalLink className='me-2 h-4 w-4' />}
              >
                <Trans>Continue with {providerLabel}</Trans>
              </Button>
            ) : (
              <Button
                type='submit'
                disabled={!isFormValid()}
                loading={isAdding}
                icon={<Plus className='me-2 h-4 w-4' />}
              >
                <Trans>Add</Trans>
              </Button>
            )}
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
