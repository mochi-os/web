// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb'

function trail() {
  return render(
    <Breadcrumb aria-label='Path'>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <a href='/root'>root</a>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>file.ts</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

describe('Breadcrumb', () => {
  it('is a navigation landmark named by the caller', () => {
    trail()
    expect(screen.getByRole('navigation', { name: 'Path' })).toBeInTheDocument()
  })

  it('renders the caller link through asChild', () => {
    trail()
    const link = screen.getByRole('link', { name: 'root' })
    expect(link).toHaveAttribute('href', '/root')
    expect(link).toHaveAttribute('data-slot', 'breadcrumb-link')
  })

  it('marks the last item as the current page', () => {
    trail()
    expect(screen.getByText('file.ts')).toHaveAttribute('aria-current', 'page')
  })

  it('hides the separator from assistive tech and lists only the items', () => {
    trail()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
