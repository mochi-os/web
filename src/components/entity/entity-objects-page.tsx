// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The container page shared by crm and projects; the route, loader, detail
// panel and the five slot-rendered components stay app-side. Every visible
// string arrives resolved from the app, for the reason given in
// entity-list-page.tsx.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  Check,
  Columns3,
  Copy,
  Download,
  Ellipsis,
  FileDown,
  GripVertical,
  Link as LinkIcon,
  LogOut,
  Plus,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Main } from '../layout/main'
import { PageHeader } from '../layout/page-header'
import { Button } from '../ui/button'
import { IconButton } from '../icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { LoadingContent } from '../ui/loading-content'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '../ui/responsive-dialog'
import { Switch } from '../ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ConfirmDialog } from '../confirm-dialog'
import type { FilterState } from '../filter-bar'
import { EntityOptionDialog } from './entity-option-dialog'
import { KeyboardShortcutsHelp } from './keyboard-shortcuts-help'
import type { EntityBoardContainerProps } from './entity-board-container'
import type { EntityCreateObjectDialogProps } from './entity-create-object-dialog'
import type { EntityTreeViewProps } from './entity-tree-view'
import type { EntityViewOptionsBarProps } from './entity-view-options-bar'
import { useEntityWebsocket } from '../../hooks/use-entity-websocket'
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts'
import { usePageTitle } from '../../hooks/use-page-title'
import { useShellStorage } from '../../hooks/use-shell-storage'
import { useSearch } from '../../context/search-provider'
import { getAppPath } from '../../lib/app-path'
import { arraysEqual } from '../../lib/change-detection'
import { canCreate, canDesign, canWrite } from '../../lib/entity-access'
import { getErrorMessage } from '../../lib/handle-server-error'
import { rankBetween, rankCompare } from '../../lib/rank'
import { shellClipboardWrite, shellSaveBlob } from '../../lib/shell-bridge'
import { toastAction } from '../../lib/toast-action'
import { toast } from '../../lib/toast-utils'
import type {
  EntityAccess,
  EntityDesign,
  EntityField,
  EntityObject,
  EntitySortState,
} from '../../types/entity-object'

// Sort keys the board and list understand directly; anything else a view stores
// is a field id, which the sort state namespaces as "field:<id>".
const BUILT_IN_SORT_FIELDS = ['rank', 'created', 'updated', 'number']

// The default sort a view was designed with (design → view → Default sort).
// Empty means the designer left it unset, which is manual rank order.
function viewSortState(
  view?: { sort?: string; direction?: string } | null,
): EntitySortState {
  const sort = view?.sort || ''
  if (!sort) return { field: 'rank', direction: 'asc' }
  return {
    field: BUILT_IN_SORT_FIELDS.includes(sort) ? sort : `field:${sort}`,
    direction: view?.direction === 'desc' ? 'desc' : 'asc',
  }
}

