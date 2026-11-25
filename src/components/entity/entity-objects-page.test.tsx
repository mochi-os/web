// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The five render slots are stubbed. What belongs to this page is which slot it
// chooses and what it hands it; what the board and tree do is the apps' tests.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
  renderWithClient,
  createMockEntityClass,
  createMockEntityDesign,
  createMockEntityField,
  createMockEntityObject,
  createMockEntityObjects,
  createMockEntityOption,
  createMockEntityView,
} from './entity-test-utils'
import {
  EntityObjectsPage,
  type EntityObjectsBoardSlotProps,
  type EntityObjectsTreeSlotProps,
  type EntityObjectsPageApi,
  type EntityObjectsPageLabels,
  type EntityObjectsPageContainer,
} from './entity-objects-page'
import type { EntityObject, EntityObjectCopy } from '../../types/entity-object'
import { FileText } from 'lucide-react'
import { SearchProvider } from '../../context/search-provider'
import { toast } from '../../lib/toast-utils'
import { sortEntityObjects } from '../../lib/entity-sort'
import { entityObjectsQuery, entityPeopleQuery } from './entity-queries'

const invalidate = vi.fn()
const navigation = vi.hoisted(() => ({
  external: vi.fn(),
  clipboard: vi.fn((_: string) => Promise.resolve(true)),
  save: vi.fn((_blob: Blob, _name: string) => Promise.resolve(true)),
}))

vi.mock('../../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/shell-bridge')>()),
  shellNavigateExternal: (url: string) => navigation.external(url),
  shellClipboardWrite: (text: string) => navigation.clipboard(text),
  shellSaveBlob: (blob: Blob, name: string) => navigation.save(blob, name),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate,
    history: { subscribe: () => () => {} },
  }),
}))

// Every label is a plain string the app resolves, so the fixture answers any
// key with its own name. An assertion can then look for "exportData" on screen
// without the test carrying 30 lines of wording it does not care about.
// Share's entries' words, given as an app gives them.
const share = {
  feed: 'Post to a feed',
  chat: 'Send in a chat',
  copy: 'Copy link',
}
const labels = new Proxy({} as EntityObjectsPageLabels, {
  get: (_t, key: string) =>
    key === 'share'
      ? share
      : key === 'createAction' ||
          key === 'downloaded' ||
          key === 'exportMissing'
        ? (arg?: string | number) => `${key}:${arg ?? ''}`
        : key,
})

function makeApi(objects: EntityObject[]): EntityObjectsPageApi<EntityObject> {
  return {
    share: vi.fn(),
    warmExport: vi.fn(),
    exportData: vi.fn(),
    unsubscribe: vi.fn(),
    listObjects: vi.fn(async () => ({ data: { objects, watched: [] } })),
    listPeople: vi.fn(async () => ({ data: { people: [] } })),
    updateObject: vi.fn(),
    moveObject: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
    deleteOption: vi.fn(),
    reorderOptions: vi.fn(),
  } as unknown as EntityObjectsPageApi<EntityObject>
}

const container: EntityObjectsPageContainer = {
  id: 'c1',
  fingerprint: 'abc123',
  name: 'Acme Holdings',
  owner: { local: true, name: 'Owner' },
  access: 'owner',
  populated: 1,
}

function renderPage(
  overrides: Partial<Parameters<typeof EntityObjectsPage>[0]> = {},
  objects: EntityObject[] = createMockEntityObjects(3),
  client?: QueryClient
) {
  const props = {
    design: createMockEntityDesign(),
    container,
    containerId: 'c1',
    search: {},
    icon: FileText,
    labels,
    shareUrl: () => 'https://x.test/crm/c1',
    api: makeApi(objects),
    entity: 'crm',
    storagePrefix: 'crms',
    listKey: 'crms',
    backupSlug: 'crm',
    refreshSidebar: vi.fn(),
    onLeave: vi.fn(),
    settingsMenuItem: null,
    renderViewOptionsBar: () => <div data-testid='view-options-bar' />,
    renderBoard: () => <div data-testid='board' />,
    renderTree: () => <div data-testid='tree' />,
    renderCreateDialog: () => <div data-testid='create-dialog' />,
    renderDetailPanel: ({ objectId }: { objectId: string | null }) => (
      <div data-testid='detail-panel'>{objectId ?? 'none'}</div>
    ),
    ...overrides,
  } as Parameters<typeof EntityObjectsPage>[0]
  return {
    ...(client
      ? renderWithClient(
          <SearchProvider>
            <EntityObjectsPage {...props} />
          </SearchProvider>,
          client
        )
      : render(
          <SearchProvider>
            <EntityObjectsPage {...props} />
          </SearchProvider>
        )),
    props,
  }
}

// Radix opens its menu on pointerdown, which jsdom does not synthesise from a
// click, and PageHeader lays the trigger out once per breakpoint. Both details
// belong here rather than in every block that needs the menu.
async function openPageMenu() {
  const trigger = (
    await screen.findAllByRole('button', { name: 'pageActions' })
  )[0]
  fireEvent.pointerDown(
    trigger,
    new MouseEvent('pointerdown', { bubbles: true, button: 0 })
  )
  return trigger
}

// The Copy dialog's binding, as an app passes it.
const duplicate = {
  menuAction: 'Duplicate',
  api: {} as never,
  create: vi.fn(),
  remove: vi.fn(),
  onDuplicated: vi.fn(),
  labels: {
    title: 'Duplicate CRM',
    name: 'Name',
    everything: 'Everything',
    designOnly: 'Design only',
    allowSearch: 'Allow anyone to search',
    readable: 'Allow anyone to view',
    cancel: 'Cancel',
    confirm: 'Duplicate',
    duplicating: 'Duplicating',
    duplicated: 'Duplicated',
    failed: 'Failed',
    defaultName: (name: string) => `Duplicate of ${name}`,
    leftBehind: 'Left behind',
    incomplete: 'Incomplete',
  },
}

