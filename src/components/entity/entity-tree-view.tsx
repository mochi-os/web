// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Hierarchical table view for the object/class/field apps (crm, projects).
// The tree, the grouped-section mode and the drag interactions are identical
// between them; the only app-specific pieces are the storage-key namespace and
// the readable-id prefix, both of which arrive as props.

import {
  useState,
  useMemo,
  useLayoutEffect,
  useCallback,
  useRef,
  Fragment,
  type DragEvent,
} from 'react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { Folder, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { ListSectionHeader } from '../list-section-header'
import { TreeRow } from '../tree-row'
import { TreeTableHeader } from '../tree-table-header'
import { treeTableMinWidth } from '../tree-table-width'
import { useShellStorage } from '../../hooks/use-shell-storage'
import { useProgressive } from '../../hooks/use-progressive'
import { sortEntityObjects, compareEntityObjects } from '../../lib/entity-sort'
import type {
  EntityDesign,
  EntityFieldOption,
  EntityObject,
  EntitySortState,
} from '../../types/entity-object'

export interface EntityTreeViewProps<TObject extends EntityObject> {
  design: EntityDesign
  containerId: string
  /**
   * Namespace for the persisted expand/collapse state, so two apps open in the
   * same shell do not share a key ("crms", "projects").
   */
  storagePrefix: string
  /**
   * Readable-id prefix (e.g. "PROJ"). Undefined in apps that do not number
   * their objects, which is also what turns the ID column off.
   */
  prefix?: string
  objects: TObject[]
  peopleMap: Record<string, string>
  viewFields?: string
  viewClasses?: string[]
  /** Enumerated field to group list rows into sections (e.g. status). */
  statusField?: string
  /** Enumerated field for row border colour (e.g. priority). */
  borderField?: string
  sort?: EntitySortState | null
  onCardClick: (object: TObject) => void
  onReparent?: (objectId: string, newParentId: string | null) => void
  onReorder?: (objectId: string, newRank: number) => void
  /** Move object to another status section (same as board column drop). */
  onMoveObject?: (
    objectId: string,
    statusFieldId: string,
    newStatus: string,
    newRank?: number
  ) => void
  selectedObjectId?: string | null
  onCreateClick?: () => void
  preview?: boolean
}

export interface EntityTreeNode<TObject extends EntityObject> {
  object: TObject
  children: EntityTreeNode<TObject>[]
  depth: number
  parent: string
}

// Build tree structure from flat list of objects
function buildTree<TObject extends EntityObject>(
  objects: TObject[],
  sort?: EntitySortState | null
): EntityTreeNode<TObject>[] {
  const objectMap = new Map<string, TObject>()
  const childrenMap = new Map<string, TObject[]>()

  // Index all objects
  for (const obj of objects) {
    objectMap.set(obj.id, obj)
  }

  // Group by parent, promoting to root if parent is not in the set
  for (const obj of objects) {
    const parentId = obj.parent && objectMap.has(obj.parent) ? obj.parent : ''
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(obj)
  }

  // Sort comparator based on sort state
  const compare = (a: TObject, b: TObject): number =>
    compareEntityObjects(a, b, sort)

  // Recursively build tree nodes
  function buildNodes(
    parentId: string,
    depth: number
  ): EntityTreeNode<TObject>[] {
    const children = childrenMap.get(parentId) || []
    children.sort(compare)

    return children.map((obj) => ({
      object: obj,
      children: buildNodes(obj.id, depth + 1),
      depth,
      parent: parentId,
    }))
  }

  return buildNodes('', 0)
}

interface FlatNode<TObject extends EntityObject> {
  node: EntityTreeNode<TObject>
  hasChildren: boolean
  isExpanded: boolean
  anySiblingHasChildren: boolean
}

