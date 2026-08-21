// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The design page shared by crm and projects: the header menu, the design
// export and the import dialog. The route, the wording, the design editor and
// the built-in template list stay app-side; templates arrive through a slot,
// and every string arrives resolved from the app.

import { useCallback, useRef, useState, type JSX, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, MoreHorizontal, Settings2, Upload } from 'lucide-react'
import { Main } from '../layout/main'
import { PageHeader } from '../layout/page-header'
import { Button } from '../ui/button'
import { IconButton } from '../icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ListSkeleton } from '../ui/list-skeleton'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '../ui/responsive-dialog'
import { ConfirmDialog } from '../confirm-dialog'
import { GeneralError } from '../../features/errors/general-error'
import { usePageTitle } from '../../hooks/use-page-title'
import { getErrorMessage } from '../../lib/handle-server-error'
import { shellSaveBlob } from '../../lib/shell-bridge'
import { toast } from '../../lib/toast-utils'

/** What the import dialog hands back, whichever half of it produced it. */
export interface EntityDesignImport {
  data: Record<string, unknown>
  template?: string
  templateVersion?: number
  /** Shown in the replace confirmation: a file name or a template name. */
  label: string
}

export interface EntityDesignApi<TDetails> {
  get: (id: string) => Promise<{ data: TDetails }>
  exportDesign: (id: string) => Promise<{ data: unknown }>
  importDesign: (
    id: string,
    data: Record<string, unknown>,
    template?: string,
    templateVersion?: number,
  ) => Promise<unknown>
}

/** Every visible string, resolved by the app. */
export interface EntityDesignPageLabels {
  /** Header while loading and on the error state. */
  design: string
  /** Header and browser title once the container has loaded. */
  pageTitle: (name?: string) => string
  back: string
  loadFailed: string
  pageActions: string
  exportAction: string
  importAction: string
  downloaded: (filename: string) => string
  exportFailed: string
  imported: string
  importFailed: string
  importTitle: string
  /** Screen-reader description of the import dialog. Left off where an app has none. */
  importDescription?: string
  /** Heading over the file half of the import dialog. projects only. */
  fileSection?: string
  uploadFile: string
  invalidJson: string
  readFailed: string
  cancel: string
  replaceTitle: string
  /** Takes the file or template name, so the app keeps its own emphasis. */
  replaceDescription: (label: ReactNode) => JSX.Element
  replaceConfirm: string
  replacing: string
  downloadBackup: string
}

export interface EntityDesignPageProps<
  TContainer extends { name: string },
  TDetails,
> {
  containerId: string
  selectContainer: (details: TDetails) => TContainer
  /** Query key root the container is cached under, shared with the settings page. */
  queryKey: string
  api: EntityDesignApi<TDetails>
  labels: EntityDesignPageLabels
  /** False sends the reader back, since design is a permission not everyone has. */
  canDesign: (details: TDetails) => boolean
  /** Where a reader without design access is sent. */
  renderRedirect: () => ReactNode
  onBack: () => void
  /** The app's own design editor. */
  renderEditor: (details: TDetails) => ReactNode
  /** Built-in templates offered inside the import dialog. projects only. */
  renderTemplates?: (select: (choice: EntityDesignImport) => void) => ReactNode
}

