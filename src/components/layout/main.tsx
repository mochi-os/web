// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../../lib/utils'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  fluid?: boolean
  /** Use consistent vertical spacing tokens for content stacking */
  spacingY?: 'xs' | 'sm' | 'default' | 'lg' | 'xl'
}

const spacingYClasses = {
  xs: 'py-2', // --content-spacing-xs
  sm: 'py-2', // --content-spacing-sm
  default: 'py-6', // --content-spacing
  lg: 'py-8', // --content-spacing-lg
  xl: 'py-12', // --content-spacing-xl
}

export function Main({
  fixed,
  className,
  fluid,
  spacingY = 'sm',
  ...props
}: MainProps) {
  return (
    <main
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        'px-2 md:px-4',
        spacingYClasses[spacingY],

        // If layout is fixed, make the main container flex and grow
        fixed && 'flex grow flex-col overflow-hidden',

        // If layout is not fluid, set the max-width
        !fluid &&
        '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...props}
    />
  )
}
