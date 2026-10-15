// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The children are real, the api is not. What belongs to this panel is which
// tab it shows, what it puts in the header, and whether a refused call is
// reported; what the comment list and field editor do is their own tests.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  createMockEntityDesign,
  createMockEntityObject,
} from './entity-test-utils'
import {
  EntityObjectDetailPanel,
  type EntityObjectDetail,
  type EntityObjectDetailPanelApi,
} from './entity-object-detail-panel'
import type { EntityObject } from '../../types/entity-object'
import { GitMerge } from 'lucide-react'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
const { clipboardWrite } = vi.hoisted(() => ({
  clipboardWrite: vi.fn(async () => true),
}))
vi.mock('../../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/shell-bridge')>()),
  shellClipboardWrite: clipboardWrite,
}))
vi.mock('../../lib/toast-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/toast-utils')>()
  return { toast: { ...actual.toast, error: toastError } }
})

// A task may parent a task, so the Parent select has something to offer.
const design = createMockEntityDesign({ hierarchy: { task: ['task'] } })
const object = createMockEntityObject({
  id: 'obj-1',
  values: { title: 'Original' },
})
const sibling = createMockEntityObject({
  id: 'obj-2',
  values: { title: 'Sibling' },
})

type Detail = EntityObjectDetail<EntityObject>

// The server answers the row and its values as siblings, so the fixture must
// not carry values on the row: the panel once titled the row and crashed on
// every real fetch while a fixture shaped like the cache kept this green.
function row(entity: EntityObject): Omit<EntityObject, 'values'> {
  const { values, ...rest } = entity
  void values
  return rest
}

function detailFor(overrides?: Partial<Detail>): Detail {
  return {
    object: row(object),
    values: { title: 'Original' },
    outgoing: [],
    incoming: [],
    watching: false,
    comments: { count: 0 },
    ...overrides,
  }
}

// Radix Select drives the parent picker, and jsdom implements none of this.
beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

function makeApi(): EntityObjectDetailPanelApi<EntityObject, Detail> {
  return {
    getObject: vi.fn(async () => ({ data: detailFor() })),
    listPeople: vi.fn(async () => ({ data: { people: [] } })),
    listObjects: vi.fn(async () => ({ data: { objects: [object, sibling] } })),
    setValue: vi.fn(async () => ({})),
    updateObject: vi.fn(async () => ({})),
    deleteObject: vi.fn(async () => ({})),
    addWatcher: vi.fn(async () => ({})),
    removeWatcher: vi.fn(async () => ({})),
    searchUsers: vi.fn(async () => ({ data: { results: [] } })),
    listComments: vi.fn(async () => ({ data: { comments: [], count: 0 } })),
    createComment: vi.fn(async () => ({})),
    updateComment: vi.fn(async () => ({})),
    deleteComment: vi.fn(async () => ({})),
    listActivity: vi.fn(async () => ({ data: { activities: [] } })),
    listAttachments: vi.fn(async () => ({ data: { attachments: [] } })),
    uploadAttachments: vi.fn(async () => ({})),
    deleteAttachment: vi.fn(async () => ({})),
    createLink: vi.fn(async () => ({})),
    deleteLink: vi.fn(async () => ({})),
  } as unknown as EntityObjectDetailPanelApi<EntityObject, Detail>
}

let api: EntityObjectDetailPanelApi<EntityObject, Detail>

function renderPanel(
  extra?: Partial<
    React.ComponentProps<typeof EntityObjectDetailPanel<EntityObject, Detail>>
  >
) {
  return render(
    <EntityObjectDetailPanel
      containerId='c-1'
      objectId='obj-1'
      design={design}
      access='owner'
      api={api}
      onClose={() => {}}
      {...extra}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  toastError.mockClear()
  api = makeApi()
})

describe('EntityObjectDetailPanel failure reporting', () => {
  it('says so when a field edit is rejected', async () => {
    vi.mocked(api.setValue).mockRejectedValue({ response: { status: 403 } })
    renderPanel()

    const input = await screen.findByDisplayValue('Original')
    fireEvent.change(input, { target: { value: 'Edited' } })
    fireEvent.blur(input)

    await waitFor(() => expect(api.setValue).toHaveBeenCalled())
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Failed to save')
    )
  })

  it('stays silent when the field edit succeeds', async () => {
    renderPanel()

    const input = await screen.findByDisplayValue('Original')
    fireEvent.change(input, { target: { value: 'Edited' } })
    fireEvent.blur(input)

    await waitFor(() => expect(api.setValue).toHaveBeenCalled())
    expect(toastError).not.toHaveBeenCalled()
  })

  it('says so when watching cannot be changed', async () => {
    vi.mocked(api.addWatcher).mockRejectedValue({ response: { status: 500 } })
    renderPanel()

    fireEvent.click(await screen.findByLabelText('Watch'))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Failed to update watching')
    )
  })

  it('says so when the delete is refused', async () => {
    vi.mocked(api.deleteObject).mockRejectedValue({ response: { status: 403 } })
    renderPanel()

    fireEvent.click(await screen.findByLabelText('Delete item'))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Failed to delete')
    )
  })

  describe('delete confirm', () => {
    const deleteWithChildren = (title: string, count: number) =>
      `Delete "${title}" and ${count} under it?`

    it('says how many items go with it, at every depth', async () => {
      const child = createMockEntityObject({ id: 'c1', parent: 'obj-1' })
      const grandchild = createMockEntityObject({ id: 'c2', parent: 'c1' })
      const unrelated = createMockEntityObject({ id: 'c3', parent: 'obj-2' })
      vi.mocked(api.listObjects).mockResolvedValue({
        data: { objects: [object, sibling, child, grandchild, unrelated] },
      } as never)
      renderPanel({ labels: { deleteWithChildren } })

      fireEvent.click(await screen.findByLabelText('Delete item'))
      expect(
        await screen.findByText('Delete "Original" and 2 under it?')
      ).toBeInTheDocument()
    })

    it('keeps the plain confirm for an item with nothing under it', async () => {
      renderPanel({ labels: { deleteWithChildren } })

      fireEvent.click(await screen.findByLabelText('Delete item'))
      expect(
        await screen.findByText(/Are you sure you want to delete "Original"/)
      ).toBeInTheDocument()
    })
  })

  it('says so when the reparent is refused', async () => {
    vi.mocked(api.updateObject).mockRejectedValue({ response: { status: 409 } })
    renderPanel()

    // By name: the enumerated fields render comboboxes of their own.
    fireEvent.click(await screen.findByRole('combobox', { name: 'Parent' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Sibling' }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Failed to move')
    )
  })
})

