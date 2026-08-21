// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The container list page shared by crm and projects. Every string arrives
// resolved from the app. No lingui macro here on purpose: a macro would push
// generic wording into all 22 app catalogs.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, Plus, type LucideIcon } from 'lucide-react'
import { Main } from '../layout/main'
import { PageHeader } from '../layout/page-header'
import { Button } from '../ui/button'
import { CardSkeleton } from '../ui/card-skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { ConfirmDialog } from '../confirm-dialog'
import { EntityOnboardingEmptyState } from '../entity-onboarding-empty-state'
import { ListCard } from '../list-card'
import { GeneralError } from '../../features/errors/general-error'
import { usePageTitle } from '../../hooks/use-page-title'
import { getErrorMessage } from '../../lib/handle-server-error'
import { toastAction } from '../../lib/toast-action'

/** The container fields this page reads. Both `Crm` and `Project` are this. */
export interface EntityListRow {
  id: string
  fingerprint: string
  name: string
  description: string
  owner: number
}

/**
 * Every visible string, resolved by the app so each keeps its own wording and
 * its own catalog entries.
 */
export interface EntityListPageLabels {
  /** Page title, header and empty-state heading. */
  title: string
  emptyDescription: string
  createAction: string
  /** Accessible name for the per-row menu button and its tooltip. */
  rowActions: string
  unsubscribe: string
  unsubscribeConfirmation: string
  unsubscribing: string
  unsubscribed: string
  unsubscribeFailed: string
}

interface EntityListPageProps<Row extends EntityListRow> {
  rows: Row[]
  isLoading: boolean
  error?: string | null
  refresh: () => void | Promise<unknown>
  icon: LucideIcon
  labels: EntityListPageLabels
  onCreate: () => void
  unsubscribe: (id: string) => Promise<unknown>
  /** Query key invalidated once an unsubscribe lands. */
  invalidateKey: string
  /** Route link for a row, so the app keeps its own `to` and params. */
  renderLink: (row: Row, className: string) => ReactNode
  /** Directory search shown on the empty state. */
  renderSearch: (subscribedIds: Set<string>) => ReactNode
  /** Recommendations shown under the empty state's primary action. */
  renderRecommended: (subscribedIds: Set<string>) => ReactNode
}

export function EntityListPage<Row extends EntityListRow>({
  rows,
  isLoading,
  error,
  refresh,
  icon: Icon,
  labels,
  onCreate,
  unsubscribe,
  invalidateKey,
  renderLink,
  renderSearch,
  renderRecommended,
}: EntityListPageProps<Row>) {
  const [unsubscribeId, setUnsubscribeId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const unsubscribeMutation = useMutation({
    mutationFn: (id: string) => unsubscribe(id),
    onSuccess: () => {
      void refresh()
      queryClient.invalidateQueries({ queryKey: [invalidateKey] })
      setUnsubscribeId(null)
    },
  })

  usePageTitle(labels.title)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribedIds = useMemo(
    () =>
      new Set(
        rows.flatMap((row) =>
          [row.id, row.fingerprint].filter((x): x is string => !!x),
        ),
      ),
    [rows],
  )

  return (
    <>
      <PageHeader
        title={labels.title}
        icon={<Icon className="size-4 md:size-5" />}
      />
      <Main>
        {error && (
          <div className="mb-4">
            <GeneralError
              error={new Error(error)}
              minimal
              mode="inline"
              reset={() => {
                void refresh()
              }}
            />
          </div>
        )}
        {isLoading ? (
          <CardSkeleton count={3} />
        ) : rows.length === 0 ? (
          <EntityOnboardingEmptyState
            icon={Icon}
            title={labels.title}
            description={labels.emptyDescription}
            searchSlot={renderSearch(subscribedIds)}
            primaryActionSlot={
              <Button variant="outline" onClick={onCreate}>
                <Plus className="me-2 h-4 w-4" />
                {labels.createAction}
              </Button>
            }
            secondarySlot={renderRecommended(subscribedIds)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const isSubscribed = row.owner !== 1
              return (
                <ListCard
                  key={row.id}
                  icon={<Icon className="size-5" />}
                  title={row.name}
                  highlighted={isSubscribed}
                  renderLink={(className) => renderLink(row, className)}
                  menu={
                    isSubscribed && (
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={labels.rowActions}
                                className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                              >
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>{labels.rowActions}</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setUnsubscribeId(row.id)}
                          >
                            {labels.unsubscribe}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                >
                  {row.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {row.description}
                    </p>
                  )}
                </ListCard>
              )
            })}
          </div>
        )}
      </Main>

      <ConfirmDialog
        open={!!unsubscribeId}
        onOpenChange={(open) => {
          if (!open) setUnsubscribeId(null)
        }}
        title={labels.unsubscribe}
        desc={labels.unsubscribeConfirmation}
        confirmText={labels.unsubscribe}
        destructive
        isLoading={unsubscribeMutation.isPending}
        handleConfirm={async () => {
          if (!unsubscribeId) return
          try {
            await toastAction(unsubscribeMutation.mutateAsync(unsubscribeId), {
              loading: labels.unsubscribing,
              success: labels.unsubscribed,
              error: (e) => getErrorMessage(e, labels.unsubscribeFailed),
            })
          } catch {
            // toast already shown
          }
        }}
      />
    </>
  )
}
