// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Under a CommentThreadProvider, replies past the depth limit give way to
// "Continue this thread", which opens the comment they hang from; four levels
// on a phone, eight on a wider screen. The comment the thread is opened on is
// highlighted, and "All comments" leads back. Without a provider, as in wikis
// and the entity apps, the tree is never cut.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import type { ReactNode } from 'react'
import { CommentTreeLayout } from './comment-tree-layout'
import {
  CommentThreadBack,
  CommentThreadProvider,
  type CommentThreadOptions,
} from './comment-thread-context'
import { findCommentInTree } from '../lib/comment-tree'

// A chain of single replies, c0 at the top down to c{levels - 1}.
function chain(levels: number, depth = 0): ReactNode {
  const id = `c${depth}`
  const last = depth === levels - 1
  return (
    <CommentTreeLayout
      depth={depth}
      commentId={id}
      isCollapsed={false}
      onToggleCollapse={() => {}}
      hasChildren={!last}
      avatar={null}
      content={<span>{`body ${id}`}</span>}
    >
      {last ? null : chain(levels, depth + 1)}
    </CommentTreeLayout>
  )
}

function show(width: number, levels: number, options?: CommentThreadOptions) {
  window.innerWidth = width
  const tree = chain(levels)
  return render(
    <I18nProvider i18n={i18n}>
      {options ? (
        <CommentThreadProvider value={options}>{tree}</CommentThreadProvider>
      ) : (
        tree
      )}
    </I18nProvider>
  )
}

afterEach(() => {
  cleanup()
})

describe('Continue this thread', () => {
  it('cuts a phone thread after four levels, opening the fourth', () => {
    const onContinue = vi.fn()
    show(375, 6, { onContinue })
    expect(screen.getByText('body c3')).toBeTruthy()
    expect(screen.queryByText('body c4')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue this thread' })
    )
    expect(onContinue).toHaveBeenCalledWith('c3')
  })

  it('cuts a desktop thread after eight levels', () => {
    show(1280, 10, { onContinue: vi.fn() })
    expect(screen.getByText('body c7')).toBeTruthy()
    expect(screen.queryByText('body c8')).toBeNull()
  })

  it('leaves a thread that fits alone', () => {
    show(375, 4, { onContinue: vi.fn() })
    expect(screen.getByText('body c3')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Continue this thread' })
    ).toBeNull()
  })

  it('never cuts without a provider', () => {
    show(375, 7)
    expect(screen.getByText('body c6')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Continue this thread' })
    ).toBeNull()
  })
})

describe('A thread opened on one comment', () => {
  it('highlights that comment and no other', () => {
    show(1280, 3, { onContinue: vi.fn(), focusedId: 'c1' })
    const box = (id: string) => screen.getByText(`body ${id}`).parentElement!
    expect(box('c1').className).toContain('bg-primary/10')
    expect(box('c0').className).not.toContain('bg-primary/10')
    expect(box('c2').className).not.toContain('bg-primary/10')
  })

  it('leads back to all comments, scrolled into view', () => {
    const onClick = vi.fn()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(
      <I18nProvider i18n={i18n}>
        <CommentThreadProvider value={{ focusedId: 'c1' }}>
          <CommentThreadBack onClick={onClick} />
        </CommentThreadProvider>
      </I18nProvider>
    )
    expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'All comments' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })
})

describe('findCommentInTree', () => {
  type Node = { id: string; replies?: Node[] }
  const tree: Node[] = [
    { id: 'a', replies: [{ id: 'b', replies: [{ id: 'c' }] }] },
    { id: 'd' },
  ]
  const find = (id: string) =>
    findCommentInTree(
      tree,
      id,
      (n) => n.id,
      (n) => n.replies
    )

  it('finds a comment at any depth', () => {
    expect(find('c')?.id).toBe('c')
    expect(find('d')?.id).toBe('d')
  })

  it('finds nothing for an id the tree does not hold', () => {
    expect(find('gone')).toBeUndefined()
  })
})
