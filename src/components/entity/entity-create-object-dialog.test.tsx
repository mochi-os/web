// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The create dialog's contract with a failed attempt: the object the first
// try created is the one the retry finishes, and the sentence naming the
// classes a parent may come from is built by the locale, not by joining.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  act,
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
  const createObject = vi.fn(async (..._args: unknown[]) => ({
    data: { id: 'o1' },
  }))
  const setValue = vi.fn(async (..._args: string[]) => ({}))
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    containerId: 'c1',
    recordId: 'r1',
    // At the top level, as a new class is: the server refuses to create a
    // class the hierarchy gives no position.
    design: createMockEntityDesign({ hierarchy: { task: [''] } }),
    defaultFields: [
      { field: 'status', value: 'todo' },
      { field: 'priority', value: 'high' },
    ],
    srTitle: 'Create',
    srDescription: 'Create an object',
    buildObject: (base: EntityObject) => base,
    listObjects: vi.fn(async () => ({
      data: { objects: [] as EntityObject[] },
    })),
    listPeople: vi.fn(async () => ({ data: { people: [] } })),
    createObject,
    setValue,
    uploadAttachments: vi.fn(async () => ({})),
    searchUsers: vi.fn(async () => ({ data: { results: [] } })),
    ...over,
  }
  render(
    <EntityCreateObjectDialog
      {...(props as Parameters<typeof EntityCreateObjectDialog>[0])}
    />
  )
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
    await waitFor(() =>
      expect(setValue.mock.calls.length).toBeGreaterThanOrEqual(3)
    )
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
    expect(
      await screen.findByText('No Epic, Story, or Task to add to')
    ).toBeInTheDocument()
  })

  it('leads the Create button with the add glyph', async () => {
    show()
    const create = await screen.findByRole('button', { name: 'Create' })
    expect(create.querySelector('svg.lucide-plus')).not.toBeNull()
    expect(create.querySelector('svg.lucide-check')).toBeNull()
  })
})

// A class whose positions were all unchecked in the design editor has no
// hierarchy entry, and the server refuses to create it anywhere.
describe('EntityCreateObjectDialog with a class that has no position', () => {
  const retired = createMockEntityClass({ id: 'retired', name: 'Retired' })
  const task = createMockEntityClass({ id: 'task', name: 'Task' })

  function designOf(classes: ReturnType<typeof createMockEntityClass>[]) {
    return createMockEntityDesign({
      classes,
      fields: Object.fromEntries(classes.map((cls) => [cls.id, []])),
      options: {},
      hierarchy: { task: [''] },
    })
  }

  // The objects arrive when the test says so, so what the dialog offers can
  // be read after it has reconsidered its classes against them.
  function deferredObjects() {
    let resolve: (objects: EntityObject[]) => void = () => {}
    const listObjects = vi.fn(
      () =>
        new Promise<{ data: { objects: EntityObject[] } }>((done) => {
          resolve = (objects) => done({ data: { objects } })
        })
    )
    async function arrive() {
      await waitFor(() => expect(listObjects).toHaveBeenCalled())
      await act(async () => resolve([]))
    }
    return { listObjects, arrive }
  }

  // Radix Select drives the type picker, and jsdom implements none of this.
  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= () => false
    Element.prototype.setPointerCapture ??= () => {}
    Element.prototype.releasePointerCapture ??= () => {}
    Element.prototype.scrollIntoView ??= () => {}
  })

  async function submitted(
    createObject: ReturnType<typeof show>['createObject']
  ) {
    const create = await screen.findByRole('button', { name: 'Create' })
    fireEvent.submit(create.closest('form') as HTMLFormElement)
    await waitFor(() => expect(createObject).toHaveBeenCalled())
    return createObject.mock.calls[0][1]
  }

  it('leaves it out of the type picker once the objects have loaded', async () => {
    const { listObjects, arrive } = deferredObjects()
    show({ design: designOf([task, retired]), defaultFields: [], listObjects })
    await arrive()

    fireEvent.click(screen.getByRole('combobox'))
    expect(
      await screen.findByRole('option', { name: 'Task' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Retired' })).toBeNull()
  })

  it('creates the next class instead, before the objects have loaded', async () => {
    const { createObject } = show({
      design: designOf([retired, task]),
      defaultFields: [],
      listObjects: vi.fn(() => new Promise(() => {})),
    })
    expect(await submitted(createObject)).toMatchObject({ class: 'task' })
  })

  it('has nothing to create when that is the only class', async () => {
    const { listObjects, arrive } = deferredObjects()
    show({ design: designOf([retired]), defaultFields: [], listObjects })
    await arrive()

    expect(
      screen.getByText(
        'No item types can be created yet. Create the required parent items first.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })
})
