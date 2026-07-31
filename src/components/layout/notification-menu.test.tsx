// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The notification dropdown navigates to an app-authored string, in the
// trusted top window, where nothing else stands between that string and
// window.location. These drive the actual click rather than asserting on the
// component's source, which is all that was possible before the vitest config
// learned to transform the Lingui macro.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import type { Notification } from '../notifications-dropdown'

const navigateExternal = vi.fn()
const toastError = vi.fn()

vi.mock('../../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/shell-bridge')>()),
  shellNavigateExternal: (url: string) => navigateExternal(url),
}))

vi.mock('../../lib/toast-utils', () => ({
  toast: { error: (message: string) => toastError(message) },
}))

const { NotificationsSection } = await import('./notification-menu')

function notification(link: string): Notification {
  return {
    id: 'n1',
    app: 'feeds',
    topic: 'invite',
    object: 'o1',
    content: 'A notification',
    link,
    read: 0,
    created: 1_700_000_000,
  } as Notification
}

function renderOne(link: string) {
  return render(
    <I18nProvider i18n={i18n}>
      <NotificationsSection
        onClose={() => {}}
        notifications={[notification(link)]}
        markAsRead={() => {}}
        markAllAsRead={() => {}}
      />
    </I18nProvider>
  )
}

// The row listens on onAuxClick and filters on button === 1. fireEvent has no
// auxClick helper in this version, so dispatch the DOM event React maps it to.
function middleClick(element: Element) {
  fireEvent(element, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
}

let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  navigateExternal.mockReset()
  toastError.mockReset()
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  openSpy.mockRestore()
})

describe('notification link navigation', () => {
  it('navigates to a same-origin link', async () => {
    renderOne('/feeds/abc')

    // Positive control: the row renders and its click handler is reachable, so
    // a later "did not navigate" assertion means refusal rather than a test
    // that never clicked anything.
    fireEvent.click(screen.getByText('A notification'))

    expect(navigateExternal).toHaveBeenCalledWith('/feeds/abc')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('refuses a javascript: link and says so', async () => {
    renderOne('javascript:alert(1)')

    fireEvent.click(screen.getByText('A notification'))

    expect(navigateExternal).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('refuses an off-origin link', async () => {
    renderOne('https://attacker.example/x')

    fireEvent.click(screen.getByText('A notification'))

    expect(navigateExternal).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('refuses a protocol-relative link', async () => {
    renderOne('//attacker.example/x')

    fireEvent.click(screen.getByText('A notification'))

    expect(navigateExternal).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('opens a same-origin link on middle click, with the opener severed', async () => {
    renderOne('/feeds/abc')

    middleClick(screen.getByText('A notification'))

    expect(openSpy).toHaveBeenCalledWith('/feeds/abc', '_blank', 'noopener,noreferrer')
  })

  it('refuses a javascript: link on middle click too', async () => {
    renderOne('javascript:alert(1)')

    middleClick(screen.getByText('A notification'))

    expect(openSpy).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })
})
