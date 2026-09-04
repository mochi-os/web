// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Link list and link picker for one object in the object/class/field apps (crm,
// projects). The three API calls arrive as props rather than an imported module,
// because the module is per-app even though the routes behind it are not.

import { useState, useMemo, useCallback } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Link2, Plus, X } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { getErrorMessage } from '../../lib/handle-server-error'
import { toast } from '../../lib/toast-utils'
import type {
  EntityClass,
  EntityObject,
  EntityObjectLink,
} from '../../types/entity-object'
import {
  entityObjectTitle,
  type EntityTitleObject,
} from '../../lib/entity-title'

export interface EntityObjectLinksProps<TObject extends EntityObject> {
  containerId: string
  objectId: string
  outgoing: EntityObjectLink[]
  incoming: EntityObjectLink[]
  /**
   * Readable-id prefix (e.g. "PROJ"). Undefined in apps that do not number
   * their objects, which falls the display name back to "Untitled".
   */
  prefix?: string
  classes: EntityClass[]
  readOnly: boolean
  listObjects: (
    containerId: string,
  ) => Promise<{ data: { objects: TObject[] } }>
  createLink: (
    containerId: string,
    source: string,
    target: string,
    linktype: string,
  ) => Promise<unknown>
  deleteLink: (
    containerId: string,
    source: string,
    target: string,
    linktype: string,
  ) => Promise<unknown>
}

function useLinkTypeLabels(): Record<string, string> {
  const { t } = useLingui()
  return useMemo(
    () => ({
      relates: t`Relates`,
      blocks: t`Blocks`,
      duplicates: t`Duplicates`,
      'blocked by': t`Blocked by`,
    }),
    [t],
  )
}

