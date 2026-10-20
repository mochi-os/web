// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from '../../lib/toast-utils'
import { render, screen, fireEvent, waitFor } from './entity-test-utils'
import {
  EntityDuplicateDialog,
  type EntityDuplicateApi,
} from './entity-duplicate-dialog'

const labels = {
  title: 'Duplicate CRM',
  name: 'Name',
  everything: 'Everything',
  designOnly: 'Design only',
  allowSearch: 'Allow anyone to search for CRM',
  cancel: 'Cancel',
  confirm: 'Duplicate',
  duplicating: 'Duplicating CRM...',
  duplicated: 'CRM duplicated',
  failed: 'Failed to duplicate CRM',
  defaultName: (name: string) => `Duplicate of ${name}`,
  leftBehind: 'The unfinished copy could not be removed',
  incomplete: 'The copy may be incomplete',
}

const archive = new Blob(['zip'])
const design = { classes: [{ id: 'deal' }] }

let api: EntityDuplicateApi
let create: ReturnType<typeof vi.fn>
let remove: ReturnType<typeof vi.fn>
let onDuplicated: ReturnType<typeof vi.fn>
let onOpenChange: ReturnType<typeof vi.fn>

beforeEach(() => {
  // Spies on toast persist between tests; each test counts its own calls.
  vi.restoreAllMocks()
  api = {
    warmExport: vi
      .fn()
      .mockResolvedValueOnce({ data: { attachments: 2, remaining: 1 } })
      .mockResolvedValue({ data: { attachments: 2, remaining: 0 } }),
    exportData: vi.fn(async () => archive),
    exportDesign: vi.fn(async () => ({ data: design })),
    importData: vi.fn(async () => ({})),
    importDesign: vi.fn(async () => ({})),
  }
  create = vi.fn(async () => 'copy-fp')
  remove = vi.fn(async () => ({}))
  onDuplicated = vi.fn()
  onOpenChange = vi.fn()
})

function renderDialog(
  extra: Partial<Parameters<typeof EntityDuplicateDialog>[0]> = {}
) {
  return render(
    <EntityDuplicateDialog
      open
      onOpenChange={onOpenChange as never}
      sourceId='src-id'
      sourceName='Sales'
      api={api}
      create={create as never}
      remove={remove as never}
      onDuplicated={onDuplicated as never}
      labels={labels}
      {...extra}
    />
  )
}

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))