export function EntityDesignPage<TContainer extends { name: string }, TDetails>({
  containerId,
  selectContainer,
  queryKey,
  api,
  labels,
  canDesign,
  renderRedirect,
  onBack,
  renderEditor,
  renderTemplates,
}: EntityDesignPageProps<TContainer, TDetails>) {
  const queryClient = useQueryClient()

  const {
    data: details,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [queryKey, containerId],
    queryFn: async () => {
      const response = await api.get(containerId)
      return response.data
    },
  })

  const container = details ? selectContainer(details) : undefined
  usePageTitle(labels.pageTitle(container?.name))

  const [importOpen, setImportOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<EntityDesignImport | null>(
    null,
  )

  const handleExport = useCallback(async () => {
    if (!container) return
    try {
      const response = await api.exportDesign(containerId)
      const json = JSON.stringify(response.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      // A bare anchor-click save silently no-ops in the shell's sandboxed
      // iframe; shellSaveBlob hands the blob to the parent shell to save.
      const filename = `${container.name.toLowerCase().replace(/\s+/g, '-')}-design.json`
      if (await shellSaveBlob(blob, filename)) {
        toast.success(labels.downloaded(filename))
      } else {
        toast.error(labels.exportFailed)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, labels.exportFailed))
    }
  }, [api, containerId, container, labels])

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport) return
    setImporting(true)
    try {
      await api.importDesign(
        containerId,
        pendingImport.data,
        pendingImport.template,
        pendingImport.templateVersion,
      )
      queryClient.invalidateQueries({ queryKey: [queryKey, containerId] })
      toast.success(labels.imported)
      setConfirmOpen(false)
      setImportOpen(false)
      setPendingImport(null)
    } catch (err) {
      toast.error(getErrorMessage(err, labels.importFailed))
    } finally {
      setImporting(false)
    }
  }, [api, containerId, pendingImport, queryClient, queryKey, labels])

  if (isLoading) {
    return (
      <Main>
        <ListSkeleton count={3} />
      </Main>
    )
  }

  if (error || !details || !container) {
    return (
      <>
        <PageHeader
          title={labels.design}
          icon={<Settings2 className="size-4 md:size-5" />}
          back={{ label: labels.back, onFallback: onBack }}
        />
        <Main>
          <GeneralError
            error={error ?? new Error(labels.loadFailed)}
            minimal
            mode="inline"
            reset={() => {
              void refetch()
            }}
          />
        </Main>
      </>
    )
  }

  if (!canDesign(details)) {
    return <>{renderRedirect()}</>
  }

  return (
    <>
      <PageHeader
        title={labels.pageTitle(container.name)}
        icon={<Settings2 className="size-4 md:size-5" />}
        back={{ label: labels.back, onFallback: onBack }}
        menuAction={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                className="size-8"
                label={labels.pageActions}
              >
                <MoreHorizontal className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                <Download className="size-4 me-2" />
                {labels.exportAction}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <Upload className="size-4 me-2" />
                {labels.importAction}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Main fixed fluid className="flex-1 !py-0">
        {renderEditor(details)}
      </Main>

      {/* Import dialog */}
      <EntityDesignImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        labels={labels}
        renderTemplates={renderTemplates}
        onSelect={(choice) => {
          setPendingImport(choice)
          setConfirmOpen(true)
        }}
      />

      {/* Confirm import dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.replaceTitle}
        desc={labels.replaceDescription(pendingImport?.label)}
        confirmText={
          importing ? (
            <>
              <Loader2 className="size-4 me-1.5 animate-spin" />
              {labels.replacing}
            </>
          ) : (
            labels.replaceConfirm
          )
        }
        handleConfirm={handleConfirmImport}
        isLoading={importing}
      >
        <Button
          variant="outline"
          className="w-full"
          onClick={handleExport}
          disabled={importing}
        >
          <Download className="size-4 me-1.5" />
          {labels.downloadBackup}
        </Button>
      </ConfirmDialog>
    </>
  )
}

function EntityDesignImportDialog({
  open,
  onOpenChange,
  labels,
  renderTemplates,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labels: EntityDesignPageLabels
  renderTemplates?: (select: (choice: EntityDesignImport) => void) => ReactNode
  onSelect: (choice: EntityDesignImport) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        onSelect({ data, label: file.name })
      } catch {
        toast.error(labels.invalidJson)
      }
    }
    reader.onerror = () => {
      toast.error(labels.readFailed)
    }
    reader.readAsText(file)

    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{labels.importTitle}</ResponsiveDialogTitle>
          {labels.importDescription && (
            <ResponsiveDialogDescription className="sr-only">
              {labels.importDescription}
            </ResponsiveDialogDescription>
          )}
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {renderTemplates?.(onSelect)}

          <div className="space-y-2">
            {labels.fileSection && (
              <p className="text-sm font-medium">{labels.fileSection}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 me-1.5" />
              {labels.uploadFile}
            </Button>
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
