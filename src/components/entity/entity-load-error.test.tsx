// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { FileText } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { EntityLoadError } from './entity-load-error'
import { fireEvent, render, screen } from './entity-test-utils'

function renderError(overrides: Record<string, unknown> = {}) {
  const onRetry = vi.fn()
  const onFallback = vi.fn()
  render(
    <EntityLoadError
      title='Acme sales'
      icon={<FileText />}
      back={{ label: 'Back', onFallback }}
      message='That CRM could not be loaded'
      onRetry={onRetry}
      {...overrides}
    />
  )
  return { onRetry, onFallback }
}

describe('EntityLoadError', () => {
  it('shows the wording the app resolved, not a generic failure', () => {
    renderError()
    expect(screen.getByText('That CRM could not be loaded')).toBeInTheDocument()
  })

  // PageHeader lays its title out once per breakpoint, so both copies are here.
  it('keeps the container named while the error is up', () => {
    renderError()
    expect(screen.getAllByText('Acme sales').length).toBeGreaterThan(0)
  })

  it('hands a retry back to the app instead of reloading', () => {
    const { onRetry } = renderError()
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