describe('EntityDuplicateDialog', () => {
  it('copies everything: warms, exports, creates, then restores the archive', async () => {
    renderDialog()
    expect(screen.getByLabelText('Name')).toHaveValue('Duplicate of Sales')
    submit()

    await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith('copy-fp'))
    expect(api.warmExport).toHaveBeenCalledTimes(2)
    expect(api.exportData).toHaveBeenCalledWith(
      'src-id',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(create).toHaveBeenCalledWith('Duplicate of Sales', 'private')
    expect(api.importData).toHaveBeenCalledWith(
      'copy-fp',
      archive,
      expect.any(Function),
      true,
      expect.any(AbortSignal)
    )
    expect(api.importDesign).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('copies the design alone when asked', async () => {
    renderDialog()
    fireEvent.click(screen.getByLabelText('Design only'))
    submit()

    await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith('copy-fp'))
    expect(api.exportDesign).toHaveBeenCalledWith('src-id')
    expect(api.importDesign).toHaveBeenCalledWith('copy-fp', design)
    expect(api.exportData).not.toHaveBeenCalled()
    expect(api.importData).not.toHaveBeenCalled()
  })

  it('creates nothing when the export fails', async () => {
    vi.mocked(api.exportData).mockRejectedValue(new Error('export broke'))
    renderDialog()
    submit()

    await waitFor(() => expect(api.exportData).toHaveBeenCalled())
    expect(create).not.toHaveBeenCalled()
    expect(onDuplicated).not.toHaveBeenCalled()
  })

  it('removes the half-made copy when the import fails, and stays open', async () => {
    vi.mocked(api.importData).mockRejectedValue(new Error('import broke'))
    renderDialog()
    submit()

    await waitFor(() => expect(remove).toHaveBeenCalledWith('copy-fp'))
    expect(onDuplicated).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('keeps to the name rules', async () => {
    renderDialog({ validateName: () => 'Name cannot contain < or >' })
    submit()
    await waitFor(() => expect(create).not.toHaveBeenCalled())
    expect(api.exportData).not.toHaveBeenCalled()
  })

  it('makes the copy searchable only when switched on', async () => {
    renderDialog()
    expect(
      screen.getByRole('switch', { name: 'Allow anyone to search for CRM' })
    ).not.toBeChecked()
    fireEvent.click(
      screen.getByRole('switch', { name: 'Allow anyone to search for CRM' })
    )
    submit()
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('Duplicate of Sales', 'public')
    )
  })

  describe('Cancel', () => {
    it('is never greyed out while a duplicate runs', async () => {
      vi.mocked(api.exportData).mockReturnValue(new Promise(() => {}))
      renderDialog()
      submit()
      await waitFor(() => expect(api.exportData).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    })

    it('stops the export and creates nothing', async () => {
      let signal: AbortSignal | undefined
      vi.mocked(api.exportData).mockImplementation(
        (_id, options) =>
          new Promise((_resolve, reject) => {
            signal = options?.signal
            signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          })
      )
      const error = vi.spyOn(toast, 'error')
      renderDialog()
      submit()
      await waitFor(() => expect(signal).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(signal?.aborted).toBe(true)
      expect(onOpenChange).toHaveBeenCalledWith(false)
      await waitFor(() => expect(create).not.toHaveBeenCalled())
      // A cancel is not reported as a failure.
      expect(error).not.toHaveBeenCalled()
    })

    it('removes the copy when cancelled after it was created', async () => {
      let signal: AbortSignal | undefined
      vi.mocked(api.importData).mockImplementation(
        (_id, _file, _progress, _design, importSignal) =>
          new Promise((_resolve, reject) => {
            signal = importSignal
            signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            )
          })
      )
      renderDialog()
      submit()
      await waitFor(() => expect(signal).toBeDefined())

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(remove).toHaveBeenCalledWith('copy-fp'))
      expect(onDuplicated).not.toHaveBeenCalled()
    })
  })

  it('says so when the unfinished copy cannot be removed', async () => {
    vi.mocked(api.importData).mockRejectedValue(new Error('import broke'))
    remove.mockRejectedValue(new Error('delete broke'))
    const error = vi.spyOn(toast, 'error')
    renderDialog()
    submit()
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'The unfinished copy could not be removed'
      )
    )
  })

  it('names the choice between everything and the design', () => {
    renderDialog()
    expect(
      screen.getByRole('radiogroup', { name: 'Duplicate CRM' })
    ).toBeInTheDocument()
  })

  describe('a cancel after the upload has reached the server', () => {
    // Resolves the import when the test says, after reporting the whole file
    // sent, the way the browser does once the body has left.
    function importInFlight() {
      let finish: (() => void) | undefined
      let fail: ((err: unknown) => void) | undefined
      let signal: AbortSignal | undefined
      vi.mocked(api.importData).mockImplementation(
        (_id, _file, onProgress, _design, importSignal) =>
          new Promise((resolve, reject) => {
            signal = importSignal
            onProgress?.({ loaded: 100, total: 100 } as never)
            finish = () => resolve({})
            fail = reject
          })
      )
      return {
        started: () => signal !== undefined,
        signal: () => signal,
        finish: () => finish?.(),
        fail: (err: unknown) => fail?.(err),
      }
    }

    it('lets the server finish, then removes the copy', async () => {
      const flight = importInFlight()
      const error = vi.spyOn(toast, 'error')
      renderDialog()
      submit()
      await waitFor(() => expect(flight.started()).toBe(true))

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Not aborted, and not deleted underneath the running import.
      expect(flight.signal()?.aborted).toBe(false)
      expect(remove).not.toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)

      flight.finish()
      await waitFor(() => expect(remove).toHaveBeenCalledWith('copy-fp'))
      expect(onDuplicated).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    })

    it('keeps the copy when the proxy gives up while the server writes', async () => {
      const flight = importInFlight()
      renderDialog()
      submit()
      await waitFor(() => expect(flight.started()).toBe(true))

      flight.fail({ response: { status: 504, data: {} } })

      await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith('copy-fp'))
      expect(remove).not.toHaveBeenCalled()
    })

    it('clears the copying message as soon as the user cancels', async () => {
      const flight = importInFlight()
      const dismiss = vi.spyOn(toast, 'dismiss')
      renderDialog()
      submit()
      await waitFor(() => expect(flight.started()).toBe(true))
      dismiss.mockClear()

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(dismiss).toHaveBeenCalled()
    })

    it('keeps the copy when the connection drops while the server writes', async () => {
      const flight = importInFlight()
      const error = vi.spyOn(toast, 'error')
      renderDialog()
      submit()
      await waitFor(() => expect(flight.started()).toBe(true))

      flight.fail(new Error('Network Error'))

      await waitFor(() =>
        expect(error).toHaveBeenCalledWith('The copy may be incomplete')
      )
      expect(remove).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledTimes(1)
      // Opened, so the user can check what it holds.
      expect(onDuplicated).toHaveBeenCalledWith('copy-fp')
    })

    it('removes the copy when the server answers with an error', async () => {
      const flight = importInFlight()
      renderDialog()
      submit()
      await waitFor(() => expect(flight.started()).toBe(true))

      flight.fail({ response: { status: 400, data: {} } })

      await waitFor(() => expect(remove).toHaveBeenCalledWith('copy-fp'))
    })
  })

  it('copies an empty original by its design, which is all it has', async () => {
    renderDialog({ empty: true })
    submit()

    await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith('copy-fp'))
    expect(api.exportDesign).toHaveBeenCalledWith('src-id')
    expect(api.importDesign).toHaveBeenCalledWith('copy-fp', design)
    expect(api.exportData).not.toHaveBeenCalled()
    expect(api.importData).not.toHaveBeenCalled()
  })
})
