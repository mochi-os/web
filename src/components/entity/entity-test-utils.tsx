// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable lingui/no-unlocalized-strings */
// Test harness shared by crm and projects; each app keeps its own container
// fixture and details envelope. No lingui macro anywhere in this file: every
// app's lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type {
  EntityClass,
  EntityDesign,
  EntityField,
  EntityFieldOption,
  EntityObject,
  EntityView,
} from '../../types/entity-object'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

// i18n is activated globally in each app's src/test/setup.ts; here we only
// provide it to the React tree so <Trans> / useLingui resolve.
function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react'
export { renderWithProviders as render }

// ============= Mock data factories =============

export function createMockEntityField(
  overrides?: Partial<EntityField>,
): EntityField {
  return {
    id: 'field-1',
    name: 'Test Field',
    fieldtype: 'text',
    flags: '',
    multi: 0,
    rank: 0,
    card: 0,
    position: '',
    rows: 0,
    ...overrides,
  }
}

export function createMockEntityOption(
  overrides?: Partial<EntityFieldOption>,
): EntityFieldOption {
  return {
    id: 'opt-1',
    name: 'Test Option',
    colour: '#3b82f6',
    icon: '',
    rank: 0,
    ...overrides,
  }
}

export function createMockEntityView(
  overrides?: Partial<EntityView>,
): EntityView {
  return {
    id: 'view-1',
    name: 'Board',
    viewtype: 'board',
    filter: '',
    columns: '',
    rows: '',
    fields: '',
    sort: '',
    direction: '',
    classes: [],
    rank: 0,
    border: '',
    ...overrides,
  }
}

export function createMockEntityClass(
  overrides?: Partial<EntityClass>,
): EntityClass {
  return {
    id: 'task',
    name: 'Task',
    rank: 0,
    title: 'title',
    ...overrides,
  }
}

export function createMockEntityObject(
  overrides?: Partial<EntityObject>,
): EntityObject {
  return {
    id: 'obj-1',
    class: 'task',
    parent: '',
    rank: 'V',
    created: Date.now(),
    updated: Date.now(),
    values: {
      title: 'Test Task',
      status: 'todo',
      priority: 'medium',
    },
    ...overrides,
  }
}

export function createMockEntityObjects(count: number): EntityObject[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEntityObject({
      id: `obj-${i + 1}`,
      values: {
        title: `Task ${i + 1}`,
        status: ['todo', 'in_progress', 'done'][i % 3],
        priority: ['high', 'medium', 'low'][i % 3],
      },
    }),
  )
}

/**
 * The schema half of an app's details envelope, e.g. `{ crm: createMockCrm(),
 * ...createMockEntityDesign() }`.
 */
export function createMockEntityDesign(
  overrides?: Partial<EntityDesign>,
): EntityDesign {
  const statusOptions: EntityFieldOption[] = [
    createMockEntityOption({ id: 'todo', name: 'To Do', colour: '#6b7280' }),
    createMockEntityOption({
      id: 'in_progress',
      name: 'In Progress',
      colour: '#f59e0b',
    }),
    createMockEntityOption({ id: 'done', name: 'Done', colour: '#22c55e' }),
  ]

  const priorityOptions: EntityFieldOption[] = [
    createMockEntityOption({ id: 'high', name: 'High', colour: '#ef4444' }),
    createMockEntityOption({ id: 'medium', name: 'Medium', colour: '#f59e0b' }),
    createMockEntityOption({ id: 'low', name: 'Low', colour: '#22c55e' }),
  ]

  return {
    classes: [createMockEntityClass()],
    fields: {
      task: [
        createMockEntityField({ id: 'title', name: 'Title', fieldtype: 'text' }),
        createMockEntityField({
          id: 'status',
          name: 'Status',
          fieldtype: 'enumerated',
        }),
        createMockEntityField({
          id: 'priority',
          name: 'Priority',
          fieldtype: 'enumerated',
        }),
        createMockEntityField({
          id: 'description',
          name: 'Description',
          fieldtype: 'text',
          rows: 3,
        }),
      ],
    },
    options: {
      task: {
        status: statusOptions,
        priority: priorityOptions,
      },
    },
    views: [
      createMockEntityView({ id: 'board', name: 'Board', viewtype: 'board' }),
      createMockEntityView({ id: 'list', name: 'List', viewtype: 'list' }),
    ],
    hierarchy: {},
    ...overrides,
  }
}
