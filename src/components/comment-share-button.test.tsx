// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A comment's Share button opens the system share sheet on a touch screen and
// copies the link with a mouse, falling back to the copy wherever the sheet is
// refused. Closing the sheet is the person changing their mind, not a failure.
// Inside the shell the frame refuses the sheet, and the copy only works during
// the press, so there it copies at once without trying the sheet. The link is
// built when pressed, not on every render.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'

const copy = vi.fn<(text: string) => Promise<boolean>>()
let inShell = false
const success = vi.fn()
const failure = vi.fn()

vi.mock('../lib/shell-bridge', () => ({
  shellClipboardWrite: (text: string) => copy(text),
  isInShell: () => inShell,
}))
vi.mock('../lib/toast-utils', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => failure(...args),
  },
}))

import { CommentShareButton } from './comment-share-button'

const URL = 'https://example.org/forums/fp/post?comment=c1'

function pointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: coarse }) as never
}

const getUrl = vi.fn(() => URL)

function show() {
  render(
    <I18nProvider i18n={i18n}>
      <CommentShareButton getUrl={getUrl} />
    </I18nProvider>
  )
}

function press() {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
}

beforeEach(() => {
  inShell = false
  copy.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Reflect.deleteProperty(navigator, 'share')
})

describe('CommentShareButton', () => {
  it('copies the link with a mouse, even where a share sheet exists', async () => {
    pointer(false)
    const share = vi.fn()
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    press()
    await waitFor(() => expect(success).toHaveBeenCalled())
    expect(copy).toHaveBeenCalledWith(URL)
    expect(share).not.toHaveBeenCalled()
  })

  it('opens the share sheet on a touch screen, and copies nothing', async () => {
    pointer(true)
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    press()
    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: URL }))
    expect(copy).not.toHaveBeenCalled()
  })

  it('does nothing more when the sheet is closed', async () => {
    pointer(true)
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('closed', 'AbortError'))
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    press()
    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(copy).not.toHaveBeenCalled()
    expect(failure).not.toHaveBeenCalled()
  })

  it('copies instead when the sheet is refused, as in a sandboxed frame', async () => {
    pointer(true)
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('no', 'NotAllowedError'))
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    press()
    await waitFor(() => expect(copy).toHaveBeenCalledWith(URL))
    expect(success).toHaveBeenCalled()
  })

  it('says so when the copy fails', async () => {
    pointer(false)
    copy.mockResolvedValue(false)
    press()
    await waitFor(() => expect(failure).toHaveBeenCalled())
    expect(success).not.toHaveBeenCalled()
  })

  it('copies during the press inside the shell, without trying the sheet', () => {
    inShell = true
    pointer(true)
    const share = vi.fn()
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    press()
    // No waitFor: the copy has to start before the click handler returns.
    expect(copy).toHaveBeenCalledWith(URL)
    expect(share).not.toHaveBeenCalled()
  })

  it('builds the link only when pressed', () => {
    pointer(false)
    show()
    expect(getUrl).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(getUrl).toHaveBeenCalledTimes(1)
  })
})
