// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ComponentProps } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

function renderTable(props: ComponentProps<typeof Table> = {}) {
  return render(
    <Table {...props}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

describe('Table visual contract', () => {
  it('uses the shared bordered, shaded, and spaced defaults', () => {
    const { container } = renderTable()
    const wrapper = container.querySelector('[data-slot="table-container"]')
    const header = container.querySelector('[data-slot="table-head"]')
    const cell = container.querySelector('[data-slot="table-cell"]')

    expect(wrapper).toHaveClass('rounded-lg', 'border', 'border-border')
    expect(container.querySelector('[data-slot="table-header"]')).toHaveClass(
      'bg-surface-2'
    )
    expect(header).toHaveClass('h-12', 'px-4')
    expect(cell).toHaveClass('px-4', 'py-3')
  })

  it('allows Card-contained tables to opt out of the outer border', () => {
    const { container } = renderTable({ bordered: false })
    const wrapper = container.querySelector('[data-slot="table-container"]')

    // One class per assertion: not.toHaveClass with several passes as soon as
    // any one of them is missing.
    expect(wrapper).not.toHaveClass('border')
    expect(wrapper).not.toHaveClass('rounded-lg')
    expect(container.querySelector('[data-slot="table-header"]')).toHaveClass(
      'bg-surface-2'
    )
  })
})
