// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Duplicate a whole CRM or project: the backup export and the create-from-
// backup import the apps already have, run as one step with no file to save.
// Every word comes from the app, so nothing here lands in other apps' catalogs.

import { useEffect, useRef, useState } from 'react'
import type { AxiosProgressEvent } from 'axios'
import { Copy } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Switch } from '../ui/switch'
import { UploadProgress } from '../ui/upload-progress'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '../ui/responsive-dialog'
import { useUploadProgress, type Upload } from '../../hooks/use-upload-progress'
import {
  exportEntityArchive,
  type EntityArchiveApi,
} from '../../lib/entity-export'
import { ENTITY_LIMIT } from '../../lib/entity-api'
import { getErrorMessage } from '../../lib/handle-server-error'
import { extractStatus } from '../../lib/error-normalizer'
import { toast } from '../../lib/toast-utils'

export type EntityDuplicateKind = 'everything' | 'design'

/** One duplicate in progress, as Cancel needs to see it. */
interface Running {
  controller: AbortController
  /** The whole file has reached the server, which is now importing it. */
  uploaded: boolean
  cancelled: boolean
  /** The "copying" toast, dismissed as soon as the user cancels. */
  toastId?: string | number
}

/**
 * After the upload, whether the import may still be running. No answer means
 * the connection dropped; 502, 503 and 504 are the proxy in front of the
 * server giving up, while the server behind it may still be writing. Any other
 * answer comes from the import itself, which has stopped.
 */
function importMayStillRun(err: unknown): boolean {
  const status = extractStatus(err)
  return (
    status === undefined || status === 502 || status === 503 || status === 504
  )
}

/** Ends a run whose outcome has been reported already. */
class Stopped extends Error {}

export interface EntityDuplicateLabels {
  title: string
  name: string
  everything: string
  designOnly: string
  allowSearch: string
  cancel: string
  confirm: string
  duplicating: string
  duplicated: string
  failed: string
  /** The name the copy starts with, from the original's. */
  defaultName: (sourceName: string) => string
  /** Shown when a copy that did not finish could not be removed either. */
  leftBehind: string
  /** Shown when the connection dropped while the server was still writing
   *  the copy, which is then kept rather than deleted under it. */
  incomplete: string
}

/** The createEntityApi calls a duplicate makes. */
export interface EntityDuplicateApi extends EntityArchiveApi {
  exportDesign: (entityId: string) => Promise<{ data: Record<string, unknown> }>
  importData: (
    entityId: string,
    file: Blob,
    onProgress?: (event: AxiosProgressEvent) => void,
    design?: boolean,
    signal?: AbortSignal
  ) => Promise<unknown>
  importDesign: (
    entityId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>
}

export interface EntityDuplicateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The id the export routes take, as the page's own Export data uses. */
  sourceId: string
  sourceName: string
  api: EntityDuplicateApi
  /** Creates the empty copy and returns the id the import routes take. */
  create: (name: string, privacy: 'public' | 'private') => Promise<string>
  /** Removes a copy whose import failed, so no half-made one is left. */
  remove: (entityId: string) => Promise<unknown>
  /** Called with the new copy's id once it is complete. */
  onDuplicated: (entityId: string) => void
  /** The same name rules as the app's create dialog. */
  validateName?: (name: string) => string | null
  /** The original has no items. Everything is then its design alone: the
   *  import refuses a file with no items, even one carrying a design. */
  empty?: boolean
  labels: EntityDuplicateLabels
}

