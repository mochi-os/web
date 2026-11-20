// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetworkSetup } from './network-setup'

const state = vi.hoisted(() => ({ external: vi.fn() }))

vi.mock('../lib/shell-bridge', async (original) => ({
  ...(await original<typeof import('../lib/shell-bridge')>()),
  shellNavigateExternal: state.external,
}))

describe('NetworkSetup', () => {
  const before = window.location.href
  afterEach(() => {
    window.history.replaceState(null, '', before)
    state.external.mockReset()
  })

  it('names the network and opens Settings › Networks at it, coming back here', () => {
    window.history.replaceState(
      null,
      '',
      '/feeds/abc/settings?_shell=1&tab=publish'
    )
    render(<NetworkSetup network='fediverse' label='Set up' />)
    expect(screen.getByText('ActivityPub')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set up' }))
    expect(state.external).toHaveBeenCalledWith(
      '/settings/user/networks?network=fediverse&back=%2Ffeeds%2Fabc%2Fsettings%3Ftab%3Dpublish'
    )
  })
})
