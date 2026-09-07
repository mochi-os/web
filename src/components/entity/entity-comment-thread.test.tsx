// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { i18n } from '@lingui/core'
import { render, screen, fireEvent } from './entity-test-utils'
import { EntityCommentThread } from './entity-comment-thread'
import type { EntityComment } from '../../types/entity-object'

function comment(id: string, children: EntityComment[] = []): EntityComment {
  return { id, parent: '', author: 'u1', name: 'Ada', content: `body ${id}`, created: 1, edited: 0, children, attachments: [] }
}

function show(root: EntityComment) {
  render(
    <EntityCommentThread
      comment={root}
      containerId='c1'
      currentUserId='u1'
      readOnly={false}
      replyingTo={null}
      replyDraft=''
      onStartReply={vi.fn()}
      onCancelReply={vi.fn()}
      onReplyDraftChange={vi.fn()}
      onSubmitReply={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />
  )
}

describe('EntityCommentThread', () => {
  it('counts the hidden replies with a plural form', () => {
    // The plural macro hands the count to the catalogue; a template literal
    // renders the same English without ever reaching i18n, so the marker
    // below can only come from plural().
    const original = i18n._.bind(i18n)
    const spy = vi.spyOn(i18n, '_').mockImplementation((...args: unknown[]) => {
      const descriptor = (typeof args[0] === 'object' ? args[0] : { id: args[0], values: args[1] }) as {
        message?: string
        values?: Record<string, unknown>
      }
      if (descriptor.message?.includes('plural')) return `PLURAL(${String(Object.values(descriptor.values ?? {})[0])})`
      return original(...(args as [string]))
    })
    show(comment('root', [comment('a'), comment('b', [comment('c')])]))
    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[0])
    expect(screen.getByText('PLURAL(3)')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('caps the edited body where the server does', () => {
    show(comment('root'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '50000')
  })
})
