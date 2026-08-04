// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Guards the breakpoint swap: the root and every part must always pick the same
// variant, or the portal throws "`DialogPortal` must be used within `Dialog`".
//
// Read what this does NOT do. It passes against the pre-fix code as well: jsdom
// delivers one resize event and React batches every listener into a single
// commit, so the tear the fix targets cannot happen here. It catches an outright
// mismatch, not the race. The race has to be confirmed in a real browser.

import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './responsive-dialog'

function resizeTo(width: number) {
  act(() => {
    window.innerWidth = width
    window.dispatchEvent(new Event('resize'))
  })
}

function Fixture({ open }: { open: boolean }) {
  return (
    <I18nProvider i18n={i18n}>
      <ResponsiveDialog open={open} onOpenChange={() => {}}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Share link</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <p>body</p>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </I18nProvider>
  )
}

describe('ResponsiveDialog across the md breakpoint', () => {
  it('survives desktop → mobile while open', () => {
    window.innerWidth = 1280
    render(<Fixture open />)
    expect(screen.getByText('Share link')).toBeTruthy()

    resizeTo(500)
    expect(screen.getByText('Share link')).toBeTruthy()
  })

  it('survives mobile → desktop while open', () => {
    window.innerWidth = 500
    render(<Fixture open />)

    resizeTo(1280)
    expect(screen.getByText('Share link')).toBeTruthy()
  })

  it('survives resizing while closed', () => {
    window.innerWidth = 1280
    render(<Fixture open={false} />)

    resizeTo(500)
    resizeTo(1280)
    expect(screen.queryByText('Share link')).toBeNull()
  })
})
