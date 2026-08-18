// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The "the container would not load" screen, which crm and projects each held
// twice: once in the container route and once in the object deep-link route.
// All four copies were the same header, the same Main, and the same inline
// GeneralError with a retry.

import type { ReactNode } from 'react'
import { Main } from '../layout/main'
import { PageHeader } from '../layout/page-header'
import { GeneralError } from '../../features/errors/general-error'

export interface EntityLoadErrorProps {
  title: string
  icon: ReactNode
  /** Back label and where it goes when there is no history to pop. */
  back: { label: string; onFallback: () => void }
  /** Already resolved by the app, so each keeps its own wording. */
  message: string
  onRetry: () => void
}

export function EntityLoadError({
  title,
  icon,
  back,
  message,
  onRetry,
}: EntityLoadErrorProps) {
  return (
    <>
      <PageHeader title={title} icon={icon} back={back} />
      <Main>
        <GeneralError
          error={new Error(message)}
          minimal
          mode="inline"
          reset={onRetry}
        />
      </Main>
    </>
  )
}
