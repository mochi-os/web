// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Comments collapse the way Reddit does it: the thread line and the +/- button
// for everyone, and a tap on the avatar or header line on touch screens only.
// The body, links and buttons keep their own meaning so reading, selecting and
// acting on a comment never folds the thread away.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { CommentTreeLayout } from './comment-tree-layout'

function show({
  isCollapsed = false,
  hasChildren = true,
}: { isCollapsed?: boolean; hasChildren?: boolean } = {}) {
  const onToggleCollapse = vi.fn()
  const view = render(
    <I18nProvider i18n={i18n}>
      <CommentTreeLayout
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        hasChildren={hasChildren}
        avatar={<span>avatar</span>}
        content={
          <div>
            <div data-comment-header=''>
              <span>author</span>
              <a href='#profile'>profile</a>
            </div>
            <p>body</p>
            <button type='button'>reply</button>
          </div>
        }
        collapsedContent={<span>summary</span>}
      >
        <span>child</span>
      </CommentTreeLayout>
    </I18nProvider>
  )
  return { onToggleCollapse, view }
}

function tap(element: Element) {
  fireEvent.pointerDown(element, { pointerType: 'touch' })
  fireEvent.click(element)
}

function mouseClick(element: Element) {
  fireEvent.pointerDown(element, { pointerType: 'mouse' })
  fireEvent.click(element)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CommentTreeLayout row click', () => {
  it('collapses from a tap on the header line and the avatar', () => {
    const { onToggleCollapse } = show()
    tap(screen.getByText('author'))
    tap(screen.getByText('avatar'))
    expect(onToggleCollapse).toHaveBeenCalledTimes(2)
  })

  it('ignores a mouse click on the header line, avatar and collapsed row', () => {
    const { onToggleCollapse } = show()
    mouseClick(screen.getByText('author'))
    mouseClick(screen.getByText('avatar'))
    cleanup()
    const collapsed = show({ isCollapsed: true })
    mouseClick(screen.getByText('summary'))
    expect(onToggleCollapse).not.toHaveBeenCalled()
    expect(collapsed.onToggleCollapse).not.toHaveBeenCalled()
  })

  it('collapses from the thread line with a mouse or a tap', () => {
    const { onToggleCollapse, view } = show()
    const line = view.container.querySelector('.group\\/line')!
    mouseClick(line)
    tap(line)
    expect(onToggleCollapse).toHaveBeenCalledTimes(2)
  })

  it('leaves the body, links and buttons alone', () => {
    const { onToggleCollapse } = show()
    tap(screen.getByText('body'))
    tap(screen.getByText('profile'))
    tap(screen.getByText('reply'))
    expect(onToggleCollapse).not.toHaveBeenCalled()
  })

  it('does not collapse when the click ends a text selection', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'author',
    } as Selection)
    const { onToggleCollapse } = show()
    tap(screen.getByText('author'))
    expect(onToggleCollapse).not.toHaveBeenCalled()
  })

  it('expands from a tap anywhere on a collapsed row', () => {
    const { onToggleCollapse } = show({ isCollapsed: true })
    tap(screen.getByText('summary'))
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })

  it('does nothing on a comment with no replies', () => {
    const { onToggleCollapse, view } = show({ hasChildren: false })
    tap(screen.getByText('author'))
    tap(view.container.querySelector('.group\\/line')!)
    expect(onToggleCollapse).not.toHaveBeenCalled()
  })

  it('toggles once from the +/- button', () => {
    const { onToggleCollapse } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })
})