// Flatten tree for rendering, respecting expanded state
function flattenTree<TObject extends EntityObject>(
  nodes: EntityTreeNode<TObject>[],
  expanded: Set<string>
): FlatNode<TObject>[] {
  const result: FlatNode<TObject>[] = []

  function traverse(nodeList: EntityTreeNode<TObject>[]) {
    const anySiblingHasChildren = nodeList.some((n) => n.children.length > 0)
    for (const node of nodeList) {
      const hasChildren = node.children.length > 0
      const isExpanded = expanded.has(node.object.id)
      result.push({ node, hasChildren, isExpanded, anySiblingHasChildren })

      if (hasChildren && isExpanded) {
        traverse(node.children)
      }
    }
  }

  traverse(nodes)
  return result
}

/** Flat rows for grouped sections — no tree nesting while grouping is active. */
function buildGroupedFlatNodes<TObject extends EntityObject>(
  objects: TObject[],
  sort?: EntitySortState | null
): FlatNode<TObject>[] {
  const sorted = sortEntityObjects(objects, sort)
  return sorted.map((obj) => ({
    node: { object: obj, children: [], depth: 0, parent: obj.parent },
    hasChildren: false,
    isExpanded: false,
    anySiblingHasChildren: false,
  }))
}

interface StatusGroup<TObject extends EntityObject> {
  id: string
  name: string
  colour?: string
  objects: TObject[]
}

const UNGROUPED_STATUS = '__none__'

function resolveGroupField(
  statusField: string | undefined,
  visibleFields: { id: string; fieldtype: string }[]
): string {
  // Explicit None in design — do not group
  if (statusField === '') return ''

  if (statusField) return statusField

  // Legacy views without columns config — auto-detect status/stage in visible fields
  const match = visibleFields.find(
    (f) =>
      f.fieldtype === 'enumerated' && (f.id === 'status' || f.id === 'stage')
  )
  return match?.id || ''
}

function mergeGroupOptions(
  design: EntityDesign,
  groupField: string,
  viewClasses?: string[]
): EntityFieldOption[] {
  const classIds = viewClasses?.length
    ? viewClasses
    : design.classes.map((c) => c.id)
  const seen = new Map<string, EntityFieldOption>()
  for (const classId of classIds) {
    for (const opt of design.options[classId]?.[groupField] || []) {
      if (!seen.has(opt.id)) seen.set(opt.id, opt)
    }
  }
  return [...seen.values()].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
}

function optionLabelForObject(
  obj: EntityObject,
  groupField: string,
  design: EntityDesign
): { name: string; colour?: string } {
  const value = obj.values[groupField]
  if (!value) return { name: '' }
  const opt = design.options[obj.class]?.[groupField]?.find(
    (o) => o.id === value
  )
  return opt ? { name: opt.name, colour: opt.colour } : { name: value }
}

function buildStatusGroups<TObject extends EntityObject>(
  objects: TObject[],
  groupField: string,
  groupOptions: EntityFieldOption[],
  design: EntityDesign,
  noStatusLabel: string
): StatusGroup<TObject>[] {
  const buckets = new Map<string, TObject[]>()
  for (const opt of groupOptions) {
    buckets.set(opt.id, [])
  }
  buckets.set(UNGROUPED_STATUS, [])

  for (const obj of objects) {
    const value = obj.values[groupField] || UNGROUPED_STATUS
    if (!buckets.has(value)) buckets.set(value, [])
    buckets.get(value)!.push(obj)
  }

  const groups: StatusGroup<TObject>[] = []
  for (const opt of groupOptions) {
    groups.push({
      id: opt.id,
      name: opt.name,
      colour: opt.colour,
      objects: buckets.get(opt.id) || [],
    })
  }

  const unassigned = buckets.get(UNGROUPED_STATUS) || []
  if (unassigned.length > 0) {
    const sample = optionLabelForObject(unassigned[0], groupField, design)
    groups.push({
      id: UNGROUPED_STATUS,
      name: sample.name || noStatusLabel,
      colour: sample.colour,
      objects: unassigned,
    })
  }

  // Values outside the known option set
  for (const [id, objs] of buckets) {
    if (id === UNGROUPED_STATUS || groupOptions.some((o) => o.id === id))
      continue
    if (objs.length === 0) continue
    const sample = optionLabelForObject(objs[0], groupField, design)
    groups.push({
      id,
      name: sample.name || id,
      colour: sample.colour,
      objects: objs,
    })
  }

  return groups
}