describe('EntityObjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('reports a column delete the server refused', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 'toast')
    const api = makeApi(createMockEntityObjects(1))
    ;(api.deleteOption as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('column in use')
    )
    renderPage({
      api,
      renderBoard: (slot) => (
        <button
          onClick={() =>
            void slot
              .onDeleteColumn?.('task', 'status', 'todo')
              ?.catch(() => {})
          }
        >
          drop column
        </button>
      ),
    })
    fireEvent.click(await screen.findByText('drop column'))
    await waitFor(() => expect(error).toHaveBeenCalledWith('column in use'))
    error.mockRestore()
  })

  it('reports a move the server refused, after rolling it back', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 'toast')
    const api = makeApi(createMockEntityObjects(2))
    ;(api.moveObject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('cannot move')
    )
    renderPage({
      api,
      renderBoard: (slot) => (
        <button onClick={() => slot.onMoveObject?.('obj-2', 'done', { before: 'obj-1' })}>
          reorder
        </button>
      ),
    })
    fireEvent.click(await screen.findByText('reorder'))
    await waitFor(() => expect(error).toHaveBeenCalledWith('cannot move'))
    error.mockRestore()
  })

  it("copies the container's mochi:// join link from Share", async () => {
    navigation.clipboard.mockClear()
    const api = makeApi(createMockEntityObjects(1))
    ;(api.share as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { link: 'mochi://x.test/abc123' },
    })
    renderPage({ api })
    await openPageMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }))
    await waitFor(() =>
      expect(navigation.clipboard).toHaveBeenCalledWith('mochi://x.test/abc123')
    )
    expect(api.share).toHaveBeenCalledWith('c1')
  })

  it("posts the container's name and page address to a feed", async () => {
    navigation.external.mockReset()
    const api = makeApi(createMockEntityObjects(1))
    ;(api.share as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { link: 'mochi://x.test/abc123' },
    })
    renderPage({ api })
    await openPageMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Post to a feed' })
    )
    expect(navigation.external).toHaveBeenCalledTimes(1)
    const address = new URL(
      navigation.external.mock.calls[0][0],
      'https://here'
    )
    expect(address.pathname).toBe('/feeds/share')
    expect(address.searchParams.get('text')).toBe('Acme Holdings')
    expect(address.searchParams.get('url')).toBe('https://x.test/crm/c1')
  })

  it('titles the page with the container name', async () => {
    renderPage()
    expect(await screen.findByText('Acme Holdings')).toBeInTheDocument()
  })

  it('keeps page chrome outside the list content scroller', async () => {
    const design = createMockEntityDesign({
      views: [
        createMockEntityView({
          id: 'list',
          name: 'List',
          viewtype: 'list',
        }),
      ],
    })
    const { container: rendered } = renderPage({
      design,
      search: { view: 'list' },
    })

    const tree = await screen.findByTestId('tree')
    const scrollArea = rendered.querySelector(
      '[data-slot="entity-content-scroll-area"]'
    )
    const pageHeader = screen
      .getByRole('heading', {
        name: 'Acme Holdings',
      })
      .closest('header')

    // Guard both lookups first: not.toContainElement(null) passes vacuously.
    expect(scrollArea).not.toBeNull()
    expect(pageHeader).not.toBeNull()
    expect(scrollArea).toHaveClass('overflow-auto')
    expect(scrollArea).toContainElement(tree)
    expect(scrollArea).not.toContainElement(pageHeader)
    expect(scrollArea).not.toContainElement(
      screen.getByTestId('view-options-bar')
    )
  })

  it('asks the api for this container’s objects', async () => {
    const { props } = renderPage()
    await waitFor(() =>
      expect(props.api.listObjects).toHaveBeenCalledWith('c1')
    )
  })

  it('offers the create action to a writer', async () => {
    renderPage()
    expect(
      await screen.findAllByRole('button', { name: /createAction/ })
    ).not.toHaveLength(0)
  })

  it('withholds the create action from a reader who may only view', async () => {
    renderPage({ container: { ...container, access: 'view' } })
    await screen.findByText('Acme Holdings')
    expect(
      screen.queryAllByRole('button', { name: /createAction/ })
    ).toHaveLength(0)
  })

  // crm passes a csvExport binding and projects does not, so the entry has to
  // come and go with the prop rather than being built into the shared menu.
  it('offers Duplicate only to an app that passes it', async () => {
    const { unmount } = renderPage({ duplicate } as never)
    await openPageMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    expect(
      await screen.findByRole('dialog', { name: 'Duplicate CRM' })
    ).toBeInTheDocument()
    unmount()

    const second = renderPage()
    await openPageMenu()
    await screen.findByRole('menuitem', { name: 'exportData' })
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBeNull()
    second.unmount()

    // A view-only subscriber may export, but is not offered a one-click copy.
    renderPage({
      duplicate,
      container: {
        ...container,
        access: 'view',
        owner: { local: false, name: 'Someone' },
      },
    } as never)
    await openPageMenu()
    await screen.findByRole('menuitem', { name: 'exportData' })
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBeNull()
  })

  // Whether the original has items decides between the full export and the
  // design alone, so a list that failed to load must not read as empty.
  it('holds Duplicate back while the item list has not loaded', async () => {
    const api = makeApi([])
    api.listObjects = vi.fn(async () => {
      throw new Error('offline')
    }) as never
    renderPage({ duplicate, api } as never)
    await waitFor(() => expect(api.listObjects).toHaveBeenCalled())
    await openPageMenu()
    expect(
      await screen.findByRole('menuitem', { name: 'Duplicate' })
    ).toHaveAttribute('data-disabled')
  })

  it('lists the CSV export only for an app that passes one', async () => {
    renderPage({
      csvExport: {
        menuAction: 'Export CSV',
        noObjects: 'nothing to export',
        idColumn: 'ID',
        classColumn: 'Class',
        parentColumn: 'Parent',
      },
    })
    await openPageMenu()
    expect(await screen.findByText('Export CSV')).toBeInTheDocument()
  })

  describe('data export', () => {
    function exporting(rounds: Array<{ remaining: number; failed?: number }>) {
      const api = makeApi(createMockEntityObjects(3))
      const warm = vi.fn()
      for (const round of rounds) warm.mockResolvedValueOnce({ data: round })
      api.warmExport = warm as never
      api.exportData = vi.fn(async () => new Blob(['zip'])) as never
      return api
    }

    async function run(api: EntityObjectsPageApi<EntityObject>) {
      renderPage({ api } as never)
      await openPageMenu()
      fireEvent.click(await screen.findByRole('menuitem', { name: 'exportData' }))
      await waitFor(() => expect(navigation.save).toHaveBeenCalled())
    }

    it('says the backup lacks the attachments it could not fetch', async () => {
      const success = vi.spyOn(toast, 'success').mockImplementation(() => 'toast')
      const warning = vi.spyOn(toast, 'warning').mockImplementation(() => 'toast')
      await run(exporting([{ remaining: 1, failed: 3 }, { remaining: 0, failed: 2 }]))
      await waitFor(() => expect(warning).toHaveBeenCalledWith('exportMissing:2'))
      expect(success).not.toHaveBeenCalled()
    })

    it('reports a whole backup as downloaded', async () => {
      const success = vi.spyOn(toast, 'success').mockImplementation(() => 'toast')
      const warning = vi.spyOn(toast, 'warning').mockImplementation(() => 'toast')
      await run(exporting([{ remaining: 0 }]))
      await waitFor(() => expect(success).toHaveBeenCalled())
      expect(warning).not.toHaveBeenCalled()
    })
  })

  it('omits the CSV export for an app that passes none', async () => {
    renderPage()
    await openPageMenu()
    await screen.findByText('viewOptions')
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument()
  })

  // crm opens an empty container on its companies view; projects leaves the
  // prop off and stays where it was. The switch only fires when the URL named
  // no view of its own.
  it('falls back to the nominated view while the container is empty', async () => {
    const design = createMockEntityDesign({
      views: [
        createMockEntityView({ id: 'board', name: 'Board', viewtype: 'board' }),
        createMockEntityView({
          id: 'companies',
          name: 'Companies',
          viewtype: 'list',
          classes: ['company'],
        }),
      ],
    })
    renderPage({ design, emptyViewClass: 'company' }, [])
    expect(await screen.findByTestId('view-options-bar')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('tree')).toBeInTheDocument())
  })

  it('leaves the view alone when the URL already named one', async () => {
    const design = createMockEntityDesign({
      views: [
        createMockEntityView({ id: 'board', name: 'Board', viewtype: 'board' }),
        createMockEntityView({
          id: 'companies',
          name: 'Companies',
          viewtype: 'list',
          classes: ['company'],
        }),
      ],
    })
    renderPage(
      { design, emptyViewClass: 'company', search: { view: 'board' } },
      []
    )
    expect(await screen.findByTestId('board')).toBeInTheDocument()
  })

  // The $objectId route lands straight on a record.
  it('opens the detail panel on the object the route named', async () => {
    const objects = createMockEntityObjects(3)
    renderPage({ initialObjectId: objects[1].id }, objects)
    const panel = await screen.findByTestId('detail-panel')
    expect(panel).toHaveTextContent(objects[1].id)
  })

  it('hands the detail slot nothing when the route named none', async () => {
    renderPage()
    await screen.findByText('Acme Holdings')
    expect(screen.getByTestId('detail-panel')).toHaveTextContent('none')
  })

  describe('collapsed board columns', () => {
    // The board is a stub that shows what it was told is collapsed and
    // collapses "todo" when asked.
    const boardSlot = {
      renderBoard: ({
        collapsedColumns,
        onToggleColumnCollapsed,
      }: {
        collapsedColumns?: string[]
        onToggleColumnCollapsed?: (id: string) => void
      }) => (
        <div data-testid='board'>
          <span data-testid='collapsed'>
            {(collapsedColumns ?? []).join(',') || 'none'}
          </span>
          <button onClick={() => onToggleColumnCollapsed?.('todo')}>
            toggle
          </button>
        </div>
      ),
    }
    const design = createMockEntityDesign({
      views: [
        createMockEntityView({
          id: 'board',
          name: 'Board',
          viewtype: 'board',
          columns: 'status',
        }),
      ],
    })

    it('remembers a collapsed column for this board only', async () => {
      const first = renderPage({ design, ...boardSlot } as never)
      fireEvent.click(await screen.findByRole('button', { name: 'toggle' }))
      expect(screen.getByTestId('collapsed')).toHaveTextContent('todo')
      first.unmount()

      // Same board again: still collapsed.
      const again = renderPage({ design, ...boardSlot } as never)
      await waitFor(() =>
        expect(screen.getByTestId('collapsed')).toHaveTextContent('todo')
      )
      again.unmount()

      // Another board with the same columns: not collapsed.
      renderPage({ design, containerId: 'c2', ...boardSlot } as never)
      await screen.findByTestId('board')
      expect(screen.getByTestId('collapsed')).toHaveTextContent('none')
    })

    it('remembers a folded row for this board only', async () => {
      const rowsSlot = {
        renderBoard: ({
          collapsedRows,
          onToggleRowCollapsed,
        }: {
          collapsedRows?: string[]
          onToggleRowCollapsed?: (id: string) => void
        }) => (
          <div data-testid='board'>
            <span data-testid='rows'>
              {(collapsedRows ?? []).join(',') || 'none'}
            </span>
            <button onClick={() => onToggleRowCollapsed?.('high')}>fold</button>
          </div>
        ),
      }
      const swimlanes = createMockEntityDesign({
        views: [
          createMockEntityView({
            id: 'board',
            name: 'Board',
            viewtype: 'board',
            columns: 'status',
            rows: 'priority',
          }),
        ],
      })
      const first = renderPage({ design: swimlanes, ...rowsSlot } as never)
      fireEvent.click(await screen.findByRole('button', { name: 'fold' }))
      expect(screen.getByTestId('rows')).toHaveTextContent('high')
      first.unmount()

      const again = renderPage({ design: swimlanes, ...rowsSlot } as never)
      await waitFor(() =>
        expect(screen.getByTestId('rows')).toHaveTextContent('high')
      )
      again.unmount()

      renderPage({
        design: swimlanes,
        containerId: 'c2',
        ...rowsSlot,
      } as never)
      await screen.findByTestId('board')
      expect(screen.getByTestId('rows')).toHaveTextContent('none')
    })

    it('expands the column again on a second toggle', async () => {
      renderPage({ design, ...boardSlot } as never)
      const toggle = await screen.findByRole('button', { name: 'toggle' })
      fireEvent.click(toggle)
      fireEvent.click(toggle)
      expect(screen.getByTestId('collapsed')).toHaveTextContent('none')
    })
  })

  it("opens Copy in an object's panel as the new-item form, filled from the object, and a later New as a plain one", async () => {
    const objects = createMockEntityObjects(3)
    const seen: Record<string, unknown>[] = []
    renderPage(
      {
        // The view shows only bugs; the copy is of a task, which keeps its class.
        design: createMockEntityDesign({
          views: [
            createMockEntityView({
              id: 'board',
              viewtype: 'board',
              classes: ['bug'],
            }),
          ],
        }),
        initialObjectId: objects[1].id,
        renderDetailPanel: ({
          objectId,
          onCopy,
        }: {
          objectId: string | null
          onCopy: (copy: EntityObjectCopy) => void
        }) => (
          <button
            type='button'
            data-testid='detail-panel'
            onClick={() =>
              onCopy({
                class: 'task',
                parent: 'p1',
                values: { title: 'Original', status: 'done' },
                attachments: [{ id: 'a1', name: 'plan.png' }],
              })
            }
          >
            {objectId ?? 'none'}
          </button>
        ),
        renderCreateDialog: (props: Record<string, unknown>) => {
          if (props.open) seen.push(props)
          return <div data-testid='create-dialog' />
        },
      },
      objects
    )
    fireEvent.click(await screen.findByTestId('detail-panel'))
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    const copy = seen[seen.length - 1]
    expect(copy).toMatchObject({
      defaultClass: 'task',
      defaultParent: 'p1',
      defaultFields: [
        { field: 'title', value: 'Original' },
        { field: 'status', value: 'done' },
      ],
      copied: [{ id: 'a1', name: 'plan.png' }],
      allowedClasses: undefined,
    })
    // The panel gave way to the form.
    expect(screen.getByTestId('detail-panel')).toHaveTextContent('none')

    seen.length = 0
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /createAction/ }))[0]
    )
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    const plain = seen[seen.length - 1]
    expect(plain.defaultClass).toBeUndefined()
    expect(plain.copied).toBeUndefined()
    expect(plain.defaultParent).toBeUndefined()
    expect(plain.allowedClasses).toEqual(['bug'])
  })
})

