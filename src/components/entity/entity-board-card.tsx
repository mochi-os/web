// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import { Check, CheckSquare } from 'lucide-react'
import { Card } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { EntityAvatar } from '../entity-avatar'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import { getAppPath } from '../../lib/app-path'
import type {
  EntityChecklistItem,
  EntityClass,
  EntityDragPreview,
  EntityField,
  EntityFieldOption,
  EntityObject,
} from '../../types/entity-object'

// Generic over the object type so each app keeps its own — a callback taking a
// CrmObject cannot be passed where one taking a bare EntityObject is expected,
// and widening the callbacks instead would lose the app's type at every call
// site.
export interface EntityBoardCardProps<TObject extends EntityObject> {
  object: TObject
  /** CRM or project id; drives the avatar asset URLs. */
  containerId?: string
  fields: EntityField[]
  options: Record<string, EntityFieldOption[]>
  /**
   * Title shown when the class has no title field, or the title field is empty.
   * crm shows a literal "Untitled"; projects shows the readable id (PROJ-14),
   * which depends on the object, hence a function rather than a string.
   */
  fallbackTitle: (object: TObject) => string
  objectMap?: Record<string, TObject>
  allFields?: Record<string, EntityField[]>
  allObjects?: TObject[]
  statusField?: string
  rowField?: string
  borderField?: string
  classMap?: Record<string, EntityClass>
  peopleMap?: Record<string, string>
  draggable?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  children?: TObject[]
  childrenByParent?: Record<string, TObject[]>
  depth?: number
  hierarchy?: Record<string, string[]>
  onChildClick?: (object: TObject) => void
  onChildDoubleClick?: (object: TObject) => void
  dragPreview?: EntityDragPreview | null
}

const MAX_NESTING_DEPTH = 3

