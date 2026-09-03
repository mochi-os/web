// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'

vi.mock('../../lib/shell-storage', () => ({
  getItem: vi.fn(async () => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}))

import { getItem, setItem } from '../../lib/shell-storage'
import { RightPanel, RightPanelCloseButton, RightPanelProvider } from './right-panel'

function show() {
  render(
    <I18nProvider i18n={i18n}>
      <RightPanelProvider defaultOpen>
        <RightPanel>
          <span>panel body</span>
          <RightPanelCloseButton />
        </RightPanel>
      </RightPanelProvider>
    </I18nProvider>
  )
}

describe('RightPanel persistence', () => {
  beforeEach(() => {
    // A desktop width: below it the panel is a sheet with its own state.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 })
    vi.mocked(getItem).mockReset().mockResolvedValue(null)
    vi.mocked(setItem).mockClear()
  })

  it('writes the open state to shell storage, which works inside the sandboxed iframe', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /close panel/i }))
    expect(setItem).toHaveBeenCalledWith('right_panel_state', 'false')
  })

  it('reads a stored closed state back on mount', async () => {
    vi.mocked(getItem).mockResolvedValue('false')
    show()
    expect(getItem).toHaveBeenCalledWith('right_panel_state')
    await waitFor(() => expect(screen.queryByText('panel body')).not.toBeInTheDocument())
  })
})