describe('EntityObjectsPage lists the route loader started', () => {
  it('reuses them on mount rather than asking again', async () => {
    // The projects and crm loaders start both lists beside the details; with
    // the shared client's staleTime 0 the page would download them again.
    const api = makeApi(createMockEntityObjects(3))
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })
    await client.prefetchQuery(entityObjectsQuery(api.listObjects, 'c1'))
    await client.prefetchQuery(entityPeopleQuery(api.listPeople, 'c1'))
    renderPage({ api }, undefined, client)
    await screen.findByTestId('board')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(api.listObjects).toHaveBeenCalledTimes(1)
    expect(api.listPeople).toHaveBeenCalledTimes(1)
  })
})

describe('EntityObjectsPage filling', () => {
  it('asks for the items again once the container has filled', async () => {
    // The list held while it filled was fetched before the sync landed.
    const api = makeApi([])
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = renderPage(
      { api, container: { ...container, populated: 0 } },
      undefined,
      client
    )
    await waitFor(() => expect(api.listObjects).toHaveBeenCalledTimes(1))
    view.rerender(
      <SearchProvider>
        <EntityObjectsPage
          {...view.props}
          container={{ ...container, populated: 1 }}
        />
      </SearchProvider>
    )
    await waitFor(() => expect(api.listObjects).toHaveBeenCalledTimes(2))
  })
})

