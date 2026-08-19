// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Four copies of this screen lived in crm and projects, one per container
// route and one per object deep-link route, and none of them was ever
// rendered by a test. The screen is what a reader sees when the container
// will not load, so the two things worth holding are that the app's own
// wording survives the trip through GeneralError, and that retry reaches the
// app rather than reloading the page.
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
