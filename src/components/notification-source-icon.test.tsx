// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { NotificationSourceIcon } from './notification-source-icon'

describe('NotificationSourceIcon', () => {
  it('is decorative when no display name is known', () => {
    const { container } = render(<NotificationSourceIcon app='feeds' isUnread={false} />)
    const image = container.querySelector('img')!
    expect(image.getAttribute('alt')).toBe('')
    fireEvent.error(image)
    // The fallback is a generic glyph, never the first letter of an id.
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('uses the display name for the alt text and the fallback glyph', () => {
    const { container } = render(<NotificationSourceIcon app='feeds' name='Feeds' isUnread={false} />)
    const image = container.querySelector('img')!
    expect(image.getAttribute('alt')).toBe('Feeds')
    fireEvent.error(image)
    expect(container.textContent).toBe('F')
  })
})
