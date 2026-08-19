// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The design page loads the container, gates on design permission, and wraps
// the app's own editor. Only projects offers built-in templates, so the import
// dialog has to hold that slot open without requiring it.
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from './entity-test-utils'
import {
  EntityDesignPage,
  type EntityDesignPageLabels,
} from './entity-design-page'

vi.mock('../../lib/toast-action', () => ({
  toastAction: (promise: Promise<unknown>) => promise,
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back: vi.fn() }, navigate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const labels = new Proxy({} as EntityDesignPageLabels, {
  get: (_t, key: string) =>
    key === 'pageTitle' || key === 'downloaded'
      ? (arg?: string) => `${key}:${arg ?? ''}`
      : key === 'replaceDescription'
        ? () => <span>replaceDescription</span>
        : key,
})

const details = { crm: { name: 'Acme Holdings' } }

function makeApi(over: Record<string, unknown> = {}) {
  return {
    get: vi.fn(async () => ({ data: details })),
    exportDesign: vi.fn(async () => ({ data: { classes: [] } })),
    importDesign: vi.fn(async () => ({})),
    ...over,
  }
}

function renderPage(overrides: Record<string, unknown> = {}) {
  const { api: apiOverride, ...rest } = overrides
  const api = (apiOverride as ReturnType<typeof makeApi>) ?? makeApi()
  const onBack = vi.fn()
  const props = {
    containerId: 'c1',
    selectContainer: (d: typeof details) => d.crm,
    queryKey: 'crms',
    labels,
    canDesign: () => true,
    renderRedirect: () => <div data-testid='redirect' />,
    onBack,
    renderEditor: () => <div data-testid='editor' />,
    ...rest,
    api,
  }
  const Page = EntityDesignPage as unknown as (
    p: Record<string, unknown>
  ) => ReactElement
  render(<Page {...props} />)
  return { api, onBack }
}

async function openPageMenu() {
  const triggers = await screen.findAllByRole('button', { name: 'pageActions' })
  fireEvent.pointerDown(
    triggers[0],
    new MouseEvent('pointerdown', { bubbles: true, button: 0 })
  )
}

describe('EntityDesignPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('titles the page from the container the app selects', async () => {
    renderPage()
    expect(
      await screen.findByText('pageTitle:Acme Holdings')
    ).toBeInTheDocument()
  })

  it('wraps the app’s own editor once the container has loaded', async () => {
    renderPage()
    expect(await screen.findByTestId('editor')).toBeInTheDocument()
  })

  // Design is a permission, so a reader without it is sent away rather than
  // shown an empty editor.
  it('sends a reader without design permission to the redirect', async () => {
    renderPage({ canDesign: () => false })
    expect(await screen.findByTestId('redirect')).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  // The server's own message is shown when it sent one; labels.loadFailed is
  // only the stand-in for a failure that arrived without one.
  it('shows the error instead of the editor when the container cannot be fetched', async () => {
    renderPage({
      api: makeApi({
        get: vi.fn(async () => {
          throw new Error('boom')
        }),
      }),
    })
    expect(await screen.findByText('design')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
    )
  })

  it('offers export and import in the page menu', async () => {
    renderPage()
    await screen.findByTestId('editor')
    await openPageMenu()
    expect(await screen.findByText('exportAction')).toBeInTheDocument()
    expect(screen.getByText('importAction')).toBeInTheDocument()
  })

  // projects passes a templates slot and crm does not, so the import dialog
  // has to render either way.
  it('renders the templates an app offers inside the import dialog', async () => {
    renderPage({ renderTemplates: () => <div data-testid='templates' /> })
    await screen.findByTestId('editor')
    await openPageMenu()
    fireEvent.click(await screen.findByText('importAction'))
    expect(await screen.findByTestId('templates')).toBeInTheDocument()
  })

  it('opens the same import dialog for an app with no templates', async () => {
    renderPage()
    await screen.findByTestId('editor')
    await openPageMenu()
    fireEvent.click(await screen.findByText('importAction'))
    expect(await screen.findByText('importTitle')).toBeInTheDocument()
    expect(screen.queryByTestId('templates')).not.toBeInTheDocument()
  })

  it('asks the api for the design when exporting', async () => {
    const { api } = renderPage()
    await screen.findByTestId('editor')
    await openPageMenu()
    fireEvent.click(await screen.findByText('exportAction'))
    await waitFor(() => expect(api.exportDesign).toHaveBeenCalledWith('c1'))
  })
})
