// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '../../context/theme-provider'

// Default durations (in ms): success/info 6s, error 10s
const DEFAULT_DURATION = 6000

export function Toaster({ duration = DEFAULT_DURATION, closeButton = true, ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      duration={duration}
      closeButton={closeButton}
      position="bottom-right"
      className='toaster group'
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
