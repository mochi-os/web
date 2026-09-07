// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useRef, type DragEvent } from 'react'
import {
  Calendar,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  GripVertical,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useFormat } from '../hooks/use-format'
import { useLingui } from '@lingui/react/macro'
import { getAppPath } from '../lib/app-path'
import { EntityAvatar } from './entity-avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export interface TreeRowField {
  id: string
  name?: string
  fieldtype: string
}

export interface TreeRowObject {
  id: string
  class: string
  number?: number
  values: Record<string, string>
}

export interface TreeRowFieldOption {
  id: string
  name: string
  colour: string
}

export interface TreeRowChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface TreeRowProps {
  object: TreeRowObject
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  anySiblingHasChildren: boolean
  fields: TreeRowField[]
  options: Record<string, TreeRowFieldOption[]>
  peopleMap: Record<string, string>
  classMap: Record<string, string>
  titleFieldId?: string
  /** Optional prefix for object number display (e.g. "PROJ"). Enables the ID column when set. */
  prefix?: string
  showClass?: boolean
  showId?: boolean
  /** Enumerated field id used for card/row border colour (e.g. priority). */
  borderField?: string
  /** App resource id for user avatar URLs (project/crm fingerprint). */
  resourceId?: string
  /** Highlight row when detail panel is open for this object. */
  isSelected?: boolean
  isDragOver: boolean
  isDragBefore: boolean
  isDragAfter: boolean
  canReorder: boolean
  canReparent: boolean
  /**
   * Whether this row may start a drag at all. False for a reader without write
   * access, who would otherwise get a grab cursor and a drop indicator for a
   * move the tree refuses. Defaults to true.
   */
  canDrag?: boolean
  onToggleExpand: () => void
  onClick: () => void
  onDragStart: () => void
  onDragOver: (objectId: string, position: 'before' | 'after' | 'on') => void
  onDragEnd: () => void
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

function isPastDue(dateStr: string): boolean {
  const due = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function withTruncationTooltip(fullText: string, maxLength: number, className?: string) {
  const display = truncate(fullText, maxLength)
  const node = <span className={cn('truncate block', className)}>{display}</span>
  if (fullText.length <= maxLength) return node
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap break-words">
        {fullText}
      </TooltipContent>
    </Tooltip>
  )
}

function columnWidthClass(field: TreeRowField, isTitle: boolean): string {
  if (isTitle) return 'min-w-[12rem] w-full max-w-0'
  switch (field.fieldtype) {
    case 'user':
      return 'w-40 shrink-0'
    case 'date':
      return 'w-32 shrink-0'
    case 'enumerated':
      return 'w-36 shrink-0'
    default:
      return 'w-48 shrink-0 max-w-xs'
  }
}

export function TreeRow({
  object,
  depth,
  hasChildren,
  isExpanded,
  anySiblingHasChildren,
  fields,
  options,
  peopleMap,
  classMap,
  titleFieldId,
  prefix,
  showClass = true,
  showId = true,
  borderField,
  resourceId,
  isSelected = false,
  isDragOver,
  isDragBefore,
  isDragAfter,
  canReorder,
  canReparent,
  canDrag = true,
  onToggleExpand,
  onClick,
  onDragStart,
  onDragOver,
  onDragEnd,
}: TreeRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)
  const { formatDate } = useFormat()
  const { t } = useLingui()

  let borderColor: string | undefined
  if (borderField) {
    const value = object.values[borderField]
    if (value) {
      const match = options[borderField]?.find((o) => o.id === value && o.colour)
      if (match) borderColor = match.colour
    }
  }

  const renderFieldValue = (field: TreeRowField, value: string, isTitleField: boolean) => {
    if (!value) {
      if (field.fieldtype === 'date') {
        return (
          <span
            className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/35 text-muted-foreground/45"
            aria-hidden="true"
          >
            <Calendar className="size-3.5" />
          </span>
        )
      }
      if (field.fieldtype === 'user') {
        return (
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/35 text-muted-foreground/45 text-xs">
            —
          </span>
        )
      }
      return <span className="text-muted-foreground">—</span>
    }

    switch (field.fieldtype) {
      case 'enumerated': {
        const fieldOptions = options[field.id] || []
        const option = fieldOptions.find((o) => o.id === value)
        if (option) {
          return (
            <span className="inline-flex items-center gap-1.5 max-w-full">
              {option.colour ? (
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: option.colour }}
                />
              ) : null}
              <span className="truncate">{option.name}</span>
            </span>
          )
        }
        return <span className="truncate">{value}</span>
      }

      case 'date': {
        const date = new Date(value + 'T00:00:00')
        const overdue = isPastDue(value)
        const label = formatDate(date)
        return (
          <span className={cn('truncate tabular-nums', overdue && 'text-destructive font-medium')}>
            {label}
          </span>
        )
      }

