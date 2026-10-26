// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { fireEvent, render as baseRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { parseDiff } from '../lib/diff-parser'
import {
  DiffFileView,
  DiffLines,
  DiffViewer,
  DiffViewToggle,
} from './diff-viewer'

const render = (ui: ReactElement) =>
  baseRender(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)

// The cell showing a line, whole: an edited line's changed words are marked in
// pieces of their own, so its text is not one node.
const line = (text: string) =>
  screen.getByText(
    (_, element) =>
      element?.tagName === 'TD' &&
      element.textContent?.replace(/^[-+ ]/, '') === text
  )

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

  const edit =
    'diff --git a/a.md b/a.md\n--- a/a.md\n+++ b/a.md\n@@ -1 +1 @@\n-a single server\n+a small server\n'

  it('marks the changed words inside an edited line', () => {
    render(<DiffViewer diff={edit} viewStyle='unified' />)
    expect(screen.getByText('single').className).toContain('bg-destructive')
    expect(screen.getByText('small').className).toContain('bg-success')
  })

  it('shows both lines whole when they have little in common', () => {
    render(
      <DiffViewer
        diff={
          'diff --git a/a.md b/a.md\n--- a/a.md\n+++ b/a.md\n@@ -1 +1 @@\n-Install from git.\n+Requirements are listed below.\n'
        }
        viewStyle='unified'
      />
    )
    expect(screen.getByText('Install from git.')).toBeInTheDocument()
    expect(
      screen.getByText('Requirements are listed below.')
    ).toBeInTheDocument()
  })

  it('lays the two sides out in separate columns in the split view', () => {
    const { container } = render(<DiffViewer diff={edit} viewStyle='split' />)
    const row = line('a single server').closest('tr')
    expect(row).toBe(line('a small server').closest('tr'))
    expect(container.querySelectorAll('td.w-1\\/2').length).toBeGreaterThan(0)
  })
})

const file = (name: string, lines = 1) =>
  `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n@@ -0,0 +1,${lines} @@\n` +
  Array.from({ length: lines }, (_, i) => `+${name} line ${i + 1}\n`).join('')

describe('DiffViewer files', () => {
  it('lists the changed files and opens one from the list', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 0
    })
    render(
      <DiffViewer diff={file('a.ts') + file('b.ts')} viewStyle='unified' />
    )
    expect(screen.queryByRole('list')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2 files changed/ }))
    const list = screen.getByRole('list')
    expect(list).toHaveTextContent('a.ts')
    expect(list).toHaveTextContent('b.ts')

    // Collapsed by its header, b.ts opens again when picked from the list.
    fireEvent.click(screen.getAllByRole('button', { name: /b\.ts/ })[1])
    expect(screen.queryByText('b.ts line 1')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /b\.ts/ })[0])
    expect(screen.getByText('b.ts line 1')).toBeInTheDocument()
    expect(scroll).toHaveBeenCalled()
  })

  it('collapses and expands every file at once', () => {
    render(
      <DiffViewer diff={file('a.ts') + file('b.ts')} viewStyle='unified' />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryByText('a.ts line 1')).toBeNull()
    expect(screen.queryByText('b.ts line 1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(screen.getByText('a.ts line 1')).toBeInTheDocument()
    expect(screen.getByText('b.ts line 1')).toBeInTheDocument()
  })

  it('holds a large file back until asked for', () => {
    render(<DiffViewer diff={file('big.ts', 401)} viewStyle='unified' />)
    expect(screen.queryByText('big.ts line 1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Load diff' }))
    expect(screen.getByText('big.ts line 1')).toBeInTheDocument()
  })

  it('draws a file of exactly the size limit at once', () => {
    render(<DiffViewer diff={file('edge.ts', 400)} viewStyle='unified' />)
    expect(screen.getByText('edge.ts line 1')).toBeInTheDocument()
  })

  it('holds back files listed after the first fifty', () => {
    const diff = Array.from({ length: 51 }, (_, i) => file(`f${i}.ts`)).join('')
    render(<DiffViewer diff={diff} viewStyle='unified' />)
    expect(screen.getByText('f49.ts line 1')).toBeInTheDocument()
    expect(screen.queryByText('f50.ts line 1')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Load diff' })).toHaveLength(1)
  })

  it("places the app's controls beside each file's toggle, not inside it", () => {
    render(
      <DiffViewer
        diff={file('a.ts')}
        viewStyle='unified'
        actions={({ file }) => (
          <button type='button'>Options {file.path}</button>
        )}
      />
    )
    const options = screen.getByRole('button', { name: 'Options a.ts' })
    expect(options.closest('button[aria-expanded]')).toBeNull()
  })

  it("draws a file with the app's body when it gives one", () => {
    render(
      <DiffViewer
        diff={file('a.ts')}
        viewStyle='unified'
        body={({ file, viewStyle }) => (
          <div>
            <p>
              Again {file.path} in {viewStyle}
            </p>
            <DiffLines file={file} viewStyle={viewStyle} />
          </div>
        )}
      />
    )
    expect(screen.getByText('Again a.ts in unified')).toBeInTheDocument()
    expect(screen.getByText('a.ts line 1')).toBeInTheDocument()
  })

  // Six files of 380 lines: the first four fill the first frame's 1,500.
  const large = Array.from({ length: 6 }, (_, i) => file(`f${i}.ts`, 380)).join(
    ''
  )

  it("draws a large diff's first files at once and the rest after", async () => {
    render(<DiffViewer diff={large} viewStyle='unified' />)
    expect(screen.getByText('f3.ts line 1')).toBeInTheDocument()
    // THE POINT: the last files wait their turn, their headers shown.
    expect(screen.queryByText('f4.ts line 1')).toBeNull()
    expect(screen.getByRole('button', { name: /f5\.ts/ })).toBeInTheDocument()
    expect(await screen.findByText('f5.ts line 1')).toBeInTheDocument()
  })

  it('draws a file picked from the list before its turn', () => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 0
    })
    render(<DiffViewer diff={large} viewStyle='unified' />)
    fireEvent.click(screen.getByRole('button', { name: /6 files changed/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /f5\.ts/ })[0])
    expect(screen.getByText('f5.ts line 1')).toBeInTheDocument()
    expect(screen.queryByText('f4.ts line 1')).toBeNull()
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
    expect(line('a single server')).toBeInTheDocument()
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
    expect(line('a small server')).toBeInTheDocument()
  })
})
