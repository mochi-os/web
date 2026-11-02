// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, createMockEntityField } from './entity-test-utils'
import { EntityActivityList } from './entity-activity-list'

const activities = [
  {
    id: 'a1',
    user: 'u1',
    name: 'Ada',
    action: 'update',
    field: 'due_date',
    oldvalue: '1',
    newvalue: '2',
    created: 1,
  },
  {
    id: 'a2',
    user: 'u1',
    name: 'Ada',
    action: 'create',
    field: '',
    oldvalue: '',
    newvalue: '',
    created: 2,
  },
  {
    id: 'a3',
    user: 'u1',
    name: 'Ada',
    action: 'update',
    field: 'gone',
    oldvalue: '',
    newvalue: '',
    created: 3,
  },
]

describe('EntityActivityList', () => {
  it('names the field from the design and never shows its id', async () => {
    render(
      <EntityActivityList
        containerId='c1'
        objectId='o1'
        listActivity={vi.fn(async () => ({ data: { activities } }))}
        fields={[createMockEntityField({ id: 'due_date', name: 'Due date' })]}
      />
    )
    expect(await screen.findByText(/^Updated Due date/)).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    // A field the design no longer has is not named by its id.
    expect(screen.queryByText(/due_date/)).toBeNull()
    expect(screen.queryByText(/gone/)).toBeNull()
    expect(screen.getAllByText('Updated')).toHaveLength(1)
  })

  it('names the past-tense actions the server logs', async () => {
    const logged = (action: string, id: string) => ({
      id,
      user: 'u1',
      name: 'Ada',
      action,
      field: '',
      oldvalue: '',
      newvalue: '',
      created: 1,
    })
    render(
      <EntityActivityList
        containerId='c1'
        objectId='o1'
        listActivity={vi.fn(async () => ({
          data: {
            activities: [
              logged('created', 'a'),
              logged('updated', 'b'),
              logged('moved', 'c'),
            ],
          },
        }))}
      />
    )
    expect(await screen.findByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.getByText('Moved')).toBeInTheDocument()
    expect(screen.queryByText('Changed')).toBeNull()
  })

  it('says the load failed rather than that there is no activity', async () => {
    render(
      <EntityActivityList
        containerId='c1'
        objectId='o1'
        listActivity={vi.fn(async () => {
          throw new Error('Server unreachable')
        })}
      />
    )
    expect(await screen.findByText(/Server unreachable/)).toBeInTheDocument()
    expect(screen.queryByText('No activity yet')).toBeNull()
  })
})

// A person's avatar route names one of their activity rows, so a list that
// built each row's own address fetched the same picture once per row.
describe('EntityActivityList avatars', () => {
  it('draws every row by one person from their first row', async () => {
    const row = (id: string, user: string) => ({
      id,
      user,
      name: user,
      action: 'created',
      field: '',
      oldvalue: '',
      newvalue: '',
      created: 1,
    })
    render(
      <EntityActivityList
        containerId='p1'
        objectId='o1'
        listActivity={vi.fn(async () => ({
          data: {
            activities: [
              row('a1', 'Ann'),
              row('a2', 'Bob'),
              row('a3', 'Ann'),
              row('a4', 'Bob'),
              row('a5', ''),
            ],
          },
        }))}
        fields={[]}
      />
    )
    const sources = async (name: string) =>
      (await screen.findAllByAltText(`Avatar for ${name}`)).map((img) =>
        img.getAttribute('src')
      )
    expect(await sources('Ann')).toEqual([
      '/p1/-/activity/a1/asset/avatar',
      '/p1/-/activity/a1/asset/avatar',
    ])
    expect(await sources('Bob')).toEqual([
      '/p1/-/activity/a2/asset/avatar',
      '/p1/-/activity/a2/asset/avatar',
    ])
    // A row naming no one keeps its own address rather than borrowing one.
    expect(screen.getByAltText('Avatar')).toHaveAttribute(
      'src',
      '/p1/-/activity/a5/asset/avatar'
    )
  })
})
