// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Asserted against the source, the way api-client.test.ts checks its
// same-origin guard. Driving this through the rendered tree would be better,
// but Radix's dropdown does not open under jsdom - it needs the full pointer
// sequence @testing-library/user-event dispatches, and that is not a
// dependency of this package. A test that cannot open the menu can only
// assert that nothing happened, which passes whether or not the wiring is
// right; this at least fails if the confirmation is taken back out.
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
