// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { OptionsMenu } from './options-menu'

const navigation = vi.hoisted(() => ({
  external: vi.fn(),
  clipboard: vi.fn((_: string) => Promise.resolve(true)),
}))

vi.mock('../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/shell-bridge')>()),
  shellNavigateExternal: (url: string) => navigation.external(url),
  shellClipboardWrite: (text: string) => navigation.clipboard(text),
}))

// Asserted against the source: Radix's dropdown does not open under jsdom
// without
// @testing-library/user-event, which this package does not depend on, and a test
// that cannot open the menu passes either way.
const SOURCE = readFileSync(resolve(__dirname, 'options-menu.tsx'), 'utf8')

describe('OptionsMenu revoking RSS access', () => {
  it('opens a confirmation rather than revoking on the click', () => {
    // Revoking breaks every reader currently polling the URL, so it must not
    // fire from a single menu selection.
    expect(SOURCE).toContain('onSelect={() => setRevokeRssOpen(true)}')
    expect(SOURCE).not.toContain('onSelect={() => void handleRevokeRss()}')
  })

  it('renders a destructive ConfirmDialog for it', () => {
    expect(SOURCE).toContain('<ConfirmDialog')
    expect(SOURCE).toContain('handleConfirm={() => void handleRevokeRss()}')
    expect(SOURCE).toContain('destructive')
  })

  it('tells the reader a new URL can be copied afterwards', () => {
    // Load-bearing, not decoration: revoking is also the only way to reissue,
    // because minting returns the existing token unchanged - so a feed whose
    // core token is gone stays broken until the row is cleared. Nothing else
    // in the interface says so.
    expect(SOURCE).toContain('You can copy a new URL afterwards.')
  })
})

const labels = {
  feed: 'Post to a feed',
  chat: 'Send in a chat',
  copy: 'Copy link',
}

function share(createShareLink: (entity: string) => Promise<string>) {
  i18n.load('en', {})
  i18n.activate('en')
  render(
    <I18nProvider i18n={i18n}>
      <OptionsMenu
        entityId='abcdefghi'
        canShare
        shareLabels={labels}
        shareName='Garden notes'
        shareUrl={() => 'https://example.org/feeds/abcdefghi'}
        createShareLink={createShareLink}
        createRssToken={() => Promise.resolve('')}
        revokeRssToken={() => Promise.resolve()}
      />
    </I18nProvider>
  )
  fireEvent.pointerDown(screen.getByRole('button', { name: 'More options' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Share' }))
}

describe('OptionsMenu Share', () => {
  it("copies the entity's mochi:// link, asked for as Share opens", async () => {
    navigation.clipboard.mockClear()
    const createShareLink = vi.fn(() =>
      Promise.resolve('mochi://example.org/abcdefghi')
    )
    share(createShareLink)
    expect(createShareLink).toHaveBeenCalledWith('abcdefghi')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }))
    await waitFor(() =>
      expect(navigation.clipboard).toHaveBeenCalledWith(
        'mochi://example.org/abcdefghi'
      )
    )
  })

  it("posts the entity's name and page address to a feed", async () => {
    navigation.external.mockReset()
    share(() => Promise.resolve('mochi://example.org/abcdefghi'))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Post to a feed' })
    )
    expect(navigation.external).toHaveBeenCalledTimes(1)
    const address = new URL(
      navigation.external.mock.calls[0][0],
      'https://here'
    )
    expect(address.pathname).toBe('/feeds/share')
    expect(address.searchParams.get('text')).toBe('Garden notes')
    expect(address.searchParams.get('url')).toBe(
      'https://example.org/feeds/abcdefghi'
    )
  })
})