// Escape one CSV cell. Quoting parses correctly but does not stop Excel and
// Sheets EVALUATING a leading =, +, - or @ as a formula, so those cells take a
// leading apostrophe, which forces text and is not displayed.
function csvCell(value: unknown): string {
  const text = String(value ?? '')
  const escaped = text.replace(/"/g, '""')
  return /^[=+\-@\t\r]/.test(text) ? `'${escaped}` : escaped
}

/** The container fields this page reads. Both `Crm` and `Project` are this. */
export interface EntityObjectsPageContainer {
  id: string
  fingerprint: string
  name: string
  owner: number
  access: EntityAccess
  /** 0 while a freshly-subscribed container is still filling over P2P. */
  populated: number
}

/**
 * The api calls this page makes. Every one is a `createEntityApi` method, so an
 * app passes its api module straight in.
 */
export interface EntityObjectsPageApi<TObject extends EntityObject> {
  share: (id: string) => Promise<{ data: { link: string } }>
  warmExport: (id: string) => Promise<{ data?: { remaining: number } | null }>
  exportData: (id: string) => Promise<Blob>
  unsubscribe: (id: string) => Promise<unknown>
  listObjects: (
    containerId: string,
  ) => Promise<{ data: { objects: TObject[]; watched?: string[] } }>
  listPeople: (
    containerId: string,
  ) => Promise<{ data: { people: { id: string; name: string }[] } }>
  moveObject: (
    containerId: string,
    objectId: string,
    data: {
      field: string
      value: string
      rank?: number
      row_field?: string
      row_value?: string
      scope_parent?: string
      promote?: string
    },
  ) => Promise<unknown>
  updateObject: (
    containerId: string,
    objectId: string,
    data: { parent?: string; class?: string },
  ) => Promise<unknown>
  createOption: (
    containerId: string,
    classId: string,
    fieldId: string,
    data: { name: string; colour: string },
  ) => Promise<unknown>
  updateOption: (
    containerId: string,
    classId: string,
    fieldId: string,
    optionId: string,
    data: { name: string },
  ) => Promise<unknown>
  deleteOption: (
    containerId: string,
    classId: string,
    fieldId: string,
    optionId: string,
  ) => Promise<unknown>
  reorderOptions: (
    containerId: string,
    classId: string,
    fieldId: string,
    order: string[],
  ) => Promise<unknown>
}

/** The CSV export crm offers. Left off entirely in apps that do not have it. */
export interface EntityObjectsCsvExport {
  menuAction: string
  noObjects: string
  idColumn: string
  classColumn: string
  parentColumn: string
}

/**
 * Every visible string, resolved by the app so each keeps its own wording and
 * its own catalog entries.
 */
export interface EntityObjectsPageLabels {
  /** Accessible name for the page menu button. */
  pageActions: string
  /** Primary action on a narrow screen, where the class name does not fit. */
  createShort: string
  /**
   * Primary action, given the active view's single class name where it has one.
   * The name arrives as the designer wrote it; each app lowercases it in its
   * own macro to keep its existing msgid.
   */
  createAction: (className?: string) => string
  /** Shown instead of opening the create dialog when nothing can be created. */
  noClasses: string
  viewOptions: string
  /** Menu entry, and the title of the add-column dialog. */
  addColumn: string
  reorderColumns: string
  reorderHint: string
  cancel: string
  save: string
  /** Hint over the board, until the reader dismisses it. */
  boardHint: string
  dismissBoardHint: string
  exportData: string
  loading: string
  downloaded: (filename: string) => string
  exportFailed: string
  /** Share link: the menu entry, then the dialog title. */
  shareAction: string
  shareTitle: string
  shareFailed: string
  unsubscribe: string
  unsubscribeTitle: string
  /** Already carries the container name. */
  unsubscribeDescription: string
  unsubscribing: string
  unsubscribed: string
  unsubscribeFailed: string
}

/** What the app's board binding leaves open. */
export type EntityObjectsBoardSlotProps<TObject extends EntityObject> = Omit<
  EntityBoardContainerProps<TObject>,
  'design' | 'containerId' | 'fallbackTitle'
>

/** What the app's tree binding leaves open. */
export type EntityObjectsTreeSlotProps<TObject extends EntityObject> = Omit<
  EntityTreeViewProps<TObject>,
  'design' | 'containerId' | 'storagePrefix' | 'prefix'
>

/** What the app's view-bar binding leaves open. */
export type EntityObjectsViewOptionsSlotProps = Omit<
  EntityViewOptionsBarProps,
  'views' | 'numbered'
>

/** What the app's create-dialog binding leaves open. */
export type EntityObjectsCreateSlotProps<TObject extends EntityObject> = Omit<
  EntityCreateObjectDialogProps<TObject>,
  | 'containerId'
  | 'recordId'
  | 'design'
  | 'prefix'
  | 'srTitle'
  | 'srDescription'
  | 'buildObject'
  | 'listObjects'
  | 'listPeople'
  | 'createObject'
  | 'setValue'
  | 'uploadAttachments'
  | 'searchUsers'
>

export interface EntityObjectsPageProps<TObject extends EntityObject> {
  /** The app's details object: classes, fields, options, views, hierarchy. */
  design: EntityDesign
  container: EntityObjectsPageContainer
  /** Route parameter, which the object and option endpoints take. */
  containerId: string
  search: { view?: string }
  /** Set by the `$objectId` route, which opens the detail panel on mount. */
  initialObjectId?: string
  icon: LucideIcon
  labels: EntityObjectsPageLabels
  api: EntityObjectsPageApi<TObject>
  /** Websocket entity name ("crm", "project"). */
  entity: string
  /** Namespace for the persisted view-bar and hint state ("crms", "projects"). */
  storagePrefix: string
  /** Query key the sidebar list is cached under ("crms", "projects"). */
  listKey: string
  /** Middle part of the backup filename: `<name>-<backupSlug>-<date>.zip`. */
  backupSlug: string
  refreshSidebar: () => void | Promise<unknown>
  /** Where an unsubscribe leaves the reader. */
  onLeave: () => void
  /** Passed to PageHeader, where it is deprecated and does nothing; carried
   *  because projects sets it. */
  showSidebarTrigger?: boolean
  /** The view to fall back to while the container holds no objects, named by the
   *  class it shows. */
  emptyViewClass?: string
  csvExport?: EntityObjectsCsvExport
  /** Design entry in the page menu, when the reader may design. */
  designMenuItem?: ReactNode
  settingsMenuItem: ReactNode
  renderViewOptionsBar: (props: EntityObjectsViewOptionsSlotProps) => ReactNode
  renderBoard: (props: EntityObjectsBoardSlotProps<TObject>) => ReactNode
  renderTree: (props: EntityObjectsTreeSlotProps<TObject>) => ReactNode
  renderCreateDialog: (props: EntityObjectsCreateSlotProps<TObject>) => ReactNode
  renderDetailPanel: (props: {
    objectId: string | null
    onClose: () => void
  }) => ReactNode
}

export function EntityObjectsPage<TObject extends EntityObject>({
  design,
  container,
  containerId,
  search,
  initialObjectId,
  icon: Icon,
  labels,
  api,
  entity,
  storagePrefix,
  listKey,
  backupSlug,
  refreshSidebar,
  onLeave,
  showSidebarTrigger,
  emptyViewClass,
  csvExport,
  designMenuItem,
  settingsMenuItem,
  renderViewOptionsBar,
  renderBoard,
  renderTree,
  renderCreateDialog,
  renderDetailPanel,
}: EntityObjectsPageProps<TObject>) {
  const router = useRouter()
  const access = container.access
  const isOwner = container.owner === 1
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  // Destructured so a callback's dependency list compares strings by value
  // rather than the labels object, which an app builds inline every render.
  const { noClasses, shareFailed } = labels

  const openLinkDialog = useCallback(async () => {
    setShareLink('')
    setLinkCopied(false)
    setLinkOpen(true)
    try {
      const response = await api.share(container.id)
      setShareLink(response.data.link)
    } catch (error) {
      setLinkOpen(false)
      toast.error(getErrorMessage(error, shareFailed))
    }
  }, [api, container.id, shareFailed])

  const copyShareLink = useCallback(async () => {
    if (!shareLink) return
    const ok = await shellClipboardWrite(shareLink)
    if (ok) {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }, [shareLink])

  const handleDataExport = useCallback(async () => {
    // Remote containers fetch attachment bytes over P2P in bounded server-side
    // rounds; warm until nothing remains so a large one's export doesn't time
    // out. Each round covers up to a minute of fetching.
    const warming = toast.loading(labels.loading)
    try {
      for (let round = 0; round < 120; round++) {
        const warm = await api.warmExport(container.id)
        if (!warm.data || warm.data.remaining === 0) break
      }
      const blob = await api.exportData(container.id)
      const today = new Date().toISOString().split('T')[0]
      const slug = container.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const filename = `${slug}-${backupSlug}-${today}.zip`
      // A bare anchor-click save silently no-ops in the shell's sandboxed
      // iframe; shellSaveBlob hands the blob to the parent shell to save.
      if (await shellSaveBlob(blob, filename)) {
        toast.success(labels.downloaded(filename))
      } else {
        toast.error(labels.exportFailed)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, labels.exportFailed))
    } finally {
      toast.dismiss(warming)
    }
  }, [api, backupSlug, container.id, container.name, labels])

  usePageTitle(container.name)
  // onSync re-runs the route loader (where the container, schema, and
  // `populated` flag live) when a sync batch lands, flipping the board out of
  // its loading state once the freshly-subscribed data has arrived.
  useEntityWebsocket({
    entity,
    fingerprint: container.fingerprint,
    onSync: () => void router.invalidate(),
  })

  // Fallback for the websocket race: if the update event is missed (fired
  // before the socket connected), poll the loader while the container is still
  // filling so the board never stays stuck on the loading spinner.
  const populated = container.populated
  useEffect(() => {
    if (populated) return
    const timer = setInterval(() => void router.invalidate(), 3000)
    return () => clearInterval(timer)
  }, [populated, router])

  // Disable global Ctrl+K search shortcut so we can use it for view options
  const { setShortcutEnabled } = useSearch()
  useEffect(() => {
    setShortcutEnabled(false)
    return () => setShortcutEnabled(true)
  }, [setShortcutEnabled])

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    initialObjectId ?? null,
  )
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDefaultFields, setCreateDefaultFields] = useState<
    { field: string; value: string }[] | undefined
  >()
  const [createDefaultParent, setCreateDefaultParent] = useState<
    string | undefined
  >()
  const [createChildClasses, setCreateChildClasses] = useState<
    string[] | undefined
  >()
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [showViewOptions, setShowViewOptions] = useShellStorage(
    `${storagePrefix}-view-options-expanded`,
    true,
  )
  const [selectedCardIndex, setSelectedCardIndex] = useState(-1)
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false)
  const [isReorderingColumns, setIsReorderingColumns] = useState(false)
  const [pendingColumnOrder, setPendingColumnOrder] = useState<string[] | null>(
    null,
  )
  const [hintDismissed, setHintDismissed] = useShellStorage(
    `${storagePrefix}-hint-dismissed`,
    false,
  )

  const dismissBoardHint = () => {
    setHintDismissed(true)
  }

  // View state - initialize from URL or first view
  const defaultViewId = design.views[0]?.id || 'board'
  const initialViewId =
    search.view && design.views.some((v) => v.id === search.view)
      ? search.view
      : defaultViewId
  const [activeViewId, setActiveViewId] = useState(initialViewId)
  const activeView =
    design.views.find((v) => v.id === activeViewId) || design.views[0]

  // Deduplicated field list across all classes (for sort dropdown)
  const allFields = useMemo(() => {
    const seen = new Set<string>()
    const result: EntityField[] = []
    for (const fields of Object.values(design.fields)) {
      for (const f of fields) {
        if (!seen.has(f.id)) {
          seen.add(f.id)
          result.push(f)
        }
      }
    }
    return result
  }, [design.fields])

  // Sync view and selected object to the URL. Suppress @tanstack/history's
  // subscriber notification or the router matches /$containerId/$objectId and
  // remounts; replaceState keeps the shell's URL-sync monkey-patch running.
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const appPath = getAppPath() || ''
    const path = selectedObjectId
      ? `${appPath}/${containerId}/${selectedObjectId}`
      : `${appPath}/${containerId}`
    const viewParam = activeViewId !== defaultViewId ? `?view=${activeViewId}` : ''
    const routerHistory = router.history as unknown as {
      _ignoreSubscribers?: boolean
    }
    routerHistory._ignoreSubscribers = true
    try {
      window.history.replaceState(null, '', `${path}${viewParam}`)
    } finally {
      routerHistory._ignoreSubscribers = false
    }
  }, [selectedObjectId, activeViewId, defaultViewId, containerId, router])

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    watched: false,
  })

  // Sort state, seeded from the view's designed default sort
  const [sort, setSort] = useState<EntitySortState | null>(() =>
    viewSortState(activeView),
  )

  const queryClient = useQueryClient()

  // Load objects
  const { data: objectListData, isLoading: objectsLoading } = useQuery({
    queryKey: ['objects', containerId],
    queryFn: async () => {
      const response = await api.listObjects(containerId)
      return response.data
    },
  })
  const objectsData = objectListData?.objects
  const watchedIds = objectListData?.watched

  // While the container is empty and no view was specified in the URL, switch
  // to the view the app nominates (crm's companies view).
  const didAutoSwitch = useRef(false)
  useEffect(() => {
    if (!emptyViewClass || didAutoSwitch.current || search.view) return
    if (objectsData && objectsData.length === 0) {
      const fallbackView = design.views.find((v) =>
        v.classes?.includes(emptyViewClass),
      )
      if (fallbackView && fallbackView.id !== activeViewId) {
        didAutoSwitch.current = true
        setActiveViewId(fallbackView.id)
      }
    }
  }, [objectsData, design.views, search.view, activeViewId, emptyViewClass])

  // Load people for resolving user field values to names
  const { data: peopleData } = useQuery({
    queryKey: ['people', containerId],
    queryFn: async () => {
      const response = await api.listPeople(containerId)
      return response.data.people
    },
  })

  // Create a map of user ID to name for quick lookups
  const peopleMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const person of peopleData || []) {
      map[person.id] = person.name
    }
    return map
  }, [peopleData])

  // Check if an object is a descendant of a given ancestor
  const isDescendant = (
    obj: TObject,
    ancestorId: string,
    allObjects: TObject[],
  ): boolean => {
    let current = obj.parent
    while (current) {
      if (current === ancestorId) return true
      const parent = allObjects.find((o) => o.id === current)
      current = parent?.parent || ''
    }
    return false
  }

  // Move object mutation
  const moveMutation = useMutation({
    mutationFn: async ({
      objectId,
      field,
      value,
      rank,
      rowField: rf,
      rowValue,
      scopeParent,
      promote,
    }: {
      objectId: string
      field: string
      value: string
      rank?: number
      rowField?: string
      rowValue?: string
      scopeParent?: string
      promote?: boolean
    }) => {
      return api.moveObject(containerId, objectId, {
        field,
        value,
        rank,
        row_field: rf,
        row_value: rowValue,
        scope_parent: scopeParent,
        promote: promote ? 'true' : undefined,
      })
    },
    onMutate: async ({
      objectId,
      field,
      value,
      rank,
      rowField: rf,
      rowValue,
      scopeParent,
      promote,
    }) => {
      // Await, as the reparent mutation below does: an in-flight objects fetch
      // that resolves after the optimistic write would overwrite it and snap the
      // dragged card back to where it started.
      await queryClient.cancelQueries({
        queryKey: ['objects', containerId],
      })

      const previousData = queryClient.getQueryData<{
        objects: TObject[]
        watched?: string[]
      }>(['objects', containerId])

      queryClient.setQueryData<{ objects: TObject[]; watched?: string[] }>(
        ['objects', containerId],
        (old) => {
          if (!old) return old

          // Compute the moved object's new fractional key between the neighbours
          // at the 1-based target position (#53): one key change, matching the
          // server — no whole-scope renumber. scopeParent may be "" (top-level),
          // so test for presence, not truthiness.
          let newRank: string | undefined
          if (rank) {
            let others: TObject[]
            if (scopeParent !== undefined) {
              others = old.objects.filter(
                (o) => o.parent === scopeParent && o.id !== objectId,
              )
            } else {
              const oldVal =
                old.objects.find((o) => o.id === objectId)?.values[field] || ''
              const targetValue = value || oldVal
              others = old.objects.filter(
                (o) => o.id !== objectId && (o.values[field] || '') === targetValue,
              )
            }
            others.sort((a, b) => rankCompare(a.rank, b.rank))
            let pos = rank
            if (pos < 1) pos = 1
            if (pos > others.length + 1) pos = others.length + 1
            const before = pos >= 2 ? others[pos - 2].rank : null
            const after = pos - 1 < others.length ? others[pos - 1].rank : null
            newRank = rankBetween(before, after)
          }

          return {
            ...old,
            objects: old.objects.map((obj) => {
              if (obj.id === objectId) {
                const updatedValues = { ...obj.values, [field]: value }
                if (rf && rowValue !== undefined) {
                  updatedValues[rf] = rowValue
                }
                return {
                  ...obj,
                  rank: newRank ?? obj.rank,
                  values: updatedValues,
                  ...(promote ? { parent: '' } : {}),
                }
              }
              // Cascade status/row changes to descendants (rank unchanged).
              if (field && isDescendant(obj, objectId, old.objects)) {
                const updatedValues = { ...obj.values, [field]: value }
                if (rf && rowValue !== undefined) {
                  updatedValues[rf] = rowValue
                }
                return { ...obj, values: updatedValues }
              }
              return obj
            }),
          }
        },
      )

      return { previousData }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['objects', containerId], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['objects', containerId],
      })
    },
  })

  // Reparent object mutation
  const reparentMutation = useMutation({
    mutationFn: async ({
      objectId,
      parentId,
    }: {
      objectId: string
      parentId: string | null
    }) => {
      return api.updateObject(containerId, objectId, {
        parent: parentId || '',
      })
    },
    onMutate: async ({ objectId, parentId }) => {
      await queryClient.cancelQueries({
        queryKey: ['objects', containerId],
      })

      const previousData = queryClient.getQueryData<{
        objects: TObject[]
        watched?: string[]
      }>(['objects', containerId])

      queryClient.setQueryData<{ objects: TObject[]; watched?: string[] }>(
        ['objects', containerId],
        (old) => {
          if (!old) return old
          const newParent = parentId
            ? old.objects.find((o) => o.id === parentId)
            : null
          const sf = activeView?.columns || ''
          const rf = activeView?.rows || ''
          return {
            ...old,
            objects: old.objects.map((obj) => {
              if (obj.id !== objectId) return obj
              const updated = { ...obj, parent: parentId || '' }
              if (newParent && sf) {
                updated.values = {
                  ...updated.values,
                  [sf]: newParent.values[sf] || '',
                }
                if (rf) updated.values[rf] = newParent.values[rf] || ''
              }
              return updated
            }),
          }
        },
      )

      return { previousData }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['objects', containerId], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['objects', containerId],
      })
    },
  })

  // Delete column (option) mutation
  const deleteColumnMutation = useMutation({
    mutationFn: async ({
      classId,
      fieldId,
      optionId,
    }: {
      classId: string
      fieldId: string
      optionId: string
    }) => {
      return api.deleteOption(containerId, classId, fieldId, optionId)
    },
    onSuccess: () => {
      router.invalidate()
    },
  })

  // Rename column (option) mutation
  const renameColumnMutation = useMutation({
    mutationFn: async ({
      classId,
      fieldId,
      optionId,
      name,
    }: {
      classId: string
      fieldId: string
      optionId: string
      name: string
    }) => {
      return api.updateOption(containerId, classId, fieldId, optionId, { name })
    },
    onSuccess: () => {
      router.invalidate()
    },
  })

  // Create column (option) mutation
  const createColumnMutation = useMutation({
    mutationFn: async ({
      classId,
      fieldId,
      name,
      colour,
    }: {
      classId: string
      fieldId: string
      name: string
      colour: string
    }) => {
      return api.createOption(containerId, classId, fieldId, { name, colour })
    },
    onSuccess: () => {
      router.invalidate()
    },
  })

  // Reorder columns (options) mutation
  const reorderColumnsMutation = useMutation({
    mutationFn: async ({
      classId,
      fieldId,
      order,
    }: {
      classId: string
      fieldId: string
      order: string[]
    }) => {
      return api.reorderOptions(containerId, classId, fieldId, order)
    },
    onSuccess: () => {
      router.invalidate()
      setIsReorderingColumns(false)
      setPendingColumnOrder(null)
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: () => api.unsubscribe(container.id),
    onSuccess: () => {
      void refreshSidebar()
      queryClient.invalidateQueries({ queryKey: [listKey] })
    },
  })

  const handleUnsubscribe = async () => {
    try {
      await toastAction(unsubscribeMutation.mutateAsync(), {
        loading: labels.unsubscribing,
        success: labels.unsubscribed,
        error: (e) => getErrorMessage(e, labels.unsubscribeFailed),
      })
      setUnsubscribeOpen(false)
      onLeave()
    } catch {
      // toast already shown
    }
  }

  // Filter objects
  const filteredObjects = useMemo(() => {
    let result = objectsData || []

    // Apply view's class filter (if view has specific classes selected)
    const viewClasses = activeView?.classes || []
    if (viewClasses.length > 0) {
      result = result.filter((obj) => viewClasses.includes(obj.class))
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter((obj) =>
        Object.values(obj.values).some(
          (v) => typeof v === 'string' && v.toLowerCase().includes(searchLower),
        ),
      )
    }

    // Apply watched filter
    if (filters.watched && watchedIds) {
      const watchedSet = new Set(watchedIds)
      result = result.filter((obj) => watchedSet.has(obj.id))
    }

    return result
  }, [objectsData, watchedIds, filters, activeView?.classes])

  // Keyboard navigation helpers
  const handleSelectNext = useCallback(() => {
    if (filteredObjects.length === 0) return
    const currentIndex = selectedObjectId
      ? filteredObjects.findIndex((obj) => obj.id === selectedObjectId)
      : selectedCardIndex
    const nextIndex =
      currentIndex + 1 >= filteredObjects.length ? 0 : currentIndex + 1
    setSelectedCardIndex(nextIndex)
    if (selectedObjectId) {
      setSelectedObjectId(filteredObjects[nextIndex].id)
    }
  }, [filteredObjects, selectedCardIndex, selectedObjectId])

  const handleSelectPrevious = useCallback(() => {
    if (filteredObjects.length === 0) return
    const currentIndex = selectedObjectId
      ? filteredObjects.findIndex((obj) => obj.id === selectedObjectId)
      : selectedCardIndex
    const prevIndex =
      currentIndex <= 0 ? filteredObjects.length - 1 : currentIndex - 1
    setSelectedCardIndex(prevIndex)
    if (selectedObjectId) {
      setSelectedObjectId(filteredObjects[prevIndex].id)
    }
  }, [filteredObjects, selectedCardIndex, selectedObjectId])

  const handleOpenSelected = useCallback(() => {
    if (selectedCardIndex >= 0 && selectedCardIndex < filteredObjects.length) {
      setSelectedObjectId(filteredObjects[selectedCardIndex].id)
    }
  }, [selectedCardIndex, filteredObjects])

  const handleSwitchView = useCallback(
    (index: number) => {
      if (index < design.views.length) {
        setActiveViewId(design.views[index].id)
        setSort(viewSortState(design.views[index]))
      }
    },
    [design.views],
  )

  // Get the column and row fields for the current view
  const columnField = activeView?.columns || ''
  const rowField = activeView?.rows || ''

  // Get default column value (first option of column field for the view's class)
  const viewClasses = activeView?.classes
  const boardClass = useMemo(() => {
    if (viewClasses?.length) {
      return design.classes.find((c) => c.id === viewClasses[0]) ?? design.classes[0]
    }
    return design.classes[0]
  }, [design.classes, viewClasses])

  const getDefaultColumnValue = useCallback(() => {
    const effectiveType = boardClass?.id
    if (effectiveType && design.options[effectiveType]?.[columnField]?.length > 0) {
      return [
        {
          field: columnField,
          value: design.options[effectiveType][columnField][0].id,
        },
      ]
    }
    return undefined
  }, [boardClass, design.options, columnField])

  const baselineColumnOrder = useMemo(() => {
    const effectiveType = boardClass?.id
    if (!effectiveType || !columnField) return []
    return design.options[effectiveType]?.[columnField]?.map((o) => o.id) ?? []
  }, [boardClass, design.options, columnField])

  const handleOpenCreateDialog = useCallback(() => {
    if (design.classes.length === 0) {
      toast.error(noClasses)
      return
    }
    setSelectedObjectId(null)
    setCreateDefaultFields(getDefaultColumnValue())
    setCreateDialogOpen(true)
  }, [design.classes.length, getDefaultColumnValue, noClasses])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCreateNew: canCreate(access) ? handleOpenCreateDialog : undefined,
    onFocusSearch: () => setShowViewOptions(!showViewOptions),
    onSwitchView: handleSwitchView,
    onSelectNext: handleSelectNext,
    onSelectPrevious: handleSelectPrevious,
    onOpenSelected: handleOpenSelected,
    onEditSelected: handleOpenSelected,
    onClose: () => {
      // The detail panel owns its own Escape (the sheet's dismiss handling →
      // onOpenChange → onClose). Also clearing the selection from here made two
      // handlers race on one keypress and unmounted the panel mid-dismiss.
      if (selectedObjectId) return
      setSelectedCardIndex(-1)
    },
    onShowHelp: () => setShowShortcutsHelp(true),
    enabled: !createDialogOpen,
  })

  const handleCardClick = (object: TObject) => {
    setSelectedObjectId(object.id)
  }

  const handleCreateClick = (columnValue: string, rowValue?: string) => {
    if (design.classes.length === 0) {
      toast.error(noClasses)
      return
    }
    const fields = [{ field: columnField, value: columnValue }]
    if (rowValue !== undefined && rowField) {
      fields.push({ field: rowField, value: rowValue })
    }
    setSelectedObjectId(null)
    setCreateDefaultFields(fields)
    setCreateDefaultParent(undefined)
    setCreateChildClasses(undefined)
    setCreateDialogOpen(true)
  }

  // Double-click on an object: create a child of that object
  const handleCreateChild = (parent: TObject) => {
    setSelectedObjectId(null)
    // Find all classes that can be children of this object's class
    const childClasses = design.classes
      .filter((c) => (design.hierarchy[c.id] || []).includes(parent.class))
      .map((c) => c.id)
    if (childClasses.length === 0) return
    // Pre-fill column fields from the parent's values
    const fields: { field: string; value: string }[] = []
    if (columnField && parent.values[columnField]) {
      fields.push({ field: columnField, value: parent.values[columnField] })
    }
    setCreateDefaultFields(fields.length > 0 ? fields : undefined)
    setCreateDefaultParent(parent.id)
    setCreateChildClasses(childClasses)
    setCreateDialogOpen(true)
  }

  const handleMoveObject = (
    objectId: string,
    newValue: string,
    newRank?: number,
    newRow?: string,
    scopeParent?: string,
    promote?: boolean,
  ) => {
    moveMutation.mutate({
      objectId,
      field: newValue ? columnField : '',
      value: newValue,
      rank: newRank,
      rowField: newRow !== undefined ? rowField : undefined,
      rowValue: newRow,
      scopeParent,
      promote,
    })
  }

  // Destructured rather than closing over the mutation object, which react-query
  // rebuilds every render while `mutate` itself stays stable.
  const { mutate: mutateMove } = moveMutation

  const handleListMoveObject = useCallback(
    (
      objectId: string,
      statusFieldId: string,
      newStatus: string,
      newRank?: number,
    ) => {
      mutateMove({
        objectId,
        field: statusFieldId,
        value: newStatus,
        rank: newRank,
      })
    },
    [mutateMove],
  )

  const handleReparent = (objectId: string, newParentId: string | null) => {
    reparentMutation.mutate({ objectId, parentId: newParentId })
  }

  const handleReorder = (objectId: string, position: number) => {
    // Reorder within the object's own parent: the move handler treats `rank` as
    // a 1-based position and renumbers the siblings of `scopeParent` around it.
    // Scope to the parent (which may be "" for top-level) so only its children
    // are renumbered, not every object in the container.
    const parent = objectsData?.find((o) => o.id === objectId)?.parent ?? ''
    moveMutation.mutate({
      objectId,
      field: '',
      value: '',
      rank: position,
      scopeParent: parent,
    })
  }

  const handleDeleteColumn = async (
    classId: string,
    fieldId: string,
    optionId: string,
  ) => {
    await deleteColumnMutation.mutateAsync({ classId, fieldId, optionId })
  }

  const handleRenameColumn = async (
    classId: string,
    fieldId: string,
    optionId: string,
    newName: string,
  ) => {
    await renameColumnMutation.mutateAsync({
      classId,
      fieldId,
      optionId,
      name: newName,
    })
  }

  const handleObjectCreated = () => {
    // Object created successfully, queries will be invalidated by the mutation
  }

  const handleExportCSV = useCallback(() => {
    if (!csvExport) return
    if (filteredObjects.length === 0) {
      toast.error(csvExport.noObjects)
      return
    }

    // Collect option name lookups: fieldId -> optionId -> displayName
    const optionNames: Record<string, Record<string, string>> = {}
    for (const classOptions of Object.values(design.options)) {
      for (const [fieldId, opts] of Object.entries(classOptions)) {
        if (!optionNames[fieldId]) optionNames[fieldId] = {}
        for (const opt of opts) {
          optionNames[fieldId][opt.id] = opt.name
        }
      }
    }

    const headers = [
      csvExport.idColumn,
      csvExport.classColumn,
      csvExport.parentColumn,
      ...allFields.map((f) => f.name),
    ]
    const rows = filteredObjects.map((obj) => {
      const cls = design.classes.find((c) => c.id === obj.class)
      const cells = [
        obj.id,
        cls?.name ?? obj.class,
        obj.parent,
        ...allFields.map((f) => {
          const raw = obj.values[f.id] ?? ''
          if (f.fieldtype === 'enumerated') return optionNames[f.id]?.[raw] ?? raw
          if (f.fieldtype === 'user') return peopleMap[raw] ?? raw
          return raw
        }),
      ]
      return cells.map((cell) => `"${csvCell(cell)}"`).join(',')
    })

    const csv = [
      headers.map((h) => `"${csvCell(h)}"`).join(','),
      ...rows,
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const filename = `${container.name}.csv`
    // A bare anchor-click save silently no-ops in the shell's sandboxed
    // iframe; shellSaveBlob hands the blob to the parent shell to save.
    void shellSaveBlob(blob, filename).then((ok) => {
      if (ok) {
        toast.success(labels.downloaded(filename))
      } else {
        toast.error(labels.exportFailed)
      }
    })
  }, [
    csvExport,
    filteredObjects,
    allFields,
    design.options,
    design.classes,
    container.name,
    peopleMap,
    labels,
  ])

  const handleViewChange = (viewId: string) => {
    setActiveViewId(viewId)
    // Each view carries its own default sort
    setSort(viewSortState(design.views.find((v) => v.id === viewId)))
  }

  const handleAddColumn = (name: string, colour: string) => {
    if (!boardClass) return
    createColumnMutation.mutate({
      classId: boardClass.id,
      fieldId: columnField,
      name,
      colour,
    })
  }

  const handleReorderColumns = (order: string[]) => {
    setPendingColumnOrder(order)
  }

  const handleSaveColumnOrder = () => {
    if (!boardClass || !pendingColumnOrder) return
    if (arraysEqual(pendingColumnOrder, baselineColumnOrder)) {
      handleCancelReorder()
      return
    }
    reorderColumnsMutation.mutate({
      classId: boardClass.id,
      fieldId: columnField,
      order: pendingColumnOrder,
    })
  }

  const handleCancelReorder = () => {
    setIsReorderingColumns(false)
    setPendingColumnOrder(null)
  }

  const primaryActionLabel = (() => {
    const activeViewClasses = activeView?.classes || []
    if (activeViewClasses.length === 1) {
      const cls = design.classes.find((c) => c.id === activeViewClasses[0])
      if (cls) return labels.createAction(cls.name)
    }
    return labels.createAction()
  })()

  return (
    <>
      <PageHeader
        title={container.name}
        icon={<Icon className="size-4 md:size-5" />}
        showSidebarTrigger={showSidebarTrigger}
        primaryAction={
          canCreate(access) ? (
            <Button
              variant="outline"
              size="sm"
              className="px-2.5"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="size-4" />
              <span className="md:hidden">{labels.createShort}</span>
              <span className="hidden md:inline">{primaryActionLabel}</span>
            </Button>
          ) : undefined
        }
        menuAction={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" label={labels.pageActions}>
                <Ellipsis className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <SlidersHorizontal className="size-4 me-2" />
                {labels.viewOptions}
                <Switch
                  className="ms-auto"
                  checked={showViewOptions}
                  onCheckedChange={setShowViewOptions}
                />
              </DropdownMenuItem>
              {canDesign(access) && activeView?.viewtype !== 'list' && (
                <>
                  <DropdownMenuItem onClick={() => setAddColumnDialogOpen(true)}>
                    <Columns3 className="size-4 me-2" />
                    {labels.addColumn}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsReorderingColumns(true)}>
                    <GripVertical className="size-4 me-2" />
                    {labels.reorderColumns}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {csvExport && (
                <DropdownMenuItem onClick={handleExportCSV}>
                  <Download className="size-4 me-2" />
                  {csvExport.menuAction}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDataExport}>
                <FileDown className="size-4 me-2" />
                {labels.exportData}
              </DropdownMenuItem>
              {/* Canonical menu tail: Link, Design, Settings, Unsubscribe. */}
              {isOwner && (
                <DropdownMenuItem onClick={() => void openLinkDialog()}>
                  <LinkIcon className="size-4 me-2" />
                  {labels.shareAction}
                </DropdownMenuItem>
              )}
              {canDesign(access) && designMenuItem}
              {settingsMenuItem}
              {!isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setUnsubscribeOpen(true)}>
                    <LogOut className="size-4 me-2" />
                    {labels.unsubscribe}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {showViewOptions &&
        renderViewOptionsBar({
          fields: allFields,
          filters,
          onFilterChange: setFilters,
          activeViewId,
          onViewChange: handleViewChange,
          sort,
          onSortChange: setSort,
          showSort: true,
        })}
      {isReorderingColumns && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="text-sm text-muted-foreground">
            {labels.reorderHint}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelReorder}>
              {labels.cancel}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveColumnOrder}
              disabled={
                !pendingColumnOrder ||
                reorderColumnsMutation.isPending ||
                arraysEqual(pendingColumnOrder, baselineColumnOrder)
              }
            >
              <Check className="size-4" />
              {labels.save}
            </Button>
          </div>
        </div>
      )}
      {!hintDismissed &&
        !isReorderingColumns &&
        activeView?.viewtype !== 'list' &&
        canCreate(access) && (
          <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
            <span className="text-sm text-muted-foreground">
              {labels.boardHint}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={dismissBoardHint}
                  aria-label={labels.dismissBoardHint}
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{labels.dismissBoardHint}</TooltipContent>
            </Tooltip>
          </div>
        )}
      <Main fluid className="flex flex-col min-h-0 min-w-0 flex-1 !p-0">
        {/* Content area */}
        <div
          className={
            activeView?.viewtype === 'list'
              ? 'flex-1 min-h-0 overflow-auto'
              : 'flex-1 min-h-0 overflow-x-auto'
          }
        >
          {!populated || objectsLoading ? (
            <LoadingContent />
          ) : activeView?.viewtype === 'list' ? (
            <div className="p-4">
              {renderTree({
                objects: filteredObjects,
                peopleMap,
                viewFields: activeView?.fields,
                viewClasses: activeView?.classes,
                statusField: activeView?.columns,
                borderField: activeView?.border,
                sort,
                onCardClick: handleCardClick,
                onReparent: canWrite(access) ? handleReparent : undefined,
                onReorder: canWrite(access) ? handleReorder : undefined,
                onMoveObject: canWrite(access) ? handleListMoveObject : undefined,
                selectedObjectId,
                onCreateClick: canCreate(access)
                  ? handleOpenCreateDialog
                  : undefined,
              })}
            </div>
          ) : (
            <div className="px-4 w-fit min-w-full">
              {renderBoard({
                objects: filteredObjects,
                statusField: columnField,
                rowField,
                borderField: activeView?.border,
                viewFields: activeView?.fields,
                viewClasses: activeView?.classes,
                sort,
                peopleMap,
                onCardClick: handleCardClick,
                onCardDoubleClick: canCreate(access)
                  ? handleCreateChild
                  : undefined,
                onCreateClick: canCreate(access) ? handleCreateClick : undefined,
                onMoveObject: canWrite(access) ? handleMoveObject : undefined,
                onReparentObject: canWrite(access) ? handleReparent : undefined,
                onRenameColumn: canDesign(access) ? handleRenameColumn : undefined,
                onDeleteColumn: canDesign(access) ? handleDeleteColumn : undefined,
                isReordering: isReorderingColumns,
                onReorderColumns: handleReorderColumns,
              })}
            </div>
          )}
        </div>
      </Main>

      {/* Object detail dialog */}
      {renderDetailPanel({
        objectId: selectedObjectId,
        onClose: () => setSelectedObjectId(null),
      })}

      {canCreate(access) &&
        renderCreateDialog({
          open: createDialogOpen,
          onOpenChange: setCreateDialogOpen,
          defaultFields: createDefaultFields,
          defaultParent: createDefaultParent,
          allowedClasses:
            createChildClasses ||
            (activeView?.classes?.length ? activeView.classes : undefined),
          onCreated: handleObjectCreated,
        })}

      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
      />

      <EntityOptionDialog
        open={addColumnDialogOpen}
        onOpenChange={setAddColumnDialogOpen}
        onAdd={handleAddColumn}
        title={labels.addColumn}
      />
      <ResponsiveDialog open={linkOpen} onOpenChange={setLinkOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{labels.shareTitle}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
            <code className="flex-1 break-all">{shareLink || '…'}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copyShareLink()}
              disabled={!shareLink}
              className="shrink-0"
            >
              {linkCopied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        open={unsubscribeOpen}
        onOpenChange={setUnsubscribeOpen}
        title={labels.unsubscribeTitle}
        desc={labels.unsubscribeDescription}
        confirmText={labels.unsubscribe}
        handleConfirm={() => void handleUnsubscribe()}
        isLoading={unsubscribeMutation.isPending}
      />
    </>
  )
}
