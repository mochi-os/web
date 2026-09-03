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
vi.mock('../../lib/toast-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/toast-utils')>()
  return { toast: { ...actual.toast, error: toastError } }
})

// A task may parent a task, so the Parent select has something to offer.
const design = createMockEntityDesign({ hierarchy: { task: ['task'] } })
const object = createMockEntityObject({ id: 'obj-1', values: { title: 'Original' } })
const sibling = createMockEntityObject({ id: 'obj-2', values: { title: 'Sibling' } })

type Detail = EntityObjectDetail<EntityObject>

function detailFor(overrides?: Partial<Detail>): Detail {
  return {
    object,
    values: { title: 'Original' },
    outgoing: [],
    incoming: [],
    watching: false,
    comment_count: 0,
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
  extra?: Partial<React.ComponentProps<typeof EntityObjectDetailPanel<EntityObject, Detail>>>,
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
    />,
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
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to save'))
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
      expect(toastError).toHaveBeenCalledWith('Failed to update watching'),
    )
  })

  it('says so when the delete is refused', async () => {
    vi.mocked(api.deleteObject).mockRejectedValue({ response: { status: 403 } })
    renderPanel()

    fireEvent.click(await screen.findByLabelText('Delete item'))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to delete'))
  })

  it('says so when the reparent is refused', async () => {
    vi.mocked(api.updateObject).mockRejectedValue({ response: { status: 409 } })
    renderPanel()

    fireEvent.click(await screen.findByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Sibling' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to move'))
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
      data: detailFor({ object: numbered }),
    })

    renderPanel()

    expect(await screen.findByTestId('entity-readable')).toHaveTextContent('PROJ-14')
  })
})

describe('EntityObjectDetailPanel tabs', () => {
  it('shows properties, comments and activity by default', async () => {
    renderPanel()
    await screen.findByDisplayValue('Original')

    expect(screen.getByRole('button', { name: /Properties/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Comments/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Activity/ })).toBeInTheDocument()
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
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((n) => /Properties|Comments|Merge requests|Activity/.test(n))
    expect(names[0]).toContain('Properties')
    expect(names[1]).toContain('Comments')
    expect(names[2]).toContain('Merge requests (2)')
    expect(names[3]).toContain('Activity')

    fireEvent.click(screen.getByRole('button', { name: /Merge requests/ }))
    expect(await screen.findByText('request panel')).toBeInTheDocument()
  })

  it('opens on comments when the object already has some', async () => {
    vi.mocked(api.getObject).mockResolvedValue({
      data: detailFor({ comment_count: 3 }),
    })

    renderPanel()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Comments \(3\)/ })).toBeInTheDocument(),
    )
  })
})
