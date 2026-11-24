// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationSourceIcon } from './notification-source-icon'

describe('NotificationSourceIcon', () => {
  it('is decorative when no display name is known', () => {
    const { container } = render(
      <NotificationSourceIcon app='feeds' isUnread={false} />
    )
    const image = container.querySelector('img')!
    expect(image.getAttribute('alt')).toBe('')
    fireEvent.error(image)
    // The fallback is a generic glyph, never the first letter of an id.
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it("shows the icon at the app's path, and a sender's avatar instead", () => {
    const { container } = render(
      <NotificationSourceIcon app='chat' isUnread={false} />
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/chat/images/icon.svg'
    )
    // The avatar asks for the sender's accent colour.
    const sent = render(
      <QueryClientProvider client={new QueryClient()}>
        <NotificationSourceIcon app='chat' sender='person1' isUnread={false} />
      </QueryClientProvider>
    )
    const sources = Array.from(sent.container.querySelectorAll('img')).map(
      (image) => image.getAttribute('src')
    )
    expect(sources).not.toContain('/chat/images/icon.svg')
  })

  it('uses the display name for the alt text and the fallback glyph', () => {
    const { container } = render(
      <NotificationSourceIcon app='feeds' name='Feeds' isUnread={false} />
    )
    const image = container.querySelector('img')!
    expect(image.getAttribute('alt')).toBe('Feeds')
    fireEvent.error(image)
    expect(container.textContent).toBe('F')
  })
})
