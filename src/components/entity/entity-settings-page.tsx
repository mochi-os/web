// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The settings page shared by crm and projects. The route, wording, name
// validation, access ladder and any app-only identity row stay app-side, the
// last arriving through renderIdentityExtras.

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Settings, Shield, Trash2, type LucideIcon } from 'lucide-react'
import { Main } from '../layout/main'
import { PageHeader } from '../layout/page-header'
import { Button } from '../ui/button'
import { DataChip } from '../ui/data-chip'
import { EditableFieldRow } from '../ui/editable-field-row'
import { EmptyState } from '../ui/empty-state'
import { Skeleton } from '../ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { ConfirmDialog } from '../confirm-dialog'
import { Section, FieldRow } from '../layout/section'
import { AccessDialog } from '../../features/access/access-dialog'
import { AccessList } from '../../features/access/access-list'
import type { AccessLevel, AccessRule } from '../../features/access/types'
import { GeneralError } from '../../features/errors/general-error'
import { usePageTitle } from '../../hooks/use-page-title'
import { coerceObjectArray } from '../../lib/coerce'
import { extractStatus } from '../../lib/error-normalizer'
import { getErrorMessage } from '../../lib/handle-server-error'
import { toastAction } from '../../lib/toast-action'

export type EntitySettingsTab = 'general' | 'access'

/** The container fields this page shows. */
export interface EntitySettingsContainer {
  id: string
  fingerprint: string
  name: string
  description: string
  server: string
  owner: number
}

export interface EntitySettingsUpdate {
  name?: string
  description?: string
  prefix?: string
}

/** The api calls this page makes. Every one is a `createEntityApi` method. */
export interface EntitySettingsApi<TContainer> {
  get: (id: string) => Promise<{ data: TContainer }>
  update: (id: string, updates: EntitySettingsUpdate) => Promise<unknown>
  delete: (id: string) => Promise<unknown>
  getAccessRules: (id: string) => Promise<{ data?: { rules?: unknown } }>
  setAccessLevel: (id: string, subject: string, level: string) => Promise<unknown>
  revokeAccess: (id: string, subject: string) => Promise<unknown>
  searchUsers: (query: string) => Promise<{ data?: { results?: unknown } }>
  listGroups: () => Promise<{ data?: { groups?: unknown } }>
}

/**
 * Every visible string, resolved by the app. The two taking the container name
 * are functions: the page loads the container itself.
 */
export interface EntitySettingsPageLabels {
  /** Header while loading, and on the error states. */
  settings: string
  access: string
  back: string
  /** Browser and header title, given the container name once it has loaded. */
  pageTitle: (name?: string) => string
  notFound: string
  notFoundDescription: string
  unavailable: string
  unavailableDescription: string
  identity: string
  name: string
  description: string
  entityId: string
  fingerprint: string
  server: string
  saving: string
  updated: string
  updateFailed: string
  deleteSection: string
  delete: string
  deleteTitle: string
  deleteConfirm: string
  /** Takes the container name, so each app keeps its own placeholder. */
  deleteDescription: (name: string) => string
  deleting: string
  deleted: string
  deleteFailed: string
  accessManagement: string
  addRule: string
  settingAccess: string
  accessSet: (subjectName: string) => string
  setAccessFailed: string
  removingAccess: string
  accessRemoved: string
  removeAccessFailed: string
  updatingAccess: string
  accessUpdated: string
  updateAccessFailed: string
}

export interface EntitySettingsPageProps<
  TContainer extends EntitySettingsContainer,
  TDetails,
> {
  /** Route parameter the container is fetched and cached under. */
  containerId: string
  /** Pulls the container out of the app's details envelope (`crm`, `project`). */
  selectContainer: (details: TDetails) => TContainer
  /** Query key root for the container and its access rules. */
  queryKey: string
  accessRulesKey: string
  api: EntitySettingsApi<TDetails>
  icon: LucideIcon
  labels: EntitySettingsPageLabels
  /** The app's access ladder, worded by the app. */
  accessLevels: AccessLevel[]
  validateName: (value: string) => string | null
  activeTab: EntitySettingsTab
  onTabChange: (tab: EntitySettingsTab) => void
  onBack: () => void
  /** Where a delete leaves the reader. */
  onDeleted: () => void
  refreshSidebar: () => void | Promise<unknown>
  /** Identity rows only one app has, such as projects' prefix. */
  renderIdentityExtras?: (props: {
    container: TContainer
    canEdit: boolean
    onUpdate: (updates: EntitySettingsUpdate) => Promise<void>
  }) => ReactNode
}

export function EntitySettingsPage<
  TContainer extends EntitySettingsContainer,
  TDetails,
