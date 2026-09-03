// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Both apps render this page and each passes a different envelope, a different
// access ladder and, in projects' case, an extra identity row. These blocks
// cover what the page decides for itself: which of its four states it is in,
// who may delete, and what it does after a save.
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from './entity-test-utils'
import {
  EntitySettingsPage,
  type EntitySettingsPageLabels,
} from './entity-settings-page'
import { FileText } from 'lucide-react'

vi.mock('../../lib/toast-action', () => ({
  toastAction: (promise: Promise<unknown>) => promise,
}))

// A lookup failure that is not a 403 or 404 renders GeneralError, which reaches
// for the router the app shell provides.
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back: vi.fn() }, navigate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Same trick as the objects page: every label answers with its own key, so an
// assertion names the state rather than the app's wording.
const labels = new Proxy({} as EntitySettingsPageLabels, {
  get: (_t, key: string) =>
    ['pageTitle', 'deleteDescription', 'accessSet'].includes(key)
      ? (arg?: string) => `${key}:${arg ?? ''}`
      : key,
})

const container = {
  id: 'c1',
  fingerprint: 'f1',
  name: 'Acme Holdings',
  description: 'a container',
  server: 'node-a',
  owner: 1,
}

function makeApi(over: Record<string, unknown> = {}) {
  return {
    get: vi.fn(async () => ({ data: { crm: container } })),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getAccessRules: vi.fn(async () => ({ data: { rules: [] } })),
    setAccessLevel: vi.fn(),
    revokeAccess: vi.fn(),
    searchUsers: vi.fn(async () => ({ data: { results: [] } })),
    listGroups: vi.fn(async () => ({ data: { groups: [] } })),
    ...over,
  }
}

function renderPage(overrides: Record<string, unknown> = {}) {
  const { api: apiOverride, ...rest } = overrides
  const api = (apiOverride as ReturnType<typeof makeApi>) ?? makeApi()
  const onDeleted = vi.fn()
  const refreshSidebar = vi.fn()
  const props = {
    containerId: 'c1',
    selectContainer: (d: { crm: typeof container }) => d.crm,
    queryKey: 'crms',
    accessRulesKey: 'crm-access',
    icon: FileText,
    labels,
    accessLevels: [{ value: 'view', label: 'View', description: 'read' }],
    validateName: () => null,
    activeTab: 'general' as const,
    onTabChange: vi.fn(),
    onBack: vi.fn(),
    onDeleted,
    refreshSidebar,
    ...rest,
    api,
  }
  const Page = EntitySettingsPage as unknown as (
    p: Record<string, unknown>
  ) => ReactElement
  render(<Page {...props} />)
  return { api, onDeleted, refreshSidebar }
}

describe('EntitySettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pulls the container out of the envelope this app wraps it in', async () => {
    renderPage()
    expect(await screen.findByText('Acme Holdings')).toBeInTheDocument()
  })

  // A 403 and a 404 both mean "not yours to see" and share one state; anything
  // else is the server being unwell and reads differently.
  it.each([403, 404])(
    'reads a %i as the container not being there',
    async (status) => {
      renderPage({
        api: makeApi({
          get: vi.fn(async () => {
            throw Object.assign(new Error('nope'), { status })
          }),
        }),
      })
      expect(await screen.findByText('notFound')).toBeInTheDocument()
    }
  )

  // A 500 is the server being unwell rather than the container being missing,
  // so it gets the retryable error rather than the empty state.
  it('reads any other failure as an error to retry, not a missing container', async () => {
    renderPage({
      api: makeApi({
        get: vi.fn(async () => {
          throw Object.assign(new Error('boom'), { status: 500 })
        }),
      }),
    })
    await screen.findByText('settings')
    await waitFor(() =>
      expect(screen.queryByText('notFound')).not.toBeInTheDocument()
    )
  })

  it('offers the delete section to the owner', async () => {
    renderPage()
    expect(await screen.findByText('deleteSection')).toBeInTheDocument()
  })

  it('withholds the delete section from everyone else', async () => {
    renderPage({
      api: makeApi({
        get: vi.fn(async () => ({ data: { crm: { ...container, owner: 2 } } })),
      }),
    })
    await screen.findByText('Acme Holdings')
    expect(screen.queryByText('deleteSection')).not.toBeInTheDocument()
  })

  // projects adds a prefix row here and crm adds nothing, so the slot has to be
  // optional rather than always rendered.
  it('renders the identity extras an app supplies', async () => {
    renderPage({
      renderIdentityExtras: () => <div data-testid='extras' />,
    })
    expect(await screen.findByTestId('extras')).toBeInTheDocument()
  })

  it('renders none when the app supplies no extras', async () => {
    renderPage()
    await screen.findByText('Acme Holdings')
    expect(screen.queryByTestId('extras')).not.toBeInTheDocument()
  })

  // The access tab is where crm used to break: the server can answer with an
  // object rather than a list, and `?? []` let that through to a .map().
  it('shows the access management section on the access tab', async () => {
    renderPage({ activeTab: 'access' })
    expect(await screen.findByText('accessManagement')).toBeInTheDocument()
  })

  it('survives a rules payload that is an object rather than a list', async () => {
    renderPage({
      activeTab: 'access',
      api: makeApi({
        getAccessRules: vi.fn(async () => ({
          data: { rules: { '1': { subject: 'u1', level: 'view' } } },
        })),
      }),
    })
    expect(await screen.findByText('accessManagement')).toBeInTheDocument()
  })

  it('keeps the access tab away from anyone but the owner', async () => {
    renderPage({
      activeTab: 'access',
      api: makeApi({
        get: vi.fn(async () => ({ data: { crm: { ...container, owner: 2 } } })),
      }),
    })
    await screen.findByText('pageTitle:Acme Holdings')
    expect(screen.queryByText('accessManagement')).not.toBeInTheDocument()
    // The URL asked for the access tab; a visitor lands on the general one
    // rather than an empty page.
    expect(screen.getByText('identity')).toBeInTheDocument()
  })

  it('refreshes the sidebar and leaves after a delete', async () => {
    const { api, onDeleted, refreshSidebar } = renderPage()
    fireEvent.click(await screen.findByText('delete'))
    fireEvent.click(await screen.findByText('deleteConfirm'))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('c1'))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(refreshSidebar).toHaveBeenCalled()
  })
})
