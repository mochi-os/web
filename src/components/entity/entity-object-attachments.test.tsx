// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from './entity-test-utils'

const shellDownload = vi.fn(async (_url: string, _name: string) => true)
vi.mock('../../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/shell-bridge')>()),
  shellDownload: (url: string, name: string) => shellDownload(url, name),
}))

const { EntityObjectAttachments } = await import('./entity-object-attachments')

const files = [
  { id: 'f1', name: 'brief.pdf', type: 'application/pdf', size: 1024, caption: '', created: 0 },
  { id: 'f2', name: 'cover.png', type: 'image/png', size: 2048, caption: '', created: 0 },
]

function show(readOnly = false) {
  render(
    <EntityObjectAttachments
      containerId='c1'
      objectId='o1'
      readOnly={readOnly}
      listAttachments={vi.fn(async () => ({ data: { attachments: files } }))}
      uploadAttachments={vi.fn(async () => ({}))}
      deleteAttachment={vi.fn(async () => ({}))}
    />
  )
}

describe('EntityObjectAttachments', () => {
  beforeEach(() => shellDownload.mockClear())

  it('saves a file through the shell rather than an anchor the sandbox ignores', async () => {
    show(true)
    const download = await screen.findByRole('button', { name: 'Download' })
    expect(document.querySelector('a[download]')).toBeNull()
    fireEvent.click(download)
    await waitFor(() => expect(shellDownload).toHaveBeenCalledTimes(1))
    expect(shellDownload.mock.calls[0][0]).toContain('f1')
    expect(shellDownload.mock.calls[0][1]).toBe('brief.pdf')
  })

  it('keeps the image delete control reachable without hover', async () => {
    show(false)
    const removes = await screen.findAllByRole('button', { name: 'Delete' })
    const overlay = removes.find((el) => el.className.includes('group-hover/item'))
    expect(overlay?.className).toContain('[@media(hover:none)]:flex')
  })
})