      case 'user': {
        const name = peopleMap[value] || t`Unknown`
        const avatarSrc = resourceId
          ? `${getAppPath()}/${resourceId}/-/user/${value}/asset/avatar`
          : undefined
        const styleUrl = resourceId
          ? `${getAppPath()}/${resourceId}/-/user/${value}/asset/style`
          : undefined
        return (
          <span className="inline-flex items-center gap-2 truncate max-w-full">
            <EntityAvatar
              src={avatarSrc}
              styleUrl={styleUrl}
              fingerprint={resourceId ? undefined : value}
              seed={value}
              name={name}
              size="xs"
            />
            <span className="truncate text-sm">{truncate(name, 22)}</span>
          </span>
        )
      }

      case 'checklist': {
        try {
          const items: TreeRowChecklistItem[] = JSON.parse(value)
          if (items.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }
          const doneCount = items.filter((item) => item.done).length
          const allDone = doneCount === items.length
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                allDone
                  ? 'bg-success/10 text-success ring-success/30'
                  : 'bg-muted text-muted-foreground ring-border',
              )}
            >
              <CheckSquare className="size-3" />
              {doneCount}/{items.length}
            </span>
          )
        } catch {
          return <span className="text-muted-foreground">—</span>
        }
      }

      case 'text':
      default: {
        const maxLen = isTitleField ? 120 : 80
        return withTruncationTooltip(
          value,
          maxLen,
          isTitleField ? 'font-medium text-foreground' : 'text-muted-foreground',
        )
      }
    }
  }

  const indentPx = depth * 20
  const hasId = prefix !== undefined && showId
  const firstContentCol = showClass ? 'class' : hasId ? 'id' : fields[0]?.id || ''
  const indentStyle = indentPx > 0 ? { paddingInlineStart: indentPx } : undefined

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (!rowRef.current) return

    const rect = rowRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    const edge = canReparent ? height * 0.35 : height * 0.5

    if (canReorder && y < edge) {
      onDragOver(object.id, 'before')
    } else if (canReorder && y > height - edge) {
      onDragOver(object.id, 'after')
    } else if (canReparent) {
      onDragOver(object.id, 'on')
    } else if (canReorder) {
      onDragOver(object.id, y < height * 0.5 ? 'before' : 'after')
    }
  }

  return (
    <tr
      ref={rowRef}
      data-card-id={object.id}
      className={cn(
        'hover:bg-hover transition-colors cursor-pointer text-sm group relative border-b border-border/60',
        isSelected && 'bg-primary/10 hover:bg-primary/10 ring-1 ring-inset ring-primary/20',
        isDragOver && 'bg-primary/20 ring-2 ring-inset ring-primary/50',
        borderColor && 'border-s-[3px]',
      )}
      style={borderColor ? { borderInlineStartColor: borderColor } : undefined}
      onClick={onClick}
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', object.id)
        onDragStart()
      }}
      onDragOver={handleDragOver}
      onDrop={onDragEnd}
      onDragEnd={onDragEnd}
    >
      {isDragBefore ? (
        <td colSpan={100} className="absolute -top-px left-0 right-0 pointer-events-none">
          <div className="relative h-0.5 bg-primary shadow-[0_0_4px_1px] shadow-primary/50">
            <div className="absolute -start-1 -top-[3px] size-2 rounded-full bg-primary" />
          </div>
        </td>
      ) : null}

      <td className="whitespace-nowrap py-2 ps-2 pe-2 w-10 min-w-10">
        <div className="flex items-center gap-0.5">
          <div className="w-5 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-50 cursor-grab">
            <GripVertical className="size-3" />
          </div>
          {hasChildren ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={isExpanded ? t`Collapse` : t`Expand`}
                  className="size-5 flex items-center justify-center hover:bg-hover transition-colors rounded"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand()
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4 rtl:rotate-180" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? t`Collapse` : t`Expand`}</TooltipContent>
            </Tooltip>
          ) : anySiblingHasChildren ? (
            <div className="size-5" />
          ) : null}
        </div>
      </td>

      {showClass ? (
        <td
          className="whitespace-nowrap ps-1 pe-2 py-2 w-24 shrink-0"
          style={firstContentCol === 'class' ? indentStyle : undefined}
        >
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {classMap[object.class] || t`Unknown`}
          </span>
        </td>
      ) : null}

      {hasId ? (
        <td
          className="whitespace-nowrap ps-1 pe-2 py-2 text-xs text-muted-foreground font-mono w-20 shrink-0"
          style={firstContentCol === 'id' ? indentStyle : undefined}
        >
          {prefix}-{object.number}
        </td>
      ) : null}

      {fields.map((field) => {
        const isTitleField = field.id === titleFieldId
        const value = object.values[field.id] || ''
        return (
          <td
            key={field.id}
            className={cn(
              'px-2 py-2',
              columnWidthClass(field, isTitleField),
              firstContentCol === field.id && 'ps-3',
            )}
            style={firstContentCol === field.id ? indentStyle : undefined}
          >
            {renderFieldValue(field, value, isTitleField)}
          </td>
        )
      })}

      {isDragAfter ? (
        <td colSpan={100} className="absolute -bottom-px left-0 right-0 pointer-events-none">
          <div className="relative h-0.5 bg-primary shadow-[0_0_4px_1px] shadow-primary/50">
            <div className="absolute -start-1 -top-[3px] size-2 rounded-full bg-primary" />
          </div>
        </td>
      ) : null}
    </tr>
  )
}