>({
  containerId,
  selectContainer,
  queryKey,
  accessRulesKey,
  api,
  icon: Icon,
  labels,
  accessLevels,
  validateName,
  activeTab,
  onTabChange,
  onBack,
  onDeleted,
  refreshSidebar,
  renderIdentityExtras,
}: EntitySettingsPageProps<TContainer, TDetails>) {
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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
    retry: false,
    refetchOnWindowFocus: false,
  })

  const container = details ? selectContainer(details) : undefined
  const isOwner = container?.owner === 1
  const status = extractStatus(error)
  const lookupError = error && status !== 403 && status !== 404 ? error : null
  const notFound =
    !container && (status === 403 || status === 404 || (!isLoading && !error))

  usePageTitle(labels.pageTitle(container?.name))

  const handleDelete = useCallback(async () => {
    if (!container || !isOwner || isDeleting) return

    setIsDeleting(true)
    try {
      await toastAction(api.delete(container.id), {
        loading: labels.deleting,
        success: labels.deleted,
        error: (e) => getErrorMessage(e, labels.deleteFailed),
      })
      void refreshSidebar()
      onDeleted()
    } catch {
      // toast already shown
    } finally {
      setIsDeleting(false)
    }
  }, [api, container, isOwner, isDeleting, labels, refreshSidebar, onDeleted])

  const handleUpdate = useCallback(
    async (updates: EntitySettingsUpdate) => {
      if (!container || !isOwner) return

      await toastAction(api.update(container.id, updates), {
        loading: labels.saving,
        success: labels.updated,
        error: (e) => getErrorMessage(e, labels.updateFailed),
      })
      void refreshSidebar()
      queryClient.invalidateQueries({ queryKey: [queryKey, containerId] })
    },
    [
      api,
      container,
      isOwner,
      labels,
      refreshSidebar,
      queryClient,
      queryKey,
      containerId,
    ],
  )

  if (isLoading) {
    return (
      <>
        <PageHeader
          title={labels.settings}
          icon={<Settings className="size-4 md:size-5" />}
          back={{ label: labels.back, onFallback: onBack }}
        />
        <Main className="space-y-6">
          <div className="flex gap-1 border-b">
            <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="pt-2">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </Main>
      </>
    )
  }

  if (!container) {
    return (
      <>
        <PageHeader
          title={labels.settings}
          icon={<Settings className="size-4 md:size-5" />}
          back={{ label: labels.back, onFallback: onBack }}
        />
        <Main>
          {lookupError ? (
            <GeneralError
              error={lookupError}
              minimal
              mode="inline"
              reset={() => {
                void refetch()
              }}
            />
          ) : (
            <EmptyState
              icon={Icon}
              title={notFound ? labels.notFound : labels.unavailable}
              description={
                notFound
                  ? labels.notFoundDescription
                  : labels.unavailableDescription
              }
            />
          )}
        </Main>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={labels.pageTitle(container.name)}
        icon={<Settings className="size-4 md:size-5" />}
        back={{ label: labels.back, onFallback: onBack }}
      />
      <Main className="space-y-6">
        {/* Tabs - only show for owners */}
        {isOwner && (
          <Tabs
            variant="underline"
            value={activeTab}
            onValueChange={(value) => onTabChange(value as EntitySettingsTab)}
          >
            <TabsList>
              <TabsTrigger value="general" className="gap-2">
                <Settings className="h-4 w-4" />
                {labels.settings}
              </TabsTrigger>
              <TabsTrigger value="access" className="gap-2">
                <Shield className="h-4 w-4" />
                {labels.access}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Tab content */}
        <div className="pt-2">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <Section title={labels.identity}>
                <div className="divide-y-0">
                  <EditableFieldRow
                    label={labels.name}
                    value={container.name}
                    canEdit={!!isOwner}
                    onSave={(value) => handleUpdate({ name: value })}
                    validate={validateName}
                    emphasize
                  />

                  <EditableFieldRow
                    label={labels.description}
                    value={container.description}
                    canEdit={!!isOwner}
                    onSave={(value) => handleUpdate({ description: value })}
                    multiline
                  />

                  {renderIdentityExtras?.({
                    container,
                    canEdit: !!isOwner,
                    onUpdate: handleUpdate,
                  })}

                  <FieldRow label={labels.entityId}>
                    <DataChip value={container.id} truncate="middle" />
                  </FieldRow>

                  {container.fingerprint && (
                    <FieldRow label={labels.fingerprint}>
                      <DataChip value={container.fingerprint} truncate="middle" />
                    </FieldRow>
                  )}

                  {container.server && (
                    <FieldRow label={labels.server}>
                      <DataChip value={container.server} />
                    </FieldRow>
                  )}
                </div>
              </Section>

              {isOwner && (
                <Section
                  title={labels.deleteSection}
                  action={
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                      size="sm"
                    >
                      <Trash2 className="size-4 me-2" />
                      {labels.delete}
                    </Button>
                  }
                />
              )}

              <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title={labels.deleteTitle}
                desc={labels.deleteDescription(container.name)}
                confirmText={labels.deleteConfirm}
                destructive
                handleConfirm={handleDelete}
                isLoading={isDeleting}
              />
            </div>
          )}
          {activeTab === 'access' && isOwner && (
            <EntityAccessTab
              containerId={container.id}
              accessRulesKey={accessRulesKey}
              api={api}
              labels={labels}
              accessLevels={accessLevels}
            />
          )}
        </div>
      </Main>
    </>
  )
}

