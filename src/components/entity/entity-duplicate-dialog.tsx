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
import { toast } from '../../lib/toast-utils'

export type EntityDuplicateKind = 'everything' | 'design'

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
  const abortRef = useRef<AbortController | null>(null)
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

  const run = async (signal: AbortSignal): Promise<string> => {
    // Exported first, so a failed export leaves nothing behind.
    let archive: Blob | null = null
    let design: Record<string, unknown> | null = null
    if (kind === 'everything') {
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
    try {
      // Creating cannot be stopped midway, so a Cancel during it lands here.
      signal.throwIfAborted()
      if (archive) {
        const file = archive
        await upload((onProgress) =>
          api.importData(copyId, file, onProgress, true, signal)
        )
      } else if (design) {
        await api.importDesign(copyId, design)
      }
      signal.throwIfAborted()
    } catch (err) {
      try {
        await remove(copyId)
      } catch {
        toast.error(labels.leftBehind)
      }
      throw err
    }
    return copyId
  }

  const handleConfirm = async () => {
    const problem = validateName?.(name) ?? null
    if (problem) {
      toast.error(problem)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    const working = toast.loading(labels.duplicating)
    try {
      const copyId = await run(controller.signal)
      toast.dismiss(working)
      toast.success(labels.duplicated)
      onOpenChange(false)
      onDuplicated(copyId)
    } catch (err) {
      toast.dismiss(working)
      // A cancel is the user's own doing, not a failure to report.
      if (!controller.signal.aborted) {
        toast.error(getErrorMessage(err, labels.failed))
      }
    } finally {
      abortRef.current = null
      setPending(false)
    }
  }

  // Closing while a duplicate runs stops it; the cleanup carries on.
  const close = () => {
    abortRef.current?.abort()
    onOpenChange(false)
  }

  // Leaving the page mid-duplicate stops it too.
  useEffect(() => () => abortRef.current?.abort(), [])

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
