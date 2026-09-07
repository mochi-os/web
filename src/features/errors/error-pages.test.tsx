// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))
vi.mock('../../lib/shell-bridge', () => ({
  shellNavigateBack: vi.fn(),
}))

import { shellNavigateBack } from '../../lib/shell-bridge'
import { NotFoundError } from './not-found-error'
import { AccessDeniedError } from './access-denied-error'

// history.go(-1) is a silent no-op inside the shell's sandboxed iframe, which
// has no history entries of its own; shellNavigateBack asks the top window.
describe('error pages go back through the shell bridge', () => {
  beforeEach(() => {
    vi.mocked(shellNavigateBack).mockClear()
  })

  it('not found', () => {
    render(<I18nProvider i18n={i18n}><NotFoundError /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(shellNavigateBack).toHaveBeenCalledTimes(1)
  })

  it('access denied', () => {
    render(<I18nProvider i18n={i18n}><AccessDeniedError /></I18nProvider>)
    expect(screen.getByText('Access denied')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(shellNavigateBack).toHaveBeenCalledTimes(1)
  })
})
