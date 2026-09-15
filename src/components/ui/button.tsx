// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border-[length:var(--border-width)] border-primary/30 shadow-sm hover:bg-primary/90 hover:shadow-md active:bg-primary/80',
        destructive:
          'bg-destructive text-destructive-foreground border-[length:var(--border-width)] border-destructive/50 shadow-sm hover:bg-destructive/90 hover:shadow-md active:bg-destructive/80',
        warning:
          'bg-warning text-warning-foreground border-[length:var(--border-width)] border-warning/50 shadow-sm hover:bg-warning/90 hover:shadow-md active:bg-warning/80',
        outline:
          'border-[length:var(--border-width)] border-border bg-background hover:border-border-strong hover:bg-hover active:bg-interactive-active dark:bg-surface-1',
        ghost: 'hover:bg-hover active:bg-interactive-active',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[var(--control-height-md)] px-4 py-2 has-[>svg]:px-3',
        sm: 'h-[var(--control-height-sm)] rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-[var(--control-height-lg)] rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-[var(--control-height-md)]',
        xs: 'h-[var(--control-height-xs)] rounded-md px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

type ButtonLoadingProps = {
  loading?: boolean
  icon?: React.ReactNode
}

type ButtonSlotProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild: true
    loading?: never
    icon?: never
  }

type ButtonNativeProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> &
  ButtonLoadingProps & { asChild?: false }

// Overloaded so `React.ComponentProps<typeof Button>` (used by several
// existing call sites to `extend`/`Omit` the props type) resolves to the
// plain `ButtonNativeProps` object type below rather than a union — an
// interface cannot `extend` a union, and consumers built for the old
// single-object props type would break. The overloads still enforce the
// asChild/loading exclusion at every call site; only the implementation
// signature underneath is a union.
function Button(props: ButtonSlotProps): React.JSX.Element
function Button(props: ButtonNativeProps): React.JSX.Element
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonSlotProps | ButtonNativeProps) {
  if (asChild) {
    return (
      <Slot
        data-slot='button'
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }

  const { loading, icon, disabled, children, ...rest } = props

  return (
    <button
      data-slot='button'
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...rest}
    >
      {loading ? (
        <Loader2
          data-slot='button-spinner'
          className='animate-spin'
          aria-hidden='true'
        />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

export { Button, buttonVariants }
export type { ButtonLoadingProps }
