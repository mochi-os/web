// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { Check, Minus, MoreHorizontal, Plus } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from '../ui/responsive-dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ColourPicker, PRESET_COLOURS } from '../colour-picker'
import type { EntityFieldOption } from '../../types/entity-object'

interface EntityOptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  /** Present for edit mode, absent for add mode. */
  option?: EntityFieldOption | null
  onUpdate?: (updates: { name?: string; colour?: string }) => void
  onDelete?: () => void
  onAdd?: (name: string, colour: string) => void | Promise<void>
}

/**
 * Add and edit a select-field option, shared by the crm and projects apps. One
 * dialog for both modes, so the add and edit forms cannot drift apart.
 */
export function EntityOptionDialog({
  open,
  onOpenChange,
  title,
  option,
  onUpdate,
  onDelete,
  onAdd,
}: EntityOptionDialogProps) {
  const isEdit = !!option
  const [name, setName] = useState('')
  const [colour, setColour] = useState(PRESET_COLOURS[1])

  useEffect(() => {
    if (!open) return
    if (option) {
      setName(option.name)
      setColour(option.colour)
    } else {
      setName('')
      setColour(
        PRESET_COLOURS[Math.floor(Math.random() * PRESET_COLOURS.length)]
      )
    }
  }, [open, option])

  const handleAdd = async () => {
    if (name.trim() && onAdd) {
      await onAdd(name.trim(), colour)
      onOpenChange(false)
    }
  }

  const handleSave = () => {
    if (option && onUpdate) {
      if (name.trim() !== option.name || colour !== option.colour) {
        onUpdate({ name: name.trim(), colour })
      }
    }
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent showCloseButton={false}>
        <ResponsiveDialogHeader className='flex flex-row items-center justify-between'>
          <ResponsiveDialogTitle>
            {title || (isEdit ? t`Edit option` : t`Add option`)}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            <Trans>Configure option settings</Trans>
          </ResponsiveDialogDescription>
          {isEdit && onDelete && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-8'
                      aria-label={t`Open option actions`}
                    >
                      <MoreHorizontal className='size-4' />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t`Open option actions`}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={onDelete}>
                  <Minus className='size-4' />
                  <Trans>Delete option</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </ResponsiveDialogHeader>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='option-name'>
              <Trans>Name</Trans>
            </Label>
            <Input
              id='option-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  e.preventDefault()
                  if (isEdit) {
                    handleSave()
                  } else {
                    void handleAdd()
                  }
                }
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label>
              <Trans>Colour</Trans>
            </Label>
            <ColourPicker value={colour} onChange={setColour} />
          </div>
          <div className='flex items-center gap-2'>
            <span
              className='size-4 rounded-full'
              style={{ backgroundColor: colour }}
            />
            <span className='text-sm'>{name || t`Option name`}</span>
          </div>
        </div>
        <ResponsiveDialogFooter>
          {isEdit ? (
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button type='button' onClick={handleSave}>
                <Check className='size-4' />
                <Trans>Save</Trans>
              </Button>
            </>
          ) : (
            <>
              {/* Add mode had no way out but Escape: the header's close button
                  is suppressed so it cannot collide with the edit-mode actions
                  menu, and only edit mode carried a Cancel. */}
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                type='button'
                onClick={() => void handleAdd()}
                disabled={!name.trim()}
              >
                <Plus className='size-4' />
                <Trans>Add option</Trans>
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
