// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The create dialog's contract with a failed attempt: the object the first
// try created is the one the retry finishes, and the sentence naming the
// classes a parent may come from is built by the locale, not by joining.
import { describe, it, expect, vi } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  createMockEntityDesign,
  createMockEntityClass,
} from './entity-test-utils'
import { EntityCreateObjectDialog } from './entity-create-object-dialog'
import type { EntityObject } from '../../types/entity-object'

function show(over: Record<string, unknown> = {}) {
  const createObject = vi.fn(async () => ({ data: { id: 'o1' } }))
  const setValue = vi.fn(async (..._args: string[]) => ({}))
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    containerId: 'c1',
    recordId: 'r1',
    design: createMockEntityDesign(),
    defaultFields: [
      { field: 'status', value: 'todo' },
      { field: 'priority', value: 'high' },
    ],
    srTitle: 'Create',
    srDescription: 'Create an object',
    buildObject: (base: EntityObject) => base,
    listObjects: vi.fn(async () => ({ data: { objects: [] as EntityObject[] } })),
    listPeople: vi.fn(async () => ({ data: { people: [] } })),
    createObject,
    setValue,
    uploadAttachments: vi.fn(async () => ({})),
    searchUsers: vi.fn(async () => ({ data: { results: [] } })),
    ...over,
  }
  render(<EntityCreateObjectDialog {...(props as Parameters<typeof EntityCreateObjectDialog>[0])} />)
  return { createObject, setValue }
}

describe('EntityCreateObjectDialog', () => {
  it('finishes the object the failed attempt created instead of creating another', async () => {
    const { createObject, setValue } = show()
    // The board's defaults are written after the object exists; the first
    // write fails.
    setValue.mockRejectedValueOnce(new Error('value write refused'))
    const create = await screen.findByRole('button', { name: 'Create' })
    fireEvent.submit(create.closest('form') as HTMLFormElement)
    await waitFor(() => expect(setValue).toHaveBeenCalled())
    // The button reads Create again once the attempt has settled.
    const again = await screen.findByRole('button', { name: 'Create' })
    expect(createObject).toHaveBeenCalledTimes(1)

    fireEvent.submit(again.closest('form') as HTMLFormElement)
    await waitFor(() => expect(setValue.mock.calls.length).toBeGreaterThanOrEqual(3))
    expect(createObject).toHaveBeenCalledTimes(1)
    expect(setValue.mock.calls.every((call) => call[1] === 'o1')).toBe(true)
  })

  it('lists the parent classes the way the locale joins a list', async () => {
    // Every class needs a parent and nothing exists yet, so the class stays
    // on the first one and explains what it would need.
    const design = createMockEntityDesign({
      classes: [
        createMockEntityClass({ id: 'bug', name: 'Bug' }),
        createMockEntityClass({ id: 'epic', name: 'Epic' }),
        createMockEntityClass({ id: 'story', name: 'Story' }),
        createMockEntityClass({ id: 'task', name: 'Task' }),
      ],
      fields: { bug: [], epic: [], story: [], task: [] },
      options: {},
      hierarchy: {
        bug: ['epic', 'story', 'task'],
        epic: ['bug'],
        story: ['bug'],
        task: ['bug'],
      },
    })
    show({ design })
    expect(await screen.findByText('No Epic, Story, or Task to add to')).toBeInTheDocument()
  })

  it('leads the Create button with the add glyph', async () => {
    show()
    const create = await screen.findByRole('button', { name: 'Create' })
    expect(create.querySelector('svg.lucide-plus')).not.toBeNull()
    expect(create.querySelector('svg.lucide-check')).toBeNull()
  })
})
