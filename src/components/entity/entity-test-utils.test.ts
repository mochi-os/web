// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { createMockEntityDesign } from './entity-test-utils'

describe('createMockEntityDesign', () => {
  it('uses the field types the product has', () => {
    const fields = createMockEntityDesign().fields.task
    const types = Object.fromEntries(fields.map((f) => [f.id, f.fieldtype]))
    expect(types).toEqual({ title: 'text', status: 'enumerated', priority: 'enumerated', description: 'text' })
    expect(fields.find((f) => f.id === 'description')?.rows).toBe(3)
  })
})
