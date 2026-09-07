// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldRow } from './section'

describe('FieldRow', () => {
  it('is a definition list: the term and its value sit inside a dl', () => {
    const { container } = render(
      <FieldRow label='Name' description='Shown to others'>
        <span>Ann</span>
      </FieldRow>
    )
    const list = container.querySelector('dl')
    expect(list).not.toBeNull()
    expect(list!.querySelector('dt')).toHaveTextContent('Name')
    expect(list!.querySelector('dt')).toHaveTextContent('Shown to others')
    expect(list!.querySelector('dd')).toHaveTextContent('Ann')
    expect(container.querySelectorAll('dt, dd')).toHaveLength(2)
    expect(screen.getByText('Ann').closest('dl')).toBe(list)
  })
})
