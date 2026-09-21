// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// shadcn's combobox: a field that holds chips and a search input, with the
// list under it. The registry file is built on Base UI. This one composes the
// Radix Popover and cmdk parts the package already ships, so it adds no
// dependency and keeps the list in the same layer as every other popover
// inside a dialog. The list, group and item parts come from ./command.
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Command as CommandPrimitive } from 'cmdk'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Command } from './command'
import { Popover, PopoverContent } from './popover'

const ComboboxContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({ open: false, setOpen: () => {} })

const FIELD_SELECTOR = '[data-slot="combobox-chips"]'

function Combobox({
  open,
  onOpenChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Command>, 'shouldFilter'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const context = React.useMemo(
    () => ({ open, setOpen: onOpenChange }),
    [open, onOpenChange]
  )
  return (
    <ComboboxContext.Provider value={context}>
      <Popover open={open} onOpenChange={onOpenChange}>
        {/* The caller filters: directory results arrive after the query. */}
        <Command
          data-slot='combobox'
          shouldFilter={false}
          className={cn(
            'h-auto overflow-visible rounded-none bg-transparent',
            className
          )}
          {...props}
        >
          {children}
        </Command>
      </Popover>
    </ComboboxContext.Provider>
  )
}

function ComboboxChips({
  className,
  disabled,
  onMouseDown,
  ...props
}: React.ComponentProps<'div'> & { disabled?: boolean }) {
  return (
    <PopoverPrimitive.Anchor asChild>
      <div
        data-slot='combobox-chips'
        data-disabled={disabled || undefined}
        aria-disabled={disabled || undefined}
        className={cn(
          'border-border bg-background flex max-h-32 min-h-[var(--input-h)] w-full cursor-text flex-wrap items-center gap-1 overflow-y-auto rounded-md border-[length:var(--border-width)] px-2 py-1 text-base shadow-xs transition-[color,box-shadow,border-color,background-color] md:text-sm dark:bg-surface-1',
          'hover:border-border-strong hover:bg-hover/30',
          'focus-within:border-ring focus-within:ring-ring/20 focus-within:ring-[3px]',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          className
        )}
        onMouseDown={(event) => {
          // A press on the padding lands on the field, not the input.
          if (event.target === event.currentTarget) {
            event.preventDefault()
            event.currentTarget.querySelector('input')?.focus()
          }
          onMouseDown?.(event)
        }}
        {...props}
      />
    </PopoverPrimitive.Anchor>
  )
}

function ComboboxChip({
  className,
  children,
  removeLabel,
  onRemove,
  disabled,
  ...props
}: Omit<React.ComponentProps<'span'>, 'onClick'> & {
  /** Accessible name of the remove button. The caller translates it. */
  removeLabel: string
  onRemove?: () => void
  disabled?: boolean
}) {
  return (
    <span
      data-slot='combobox-chip'
      className={cn(
        'bg-muted text-foreground flex h-6 max-w-full items-center gap-1 rounded-sm ps-2 pe-0.5 text-xs font-medium',
        className
      )}
      {...props}
    >
      <span className='truncate'>{children}</span>
      <button
        type='button'
        aria-label={removeLabel}
        disabled={disabled}
        // Keep focus in the input so the list does not close or jump.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
        className='hover:bg-hover focus-visible:ring-ring/20 flex size-5 shrink-0 items-center justify-center rounded-sm opacity-60 outline-none hover:opacity-100 focus-visible:ring-[3px] disabled:pointer-events-none'
      >
        <X className='size-3' />
      </button>
    </span>
  )
}

function ComboboxInput({
  className,
  onFocus,
  onClick,
  onKeyDown,
  onValueChange,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  const { open, setOpen } = React.useContext(ComboboxContext)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const openList = () => {
    if (!open) setOpen(true)
  }

  // The list can be opened from outside, for example by a dialog that opens
  // it as it appears. Typing must work at once, so the input takes focus.
  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <CommandPrimitive.Input
      ref={inputRef}
      data-slot='combobox-input'
      className={cn(
        'placeholder:text-muted-foreground h-6 min-w-16 flex-1 bg-transparent text-base outline-none disabled:cursor-not-allowed md:text-sm',
        className
      )}
      onFocus={(event) => {
        openList()
        onFocus?.(event)
      }}
      onClick={(event) => {
        openList()
        onClick?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') openList()
        onKeyDown?.(event)
      }}
      onValueChange={(value) => {
        openList()
        onValueChange?.(value)
      }}
      {...props}
    />
  )
}

function ComboboxClear({
  className,
  label,
  ...props
}: Omit<React.ComponentProps<'button'>, 'aria-label'> & {
  /** Accessible name. The caller translates it. */
  label: string
}) {
  return (
    <button
      type='button'
      data-slot='combobox-clear'
      aria-label={label}
      // Keep focus in the input so the list does not close or jump.
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        'hover:bg-hover focus-visible:ring-ring/20 ms-auto flex size-6 shrink-0 items-center justify-center rounded-sm opacity-60 outline-none hover:opacity-100 focus-visible:ring-[3px]',
        className
      )}
      {...props}
    >
      <X className='size-4' />
    </button>
  )
}

function ComboboxContent({
  className,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      data-slot='combobox-content'
      align='start'
      className={cn('w-(--radix-popover-trigger-width) p-0', className)}
      {...props}
      // The input holds focus, so the list neither takes it on open nor gives
      // it back on close.
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onInteractOutside={(event) => {
        // The field is the list's anchor, not something outside it. Radix only
        // exempts a trigger, and there is none here.
        if ((event.target as Element | null)?.closest?.(FIELD_SELECTOR)) {
          event.preventDefault()
        }
        onInteractOutside?.(event)
      }}
    />
  )
}

export {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxInput,
  ComboboxClear,
  ComboboxContent,
}
