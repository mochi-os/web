// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxInput,
  ComboboxClear,
  ComboboxContent,
} from './combobox'
import { CommandList, CommandItem } from './command'

function show(
  props: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onValueChange?: (value: string) => void
    onRemoveAna?: () => void
    onRemoveBo?: () => void
    onClear?: () => void
    onSelect?: () => void
  } = {}
) {
  const {
    open = true,
    onOpenChange = () => {},
    onValueChange,
    onRemoveAna,
    onRemoveBo,
    onClear,
    onSelect,
  } = props
  return render(
    <Combobox open={open} onOpenChange={onOpenChange}>
      <ComboboxChips data-testid='field'>
        <ComboboxChip removeLabel='Remove Ana' onRemove={onRemoveAna}>
          Ana
        </ComboboxChip>
        <ComboboxChip removeLabel='Remove Bo' onRemove={onRemoveBo}>
          Bo
        </ComboboxChip>
        <ComboboxInput placeholder='Search' onValueChange={onValueChange} />
        <ComboboxClear label='Clear' onClick={onClear} />
      </ComboboxChips>
      <ComboboxContent>
        <CommandList>
          <CommandItem value='ann' onSelect={onSelect}>
            Ann
          </CommandItem>
          <CommandItem value='bob'>Bob</CommandItem>
        </CommandList>
      </ComboboxContent>
    </Combobox>
  )
}

describe('Combobox', () => {
  it('names each chip remove button and removes only that chip', () => {
    const onRemoveAna = vi.fn()
    const onRemoveBo = vi.fn()
    show({ onRemoveAna, onRemoveBo })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bo' }))
    expect(onRemoveBo).toHaveBeenCalledTimes(1)
    expect(onRemoveAna).not.toHaveBeenCalled()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('names the clear button and calls its handler', () => {
    const onClear = vi.fn()
    show({ onClear })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('reports typed text and leaves filtering to the caller', () => {
    const onValueChange = vi.fn()
    show({ onValueChange })
    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'zzz' },
    })
    expect(onValueChange).toHaveBeenCalledWith('zzz')
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('selects an item from the list', () => {
    const onSelect = vi.fn()
    show({ onSelect })
    fireEvent.click(screen.getByText('Ann'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('opens the list when the input is focused, clicked or typed in', () => {
    const onOpenChange = vi.fn()
    show({ open: false, onOpenChange })
    const input = screen.getByPlaceholderText('Search')
    fireEvent.focus(input)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    onOpenChange.mockClear()
    fireEvent.click(input)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    onOpenChange.mockClear()
    fireEvent.change(input, { target: { value: 'a' } })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('moves focus to the input when the list is opened from outside', () => {
    show({ open: true })
    expect(screen.getByPlaceholderText('Search')).toHaveFocus()
  })

  it('closes on Escape', () => {
    const onOpenChange = vi.fn()
    show({ onOpenChange })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // jsdom does not deliver Radix's pointer-down-outside (a bare Popover ignores
  // a press on body too), so the guard is tested through focus. Both go
  // through the same onInteractOutside handler.
  it('dismisses when focus moves to something outside the field', () => {
    const onOpenChange = vi.fn()
    show({ onOpenChange })
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    outside.remove()
  })

  it('does not dismiss when focus returns to the field', () => {
    const onOpenChange = vi.fn()
    show({ onOpenChange })
    const input = screen.getByPlaceholderText('Search')
    input.blur()
    input.focus()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
