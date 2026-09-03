// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { useLingui } from '@lingui/react/macro'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Textarea } from './textarea'
import { FieldRow } from '../layout/section'
import { cn } from '../../lib/utils'

export interface EditableFieldRowProps {
  label: string
  value: string
  onSave: (value: string) => Promise<void> | void
  canEdit?: boolean
  validate?: (value: string) => string | null
  multiline?: boolean
  placeholder?: string
  emphasize?: boolean
  description?: string
  className?: string
  maxLength?: number
}

export function EditableFieldRow({
  label,
  value,
  onSave,
  canEdit = true,
  validate,
  multiline,
  placeholder,
  emphasize,
  description,
  className,
  maxLength,
}: EditableFieldRowProps) {
  const { t } = useLingui()
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const startEdit = () => {
    setDraft(value)
    setError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setDraft(value)
    setError(null)
  }

  const save = async () => {
    const trimmed = draft.trim()
    if (validate) {
      const validationError = validate(trimmed)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    if (trimmed === value) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(trimmed)
      setIsEditing(false)
    } catch {
      // Keep the row in edit mode so the user can retry; the caller surfaces
      // the error (typically via a toast).
    } finally {
      setSaving(false)
    }
  }

  return (
    <FieldRow label={label} description={description} className={className}>
      {canEdit && isEditing ? (
        <div className='flex w-full flex-col gap-1'>
          <div className={cn('flex w-full gap-2', multiline ? 'items-start' : 'items-center')}>
            {multiline ? (
              <Textarea
                maxLength={maxLength}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelEdit()
                }}
                className='min-h-[80px] flex-1'
                disabled={saving}
                autoFocus
              />
            ) : (
              <Input
                maxLength={maxLength}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save()
                  if (e.key === 'Escape') cancelEdit()
                }}
                className='h-8 flex-1'
                disabled={saving}
                autoFocus
              />
            )}
            <Button
              size='sm'
              variant='ghost'
              onClick={() => void save()}
              disabled={saving}
              className='size-8 shrink-0 p-0'
              aria-label={t`Save`}
            >
              {saving ? <Loader2 className='size-4 animate-spin' /> : <Check className='size-4' />}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={cancelEdit}
              disabled={saving}
              className='size-8 shrink-0 p-0'
              aria-label={t`Cancel`}
            >
              <X className='size-4' />
            </Button>
          </div>
          {error && <span className='text-destructive text-sm'>{error}</span>}
        </div>
      ) : (
        <div className='flex w-full items-center gap-2'>
          {value ? (
            <span className={cn('min-w-0 break-words', emphasize && 'text-foreground text-base font-semibold')}>
              {value}
            </span>
          ) : (
            <span className='text-muted-foreground italic'>{placeholder ?? t`Not set`}</span>
          )}
          {canEdit && (
            <Button
              size='sm'
              variant='ghost'
              onClick={startEdit}
              className='size-6 shrink-0 p-0'
              aria-label={t`Edit ${label}`}
            >
              <Pencil className='size-3.5 text-muted-foreground' />
            </Button>
          )}
        </div>
      )}
    </FieldRow>
  )
}
