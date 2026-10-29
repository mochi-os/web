// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A person's avatar route names one of their comments, so a thread that built
// each comment's own address fetched the same picture once per comment: an
// item with 80 comments by one person sent 81 avatar and 81 style requests.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from './entity-test-utils'
import { EntityCommentList } from './entity-comment-list'
import type { EntityComment } from '../../types/entity-object'

function by(
  id: string,
  author: string,
  children: EntityComment[] = []
): EntityComment {
  return {
    id,
    parent: '',
    author,
    name: author,
    content: `body ${id}`,
    created: 1,
    edited: 0,
    children,
    attachments: [],
  }
}

describe('EntityCommentList avatars', () => {
  it('fetches each person once, however many comments and replies', async () => {
    const comments = [
      by('c1', 'Bob', [by('c2', 'Ann'), by('c3', 'Bob', [by('c4', 'Ann')])]),
      by('c5', 'Ann'),
      by('c6', 'Bob'),
    ]
    render(
      <EntityCommentList
        containerId='p1'
        objectId='o1'
        listComments={vi.fn(async () => ({
          data: { comments, count: comments.length },
        }))}
        listPeople={vi.fn(async () => ({ data: { people: [] } }))}
        createComment={vi.fn()}
        updateComment={vi.fn()}
        deleteComment={vi.fn()}
      />
    )
    const sources = async (name: string) =>
      (await screen.findAllByAltText(`Avatar for ${name}`)).map((img) =>
        img.getAttribute('src')
      )
    // Replies come before the next comment, so Ann's first is the reply c2.
    expect(await sources('Ann')).toEqual([
      '/p1/-/comment/c2/asset/avatar',
      '/p1/-/comment/c2/asset/avatar',
      '/p1/-/comment/c2/asset/avatar',
    ])
    expect(await sources('Bob')).toEqual([
      '/p1/-/comment/c1/asset/avatar',
      '/p1/-/comment/c1/asset/avatar',
      '/p1/-/comment/c1/asset/avatar',
    ])
  })
})