// The field editor stores a ticked checkbox as "1" (and reads back "1" or
// "true"); the server accepts "0"/"1"/"true"/"false". Testing only for "true"
// here meant a box ticked in the detail panel never appeared on the card.
function isChecked(value: string): boolean {
  return value === '1' || value === 'true'
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

export function EntityBoardCard<TObject extends EntityObject>({
  containerId,
  object,
  fields,
  options,
  fallbackTitle,
  objectMap,
  allFields,
  allObjects,
  statusField,
  rowField,
  borderField,
  classMap,
  peopleMap,
  draggable: canDrag = true,
  onClick,
  onDoubleClick,
  children: childObjects,
  childrenByParent,
  depth = 0,
  hierarchy,
  onChildClick,
  onChildDoubleClick,
  dragPreview,
}: EntityBoardCardProps<TObject>) {
  const { formatDate } = useFormat()
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isNested = depth > 0

  // Use the class's title field as the card header
  const cls = classMap?.[object.class]
  const titleFieldId = cls?.title
  const headerField = titleFieldId
    ? fields.find((f) => f.id === titleFieldId)
    : undefined
  const rawTitle = headerField
    ? object.values[headerField.id] || fallbackTitle(object)
    : fallbackTitle(object)
  const title = truncate(rawTitle, 160)

  // Body fields: exclude the header field, statusField, and rowField
  const cardFields = fields.filter(
    (f) => f !== headerField && f.id !== statusField && f.id !== rowField
  )

  // Get border color from the view's border field
  let borderColor: string | undefined
  if (borderField) {
    const value = object.values[borderField]
    if (value) {
      const match = options[borderField]?.find((o) => o.id === value && o.colour)
      if (match) {
        borderColor = match.colour
      }
    }
  }

  // Count total nested children beyond depth cap
  const countDeepChildren = (objId: string): number => {
    const kids = childrenByParent?.[objId] || []
    let count = kids.length
    for (const kid of kids) {
      count += countDeepChildren(kid.id)
    }
    return count
  }

  // Render a field value inline on the card
  const renderField = (field: EntityField) => {
    const value = object.values[field.id]
    if (!value) return null

    const fieldOptions = options[field.id] || []
    const option = fieldOptions.find((o) => o.id === value)

    switch (field.fieldtype) {
      case 'enumerated':
        if (!option) return null
        return (
          <span
            key={field.id}
            className='inline-flex items-center gap-1 text-[10px] text-muted-foreground'
          >
            {option.colour && (
              <span
                className='w-2 h-2 rounded-full shrink-0'
                style={{ backgroundColor: option.colour }}
              />
            )}
            {option.name}
          </span>
        )

      case 'checklist':
        try {
          const items: EntityChecklistItem[] = JSON.parse(value)
          if (items.length === 0) return null
          const doneCount = items.filter((item) => item.done).length
          const allDone = doneCount === items.length
          return (
            <span
              key={field.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                allDone
                  ? 'bg-success/10 text-success ring-success/30'
                  : 'bg-surface-2 text-muted-foreground ring-border'
              )}
            >
              <CheckSquare className='h-3 w-3' />
              {doneCount}/{items.length}
            </span>
          )
        } catch {
          return null
        }

      case 'date':
        return (
          <span key={field.id} className='text-[10px] text-muted-foreground'>
            {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
            {formatDate(new Date(value + 'T00:00:00'))}
          </span>
        )

      case 'user': {
        // Resolve the assignee's entity ID to a name. During a fresh
        // subscribe the people list may not have synced yet; never fall
        // back to printing the raw entity ID (that reads as corrupt data) —
        // show the avatar (its asset URL resolves independently) with a
        // skeleton in place of the name until it resolves.
        const name = peopleMap?.[value]
        return (
          <span
            key={field.id}
            className='inline-flex items-center gap-1.5 text-[10px] text-muted-foreground'
          >
            <EntityAvatar
              src={
                containerId
                  ? `${getAppPath()}/${containerId}/-/user/${value}/asset/avatar`
                  : undefined
              }
              styleUrl={
                containerId
                  ? `${getAppPath()}/${containerId}/-/user/${value}/asset/style`
                  : undefined
              }
              fingerprint={containerId ? undefined : value}
              seed={value}
              name={name}
              size='xs'
            />
            {name ? truncate(name, 25) : <Skeleton className='h-2.5 w-14' />}
          </span>
        )
      }

      case 'checkbox':
        if (!isChecked(value)) return null
        return (
          <span
            key={field.id}
            className='inline-flex items-center gap-1 text-[10px] text-muted-foreground'
          >
            <Check className='h-3 w-3' />
            {field.name}
          </span>
        )

      case 'number':
        return (
          <span key={field.id} className='text-[10px] text-muted-foreground'>
            {value}
          </span>
        )

      case 'text':
      default:
        return (
          <span
            key={field.id}
            className='text-[10px] text-muted-foreground truncate max-w-[200px]'
          >
            {truncate(value, 80)}
          </span>
        )
    }
  }

  // Check if any body field has a value to render
  const hasBodyFields =
    !isNested &&
    cardFields.some((f) => {
      const value = object.values[f.id]
      if (!value) return false
      if (f.fieldtype === 'checkbox' && !isChecked(value)) return false
      return true
    })

  const hasChildren = childObjects && childObjects.length > 0
  const atDepthCap = depth >= MAX_NESTING_DEPTH

  // Render a single nested child wrapped in its drag-target div
  const renderChild = (child: TObject) => {
    const childFields = allFields?.[child.class] || fields
    const childOptions = allFields
      ? Object.fromEntries(childFields.map((f) => [f.id, options[f.id] || []]))
      : options
    return (
      <div
        key={child.id}
        data-card-id={child.id}
        className='rounded-lg data-drop-target:ring-2 data-drop-target:ring-primary'
      >
        <EntityBoardCard
          containerId={containerId}
          object={child}
          fields={childFields}
          options={childOptions}
          fallbackTitle={fallbackTitle}
          objectMap={objectMap}
          allFields={allFields}
          allObjects={allObjects}
          statusField={statusField}
          rowField={rowField}
          borderField={borderField}
          classMap={classMap}
          peopleMap={peopleMap}
          draggable={canDrag}
          onClick={() => onChildClick?.(child)}
          onDoubleClick={
            onChildDoubleClick ? () => onChildDoubleClick(child) : undefined
          }
          children={childrenByParent?.[child.id] || []}
          childrenByParent={childrenByParent}
          depth={depth + 1}
          hierarchy={hierarchy}
          onChildClick={onChildClick}
          onChildDoubleClick={onChildDoubleClick}
          dragPreview={dragPreview}
        />
      </div>
    )
  }

  // Render children with a gap placeholder when the drag preview targets this card.
  // Mirrors renderCardsWithGap in board-column.tsx for top-level cards.
  const renderChildrenWithGap = () => {
    const list = childObjects || []
    const reorder = dragPreview?.childReorder
    const draggedId = dragPreview?.draggedId
    // During a child-reorder preview the dragged card is hidden from any current
    // parent; the target parent shows a gap at the drop position. Mirrors the
    // top-level cross-column pattern (card "disappears" from source).
    const filtered =
      reorder && draggedId ? list.filter((c) => c.id !== draggedId) : list
    const cards = filtered.map(renderChild)
    if (reorder && reorder.parentId === object.id) {
      const insertAt = Math.max(0, Math.min(filtered.length, reorder.rank - 1))
      cards.splice(
        insertAt,
        0,
        <div
          key={draggedId}
          data-card-id={draggedId}
          className='rounded-lg border-2 border-dashed border-primary/30 bg-primary/5'
          style={{ height: dragPreview!.cardHeight }}
        />
      )
    }
    return cards
  }

  return (
    <Card
      className={cn(
        'group/card relative transition-[background-color,border-color,box-shadow,transform] duration-200',
        isNested
          ? 'bg-surface-1 p-1.5 md:p-1.5'
          : 'px-3 py-2.5 md:py-2.5 gap-2 hover:bg-surface-2 hover:shadow-md',
        'cursor-pointer active:scale-[0.99]'
      )}
      style={borderColor ? { borderColor: borderColor } : undefined}
      onClick={(e) => {
        e.stopPropagation()
        if (onDoubleClick) {
          if (clickTimer.current) clearTimeout(clickTimer.current)
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null
            onClick?.()
          }, 200)
        } else {
          onClick?.()
        }
      }}
      onDoubleClick={
        onDoubleClick
          ? (e) => {
              e.stopPropagation()
              if (clickTimer.current) {
                clearTimeout(clickTimer.current)
                clickTimer.current = null
              }
              onDoubleClick()
            }
          : undefined
      }
      draggable={canDrag}
      onDragStart={
        canDrag
          ? (e) => {
              e.stopPropagation()
              e.dataTransfer.setData('text/plain', object.id)
              e.dataTransfer.setData(
                `application/x-mochi-class-${object.class}`,
                ''
              )
              e.dataTransfer.setData(`application/x-mochi-id-${object.id}`, '')
              e.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
    >
      {/* Header row */}
      <div className='flex items-baseline gap-1.5'>
        <div
          className={cn(
            'font-medium leading-tight text-card-foreground flex-1 min-w-0',
            isNested ? 'text-xs' : 'text-sm'
          )}
        >
          {title}
        </div>
      </div>

      {/* Body fields (top-level only) */}
      {hasBodyFields && (
        <div className='flex flex-col gap-1'>
          {cardFields.map((field) => renderField(field))}
        </div>
      )}

      {/* Nested children */}
      {hasChildren && (
        <div className='space-y-1.5 border-t pt-1.5'>
          {atDepthCap ? (
            <span className='text-[10px] text-muted-foreground'>
              <Trans>+{countDeepChildren(object.id)} nested</Trans>
            </span>
          ) : (
            renderChildrenWithGap()
          )}
        </div>
      )}
    </Card>
  )
}
