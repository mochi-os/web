// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The new-game dialog shared by chess, go and words. The shell owns the
// dialog, the friend picker and its three states, and the footer. Each game's
// own fields go in the `options` slot, and its own create mutation stays in
// the app behind `onSubmit`. Every string arrives resolved through `labels`,
// the way GameLayout already takes its own, so no Lingui string lives here.

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Plus, UserPlus, Users } from 'lucide-react'
import { Button } from '../ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '../ui/responsive-dialog'
import { Skeleton } from '../ui/skeleton'
import { PersonPicker, type Person } from '../person-picker'
import { GeneralError } from '../../features/errors/general-error'
import { shellNavigateExternal } from '../../lib/shell-bridge'

export interface GameNewGameDialogLabels {
  title: ReactNode
  /** Screen-reader only, e.g. "Start a new chess game". */
  description: ReactNode
  /** Above the picker. words puts its "(1-3)" hint inside this one. */
  opponentLabel: ReactNode
  emptyTitle: ReactNode
  emptyHint: ReactNode
  addFriends: ReactNode
  /** The picker takes plain strings, not nodes. */
  placeholder: string
  emptyMessage: string
  cancel: ReactNode
  submit: ReactNode
  submitting: ReactNode
}

export interface GameNewGameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  friends: Person[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  mode: 'single' | 'multiple'
  value: string | string[]
  onChange: (value: string | string[]) => void
  /** Under the picker. words counts the players here. */
  pickerFooter?: ReactNode
  /** The game's own fields: go's board size and komi, words' language. */
  options?: ReactNode
  canSubmit: boolean
  isSubmitting: boolean
  onSubmit: () => void
  labels: GameNewGameDialogLabels
}

export function GameNewGameDialog({
  open,
  onOpenChange,
  friends,
  isLoading,
  error,
  onRetry,
  mode,
  value,
  onChange,
  pickerFooter,
  options,
  canSubmit,
  isSubmitting,
  onSubmit,
  labels,
}: GameNewGameDialogProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  // Drop the picker's own open state with the dialog, so reopening does not
  // flash the list from last time.
  useEffect(() => {
    if (!open) setPickerOpen(false)
  }, [open])

  // The picker opens itself once the list has arrived. The delay lets the
  // dialog finish its own entrance first.
  useEffect(() => {
    if (open && !isLoading && friends.length > 0) {
      const timer = setTimeout(() => setPickerOpen(true), 50)
      return () => clearTimeout(timer)
    }
  }, [open, isLoading, friends.length])

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldCloseOnInteractOutside={false}
    >
      <ResponsiveDialogContent className="sm:max-w-[420px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            {labels.title}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {labels.description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{labels.opponentLabel}</label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : error ? (
              <GeneralError error={error} minimal mode="inline" reset={onRetry} />
            ) : friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border py-8 text-center">
                <UserPlus className="text-muted-foreground mb-3 h-10 w-10 opacity-50" />
                <p className="text-muted-foreground text-sm font-medium">
                  {labels.emptyTitle}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {labels.emptyHint}
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => shellNavigateExternal('/people/?action=add')}
                >
                  <Users className="size-4" />
                  {labels.addFriends}
                </Button>
              </div>
            ) : (
              <PersonPicker
                mode={mode}
                value={value}
                onChange={onChange}
                local={friends}
                placeholder={labels.placeholder}
                emptyMessage={labels.emptyMessage}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
              />
            )}
            {pickerFooter}
          </div>

          {options}
        </div>

        <ResponsiveDialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {labels.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isSubmitting ? labels.submitting : labels.submit}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