export function EntityDuplicateDialog({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  api,
  create,
  remove,
  onDuplicated,
  validateName,
  empty,
  labels,
}: EntityDuplicateDialogProps) {
  const [name, setName] = useState(() => labels.defaultName(sourceName))
  const [kind, setKind] = useState<EntityDuplicateKind>('everything')
  // Off: the page does not know whether the original is searchable, and a copy
  // of customer data should never become searchable by surprise.
  const [allowSearch, setAllowSearch] = useState(false)
  const [pending, setPending] = useState(false)
  const { progress: uploadProgress, upload } = useUploadProgress()
  // The download half has no hook of its own; one bar shows whichever half
  // is running.
  const [downloadProgress, setDownloadProgress] = useState<Upload | null>(null)
  // Set while a duplicate runs, so Cancel can stop it.
  const runningRef = useRef<Running | null>(null)
  // A ref, not a dependency: the app's labels are a fresh object on every
  // render, and the name is set once per opening.
  const defaultNameRef = useRef(labels.defaultName)
  defaultNameRef.current = labels.defaultName

  useEffect(() => {
    if (!open) return
    setName(defaultNameRef.current(sourceName))
    setKind('everything')
    setAllowSearch(false)
  }, [open, sourceName])

  const run = async (running: Running): Promise<string> => {
    const { signal } = running.controller
    // Exported first, so a failed export leaves nothing behind.
    let archive: Blob | null = null
    let design: Record<string, unknown> | null = null
    if (kind === 'everything' && !empty) {
      try {
        archive = await exportEntityArchive(api, sourceId, {
          signal,
          onProgress: (event) =>
            setDownloadProgress({
              sent: event.loaded,
              total: event.total ?? null,
              phase: 'uploading',
            }),
        })
      } finally {
        setDownloadProgress(null)
      }
    } else {
      design = (await api.exportDesign(sourceId)).data
    }
    signal.throwIfAborted()

    const copyId = await create(name.trim(), allowSearch ? 'public' : 'private')
    const discard = async () => {
      try {
        await remove(copyId)
      } catch {
        toast.error(labels.leftBehind)
      }
    }
    try {
      // Creating cannot be stopped midway, so a Cancel during it lands here.
      signal.throwIfAborted()
      if (archive) {
        const file = archive
        await upload((onProgress) =>
          api.importData(
            copyId,
            file,
            (event) => {
              onProgress(event)
              // The whole file has reached the server, which now writes the
              // copy whatever the browser does. Stopping the request from
              // here on would not stop that.
              if (event.total != null && event.loaded >= event.total) {
                running.uploaded = true
              }
            },
            true,
            signal
          )
        )
      } else if (design) {
        await api.importDesign(copyId, design)
      }
      signal.throwIfAborted()
    } catch (err) {
      if (running.uploaded && importMayStillRun(err)) {
        // The server may still be writing, and the import is not one
        // transaction, so deleting the copy now would leave what it writes
        // next with no CRM or project. The copy is kept and opened instead,
        // for the user to check.
        if (!running.cancelled) {
          toast.error(labels.incomplete)
          onOpenChange(false)
          onDuplicated(copyId)
        }
        throw new Stopped()
      }
      await discard()
      throw err
    }
    if (running.cancelled) {
      // Cancelled after the upload: the server has now finished, so the copy
      // can go without stranding anything.
      await discard()
      throw new Stopped()
    }
    return copyId
  }

  const handleConfirm = async () => {
    const problem = validateName?.(name) ?? null
    if (problem) {
      toast.error(problem)
      return
    }
    const running: Running = {
      controller: new AbortController(),
      uploaded: false,
      cancelled: false,
    }
    runningRef.current = running
    setPending(true)
    const working = toast.loading(labels.duplicating)
    running.toastId = working
    try {
      const copyId = await run(running)
      toast.dismiss(working)
      toast.success(labels.duplicated)
      onOpenChange(false)
      onDuplicated(copyId)
    } catch (err) {
      toast.dismiss(working)
      // A cancel is the user's own doing, and a Stopped has said what
      // happened already.
      if (!running.cancelled && !(err instanceof Stopped)) {
        toast.error(getErrorMessage(err, labels.failed))
      }
    } finally {
      if (runningRef.current === running) runningRef.current = null
      setPending(false)
    }
  }

  // Stops a running duplicate. Before the upload is complete the request is
  // aborted and the copy removed; after it, the server is left to finish and
  // the copy is removed then.
  const cancel = () => {
    const running = runningRef.current
    if (!running) return
    running.cancelled = true
    if (running.toastId !== undefined) toast.dismiss(running.toastId)
    if (!running.uploaded) running.controller.abort()
  }

  const close = () => {
    cancel()
    onOpenChange(false)
  }

  // Leaving the page mid-duplicate cancels it the same way.
  useEffect(() => () => cancel(), [])

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true)
        else close()
      }}
    >
      <ResponsiveDialogContent className='sm:max-w-md'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{labels.title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='sr-only'>
            {labels.title}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className='space-y-4'
          onSubmit={(e) => {
            e.preventDefault()
            void handleConfirm()
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='duplicate-name'>{labels.name}</Label>
            <Input
              id='duplicate-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={ENTITY_LIMIT.name}
              disabled={pending}
              autoFocus
            />
          </div>
          <RadioGroup
            aria-label={labels.title}
            value={kind}
            onValueChange={(value) => setKind(value as EntityDuplicateKind)}
            disabled={pending}
          >
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='everything' id='duplicate-everything' />
              <Label
                htmlFor='duplicate-everything'
                className='cursor-pointer font-normal'
              >
                {labels.everything}
              </Label>
            </div>
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='design' id='duplicate-design' />
              <Label
                htmlFor='duplicate-design'
                className='cursor-pointer font-normal'
              >
                {labels.designOnly}
              </Label>
            </div>
          </RadioGroup>
          <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
            <Label
              htmlFor='duplicate-allow-search'
              className='cursor-pointer text-sm font-medium'
            >
              {labels.allowSearch}
            </Label>
            <Switch
              id='duplicate-allow-search'
              checked={allowSearch}
              onCheckedChange={setAllowSearch}
              disabled={pending}
            />
          </div>
          <UploadProgress
            progress={downloadProgress ?? uploadProgress}
            label={labels.duplicating}
          />
          <ResponsiveDialogFooter>
            <Button type='button' variant='outline' onClick={close}>
              {labels.cancel}
            </Button>
            <Button
              type='submit'
              loading={pending}
              disabled={!name.trim()}
              icon={<Copy className='size-4' />}
            >
              {labels.confirm}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
