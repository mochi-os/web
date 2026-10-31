// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { EntityLayout } from './entity-layout'

vi.mock('../layout/authenticated-layout', () => ({
  AuthenticatedLayout: () => null,
}))

const labels = {
  group: 'Things',
  all: 'All things',
  find: 'Find things',
  create: 'Create thing',
  retry: 'Retry',
}

function show(props: {
  refresh: () => Promise<void>
  load?: () => Promise<void>
}) {
  render(
    <EntityLayout
      rows={[]}
      isLoading={false}
      error={null}
      icon={FileText}
      labels={labels}
      onCreate={() => {}}
      viewUrl={(id) => `/${id}`}
      {...props}
    />
  )
}

describe('EntityLayout first load', () => {
  it('joins the load the route started rather than refreshing', () => {
    const refresh = vi.fn(async () => {})
    const load = vi.fn(async () => {})
    show({ refresh, load })
    expect(load).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes on mount for an app that gives no load', () => {
    const refresh = vi.fn(async () => {})
    show({ refresh })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
