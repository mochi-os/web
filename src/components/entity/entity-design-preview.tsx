// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Live preview pane of the design editor for the object/class/field apps (crm,
// projects). It renders the real board and tree in `preview` mode, so what the
// editor shows is the same code the app ships rather than a mock of it.

import { useMemo, useState, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { ViewTabs } from '../view-tabs'
import { EntityBoardContainer } from './entity-board-container'
import { EntityTreeView } from './entity-tree-view'
import type { EntityDesign, EntityObject } from '../../types/entity-object'

export interface EntityDesignPreviewProps<TObject extends EntityObject> {
  design: EntityDesign
  objects: TObject[]
  selectedClassId: string | null
  /**
   * The board and the tree take their container id from different places in
   * each app — the board from the entity record, the tree from the route — so
   * they stay two props rather than one guessed-at id.
   */
  boardContainerId: string
  treeContainerId: string
  /** Namespace for the tree's persisted expand state ("crms", "projects"). */
  storagePrefix: string
  /** Readable-id prefix, when the app issues them. */
  prefix?: string
  fallbackTitle: (object: TObject) => string
}

export function EntityDesignPreview<TObject extends EntityObject>({
  design,
  objects,
  selectedClassId,
  boardContainerId,
  treeContainerId,
  storagePrefix,
  prefix,
  fallbackTitle,
}: EntityDesignPreviewProps<TObject>) {
  const [selectedViewId, setSelectedViewId] = useState<string | null>(
    design.views[0]?.id || null,
  )

  // Sync to editor's class selection: pick the first view for that class
  useEffect(() => {
    if (!selectedClassId) return
    const match = design.views.find(
      (v) => v.classes.length === 0 || v.classes.includes(selectedClassId),
    )
    if (match) setSelectedViewId(match.id)
  }, [selectedClassId, design.views])

  const selectedView = design.views.find((v) => v.id === selectedViewId)

  // Filter objects to the view's classes (or show all if view has no class filter)
  const viewClasses = useMemo(() => selectedView?.classes || [], [selectedView])
  const classObjects = useMemo(
    () =>
      viewClasses.length > 0
        ? objects.filter((obj) => viewClasses.includes(obj.class))
        : objects,
    [objects, viewClasses],
  )

  const noop = () => {}

  return (
    <div className="h-full flex flex-col">
      <div className="overflow-x-auto no-scrollbar border-b">
        <div className="flex items-center px-4 py-2 min-w-max">
          <ViewTabs
            variant="pill"
            views={design.views}
            activeViewId={selectedViewId || ''}
            onViewChange={setSelectedViewId}
          />
        </div>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        {selectedView ? (
          selectedView.viewtype === 'board' ? (
            <EntityBoardContainer
              design={design}
              containerId={boardContainerId}
              fallbackTitle={fallbackTitle}
              objects={classObjects}
              statusField={selectedView.columns || ''}
              rowField={selectedView.rows || undefined}
              borderField={selectedView.border || undefined}
              viewFields={selectedView.fields}
              viewClasses={selectedView.classes}
              preview
            />
          ) : (
            <EntityTreeView
              design={design}
              containerId={treeContainerId}
              storagePrefix={storagePrefix}
              prefix={prefix}
              objects={classObjects}
              peopleMap={{}}
              viewFields={selectedView.fields}
              viewClasses={selectedView.classes}
              statusField={selectedView.columns}
              borderField={selectedView.border || undefined}
              onCardClick={noop}
              preview
            />
          )
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Trans>No views</Trans>
          </div>
        )}
      </div>
    </div>
  )
}