export function EntityObjectLinks<TObject extends EntityObject>({
  containerId,
  objectId,
  outgoing,
  incoming,
  prefix,
  classes,
  readOnly,
  listObjects,
  createLink,
  deleteLink,
}: EntityObjectLinksProps<TObject>) {
  const { t } = useLingui()
  const linkTypeLabels = useLinkTypeLabels()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [linkType, setLinkType] = useState('relates')
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const objectTitle = useCallback(
    (obj: EntityTitleObject) => entityObjectTitle(obj, classes, prefix),
    [classes, prefix],
  )

  const { data: objectListData } = useQuery({
    queryKey: ['objects', containerId],
    queryFn: async () => {
      const response = await listObjects(containerId)
      return response.data
    },
  })

  const createLinkMutation = useMutation({
    mutationFn: async ({
      source,
      target,
      linktype,
    }: {
      source: string
      target: string
      linktype: string
    }) => {
      return createLink(containerId, source, target, linktype)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['object', containerId, objectId],
      })
      setPopoverOpen(false)
      setSearch('')
      setLinkType('relates')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to create link`))
    },
  })

  const deleteLinkMutation = useMutation({
    mutationFn: async ({
      source,
      target,
      linktype,
    }: {
      source: string
      target: string
      linktype: string
    }) => {
      return deleteLink(containerId, source, target, linktype)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['object', containerId, objectId],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to delete link`))
    },
  })

  // Build display list combining outgoing and incoming
  const objectsMap = useMemo(() => {
    const map = new Map<string, TObject>()
    for (const obj of objectListData?.objects || []) {
      map.set(obj.id, obj)
    }
    return map
  }, [objectListData])

  // Link rows carry only target/source/linktype/created — the server sends no
  // number and no title — so anything not yet in the objects cache (the list is
  // still loading, or the object is gone) has no readable id available.
  // Formatting one anyway printed "PREFIX-undefined" on screen.
  const linkDisplayName = useCallback(
    (id: string | undefined, link: EntityObjectLink) => {
      const linkedObj = id ? objectsMap.get(id) : undefined
      if (linkedObj) return objectTitle(linkedObj)
      if (link.title) return link.title
      if (prefix !== undefined && typeof link.number === 'number') {
        return `${prefix}-${link.number}`
      }
      return t`Untitled`
    },
    [objectsMap, objectTitle, prefix, t],
  )

  const displayLinks = useMemo(() => {
    const items: {
      id: string
      label: string
      displayName: string
      source: string
      target: string
      linktype: string
    }[] = []

    for (const link of outgoing) {
      items.push({
        id: `out-${link.target}-${link.linktype}`,
        label: linkTypeLabels[link.linktype] || link.linktype,
        displayName: linkDisplayName(link.target, link),
        source: objectId,
        target: link.target!,
        linktype: link.linktype,
      })
    }

    for (const link of incoming) {
      items.push({
        id: `in-${link.source}-${link.linktype}`,
        label:
          link.linktype === 'blocks'
            ? t`Blocked by`
            : linkTypeLabels[link.linktype] || link.linktype,
        displayName: linkDisplayName(link.source, link),
        source: link.source!,
        target: objectId,
        linktype: link.linktype,
      })
    }

    return items
  }, [outgoing, incoming, objectId, linkDisplayName, linkTypeLabels, t])

  // Filter objects for the add-link search
  const linkedObjectIds = useMemo(() => {
    const ids = new Set<string>()
    ids.add(objectId)
    for (const link of outgoing) {
      if (link.target) ids.add(link.target)
    }
    for (const link of incoming) {
      if (link.source) ids.add(link.source)
    }
    return ids
  }, [outgoing, incoming, objectId])

  const searchResults = useMemo(() => {
    if (!objectListData?.objects || !search.trim()) return []
    const q = search.toLowerCase()
    return objectListData.objects
      .filter((obj) => {
        if (linkedObjectIds.has(obj.id)) return false
        const title = objectTitle(obj).toLowerCase()
        if (title.includes(q)) return true
        if (prefix === undefined || typeof obj.number !== 'number') return false
        return `${prefix}-${obj.number}`.toLowerCase().includes(q)
      })
      .slice(0, 10)
  }, [objectListData, search, linkedObjectIds, objectTitle, prefix])

  const handleAddLink = (targetObj: TObject) => {
    if (linkType === 'blocked by') {
      // Swap: create blocks from target → current object
      createLinkMutation.mutate({
        source: targetObj.id,
        target: objectId,
        linktype: 'blocks',
      })
    } else {
      createLinkMutation.mutate({
        source: objectId,
        target: targetObj.id,
        linktype: linkType,
      })
    }
  }

  if (displayLinks.length === 0 && readOnly) {
    return null
  }

  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 items-start">
      <label className="text-sm font-medium text-muted-foreground pt-2 flex items-center gap-1.5">
        <Link2 className="size-3.5" />
        <Trans>Links</Trans>
      </label>
      <div className="space-y-1.5 pt-1">
        {displayLinks.map((link) => (
          <div key={link.id} className="group flex min-w-0 items-center gap-1.5 text-xs">
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-normal"
            >
              {link.label}
            </Badge>
            <span className="truncate">{link.displayName}</span>
            {!readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="hidden group-hover:inline-flex [@media(hover:none)]:inline-flex ms-auto text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() =>
                      deleteLinkMutation.mutate({
                        source: link.source,
                        target: link.target,
                        linktype: link.linktype,
                      })
                    }
                    aria-label={t`Remove link`}
                  >
                    <X className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t`Remove link`}</TooltipContent>
              </Tooltip>
            )}
          </div>
        ))}

        {!readOnly && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Plus className="size-3 me-1.5" />
                <Trans>Add link</Trans>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 space-y-3">
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(linkTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={t`Search objects...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {searchResults.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      className="w-full text-start px-2 py-1.5 text-xs rounded hover:bg-hover flex items-center gap-1.5"
                      onClick={() => handleAddLink(obj)}
                      disabled={createLinkMutation.isPending}
                    >
                      <span className="truncate">{objectTitle(obj)}</span>
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  <Trans>No matching objects</Trans>
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
