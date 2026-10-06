// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from './entity-test-utils'
import { EntityDesignLayout } from './entity-design-layout'

function show() {
  render(
    <EntityDesignLayout
      editor={<p>views and classes</p>}
      preview={<p>the table</p>}
      labels={{ edit: 'Edit', preview: 'Preview' }}
    />
  )
  return {
    editor: screen
      .getByText('views and classes')
      .closest('[role=tabpanel]') as HTMLElement,
    preview: screen
      .getByText('the table')
      .closest('[role=tabpanel]') as HTMLElement,
  }
}

// jsdom applies no media queries, so the classes say what each width gets.
describe('EntityDesignLayout', () => {
  it('keeps both panels mounted and opens on the editor', () => {
    const { editor, preview } = show()
    expect(editor).toHaveAttribute('data-state', 'active')
    expect(preview).toHaveAttribute('data-state', 'inactive')
  })

  it('switches to the preview from its tab', () => {
    const { editor, preview } = show()
    // Radix tabs select on mouse down, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Preview' }))
    expect(preview).toHaveAttribute('data-state', 'active')
    expect(editor).toHaveAttribute('data-state', 'inactive')
  })

  it('hides the inactive panel only below 1024 px, and the tabs from it up', () => {
    const { editor, preview } = show()
    for (const panel of [editor, preview]) {
      expect(panel.className).toContain('max-lg:data-[state=inactive]:hidden')
    }
    expect(editor.className).toContain('lg:w-80')
    expect(screen.getByRole('tablist').className).toContain('lg:hidden')
  })
})
