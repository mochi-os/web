// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from 'react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import {
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../ui/side-panel'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { SortDirectionButton } from '../ui/sort-direction-button'
import { Switch } from '../ui/switch'
import { naturalCompare } from '../../lib/utils'
import { Check, GripVertical, Minus, MoreHorizontal, Plus } from 'lucide-react'
import type {
  EntityClass,
  EntityField,
  EntityView,
} from '../../types/entity-object'

// A Select cannot hold "" as an item value, so an empty selection needs a
// sentinel that is mapped back to "" on the way out.
const NONE_SELECT_VALUE = '_none_'

interface ViewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'create' | 'edit'
  fields: EntityField[]
  classes: EntityClass[]
  /** True where the app numbers its objects, which is what a Number sort orders. */
  numbered?: boolean
  // Edit mode props
  view?: EntityView | null
  onUpdate?: (updates: Partial<EntityView>) => void
  onUpdateClasses?: (classes: string[]) => void
  onDelete?: () => void
  // Create mode props
  onCreate?: (
    name: string,
    viewtype: string,
    columns: string,
    rows: string,
    selectedFields: string[],
    sort: string,
    direction: string,
    selectedClasses: string[],
    border: string
  ) => void | Promise<void>
}

export function ViewSheet({
  open,
  onOpenChange,
  mode = 'edit',
  fields,
  classes,
  numbered,
  view,
  onUpdate,
  onUpdateClasses,
  onDelete,
  onCreate,
}: ViewSheetProps) {
  const allClassIds = useMemo(() => classes.map((c) => c.id), [classes])

  const [name, setName] = useState('')
  const [viewtype, setViewtype] = useState('board')
  const [columns, setColumns] = useState('')
  const [rows, setRows] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [sort, setSort] = useState('')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [border, setBorder] = useState('')
  const [draggedViewFieldId, setDraggedViewFieldId] = useState<string | null>(
    null
  )
  const [viewFieldDropIndicator, setViewFieldDropIndicator] = useState<{
    fieldId: string
    position: 'before' | 'after'
  } | null>(null)

  const enumeratedFields = fields.filter((f) => f.fieldtype === 'enumerated')

  // Reset state on open
  useEffect(() => {
    if (!open) return
    if (mode === 'create') {
      setName('')
      setViewtype(enumeratedFields.length > 0 ? 'board' : 'list')
      setColumns(enumeratedFields[0]?.id || '')
      setRows('')
      setBorder('')
      setSelectedFields(fields.map((f) => f.id))
      setSort('')
      setDirection('asc')
      setSelectedClasses(classes.map((c) => c.id))
    } else if (view) {
      setName(view.name)
      setViewtype(view.viewtype)
      setColumns(view.columns || '')
      setRows(view.rows || '')
      setBorder(view.border || '')
      setSelectedFields((view.fields || '').split(',').filter(Boolean))
      setSort(view.sort || '')
      setDirection((view.direction as 'asc' | 'desc') || 'asc')
      setSelectedClasses(view.classes?.length ? view.classes : allClassIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, mode])

  if (mode === 'edit' && !view) return null

  // Edit mode handlers (live-save on change)
  const handleNameBlur = () => {
    if (
      mode === 'edit' &&
      onUpdate &&
      view &&
      name.trim() &&
      name.trim() !== view.name
    ) {
      onUpdate({ name: name.trim() })
    }
  }

  const handleViewtypeChange = (value: string) => {
    setViewtype(value)
    if (mode === 'edit' && onUpdate && view && value !== view.viewtype) {
      onUpdate({ viewtype: value })
    }
  }

  const handleColumnsChange = (value: string) => {
    setColumns(value)
    if (mode === 'edit' && onUpdate && view && value !== view.columns) {
      onUpdate({ columns: value })
    }
  }

  const handleRowsChange = (value: string) => {
    setRows(value)
    if (mode === 'edit' && onUpdate && view && value !== view.rows) {
      onUpdate({ rows: value })
    }
  }

  const handleSortChange = (value: string) => {
    setSort(value)
    if (mode === 'edit' && onUpdate && view && value !== view.sort) {
      onUpdate({ sort: value })
    }
  }

  const handleDirectionToggle = () => {
    const newDirection = direction === 'asc' ? 'desc' : 'asc'
    setDirection(newDirection)
    if (mode === 'edit' && onUpdate) {
      onUpdate({ direction: newDirection })
    }
  }

  const toggleViewField = (fieldId: string) => {
    let newFields: string[]
    if (selectedFields.includes(fieldId)) {
      newFields = selectedFields.filter((f) => f !== fieldId)
    } else {
      newFields = [...selectedFields, fieldId]
    }
    setSelectedFields(newFields)
    if (mode === 'edit' && onUpdate) {
      onUpdate({ fields: newFields.join(',') })
    }
  }

  const handleViewFieldDragStart = (e: React.DragEvent, fieldId: string) => {
    setDraggedViewFieldId(fieldId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', fieldId)
  }

  const handleViewFieldDragEnd = () => {
    setDraggedViewFieldId(null)
    setViewFieldDropIndicator(null)
  }

  const handleViewFieldDragOver = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault()
    if (fieldId === draggedViewFieldId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'
    setViewFieldDropIndicator({ fieldId, position })
  }

  const handleViewFieldDrop = (e: React.DragEvent, targetFieldId: string) => {
    e.preventDefault()
    if (!draggedViewFieldId || draggedViewFieldId === targetFieldId) return

    const draggedIndex = selectedFields.indexOf(draggedViewFieldId)
    const targetIndex = selectedFields.indexOf(targetFieldId)
    if (draggedIndex === -1 || targetIndex === -1) return

    const newOrder = [...selectedFields]
    newOrder.splice(draggedIndex, 1)
    const insertIndex =
      viewFieldDropIndicator?.position === 'after'
        ? targetIndex - (draggedIndex < targetIndex ? 1 : 0) + 1
        : targetIndex - (draggedIndex < targetIndex ? 1 : 0)
    newOrder.splice(insertIndex, 0, draggedViewFieldId)

    setSelectedFields(newOrder)
    if (mode === 'edit' && onUpdate) {
      onUpdate({ fields: newOrder.join(',') })
    }

    setDraggedViewFieldId(null)
    setViewFieldDropIndicator(null)
  }

  const toggleClass = (classId: string) => {
    let newClasses: string[]
    if (selectedClasses.includes(classId)) {
      newClasses = selectedClasses.filter((c) => c !== classId)
    } else {
      newClasses = [...selectedClasses, classId]
    }
    setSelectedClasses(newClasses)
    if (mode === 'edit' && onUpdateClasses) {
      onUpdateClasses(newClasses)
    }
  }

  const canSubmit =
    name.trim() &&
    (viewtype !== 'board' || enumeratedFields.length === 0 || columns)

  const handleCreate = async () => {
    if (onCreate && canSubmit) {
      try {
        await onCreate(
          name.trim(),
          viewtype,
          columns,
          rows,
          selectedFields,
          sort,
          direction,
          selectedClasses,
          border
        )
        onOpenChange(false)
      } catch {
        // Error displayed by caller via toast
      }
    }
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      description={t`Configure view settings`}
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <SidePanelHeader
        actions={
          mode === 'edit' && onDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t`Open view actions`}
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='end'
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <DropdownMenuItem onSelect={onDelete}>
                  <Minus className='size-4' />
                  <Trans>Delete view</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      >
        <SidePanelTitle>
          {mode === 'create' ? (
            <Trans>Add view</Trans>
          ) : (
            <Trans>Edit view</Trans>
          )}
        </SidePanelTitle>
      </SidePanelHeader>
      <SidePanelBody className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='view-name'>
            <Trans>Name</Trans>
          </Label>
          <div className='ps-4'>
            <Input
              id='view-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={mode === 'edit' ? handleNameBlur : undefined}
              autoFocus={mode === 'create'}
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label>
            <Trans>Layout</Trans>
          </Label>
          <div className='ps-4'>
            <RadioGroup value={viewtype} onValueChange={handleViewtypeChange}>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='board' id='vt-board' />
                <Label
                  htmlFor='vt-board'
                  className='font-normal cursor-pointer'
                >
                  <Trans>Board</Trans>
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <RadioGroupItem value='list' id='vt-list' />
                <Label htmlFor='vt-list' className='font-normal cursor-pointer'>
                  <Trans>List</Trans>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {classes.length > 1 && (
          <div className='space-y-2'>
            <Label>
              <Trans>Show classes</Trans>
            </Label>
            <div className='ps-4 space-y-1'>
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className='flex items-center gap-2 text-sm cursor-pointer'
                >
                  <Switch
                    checked={selectedClasses.includes(cls.id)}
                    onCheckedChange={() => toggleClass(cls.id)}
                  />
                  {cls.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {(viewtype === 'board' || viewtype === 'list') &&
          enumeratedFields.length > 0 && (
            <div className='space-y-2'>
              <Label>
                {viewtype === 'list' ? (
                  <Trans>Group by</Trans>
                ) : (
                  <Trans>Columns group by</Trans>
                )}
              </Label>
              <div className='ps-4'>
                <Select
                  value={columns || NONE_SELECT_VALUE}
                  onValueChange={(value) =>
                    handleColumnsChange(
                      value === NONE_SELECT_VALUE ? '' : value
                    )
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t`Select a field`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SELECT_VALUE}>
                      <Trans>None</Trans>
                    </SelectItem>
                    {enumeratedFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

        {viewtype === 'board' && enumeratedFields.length > 0 && (
          <div className='space-y-2'>
            <Label>
              <Trans>Rows group by</Trans>
            </Label>
            <div className='ps-4'>
              <Select
                value={rows || NONE_SELECT_VALUE}
                onValueChange={(value) =>
                  handleRowsChange(value === NONE_SELECT_VALUE ? '' : value)
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder={t`None`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT_VALUE}>
                    <Trans>None</Trans>
                  </SelectItem>
                  {enumeratedFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {(viewtype === 'board' || viewtype === 'list') &&
          enumeratedFields.length > 0 && (
            <div className='space-y-2'>
              <Label>
                <Trans>Border colour</Trans>
              </Label>
              <div className='ps-4'>
                <Select
                  value={border || NONE_SELECT_VALUE}
                  onValueChange={(value) => {
                    const nextValue = value === NONE_SELECT_VALUE ? '' : value
                    setBorder(nextValue)
                    if (mode === 'edit' && onUpdate) {
                      onUpdate({ border: nextValue })
                    }
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t`None`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SELECT_VALUE}>
                      <Trans>None</Trans>
                    </SelectItem>
                    {enumeratedFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

        <div className='space-y-2'>
          <Label>
            <Trans>Show fields</Trans>
          </Label>
          <div className='ps-4 space-y-1'>
            {selectedFields
              .map((id) => fields.find((f) => f.id === id))
              .filter(Boolean)
              .map((field) => (
                <div key={field!.id}>
                  {viewFieldDropIndicator?.fieldId === field!.id &&
                    viewFieldDropIndicator.position === 'before' && (
                      <div className='h-0.5 bg-primary mx-3 rounded-full' />
                    )}
                  <div
                    draggable
                    onDragStart={(e) => handleViewFieldDragStart(e, field!.id)}
                    onDragEnd={handleViewFieldDragEnd}
                    onDragOver={(e) => handleViewFieldDragOver(e, field!.id)}
                    onDragLeave={() => setViewFieldDropIndicator(null)}
                    onDrop={(e) => handleViewFieldDrop(e, field!.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-hover transition-colors cursor-grab ${
                      draggedViewFieldId === field!.id ? 'opacity-50' : ''
                    }`}
                  >
                    <GripVertical className='size-4 text-muted-foreground shrink-0' />
                    <Switch
                      checked
                      onCheckedChange={() => toggleViewField(field!.id)}
                    />
                    {field!.name}
                  </div>
                  {viewFieldDropIndicator?.fieldId === field!.id &&
                    viewFieldDropIndicator.position === 'after' && (
                      <div className='h-0.5 bg-primary mx-3 rounded-full' />
                    )}
                </div>
              ))}
            {fields
              .filter((f) => !selectedFields.includes(f.id))
              .map((field) => (
                <label
                  key={field.id}
                  className='flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer'
                >
                  <Switch
                    checked={false}
                    onCheckedChange={() => toggleViewField(field.id)}
                  />
                  {field.name}
                </label>
              ))}
          </div>
        </div>

        <div className='space-y-2'>
          <Label>
            <Trans>Default sort</Trans>
          </Label>
          <div className='ps-4 flex gap-2'>
            <Select
              value={sort || NONE_SELECT_VALUE}
              onValueChange={(value) =>
                handleSortChange(value === NONE_SELECT_VALUE ? '' : value)
              }
            >
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={t`None`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_SELECT_VALUE}>
                  <Trans>None</Trans>
                </SelectItem>
                <SelectItem value='created'>
                  <Trans>Created</Trans>
                </SelectItem>
                {(numbered || sort === 'number') && (
                  <SelectItem value='number'>
                    <Trans context='item number'>Number</Trans>
                  </SelectItem>
                )}
                <SelectItem value='updated'>
                  <Trans>Updated</Trans>
                </SelectItem>
                {[...fields]
                  .sort((a, b) => naturalCompare(a.name, b.name))
                  .map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <SortDirectionButton
              direction={direction}
              onToggle={handleDirectionToggle}
            />
          </div>
        </div>
      </SidePanelBody>
      <SidePanelFooter>
        {mode === 'create' ? (
          <Button type='button' onClick={handleCreate} disabled={!canSubmit}>
            <Plus className='size-4' />
            <Trans>Add view</Trans>
          </Button>
        ) : (
          <Button type='button' onClick={() => onOpenChange(false)}>
            <Check className='size-4' />
            <Trans>Done</Trans>
          </Button>
        )}
      </SidePanelFooter>
    </SidePanel>
  )
}
