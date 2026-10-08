// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { parseDiff } from '../lib/diff-parser'
import {
  DiffFileView,
  DiffViewer,
  DiffViewToggle,
  type DiffWords,
} from './diff-viewer'

const render = (ui: ReactElement) =>
  baseRender(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)

const hunk =
  'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-x\n+y\n'

describe('DiffViewer', () => {
  it('shows a placeholder for a file core did not compare', () => {
    render(
      <DiffViewer
        diff={
          'diff --git a/big.bin b/big.bin\n# not compared: over the 1048576 byte limit\n'
        }
        viewStyle='unified'
      />
    )
    expect(screen.getByText('big.bin')).toBeInTheDocument()
    expect(screen.getByText(/Not compared: larger than/)).toBeInTheDocument()
    expect(screen.queryByText('No changes to display')).not.toBeInTheDocument()
  })

  it('says how many files core cut, and does not render the marker as a line', () => {
    render(
      <DiffViewer
        diff={hunk + '# diff truncated: 12 more files\n'}
        viewStyle='unified'
      />
    )
    expect(screen.getByText('12 more files not shown')).toBeInTheDocument()
    expect(screen.queryByText(/diff truncated/)).not.toBeInTheDocument()
  })

  it('does not report no changes when only the marker survived', () => {
    render(
      <DiffViewer
        diff={'# diff truncated: 3 more files\n'}
        viewStyle='unified'
      />
    )
    expect(screen.getByText('3 more files not shown')).toBeInTheDocument()
    expect(screen.queryByText('No changes to display')).not.toBeInTheDocument()
  })

  // The library does not depend on a diff package: the app hands the word
  // comparison in, and the view has to stand without one.
  const edit =
    'diff --git a/a.md b/a.md\n--- a/a.md\n+++ b/a.md\n@@ -1 +1 @@\n-a single server\n+a small server\n'
  const words: DiffWords = () => [
    { value: 'a ' },
    { value: 'single', removed: true },
    { value: 'small', added: true },
    { value: ' server' },
  ]

  it('marks the changed words when the app passes a word comparison', () => {
    render(<DiffViewer diff={edit} viewStyle='unified' words={words} />)
    expect(screen.getByText('single').className).toContain('bg-destructive')
    expect(screen.getByText('small').className).toContain('bg-success')
  })

  it('shows both lines whole when the word comparison declines', () => {
    render(
      <DiffViewer diff={edit} viewStyle='unified' words={() => undefined} />
    )
    expect(screen.getByText('a single server')).toBeInTheDocument()
    expect(screen.getByText('a small server')).toBeInTheDocument()
  })

  it('shows both lines whole when no word comparison is passed', () => {
    render(<DiffViewer diff={edit} viewStyle='unified' />)
    expect(screen.getByText('a single server')).toBeInTheDocument()
    expect(screen.getByText('a small server')).toBeInTheDocument()
  })

  it('lays the two sides out in separate columns in the split view', () => {
    const { container } = render(<DiffViewer diff={edit} viewStyle='split' />)
    const row = screen.getByText('a single server').closest('tr')
    expect(row).toBe(screen.getByText('a small server').closest('tr'))
    expect(container.querySelectorAll('td.w-1\\/2').length).toBeGreaterThan(0)
  })
})

describe('DiffViewToggle', () => {
  it('names each icon button and marks the view shown as pressed', () => {
    render(<DiffViewToggle value='split' onChange={() => {}} />)
    const unified = screen.getByRole('button', { name: 'Unified' })
    const split = screen.getByRole('button', { name: 'Split' })
    expect(unified).toHaveAttribute('aria-pressed', 'false')
    expect(split).toHaveAttribute('aria-pressed', 'true')
    // Icons alone: the name is not printed inside the button.
    expect(unified).toHaveTextContent('')
  })

  it('reports the other view and ignores the one already shown', () => {
    const onChange = vi.fn()
    render(<DiffViewToggle value='unified' onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unified' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Split' }))
    expect(onChange).toHaveBeenCalledWith('split')
  })
})

describe('DiffFileView', () => {
  const file = parseDiff(
    'diff --git a/home b/home\n--- a/home\n+++ b/home\n@@ -1,2 +1,2 @@\n intro\n-a single server\n+a small server\n'
  ).files[0]

  it('shows the lines with no file header and no totals', () => {
    render(<DiffFileView file={file} viewStyle='unified' />)
    expect(screen.getByText('a single server')).toBeInTheDocument()
    expect(screen.queryByText('home')).not.toBeInTheDocument()
    expect(screen.queryByText(/file changed/)).not.toBeInTheDocument()
    expect(screen.getByText(/@@ -1,2 \+1,2 @@/)).toBeInTheDocument()
  })

  it('breaks prose between words and code anywhere', () => {
    const { container, rerender } = render(
      <DiffFileView file={file} viewStyle='unified' />
    )
    expect(container.firstElementChild?.className).not.toContain('word-break')
    rerender(
      <I18nProvider i18n={i18n}>
        <DiffFileView file={file} viewStyle='unified' prose />
      </I18nProvider>
    )
    expect(container.firstElementChild?.className).toContain(
      '[&_td]:[word-break:normal]'
    )
  })

  it('can keep prose comparisons at the existing readable text size', () => {
    const { container } = render(
      <DiffFileView file={file} viewStyle='unified' prose textSize='sm' />
    )
    const table = container.querySelector('table')
    expect(table).toHaveClass('text-sm')
    expect(table).not.toHaveClass('text-xs')
  })

  it('leaves the hunk header out when asked, in both layouts', () => {
    const { rerender } = render(
      <DiffFileView file={file} viewStyle='unified' hunkHeaders={false} />
    )
    expect(screen.queryByText(/@@/)).not.toBeInTheDocument()
    rerender(
      <I18nProvider i18n={i18n}>
        <DiffFileView file={file} viewStyle='split' hunkHeaders={false} />
      </I18nProvider>
    )
    expect(screen.queryByText(/@@/)).not.toBeInTheDocument()
    expect(screen.getByText('a small server')).toBeInTheDocument()
  })
})