describe('EntityObjectDetailPanel parent select', () => {
  it('offers no "None" to a class that cannot sit at the top level', async () => {
    renderPanel()

    fireEvent.click(await screen.findByRole('combobox', { name: 'Parent' }))
    await screen.findByRole('option', { name: 'Sibling' })

    expect(screen.queryByRole('option', { name: 'None' })).toBeNull()
  })

  it('offers "None" to a class that may sit at the top level', async () => {
    renderPanel({
      design: createMockEntityDesign({ hierarchy: { task: ['', 'task'] } }),
    })

    fireEvent.click(await screen.findByRole('combobox', { name: 'Parent' }))

    expect(
      await screen.findByRole('option', { name: 'None' })
    ).toBeInTheDocument()
  })
})

describe('EntityObjectDetailPanel header', () => {
  it('prints no readable id for an app that does not number its objects', async () => {
    renderPanel()
    await screen.findByDisplayValue('Original')
    expect(screen.queryByTestId('entity-readable')).toBeNull()
  })

  it('prints the readable id beside the title when the object carries one', async () => {
    const numbered = createMockEntityObject({
      id: 'obj-1',
      number: 14,
      readable: 'PROJ-14',
      values: { title: 'Original' },
    })
    vi.mocked(api.getObject).mockResolvedValue({
      data: detailFor({ object: row(numbered) }),
    })

    renderPanel()

    expect(await screen.findByTestId('entity-readable')).toHaveTextContent(
      'PROJ-14'
    )
  })

  it('titles the object from the detail values, since the row carries none', async () => {
    renderPanel()

    expect(await screen.findByText('Original')).toBeInTheDocument()
    expect(screen.queryByText('Try again')).toBeNull()
  })
})

describe('EntityObjectDetailPanel copy link', () => {
  it('copies the address the app builds for the item', async () => {
    renderPanel({
      itemUrl: (id) => `https://example.org/crm/fp/${id}`,
      labels: { copyLink: 'Copy link' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }))
    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(
        'https://example.org/crm/fp/obj-1'
      )
    )
  })

  it('offers no copy without an address or a label', async () => {
    renderPanel({ itemUrl: (id) => id })
    await screen.findByDisplayValue('Original')
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })
})

describe('EntityObjectDetailPanel tabs', () => {
  it('shows properties, comments and activity as tabs', async () => {
    renderPanel()
    await screen.findByDisplayValue('Original')

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Properties/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: /Comments/ })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.getByRole('tab', { name: /Activity/ })).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      screen.getByRole('tab', { name: /Properties/ }).id
    )
  })

  it('moves between tabs with the arrow keys', async () => {
    renderPanel()
    await screen.findByDisplayValue('Original')

    const properties = screen.getByRole('tab', { name: /Properties/ })
    properties.focus()
    fireEvent.keyDown(properties, { key: 'ArrowRight' })

    // Radix moves focus on the next tick.
    const comments = screen.getByRole('tab', { name: /Comments/ })
    await waitFor(() => expect(comments).toHaveFocus())
    expect(comments).toHaveAttribute('aria-selected', 'true')
  })

  it('puts an extra tab between comments and activity and renders it when picked', async () => {
    renderPanel({
      extraTabs: () => [
        {
          id: 'requests',
          label: 'Merge requests (2)',
          icon: <GitMerge className='size-4' />,
          content: <div>request panel</div>,
        },
      ],
    })
    await screen.findByDisplayValue('Original')

    const names = screen
      .getAllByRole('tab')
      .map((b) => b.textContent ?? '')
      .filter((n) => /Properties|Comments|Merge requests|Activity/.test(n))
    expect(names[0]).toContain('Properties')
    expect(names[1]).toContain('Comments')
    expect(names[2]).toContain('Merge requests (2)')
    expect(names[3]).toContain('Activity')

    // Radix selects a tab on mouse down, not on click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Merge requests/ }))
    expect(await screen.findByText('request panel')).toBeInTheDocument()
  })

  it('opens on comments when the object already has some', async () => {
    vi.mocked(api.getObject).mockResolvedValue({
      data: detailFor({ comments: { count: 3 } }),
    })

    renderPanel()

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /Comments \(3\)/ })
      ).toHaveAttribute('aria-selected', 'true')
    )
  })
})
