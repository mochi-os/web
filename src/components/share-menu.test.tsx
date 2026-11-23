// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareMenu, ShareSubmenu, type ShareProps } from './share-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const shell = vi.hoisted(() => ({
  external: vi.fn(),
  clipboard: vi.fn((_: string) => Promise.resolve(true)),
}))
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/shell-bridge')>()),
  shellNavigateExternal: (url: string) => shell.external(url),
  shellClipboardWrite: (text: string) => shell.clipboard(text),
}))
vi.mock('../lib/toast-utils', () => ({ toast: toasts }))

const labels = {
  feed: 'Post to a feed',
  chat: 'Send in a chat',
  copy: 'Copy link',
}

const event = () => ({ text: 'Stand-up, Monday 09:00', url: 'https://e.org/x' })

function press(name: string) {
  fireEvent.pointerDown(screen.getByRole('button', { name }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
}

function menu(props: Partial<ShareProps> = {}) {
  i18n.load('en', {})
  i18n.activate('en')
  render(
    <I18nProvider i18n={i18n}>
      <ShareMenu share={event} labels={labels} {...props}>
        <button type='button'>Share</button>
      </ShareMenu>
    </I18nProvider>
  )
  press('Share')
}

function sent(mock: typeof shell.external) {
  const address = new URL(mock.mock.calls[0][0] as string, 'https://here')
  return {
    path: address.pathname,
    text: address.searchParams.get('text'),
    url: address.searchParams.get('url'),
  }
}

beforeEach(() => {
  shell.external.mockReset()
  shell.clipboard.mockReset()
  shell.clipboard.mockImplementation(() => Promise.resolve(true))
  toasts.success.mockReset()
  toasts.error.mockReset()
})

describe('ShareMenu', () => {
  it('offers a feed first, as the likeliest, then a chat, then the link', () => {
    menu()
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Post to a feed',
      'Send in a chat',
      'Copy link',
    ])
  })

  it("hands Feeds the words and the address for its new post dialog", () => {
    menu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Post to a feed' }))
    expect(sent(shell.external)).toEqual({
      path: '/feeds/share',
      text: 'Stand-up, Monday 09:00',
      url: 'https://e.org/x',
    })
  })

  it('hands Chat the same, for a chat the user picks', () => {
    menu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send in a chat' }))
    expect(sent(shell.external)).toEqual({
      path: '/chat/share',
      text: 'Stand-up, Monday 09:00',
      url: 'https://e.org/x',
    })
  })

  it('copies the shared address, and says so', async () => {
    menu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }))
    expect(shell.clipboard).toHaveBeenCalledWith('https://e.org/x')
    await waitFor(() => expect(toasts.success).toHaveBeenCalled())
  })

  it('has no Copy link for something with no address', () => {
    menu({ share: () => ({ text: 'Stand-up' }) })
    expect(screen.queryByRole('menuitem', { name: 'Copy link' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Send in a chat' })).toBeTruthy()
  })

  it('asks for a join link as it opens, and copies it within the press', async () => {
    const link = vi.fn(() => Promise.resolve('mochi://peer/abc'))
    menu({ link })
    expect(link).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }))
    // THE POINT: no wait between the press and the copy, which the shell's
    // clipboard needs; the address the posts carry is not what is copied.
    expect(shell.clipboard).toHaveBeenCalledWith('mochi://peer/abc')
  })

  it('says so when the join link comes back empty, rather than doing nothing', async () => {
    menu({ link: () => Promise.resolve('') })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }))
    await waitFor(() => expect(toasts.error).toHaveBeenCalled())
    expect(shell.clipboard).not.toHaveBeenCalled()
  })

  it('says why when the join link cannot be had', async () => {
    menu({ link: () => Promise.reject(new Error('Not yours to share')) })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }))
    await waitFor(() => expect(toasts.error).toHaveBeenCalled())
    expect(shell.clipboard).not.toHaveBeenCalled()
  })
})

describe('ShareSubmenu', () => {
  it("is Share within the app's own menu, with the same entries", async () => {
    const link = vi.fn(() => Promise.resolve('mochi://peer/abc'))
    i18n.load('en', {})
    i18n.activate('en')
    render(
      <I18nProvider i18n={i18n}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type='button'>More options</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <ShareSubmenu share={event} link={link} labels={labels} />
          </DropdownMenuContent>
        </DropdownMenu>
      </I18nProvider>
    )
    press('More options')
    expect(link).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share' }))
    await screen.findByRole('menuitem', { name: 'Post to a feed' })
    expect(link).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send in a chat' }))
    expect(sent(shell.external).path).toBe('/chat/share')
  })
})