// Fields are per class, so a cascade gives a descendant a column only when its
// own class has the field and offers the value, as the server stores it.
describe('EntityObjectsPage cascades', () => {
  const status = (ids: string[]) =>
    ids.map((id) => createMockEntityOption({ id, name: id }))
  const design = createMockEntityDesign({
    classes: [
      createMockEntityClass({ id: 'task' }),
      createMockEntityClass({ id: 'note', rank: 1 }),
      createMockEntityClass({ id: 'memo', rank: 2 }),
    ],
    fields: {
      task: [createMockEntityField({ id: 'status', fieldtype: 'enumerated' })],
      note: [createMockEntityField({ id: 'status', fieldtype: 'enumerated' })],
      memo: [createMockEntityField({ id: 'title', fieldtype: 'text' })],
    },
    options: {
      task: { status: status(['todo', 'in_progress', 'done']) },
      note: { status: status(['todo', 'in_progress']) },
    },
    views: [
      createMockEntityView({
        id: 'board',
        viewtype: 'board',
        columns: 'status',
      }),
    ],
  })
  const objects = [
    createMockEntityObject({ id: 'parent', values: { status: 'todo' } }),
    createMockEntityObject({ id: 'other', values: { status: 'done' } }),
    createMockEntityObject({
      id: 'task',
      parent: 'parent',
      values: { status: 'todo' },
    }),
    createMockEntityObject({
      id: 'note',
      class: 'note',
      parent: 'parent',
      values: { status: 'todo' },
    }),
    createMockEntityObject({
      id: 'memo',
      class: 'memo',
      parent: 'parent',
      values: { title: 'Memo' },
    }),
    createMockEntityObject({
      id: 'grand',
      class: 'note',
      parent: 'task',
      values: { status: 'todo' },
    }),
  ]
  const board = (
    act: (slot: EntityObjectsBoardSlotProps<EntityObject>) => void
  ) =>
    function Board(slot: EntityObjectsBoardSlotProps<EntityObject>) {
      return (
        <>
          {slot.objects.map((o) => (
            <span key={o.id} data-testid={o.id}>
              {o.values.status ?? 'none'}
            </span>
          ))}
          <button onClick={() => act(slot)}>act</button>
        </>
      )
    }
  const pending = () => {
    const api = makeApi(objects)
    // The answer never comes, so the board shows the optimistic copy.
    ;(api.moveObject as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    )
    ;(api.updateObject as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    )
    return api
  }

  it('gives a moved card’s column only to descendants whose class offers it', async () => {
    renderPage(
      {
        api: pending(),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('parent', 'done', undefined)
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() =>
      expect(screen.getByTestId('task')).toHaveTextContent('done')
    )
    expect(screen.getByTestId('parent')).toHaveTextContent('done')
    // A note's status offers no done, and a memo has no status at all.
    expect(screen.getByTestId('note')).toHaveTextContent('todo')
    expect(screen.getByTestId('grand')).toHaveTextContent('todo')
    expect(screen.getByTestId('memo')).toHaveTextContent('none')
  })

  it('gives a column both classes offer to every descendant', async () => {
    renderPage(
      {
        api: pending(),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('parent', 'in_progress', undefined)
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() =>
      expect(screen.getByTestId('note')).toHaveTextContent('in_progress')
    )
    expect(screen.getByTestId('grand')).toHaveTextContent('in_progress')
    expect(screen.getByTestId('memo')).toHaveTextContent('none')
  })

  it('clears a card dropped on the column for no value, and the descendants whose class has the field', async () => {
    const api = pending()
    renderPage(
      {
        api,
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.(
            'parent',
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            true
          )
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() =>
      expect(screen.getByTestId('parent').textContent).toBe('')
    )
    expect(api.moveObject).toHaveBeenCalledWith(
      'c1',
      'parent',
      expect.objectContaining({ field: 'status', value: '', clear: 'true' })
    )
    // A note's status is cleared as a task's is; a memo has none to clear.
    expect(screen.getByTestId('task').textContent).toBe('')
    expect(screen.getByTestId('note').textContent).toBe('')
    expect(screen.getByTestId('grand').textContent).toBe('')
    expect(screen.getByTestId('memo')).toHaveTextContent('none')
  })

  it('keeps the column of a card moved with an empty value and no clear, as a reorder', async () => {
    const api = pending()
    renderPage(
      {
        api,
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('parent', '', { after: 'other' })
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() => expect(api.moveObject).toHaveBeenCalled())
    // No field: the column for no value also draws the cards whose value no
    // column is drawn for, and naming the field would refuse those as
    // neighbours, or the card itself when its class has no such field.
    expect(api.moveObject).toHaveBeenCalledWith(
      'c1',
      'parent',
      expect.objectContaining({ field: '', value: '', clear: undefined })
    )
    expect(screen.getByTestId('parent')).toHaveTextContent('todo')
    expect(screen.getByTestId('task')).toHaveTextContent('todo')
  })

  it('names no field for a reorder among a card’s children, only the parent they are children of', async () => {
    const api = pending()
    renderPage(
      {
        api,
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.(
            'task',
            '',
            { after: 'memo' },
            undefined,
            undefined,
            undefined,
            undefined,
            'parent'
          )
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() => expect(api.moveObject).toHaveBeenCalled())
    expect(api.moveObject).toHaveBeenCalledWith(
      'c1',
      'task',
      expect.objectContaining({ field: '', value: '', scope: 'parent' })
    )
  })

  it.each([
    ['a child among its siblings', 'task', 'note', 'parent'],
    ['a top-level row among the others', 'other', 'parent', ''],
    ['a row among rows of more than one parent', 'task', 'other', undefined],
  ])(
    'names the parent the list says a reorder of %s moves within',
    async (_, moved, after, scope) => {
      const api = pending()
      const listed = {
        ...design,
        views: [
          createMockEntityView({
            id: 'list',
            viewtype: 'list',
            columns: 'status',
          }),
        ],
      }
      renderPage(
        {
          api,
          design: listed,
          renderTree: function Tree(
            slot: EntityObjectsTreeSlotProps<EntityObject>
          ) {
            return (
              <button onClick={() => slot.onReorder?.(moved, { after }, scope)}>
                act
              </button>
            )
          },
        },
        objects
      )
      fireEvent.click(await screen.findByText('act'))
      await waitFor(() => expect(api.moveObject).toHaveBeenCalled())
      const sent = (api.moveObject as ReturnType<typeof vi.fn>).mock.calls[0][2]
      expect(sent).toMatchObject({ field: '', after })
      expect(sent.scope).toBe(scope)
    }
  )

  it('clears a row dragged to the list’s group for no value', async () => {
    const api = pending()
    const listed = {
      ...design,
      views: [
        createMockEntityView({
          id: 'list',
          viewtype: 'list',
          columns: 'status',
        }),
      ],
    }
    renderPage(
      {
        api,
        design: listed,
        renderTree: function Tree(
          slot: EntityObjectsTreeSlotProps<EntityObject>
        ) {
          return (
            <>
              {slot.objects.map((o) => (
                <span key={o.id} data-testid={o.id}>
                  {o.values.status ?? 'none'}
                </span>
              ))}
              <button
                onClick={() => slot.onMoveObject?.('parent', 'status', '')}
              >
                act
              </button>
            </>
          )
        },
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() =>
      expect(screen.getByTestId('parent').textContent).toBe('')
    )
    expect(api.moveObject).toHaveBeenCalledWith(
      'c1',
      'parent',
      expect.objectContaining({ field: 'status', value: '', clear: 'true' })
    )
  })

  it('gives a reparented card and its descendants the new parent’s column each class offers', async () => {
    renderPage(
      {
        api: pending(),
        design,
        renderBoard: board((slot) => slot.onReparentObject?.('task', 'other')),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() =>
      expect(screen.getByTestId('task')).toHaveTextContent('done')
    )
    // The note under it offers no done.
    expect(screen.getByTestId('grand')).toHaveTextContent('todo')
  })
})

// A move's optimistic copy, as the board draws it from the cache: each
// column's cards in the order the board sorts them.
describe('EntityObjectsPage moves', () => {
  const design = createMockEntityDesign({
    classes: [createMockEntityClass({ id: 'task' })],
    fields: {
      task: [createMockEntityField({ id: 'status', fieldtype: 'enumerated' })],
    },
    options: {
      task: {
        status: ['todo', 'done'].map((id) =>
          createMockEntityOption({ id, name: id })
        ),
      },
    },
    views: [
      createMockEntityView({
        id: 'board',
        viewtype: 'board',
        columns: 'status',
      }),
    ],
  })
  const card = (id: string, rank: string, created: number, status: string) =>
    createMockEntityObject({ id, rank, created, values: { status } })
  const board = (
    act: (slot: EntityObjectsBoardSlotProps<EntityObject>) => void
  ) =>
    function Board(slot: EntityObjectsBoardSlotProps<EntityObject>) {
      return (
        <>
          {sortEntityObjects(slot.objects, slot.sort).map((o) => (
            <span key={o.id} data-testid={`card-${o.values.status}`}>
              {o.id}
            </span>
          ))}
          <button onClick={() => act(slot)}>act</button>
        </>
      )
    }
  const column = (status: string) =>
    screen.getAllByTestId(`card-${status}`).map((el) => el.textContent)
  // The answer never comes, so the board shows the optimistic copy.
  const pending = (objects: EntityObject[]) => {
    const api = makeApi(objects)
    ;(api.moveObject as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    )
    return api
  }

  it('lands a card between two that shared a key, the lower one untied to a key of its own', async () => {
    // a and b share a key, drawn a then b, the newer first.
    const objects = [
      card('a', 'a0', 2000, 'todo'),
      card('b', 'a0', 1000, 'todo'),
      card('c', 'a1', 3000, 'todo'),
      card('x', 'a2', 4000, 'todo'),
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'a', before: 'b' })
        ),
      },
      objects
    )
    const button = await screen.findByText('act')
    expect(column('todo')).toEqual(['a', 'b', 'c', 'x'])
    fireEvent.click(button)
    await waitFor(() => expect(column('todo')).toEqual(['a', 'x', 'b', 'c']))
  })

  it('puts a card moved into another column with no neighbour after every other', async () => {
    const objects = [
      card('x', 'a0', 1000, 'todo'),
      card('d', 'a5', 2000, 'done'),
      card('e', 'a9', 3000, 'done'),
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'done', undefined)
        ),
      },
      objects
    )
    const button = await screen.findByText('act')
    expect(column('done')).toEqual(['d', 'e'])
    fireEvent.click(button)
    await waitFor(() => expect(column('done')).toEqual(['d', 'e', 'x']))
  })

  it('puts a card cleared on the column for no value with no neighbour after every other there', async () => {
    const objects = [
      card('x', 'a0', 1000, 'todo'),
      card('u', 'a5', 2000, ''),
      card('v', 'a9', 3000, ''),
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.(
            'x',
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            true
          )
        ),
      },
      objects
    )
    const button = await screen.findByText('act')
    expect(column('')).toEqual(['u', 'v'])
    fireEvent.click(button)
    await waitFor(() => expect(column('')).toEqual(['u', 'v', 'x']))
  })

  // Every card in the order the keys put them, whatever its column.
  const everything = () =>
    screen.getAllByTestId(/^card-/).map((el) => el.textContent)

  it('sends both neighbours of a drop', async () => {
    const objects = [
      card('a', 'a0', 1000, 'todo'),
      card('b', 'a1', 2000, 'todo'),
      card('x', 'a2', 3000, 'done'),
    ]
    const api = pending(objects)
    renderPage(
      {
        api,
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'a', before: 'b' })
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() => expect(api.moveObject).toHaveBeenCalled())
    expect(api.moveObject).toHaveBeenCalledWith(
      'c1',
      'x',
      expect.objectContaining({ after: 'a', before: 'b' })
    )
  })

  it('lands a card directly above the one below when the one above has gone', async () => {
    const objects = [
      card('c', 'a0', 1000, 'todo'),
      card('b', 'a5', 2000, 'todo'),
      card('x', 'a9', 3000, 'done'),
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'gone', before: 'b' })
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() => expect(column('todo')).toEqual(['c', 'x', 'b']))
  })

  it('lands a card directly above the one below when the one above is now in another column', async () => {
    // z was above b when the drop was made, and has since moved to Done,
    // beside w.
    const objects = [
      card('c', 'a0', 1000, 'todo'),
      card('z', 'a3', 2000, 'done'),
      card('w', 'a4', 3000, 'done'),
      card('b', 'a5', 4000, 'todo'),
      card('x', 'a9', 5000, 'done'),
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'z', before: 'b' })
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() => expect(column('todo')).toEqual(['c', 'x', 'b']))
    // Beside b, not beside z.
    expect(everything()).toEqual(['c', 'z', 'w', 'x', 'b'])
  })

  it('lands a card among a parent’s children directly above the one below when the one above has another parent', async () => {
    // k was above j among p's children when the drop was made, and has
    // since moved under q, keeping its key.
    const objects = [
      card('p', 'a0', 1000, 'todo'),
      card('q', 'a1', 2000, 'todo'),
      { ...card('k', 'a3', 3000, 'todo'), parent: 'q' },
      { ...card('w', 'a4', 4000, 'todo'), parent: 'q' },
      { ...card('j', 'a5', 5000, 'todo'), parent: 'p' },
      { ...card('x', 'a9', 6000, 'todo'), parent: 'q' },
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.(
            'x',
            '',
            { after: 'k', before: 'j' },
            undefined,
            undefined,
            'p'
          )
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    // Beside j, not beside k.
    await waitFor(() =>
      expect(everything()).toEqual(['p', 'q', 'k', 'w', 'x', 'j'])
    )
  })

  it('lands a card between two that share a key where the descending Manual sort drew it', async () => {
    const descending = {
      ...design,
      views: [
        createMockEntityView({
          id: 'board',
          viewtype: 'board',
          columns: 'status',
          sort: 'rank',
          direction: 'desc',
        }),
      ],
    }
    // p and q share a key, p the newer: the server lists p then q, and the
    // descending sort draws the exact reverse.
    const objects = [
      card('p', 'a0', 2000, 'todo'),
      card('q', 'a0', 1000, 'todo'),
      card('x', 'a2', 3000, 'done'),
    ]
    renderPage(
      {
        api: pending(objects),
        design: descending,
        // A drop drawn between q and p, as the board sends it.
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'p', before: 'q' })
        ),
      },
      objects
    )
    const button = await screen.findByText('act')
    expect(column('todo')).toEqual(['q', 'p'])
    fireEvent.click(button)
    await waitFor(() => expect(column('todo')).toEqual(['q', 'x', 'p']))
  })

  it('lands a card directly above the one below when the one above is now in another lane', async () => {
    const laned = createMockEntityDesign({
      classes: [createMockEntityClass({ id: 'task' })],
      fields: {
        task: [
          createMockEntityField({ id: 'status', fieldtype: 'enumerated' }),
          createMockEntityField({ id: 'priority', fieldtype: 'enumerated' }),
        ],
      },
      options: {
        task: {
          status: ['todo', 'done'].map((id) =>
            createMockEntityOption({ id, name: id })
          ),
          priority: ['high', 'low'].map((id) =>
            createMockEntityOption({ id, name: id })
          ),
        },
      },
      views: [
        createMockEntityView({
          id: 'board',
          viewtype: 'board',
          columns: 'status',
          rows: 'priority',
        }),
      ],
    })
    const laid = (
      id: string,
      rank: string,
      created: number,
      status: string,
      priority: string
    ) =>
      createMockEntityObject({
        id,
        rank,
        created,
        values: { status, priority },
      })
    // z was above b in High when the drop was made, and has since moved to
    // Low, beside w.
    const objects = [
      laid('c', 'a0', 1000, 'todo', 'high'),
      laid('z', 'a3', 2000, 'todo', 'low'),
      laid('w', 'a4', 3000, 'todo', 'low'),
      laid('b', 'a5', 4000, 'todo', 'high'),
      laid('x', 'a9', 5000, 'done', 'low'),
    ]
    renderPage(
      {
        api: pending(objects),
        design: laned,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'z', before: 'b' }, 'high')
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    // Beside b, not beside z.
    await waitFor(() => expect(everything()).toEqual(['c', 'z', 'w', 'x', 'b']))
  })

  // A task's and a note's status offer different options, and a memo's is
  // text.
  const classed = createMockEntityDesign({
    classes: [
      createMockEntityClass({ id: 'task' }),
      createMockEntityClass({ id: 'note', rank: 1 }),
      createMockEntityClass({ id: 'memo', rank: 2 }),
    ],
    fields: {
      task: [createMockEntityField({ id: 'status', fieldtype: 'enumerated' })],
      note: [createMockEntityField({ id: 'status', fieldtype: 'enumerated' })],
      memo: [createMockEntityField({ id: 'status', fieldtype: 'text' })],
    },
    options: {
      task: {
        status: ['todo', 'done'].map((id) =>
          createMockEntityOption({ id, name: id })
        ),
      },
      note: {
        status: ['todo', 'review'].map((id) =>
          createMockEntityOption({ id, name: id })
        ),
      },
    },
    views: design.views,
  })

  it.each([
    ['beside', 'no option has, a deleted one’s', 'task', 'task', 'gone'],
    ['beside', 'only another class’s option has', 'task', 'note', 'review'],
    ['not beside', 'its own class offers', 'task', 'task', 'done'],
    [
      'not beside',
      'is of a field its own class holds as text',
      'memo',
      'memo',
      'zzz',
    ],
  ])(
    'lands a card cleared on the column for no value %s one whose value %s',
    async (where, _, moving, neighbouring, value) => {
      // u has no value; n was dropped after, its value drawn in the column
      // for no value or not.
      const beside = where === 'beside'
      const objects = [
        { ...card('x', 'a0', 1000, 'todo'), class: moving },
        { ...card('n', 'a3', 2000, value), class: neighbouring },
        card('w', 'a4', 3000, 'done'),
        card('u', 'a6', 4000, ''),
      ]
      renderPage(
        {
          api: pending(objects),
          design: classed,
          renderBoard: board((slot) =>
            slot.onMoveObject?.(
              'x',
              '',
              { after: 'n', before: 'u' },
              undefined,
              undefined,
              undefined,
              true
            )
          ),
        },
        objects
      )
      fireEvent.click(await screen.findByText('act'))
      // Beside n when the server takes it, else directly above u.
      await waitFor(() =>
        expect(everything()).toEqual(
          beside ? ['n', 'x', 'w', 'u'] : ['n', 'w', 'x', 'u']
        )
      )
    }
  )

  it('lands a card dropped in the lane for no value beside one whose lane value no option has', async () => {
    const laned = createMockEntityDesign({
      classes: [createMockEntityClass({ id: 'task' })],
      fields: {
        task: [
          createMockEntityField({ id: 'status', fieldtype: 'enumerated' }),
          createMockEntityField({ id: 'priority', fieldtype: 'enumerated' }),
        ],
      },
      options: {
        task: {
          status: ['todo', 'done'].map((id) =>
            createMockEntityOption({ id, name: id })
          ),
          priority: ['high', 'low'].map((id) =>
            createMockEntityOption({ id, name: id })
          ),
        },
      },
      views: [
        createMockEntityView({
          id: 'board',
          viewtype: 'board',
          columns: 'status',
          rows: 'priority',
        }),
      ],
    })
    const laid = (
      id: string,
      rank: string,
      created: number,
      priority: string
    ) =>
      createMockEntityObject({
        id,
        rank,
        created,
        values: { status: 'todo', priority },
      })
    // g's priority is a deleted option's, so it is drawn with u in the lane
    // for no value.
    const objects = [
      laid('x', 'a0', 1000, 'high'),
      laid('g', 'a3', 2000, 'urgent'),
      laid('w', 'a4', 3000, 'low'),
      laid('u', 'a6', 4000, ''),
    ]
    renderPage(
      {
        api: pending(objects),
        design: laned,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'g', before: 'u' }, '')
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    // Beside g, not above u.
    await waitFor(() => expect(everything()).toEqual(['g', 'x', 'w', 'u']))
  })

  it('lands a child among its parent’s children beside the one it was dropped after, whatever that one’s column', async () => {
    // k1 is in Done and the rest in To Do; w is another card whose key falls
    // between k1's and k2's.
    const objects = [
      card('p', 'a0', 1000, 'todo'),
      { ...card('k1', 'a1', 2000, 'done'), parent: 'p' },
      card('w', 'a3', 3000, 'todo'),
      { ...card('k2', 'a5', 4000, 'todo'), parent: 'p' },
      { ...card('x', 'a9', 5000, 'todo'), parent: 'p' },
    ]
    renderPage(
      {
        api: pending(objects),
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.(
            'x',
            '',
            { after: 'k1', before: 'k2' },
            undefined,
            undefined,
            undefined,
            undefined,
            'p'
          )
        ),
      },
      objects
    )
    fireEvent.click(await screen.findByText('act'))
    // Beside k1, not taken past it for being in another column.
    await waitFor(() =>
      expect(everything()).toEqual(['p', 'k1', 'x', 'w', 'k2'])
    )
  })

  // A move api whose calls each wait until the test answers them.
  const answered = () => {
    const calls: { resolve: () => void; reject: (error: Error) => void }[] = []
    const fn = vi.fn(
      () =>
        new Promise((resolve, reject) =>
          calls.push({
            resolve: () => resolve({ data: { success: true } }),
            reject,
          })
        )
    )
    return { fn, calls }
  }
  // A board with a button for each act, named by its key.
  const buttons = (
    acts: Record<
      string,
      (slot: EntityObjectsBoardSlotProps<EntityObject>) => void
    >
  ) =>
    function Board(slot: EntityObjectsBoardSlotProps<EntityObject>) {
      return (
        <>
          {sortEntityObjects(slot.objects, slot.sort).map((o) => (
            <span key={o.id} data-testid={`card-${o.values.status}`}>
              {o.id}
            </span>
          ))}
          {Object.entries(acts).map(([name, act]) => (
            <button key={name} onClick={() => act(slot)}>
              {name}
            </button>
          ))}
        </>
      )
    }
  const two = buttons({
    first: (slot) =>
      slot.onMoveObject?.('x', 'todo', { after: 'a', before: 'b' }),
    second: (slot) => slot.onMoveObject?.('y', 'todo', { after: 'b' }),
  })
  const four = () => [
    card('a', 'a0', 1000, 'todo'),
    card('b', 'a5', 2000, 'todo'),
    card('x', 'a9', 3000, 'done'),
    card('y', 'aB', 4000, 'done'),
  ]
  const shown = (status: string) =>
    screen.queryAllByTestId(`card-${status}`).map((el) => el.textContent)

  it('sends a move made while another is out once that one is answered, drawing both at once and the second through a list fetched meanwhile', async () => {
    const initial = four()
    // What the server lists once the first move is written, the second not,
    // with a card someone else added since.
    const between = [
      card('a', 'a0', 1000, 'todo'),
      card('x', 'a2', 3000, 'todo'),
      card('b', 'a5', 2000, 'todo'),
      card('y', 'aB', 4000, 'done'),
      card('n', 'aZ', 5000, 'todo'),
    ]
    const api = makeApi(initial)
    const move = answered()
    api.moveObject = move.fn as never
    const lists = [initial, between]
    ;(api.listObjects as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({
        data: { objects: lists.shift() ?? between, watched: [] },
      })
    )
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    renderPage({ api, design, renderBoard: two }, initial, client)
    fireEvent.click(await screen.findByText('first'))
    fireEvent.click(screen.getByText('second'))
    await waitFor(() => expect(shown('todo')).toEqual(['a', 'x', 'b', 'y']))
    // The second waits for the first's answer.
    expect(move.fn).toHaveBeenCalledTimes(1)
    move.calls[0].resolve()
    await waitFor(() => expect(move.fn).toHaveBeenCalledTimes(2))
    expect(move.fn).toHaveBeenLastCalledWith(
      'c1',
      'y',
      expect.objectContaining({ value: 'todo', after: 'b' })
    )
    // The list asked for after the first answer lands without the second.
    await waitFor(() => expect(shown('todo')).toContain('n'))
    expect(shown('todo')).toEqual(['a', 'x', 'b', 'y', 'n'])
    expect(shown('done')).toEqual([])
  })

  it('sends a reparent made while a move is out once the move is answered', async () => {
    const initial = four()
    const api = makeApi(initial)
    const move = answered()
    api.moveObject = move.fn as never
    ;(api.updateObject as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    )
    renderPage(
      {
        api,
        design,
        renderBoard: buttons({
          first: (slot) => slot.onMoveObject?.('x', 'todo', { after: 'a' }),
          second: (slot) => slot.onReparentObject?.('y', 'a'),
        }),
      },
      initial
    )
    fireEvent.click(await screen.findByText('first'))
    fireEvent.click(screen.getByText('second'))
    // The reparent is drawn at once: y takes a's column.
    await waitFor(() => expect(shown('done')).toEqual([]))
    expect(api.updateObject).not.toHaveBeenCalled()
    move.calls[0].resolve()
    await waitFor(() =>
      expect(api.updateObject).toHaveBeenCalledWith('c1', 'y', { parent: 'a' })
    )
  })

  it('keeps a later move where it was dropped when an earlier one is refused, and puts the refused one back', async () => {
    const error = vi.spyOn(toast, 'error').mockImplementation(() => 'toast')
    const initial = four()
    const api = makeApi(initial)
    const move = answered()
    api.moveObject = move.fn as never
    // The list fetched again after the refusal holds a card added since.
    const lists = [initial, [...initial, card('n', 'aZ', 5000, 'todo')]]
    ;(api.listObjects as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({
        data: { objects: lists.shift() ?? initial, watched: [] },
      })
    )
    renderPage({ api, design, renderBoard: two }, initial)
    fireEvent.click(await screen.findByText('first'))
    fireEvent.click(screen.getByText('second'))
    await waitFor(() => expect(shown('todo')).toEqual(['a', 'x', 'b', 'y']))
    move.calls[0].reject(new Error('refused'))
    await waitFor(() => expect(shown('done')).toEqual(['x']))
    expect(shown('todo')).toContain('y')
    await waitFor(() => expect(move.fn).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(shown('todo')).toContain('n'))
    expect(shown('todo')).toEqual(['a', 'b', 'y', 'n'])
    error.mockRestore()
  })

  it('draws an answered move until a list asked for after the answer lands, then shows the server’s', async () => {
    const initial = [
      card('a', 'a0', 1000, 'todo'),
      card('b', 'a5', 2000, 'todo'),
      card('x', 'a9', 3000, 'done'),
    ]
    // The server put x at the end of To Do, not where the drop showed it.
    const written = [
      card('a', 'a0', 1000, 'todo'),
      card('b', 'a5', 2000, 'todo'),
      card('x', 'aC', 3000, 'todo'),
    ]
    const api = makeApi(initial)
    const move = answered()
    api.moveObject = move.fn as never
    let land: () => void = () => {}
    ;(api.listObjects as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async () => ({
        data: { objects: initial, watched: [] },
      }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            land = () => resolve({ data: { objects: written, watched: [] } })
          })
      )
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    renderPage(
      {
        api,
        design,
        renderBoard: board((slot) =>
          slot.onMoveObject?.('x', 'todo', { after: 'a', before: 'b' })
        ),
      },
      initial,
      client
    )
    fireEvent.click(await screen.findByText('act'))
    await waitFor(() => expect(column('todo')).toEqual(['a', 'x', 'b']))
    move.calls[0].resolve()
    await waitFor(() => expect(api.listObjects).toHaveBeenCalledTimes(2))
    // The create dialog adds a new card to the list the server sent before
    // the move.
    act(() => {
      client.setQueryData<{ objects: EntityObject[] }>(
        ['objects', 'c1'],
        (old) =>
          old
            ? {
                ...old,
                objects: [...old.objects, card('n', 'aZ', 4000, 'todo')],
              }
            : old
      )
    })
    await waitFor(() => expect(column('todo')).toContain('n'))
    expect(column('todo')).toEqual(['a', 'x', 'b', 'n'])
    act(() => land())
    await waitFor(() => expect(column('todo')).toEqual(['a', 'b', 'x']))
  })
})