interface EntityAccessTabProps<TDetails> {
  containerId: string
  accessRulesKey: string
  api: EntitySettingsApi<TDetails>
  labels: EntitySettingsPageLabels
  accessLevels: AccessLevel[]
}

function EntityAccessTab<TDetails>({
  containerId,
  accessRulesKey,
  api,
  labels,
  accessLevels,
}: EntityAccessTabProps<TDetails>) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')

  const {
    data: rulesData,
    isLoading: isLoadingRules,
    error: rulesErrorRaw,
    refetch: refetchRules,
  } = useQuery({
    queryKey: [accessRulesKey, 'access-rules', containerId],
    queryFn: () => api.getAccessRules(containerId),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const {
    data: userSearchData,
    isLoading: userSearchLoading,
    error: userSearchErrorRaw,
    refetch: refetchUserSearch,
  } = useQuery({
    queryKey: ['users', 'search', userSearchQuery],
    queryFn: () => api.searchUsers(userSearchQuery),
    enabled: userSearchQuery.length >= 1,
    retry: false,
  })

  const {
    data: groupsData,
    error: groupsErrorRaw,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => api.listGroups(),
    retry: false,
    refetchOnWindowFocus: false,
  })

  // coerceObjectArray, not `?? []`: a server that answers with an object rather
  // than a list would otherwise reach the list components as a non-array.
  const rules = useMemo<AccessRule[]>(
    () => coerceObjectArray<AccessRule>(rulesData?.data?.rules),
    [rulesData],
  )
  const rulesError = rulesErrorRaw ?? null
  const userSearchError =
    userSearchQuery.length >= 1 && userSearchErrorRaw ? userSearchErrorRaw : null
  const groupsError = groupsErrorRaw ?? null
  const canManageRules = !rulesError && !isLoadingRules && !!rulesData

  const userSearchResults = coerceObjectArray<{ id: string; name: string }>(
    userSearchData?.data?.results,
  )
  const groups = coerceObjectArray<{
    id: string
    name: string
    description?: string
  }>(groupsData?.data?.groups)

  const handleAdd = async (
    subject: string,
    subjectName: string,
    level: string,
  ) => {
    if (!canManageRules) return
    await toastAction(api.setAccessLevel(containerId, subject, level), {
      loading: labels.settingAccess,
      success: labels.accessSet(subjectName),
      error: (e) => getErrorMessage(e, labels.setAccessFailed),
    })
    await refetchRules()
  }

  const handleRevoke = async (subject: string) => {
    if (!canManageRules) return
    try {
      await toastAction(api.revokeAccess(containerId, subject), {
        loading: labels.removingAccess,
        success: labels.accessRemoved,
        error: (e) => getErrorMessage(e, labels.removeAccessFailed),
      })
      await refetchRules()
    } catch {
      // toast already shown
    }
  }

  const handleLevelChange = async (subject: string, newLevel: string) => {
    if (!canManageRules) return
    try {
      await toastAction(api.setAccessLevel(containerId, subject, newLevel), {
        loading: labels.updatingAccess,
        success: labels.accessUpdated,
        error: (e) => getErrorMessage(e, labels.updateAccessFailed),
      })
      await refetchRules()
    } catch {
      // toast already shown
    }
  }

  return (
    <Section title={labels.accessManagement}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() => setDialogOpen(true)}
            size="sm"
            disabled={!canManageRules}
          >
            <Plus className="h-4 w-4 me-2" />
            {labels.addRule}
          </Button>
        </div>

        <AccessDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAdd={handleAdd}
          levels={accessLevels}
          defaultLevel="comment"
          userSearchResults={userSearchResults}
          userSearchLoading={userSearchLoading}
          userSearchError={userSearchError}
          onRetryUserSearch={() => {
            void refetchUserSearch()
          }}
          onUserSearch={setUserSearchQuery}
          groups={groups}
          groupsError={groupsError}
          onRetryGroups={() => {
            void refetchGroups()
          }}
        />

        {rulesError ? (
          <GeneralError
            error={rulesError}
            minimal
            mode="inline"
            reset={() => {
              void refetchRules()
            }}
          />
        ) : (
          <AccessList
            rules={rules}
            levels={accessLevels}
            onLevelChange={handleLevelChange}
            onRevoke={handleRevoke}
            isLoading={isLoadingRules}
            error={null}
          />
        )}
      </div>
    </Section>
  )
}
