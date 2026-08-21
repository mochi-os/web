// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The dropdown navigates to an app-authored link in the trusted top window, so
// these drive the actual click rather than asserting on the source.

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

// MochiMenu decides whether a notification affordance exists at all, from
// whether a data source was supplied. An app with no way to read notifications
// must show nothing rather than an empty list, which would assert the user has
// none when the component cannot know.
describe('MochiMenu notification affordance', () => {
  async function renderMenu(props: Record<string, unknown>) {
    const { MochiMenu } = await import('./mochi-menu')
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    // MochiMenu renders EntityAvatar, which queries for the accent colour.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={client}>
        <I18nProvider i18n={i18n}>
          <MochiMenu {...props} />
        </I18nProvider>
      </QueryClientProvider>
    )
  }

  // The trigger's accessible name is derived from the unread count, so it
  // reports whether the data reached MochiMenu without needing to open the
  // Radix portal. NotificationsSection's own rendering is covered above.
  it('counts unread notifications when a source is supplied', async () => {
    await renderMenu({
      notifications: {
        items: [notification('/feeds/abc')],
        markAsRead: () => {},
        markAllAsRead: () => {},
      },
    })
    expect(screen.getByLabelText('Open menu (1 unread notification)')).toBeInTheDocument()
  })

  it('offers no notification affordance when no source is supplied', async () => {
    await renderMenu({})
    // Plain "Open menu": no count, so nothing claims the user has none either.
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
    expect(screen.queryByLabelText(/unread/i)).not.toBeInTheDocument()
  })
})
