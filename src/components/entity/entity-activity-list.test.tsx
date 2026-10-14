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

  describe('what the server logs', () => {
    const entry = (
      over: Partial<(typeof activities)[number]>
    ): (typeof activities)[number] => ({
      id: over.id ?? 'x',
      user: 'u1',
      name: 'Ada',
      action: 'updated',
      field: '',
      oldvalue: '',
      newvalue: '',
      created: 1,
      ...over,
    })

    function renderEntries(
      entries: (typeof activities)[number][],
      extra: Partial<Parameters<typeof EntityActivityList>[0]> = {}
    ) {
      return render(
        <EntityActivityList
          containerId='c1'
          objectId='o1'
          listActivity={vi.fn(async () => ({ data: { activities: entries } }))}
          fields={[
            createMockEntityField({
              id: 'stage',
              name: 'Stage',
              fieldtype: 'enumerated',
            }),
            createMockEntityField({
              id: 'owner',
              name: 'Owner',
              fieldtype: 'user',
            }),
          ]}
          options={{
            stage: [
              { id: 'lead', name: 'New lead', colour: '', icon: '', rank: 0 },
              { id: 'won', name: 'Won', colour: '', icon: '', rank: 1 },
            ],
          }}
          people={{ 'u-1a': 'Ada Lovelace', 'u-2b': 'Grace Hopper' }}
          objectTitle={(id) =>
            (({ o9: 'Acme', o8: 'Globex' }) as Record<string, string>)[id]
          }
          classes={[
            { id: 'contact', name: 'Contact', rank: 0, title: 'name' },
            { id: 'company', name: 'Company', rank: 1, title: 'name' },
          ]}
          labels={{ commented: 'Added a comment', attached: 'Added a file' }}
          {...extra}
        />
      )
    }

    it('names past-tense actions instead of saying Changed', async () => {
      renderEntries([
        entry({ id: 'a', action: 'created' }),
        entry({ id: 'b', action: 'commented' }),
        entry({ id: 'c', action: 'attached', newvalue: 'quote.pdf' }),
      ])
      expect(await screen.findByText('Created')).toBeInTheDocument()
      expect(screen.getByText('Added a comment')).toBeInTheDocument()
      expect(screen.getByText(/^Added a file/)).toHaveTextContent(
        'Added a file: quote.pdf'
      )
      expect(screen.queryByText(/^Changed/)).toBeNull()
    })

    it('shows option names, not option ids', async () => {
      renderEntries([
        entry({ field: 'stage', oldvalue: 'lead', newvalue: 'won' }),
      ])
      const line = await screen.findByText(/^Updated Stage/)
      expect(line).toHaveTextContent('Updated Stage: New lead → Won')
    })

    it('shows people by name, not user id', async () => {
      renderEntries([
        entry({ field: 'owner', oldvalue: 'u-1a', newvalue: 'u-2b' }),
      ])
      const line = await screen.findByText(/^Updated Owner/)
      expect(line).toHaveTextContent('Ada Lovelace → Grace Hopper')
      expect(line).not.toHaveTextContent('u-1a')
    })

    it('shows a move by item titles, and a gone item as empty', async () => {
      renderEntries([
        entry({
          id: 'a',
          action: 'moved',
          field: 'parent',
          oldvalue: 'o9',
          newvalue: 'o8',
        }),
        entry({
          id: 'b',
          action: 'moved',
          field: 'parent',
          oldvalue: 'o-deleted',
          newvalue: 'o9',
        }),
      ])
      const lines = await screen.findAllByText(/^Moved/)
      expect(lines[0]).toHaveTextContent('Moved: Acme → Globex')
      expect(lines[1]).toHaveTextContent('Moved: — → Acme')
      expect(lines[1]).not.toHaveTextContent('o-deleted')
    })

    it('shows a class change by class names', async () => {
      renderEntries([
        entry({ field: 'class', oldvalue: 'contact', newvalue: 'company' }),
      ])
      const line = await screen.findByText(/^Updated/)
      expect(line).toHaveTextContent('Updated: Contact → Company')
    })

    it('shows a link by its type and the linked item', async () => {
      renderEntries([
        entry({ action: 'linked', field: 'blocks', newvalue: 'o9' }),
      ])
      expect(await screen.findByText(/^Blocks/)).toHaveTextContent(
        'Blocks: Acme'
      )
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
})