// What a row does in a preview: nothing.
const ignore = () => {}
// What a class without fields or options has.
const noFields: EntityDesign['fields'][string] = []
const noOptions: EntityDesign['options'][string] = {}

export function EntityTreeView<TObject extends EntityObject>({
  design,
  containerId,
  storagePrefix,
  prefix,
  objects,
  peopleMap,
  viewFields,
  viewClasses,
  statusField,
  borderField,
  sort,
  onCardClick,
  onReparent,
  onReorder,
  onMoveObject,
  selectedObjectId,
  onCreateClick,
  preview,
}: EntityTreeViewProps<TObject>) {
  // Storage key for expanded state
  const storageKey = `${storagePrefix}:${containerId}:tree:expanded`

  // Persist expanded state via shell storage
  const [expandedList, setExpandedList] = useShellStorage<string[]>(
    storageKey,
    []
  )
  const expanded = useMemo(() => new Set(expandedList), [expandedList])

  // Build tree structure
  const tree = useMemo(() => buildTree(objects, sort), [objects, sort])

  // Flatten tree for rendering
  const flatNodes = useMemo(() => flattenTree(tree, expanded), [tree, expanded])

  // Toggle expand/collapse
  const toggleExpand = useCallback(
    (objectId: string) => {
      const set = new Set(expandedList)
      if (set.has(objectId)) {
        set.delete(objectId)
      } else {
        set.add(objectId)
      }
      setExpandedList([...set])
    },
    [expandedList, setExpandedList]
  )

  // Use the view's class filter to pick the right fields/options
  const effectiveClass =
    viewClasses && viewClasses.length > 0
      ? viewClasses[0]
      : design.classes[0]?.id || ''
  // The same value on every render, as everything a row is given is: rows
  // are memoised, and a new array or object each render would draw every row
  // again.
  const fields = design.fields[effectiveClass] || noFields
  const options = design.options[effectiveClass] || noOptions

  // Get visible fields from view's fields setting, or fall back to field's card property
  const viewFieldsList = useMemo(
    () => viewFields?.split(',').filter(Boolean) || [],
    [viewFields]
  )
  const showClass = viewFieldsList.includes('class')
  // No prefix means the app does not issue readable ids, so there is nothing
  // to put in the column even when a view lists it.
  const showId = prefix !== undefined && viewFieldsList.includes('id')
  const visibleFields = useMemo(() => {
    const fieldMap = new Map(fields.map((f) => [f.id, f]))
    return viewFieldsList
      .map((id) => fieldMap.get(id))
      .filter(Boolean) as typeof fields
  }, [fields, viewFieldsList])

  const groupField = resolveGroupField(statusField, visibleFields)
  const rowFields = useMemo(
    () =>
      groupField
        ? visibleFields.filter((f) => f.id !== groupField)
        : visibleFields,
    [groupField, visibleFields]
  )

  const groupOptions = useMemo(
    () =>
      groupField ? mergeGroupOptions(design, groupField, viewClasses) : [],
    [design, groupField, viewClasses]
  )

  const sectionStorageKey = `${storageKey}:sections:${groupField || 'none'}`
  const [collapsedSections, setCollapsedSections] = useShellStorage<string[]>(
    sectionStorageKey,
    []
  )
  const collapsedSectionSet = useMemo(
    () => new Set(collapsedSections),
    [collapsedSections]
  )

  const toggleSection = useCallback(
    (sectionId: string) => {
      const set = new Set(collapsedSections)
      if (set.has(sectionId)) {
        set.delete(sectionId)
      } else {
        set.add(sectionId)
      }
      setCollapsedSections([...set])
    },
    [collapsedSections, setCollapsedSections]
  )

  const statusGroups = useMemo(
    () =>
      groupField && groupOptions.length > 0
        ? buildStatusGroups(
            objects,
            groupField,
            groupOptions,
            design,
            t`[not set]`
          )
        : [],
    [objects, groupField, groupOptions, design]
  )

  const tableColSpan =
    1 + (showClass ? 1 : 0) + (showId ? 1 : 0) + rowFields.length

  // Build class map for looking up class names
  const classMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of design.classes) {
      map[c.id] = c.name
    }
    return map
  }, [design.classes])

  // Build object map for looking up objects by ID
  const objectMap = useMemo(() => {
    const map: Record<string, TObject> = {}
    for (const obj of objects) {
      map[obj.id] = obj
    }
    return map
  }, [objects])

  // Check if reparenting is allowed by hierarchy rules
  const isReparentAllowed = useCallback(
    (childId: string, parentId: string | null) => {
      const child = objectMap[childId]
      if (!child) return false

      const allowedParents = design.hierarchy[child.class] || []
      if (parentId === null) {
        // Check if root is allowed (empty string in hierarchy)
        return allowedParents.includes('')
      }

      const parent = objectMap[parentId]
      if (!parent) return false

      // Check if parent's class is allowed
      return allowedParents.includes(parent.class)
    },
    [objectMap, design.hierarchy]
  )

  // FLIP animation: capture row positions before drop, animate after re-render
  const containerRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const prev = flipRef.current
    if (!prev.size || !containerRef.current) return

    const animations: HTMLElement[] = []
    containerRef.current.querySelectorAll('[data-card-id]').forEach((row) => {
      const id = row.getAttribute('data-card-id')
      if (!id) return
      const oldRect = prev.get(id)
      if (!oldRect) return
      const newRect = row.getBoundingClientRect()
      const dy = oldRect.top - newRect.top
      if (Math.abs(dy) < 1) return
      const el = row as HTMLElement
      el.style.transition = 'none'
      el.style.transform = `translateY(${dy}px)`
      animations.push(el)
    })

    // Only consume positions once rows have actually moved
    if (animations.length === 0) return
    flipRef.current = new Map()

    document.body.getBoundingClientRect() // force reflow
    for (const el of animations) {
      // eslint-disable-next-line lingui/no-unlocalized-strings
      el.style.transition = 'transform 200ms ease-out'
      el.style.transform = ''
      el.addEventListener(
        'transitionend',
        () => {
          el.style.transition = ''
        },
        { once: true }
      )
    }
  })

  // Only allow reordering when sorting by rank, and only when the page handed
  // us a reorder handler. Without the second half the row drew a drop line for
  // a move the drop handler below then refused, so a reader without write
  // access saw the indicator and nothing happened.
  const canReorder = !!onReorder && (sort?.field === 'rank' || !sort)

  // A drag is worth starting only if something can receive it.
  const canDragRows = !!onReorder || !!onReparent || !!onMoveObject

  // The state below drives the drop indicators only; the drop decision is read
  // from dragTargetRef. `dragover` is a continuous-priority React event, so its
  // setState is not flushed before the discrete `drop`/`dragend` fires.
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<
    'before' | 'after' | 'on' | null
  >(null)
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(
    null
  )
  const dragTargetRef = useRef<{
    draggedId: string | null
    overId: string | null
    position: 'before' | 'after' | 'on' | null
    sectionId: string | null
  }>({ draggedId: null, overId: null, position: null, sectionId: null })
  const sectionDropHandledRef = useRef(false)

  const clearDragState = useCallback(() => {
    dragTargetRef.current = {
      draggedId: null,
      overId: null,
      position: null,
      sectionId: null,
    }
    setDraggedId(null)
    setDragOverId(null)
    setDropPosition(null)
    setDragOverSectionId(null)
  }, [])

  const moveToSection = useCallback(
    (dragged: string, sectionId: string) => {
      if (!onMoveObject || !groupField) return
      const draggedObj = objectMap[dragged]
      if (!draggedObj) return
      const statusValue = sectionId === UNGROUPED_STATUS ? '' : sectionId
      const currentStatus = draggedObj.values[groupField] || ''
      if (currentStatus === statusValue) return
      const siblings = objects.filter(
        (o) =>
          o.id !== dragged &&
          (o.values[groupField] || '') === statusValue &&
          o.parent === draggedObj.parent
      )
      onMoveObject(dragged, groupField, statusValue, siblings.length + 1)
    },
    [onMoveObject, groupField, objectMap, objects]
  )

  const handleDragStart = useCallback((objectId: string) => {
    sectionDropHandledRef.current = false
    dragTargetRef.current = {
      draggedId: objectId,
      overId: null,
      position: null,
      sectionId: null,
    }
    setDraggedId(objectId)
    setDragOverSectionId(null)
  }, [])

  const handleDragOver = useCallback(
    (objectId: string, position: 'before' | 'after' | 'on') => {
      if (!draggedId || draggedId === objectId) return

      // For "on" position (reparent), check if allowed
      if (position === 'on') {
        if (!isReparentAllowed(draggedId, objectId)) return
      }

      // For reorder positions, check if items share same parent and reordering is allowed
      if (position === 'before' || position === 'after') {
        if (!canReorder) return
        const draggedObj = objectMap[draggedId]
        const targetObj = objectMap[objectId]
        if (!draggedObj || !targetObj) return
        // Only allow reordering within same parent level
        if (draggedObj.parent !== targetObj.parent) return
      }

      dragTargetRef.current.overId = objectId
      dragTargetRef.current.position = position
      dragTargetRef.current.sectionId = null
      setDragOverSectionId(null)
      setDragOverId(objectId)
      setDropPosition(position)
    },
    [draggedId, isReparentAllowed, canReorder, objectMap]
  )

  const handleSectionDragOver = useCallback(
    (sectionId: string, e: DragEvent) => {
      e.preventDefault()
      if (!draggedId || preview || !onMoveObject || !groupField) return
      e.dataTransfer.dropEffect = 'move'
      dragTargetRef.current.sectionId = sectionId
      dragTargetRef.current.overId = null
      dragTargetRef.current.position = null
      setDragOverSectionId(sectionId)
      setDragOverId(null)
      setDropPosition(null)
    },
    [draggedId, preview, onMoveObject, groupField]
  )

  const handleSectionDrop = useCallback(
    (sectionId: string, e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const dragged = dragTargetRef.current.draggedId
      if (!dragged || preview || !onMoveObject) return

      if (containerRef.current) {
        const positions = new Map<string, DOMRect>()
        containerRef.current
          .querySelectorAll('[data-card-id]')
          .forEach((el) => {
            positions.set(
              el.getAttribute('data-card-id')!,
              el.getBoundingClientRect()
            )
          })
        flipRef.current = positions
      }

      sectionDropHandledRef.current = true
      moveToSection(dragged, sectionId)

      if (collapsedSectionSet.has(sectionId)) {
        setCollapsedSections(collapsedSections.filter((id) => id !== sectionId))
      }

      clearDragState()
    },
    [
      preview,
      onMoveObject,
      moveToSection,
      collapsedSectionSet,
      collapsedSections,
      setCollapsedSections,
      clearDragState,
    ]
  )

  const handleSectionDragLeave = useCallback(() => {
    dragTargetRef.current.sectionId = null
    setDragOverSectionId(null)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (sectionDropHandledRef.current) {
      sectionDropHandledRef.current = false
      return
    }

    const {
      draggedId: dragged,
      overId: over,
      position,
      sectionId,
    } = dragTargetRef.current
    if (sectionId && dragged && onMoveObject) {
      if (containerRef.current) {
        const positions = new Map<string, DOMRect>()
        containerRef.current
          .querySelectorAll('[data-card-id]')
          .forEach((el) => {
            positions.set(
              el.getAttribute('data-card-id')!,
              el.getBoundingClientRect()
            )
          })
        flipRef.current = positions
      }
      moveToSection(dragged, sectionId)
      if (collapsedSectionSet.has(sectionId)) {
        setCollapsedSections(collapsedSections.filter((id) => id !== sectionId))
      }
      clearDragState()
      return
    }

    // Read the live target from the ref, not from state — see the dragTargetRef
    // note above for why the state can be stale at drop time.
    if (dragged && over && dragged !== over) {
      // Capture row positions for FLIP animation before mutation
      if (containerRef.current) {
        const positions = new Map<string, DOMRect>()
        containerRef.current
          .querySelectorAll('[data-card-id]')
          .forEach((el) => {
            positions.set(
              el.getAttribute('data-card-id')!,
              el.getBoundingClientRect()
            )
          })
        flipRef.current = positions
      }

      if (position === 'on' && onReparent && isReparentAllowed(dragged, over)) {
        // Reparent: make dragged item a child of target
        onReparent(dragged, over)
        // Reveal the moved item under its new parent, so dropping onto a
        // collapsed parent is visibly applied instead of appearing to do
        // nothing.
        if (!expanded.has(over)) {
          setExpandedList([...expandedList, over])
        }
      } else if (
        (position === 'before' || position === 'after') &&
        onReorder &&
        canReorder
      ) {
        // Reorder within same parent
        const targetObj = objectMap[over]
        const draggedObj = objectMap[dragged]
        if (targetObj && draggedObj && targetObj.parent === draggedObj.parent) {
          // The siblings come from the object list, not the rendered rows: a
          // grouped list flattens every section into one row list, so a row's
          // rendered neighbours are not its parent's children.
          const siblings = sortEntityObjects(
            objects.filter(
              (o) => o.parent === targetObj.parent && o.id !== dragged
            ),
            sort
          )
          const targetIndex = siblings.findIndex((s) => s.id === over)
          // 1-based position within the parent's children. onReorder renumbers
          // the siblings around this position (not a midpoint rank value).
          const insertIndex =
            position === 'before' ? targetIndex : targetIndex + 1
          onReorder(dragged, insertIndex + 1)
        }
      }
    }
    clearDragState()
  }, [
    onReparent,
    onReorder,
    onMoveObject,
    moveToSection,
    isReparentAllowed,
    canReorder,
    objectMap,
    objects,
    sort,
    expanded,
    expandedList,
    setExpandedList,
    collapsedSectionSet,
    collapsedSections,
    setCollapsedSections,
    clearDragState,
  ])

  // What a row calls back, through a ref holding the latest handlers: the
  // functions rows are given never change, so a memoised row draws again only
  // when what it shows changes, not on every drag step or selection, which
  // drew every row of a long list each time.
  const latest = useRef({
    toggleExpand,
    onCardClick,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    objectMap,
  })
  useLayoutEffect(() => {
    latest.current = {
      toggleExpand,
      onCardClick,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      objectMap,
    }
  })
  const rowToggle = useCallback(
    (objectId: string) => latest.current.toggleExpand(objectId),
    []
  )
  const rowClick = useCallback((objectId: string) => {
    const object = latest.current.objectMap[objectId]
    if (object) latest.current.onCardClick(object)
  }, [])
  const rowDragStart = useCallback(
    (objectId: string) => latest.current.handleDragStart(objectId),
    []
  )
  const rowDragOver = useCallback(
    (objectId: string, position: 'before' | 'after' | 'on') =>
      latest.current.handleDragOver(objectId, position),
    []
  )
  const rowDragEnd = useCallback(() => latest.current.handleDragEnd(), [])

  // The rows in drawing order: each open section's in turn, or the tree's.
  // They are drawn a hundred at first and the rest as the browser is idle
  // (useProgressive), so a long list paints without waiting for all of it.
  const sectionRows = useMemo(
    () =>
      statusGroups.map((group) =>
        collapsedSectionSet.has(group.id)
          ? []
          : buildGroupedFlatNodes(group.objects, sort)
      ),
    [statusGroups, collapsedSectionSet, sort]
  )
  const total =
    statusGroups.length > 0
      ? sectionRows.reduce((sum, rows) => sum + rows.length, 0)
      : flatNodes.length
  const drawn = useProgressive(total)

  const renderFlatNodes = (nodes: FlatNode<TObject>[]) =>
    nodes.map(({ node, hasChildren, isExpanded, anySiblingHasChildren }) => {
      const draggedObj = draggedId ? objectMap[draggedId] : null
      const canReorderHere =
        canReorder &&
        draggedObj &&
        draggedObj.parent === node.object.parent &&
        draggedId !== node.object.id

      return (
        <TreeRow
          key={node.object.id}
          object={node.object}
          depth={node.depth}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          anySiblingHasChildren={anySiblingHasChildren}
          fields={rowFields}
          options={design.options[node.object.class] || options}
          peopleMap={peopleMap}
          classMap={classMap}
          titleFieldId={
            design.classes.find((c) => c.id === node.object.class)?.title
          }
          prefix={prefix}
          showClass={showClass}
          showId={showId}
          borderField={borderField}
          resourceId={containerId}
          isSelected={selectedObjectId === node.object.id}
          isDragOver={
            !preview && dragOverId === node.object.id && dropPosition === 'on'
          }
          isDragBefore={
            !preview &&
            dragOverId === node.object.id &&
            dropPosition === 'before'
          }
          isDragAfter={
            !preview &&
            dragOverId === node.object.id &&
            dropPosition === 'after'
          }
          canReorder={!preview && !!canReorderHere}
          canReparent={
            !preview &&
            !!onReparent &&
            !!draggedId &&
            draggedId !== node.object.id &&
            isReparentAllowed(draggedId, node.object.id)
          }
          canDrag={!preview && canDragRows}
          onToggleExpand={rowToggle}
          onClick={preview ? ignore : rowClick}
          onDragStart={preview ? ignore : rowDragStart}
          onDragOver={preview ? ignore : rowDragOver}
          onDragEnd={preview ? ignore : rowDragEnd}
        />
      )
    })

  if (objects.length === 0) {
    return (
      <EmptyState icon={Folder} title={t`Nothing found`} className='py-12'>
        {(onCreateClick || preview) && (
          <Button
            variant='outline'
            size='sm'
            onClick={preview ? undefined : onCreateClick}
          >
            <Plus className='size-4 me-1' />
            <Trans>Create</Trans>
          </Button>
        )}
      </EmptyState>
    )
  }

  const headerTitleFieldId = design.classes.find(
    (c) => c.id === effectiveClass
  )?.title

  // The rows drawn so far, taken in drawing order.
  let budget = drawn
  const take = (nodes: FlatNode<TObject>[]) => {
    const part = nodes.length <= budget ? nodes : nodes.slice(0, budget)
    budget -= part.length
    return part
  }

  return (
    // The minimum width keeps every column readable on a narrow screen. The
    // table then scrolls sideways inside the list content scroller, which is
    // the one the sticky header already follows, so the pinned first column
    // and the pinned header work against the same scroll.
    <div
      ref={containerRef}
      className='border rounded-lg bg-background relative'
      style={{
        minWidth: treeTableMinWidth({
          fields: rowFields,
          showClass,
          showId,
          titleFieldId: headerTitleFieldId,
        }),
      }}
    >
      <table className='w-full border-collapse table-fixed'>
        <TreeTableHeader
          fields={rowFields}
          showClass={showClass}
          showId={showId}
          titleFieldId={headerTitleFieldId}
        />
        <tbody>
          {statusGroups.length > 0
            ? statusGroups.map((group, index) => {
                // A section is drawn once the rows before it are.
                if (budget <= 0 && drawn < total) return null
                const sectionExpanded = !collapsedSectionSet.has(group.id)
                const groupFlat = take(sectionRows[index])
                return (
                  <Fragment key={group.id}>
                    <ListSectionHeader
                      name={group.name}
                      colour={group.colour}
                      count={group.objects.length}
                      isExpanded={sectionExpanded}
                      onToggle={() => toggleSection(group.id)}
                      colSpan={tableColSpan}
                      canAcceptDrop={
                        !preview &&
                        !!draggedId &&
                        !!onMoveObject &&
                        !!groupField
                      }
                      isDragOver={dragOverSectionId === group.id}
                      onSectionDragOver={(e) =>
                        handleSectionDragOver(group.id, e)
                      }
                      onSectionDrop={(e) => handleSectionDrop(group.id, e)}
                      onSectionDragLeave={handleSectionDragLeave}
                    />
                    {sectionExpanded ? renderFlatNodes(groupFlat) : null}
                  </Fragment>
                )
              })
            : renderFlatNodes(take(flatNodes))}
        </tbody>
      </table>
    </div>
  )
}
