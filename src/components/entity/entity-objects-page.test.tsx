// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The five render slots are stubbed. What belongs to this page is which slot it
// chooses and what it hands it; what the board and tree do is the apps' tests.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  createMockEntityDesign,
  createMockEntityObjects,
  createMockEntityView,
} from './entity-test-utils'
import {
  EntityObjectsPage,
  type EntityObjectsPageApi,
  type EntityObjectsPageLabels,
  type EntityObjectsPageContainer,
} from './entity-objects-page'
import type { EntityObject } from '../../types/entity-object'
import { FileText } from 'lucide-react'
import { SearchProvider } from '../../context/search-provider'

const invalidate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate,
    history: { subscribe: () => () => {} },
  }),
}))

// Every label is a plain string the app resolves, so the fixture answers any
// key with its own name. An assertion can then look for "exportData" on screen
// without the test carrying 30 lines of wording it does not care about.
const labels = new Proxy({} as EntityObjectsPageLabels, {
  get: (_t, key: string) =>
    key === 'createAction' || key === 'downloaded'
      ? (arg?: string) => `${key}:${arg ?? ''}`
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
  owner: 1,
  access: 'owner',
  populated: 1,
}

function renderPage(
  overrides: Partial<Parameters<typeof EntityObjectsPage>[0]> = {},
  objects: EntityObject[] = createMockEntityObjects(3)
) {
  const props = {
    design: createMockEntityDesign(),
    container,
    containerId: 'c1',
    search: {},
    icon: FileText,
    labels,
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
    ...render(
      <SearchProvider>
        <EntityObjectsPage {...props} />
      </SearchProvider>
    ),
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

describe('EntityObjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('titles the page with the container name', async () => {
    renderPage()
    expect(await screen.findByText('Acme Holdings')).toBeInTheDocument()
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
})
