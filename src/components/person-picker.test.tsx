// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  render,
  screen,
  act,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { PersonPicker, type Person } from './person-picker'

vi.mock('../lib/request', () => ({
  requestHelpers: { get: vi.fn(), post: vi.fn() },
}))
import { requestHelpers } from '../lib/request'

type Descriptor = {
  id?: string
  message?: string
  values?: Record<string, unknown>
}

function show(props: Partial<React.ComponentProps<typeof PersonPicker>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <PersonPicker
          mode='multiple'
          value={[]}
          onChange={() => {}}
          open
          onOpenChange={() => {}}
          {...props}
        />
      </I18nProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(requestHelpers.get).mockReset()
})

describe('PersonPicker', () => {
  it('counts a selection it cannot name through the plural macro', () => {
    // The macro hands the count to the catalogue; a template literal never
    // reaches i18n at all, so the marker below can only come from plural().
    const original = i18n._.bind(i18n)
    vi.spyOn(i18n, '_').mockImplementation((...args: unknown[]) => {
      const descriptor = (
        typeof args[0] === 'object' ? args[0] : { id: args[0], values: args[1] }
      ) as Descriptor
      if (descriptor.message?.includes('selected')) {
        const count = Object.values(descriptor.values ?? {})[0]
        return `SELECTED(${String(count)})`
      }
      return original(...(args as [string]))
    })
    show({ value: ['x', 'y', 'z'] })
    expect(screen.getByRole('combobox')).toHaveTextContent('SELECTED(3)')
  })

  it('heads the local list with the label the caller gives it', async () => {
    const local: Person[] = [{ id: 'a', name: 'Ann' }]
    show({
      local,
      localLabel: 'Team',
      friendsFn: async () => [{ id: 'b', name: 'Bob' }],
    })
    await screen.findByText('Bob')
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.queryByText('Project members')).not.toBeInTheDocument()
  })

  it('fetches nothing when the caller supplies only local people', async () => {
    show({ local: [{ id: 'a', name: 'Ann' }] })
    await act(async () => {})
    expect(screen.getByText('Ann')).toBeInTheDocument()
    expect(requestHelpers.get).not.toHaveBeenCalled()
  })

  describe('trigger presentation', () => {
    const people: Person[] = [
      { id: 'a', name: 'Ann' },
      { id: 'b', name: 'Bob' },
    ]

    it('single: choosing a person reports it and closes the list', () => {
      const onChange = vi.fn()
      const onOpenChange = vi.fn()
      show({ mode: 'single', value: '', local: people, onChange, onOpenChange })
      fireEvent.click(screen.getByText('Bob'))
      expect(onChange).toHaveBeenCalledWith('b')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('multiple: choosing toggles one id and leaves the list open', () => {
      const onChange = vi.fn()
      const onOpenChange = vi.fn()
      show({
        mode: 'multiple',
        value: ['a'],
        local: people,
        onChange,
        onOpenChange,
      })
      fireEvent.click(screen.getByText('Bob'))
      expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
      fireEvent.click(screen.getAllByText('Ann')[1])
      expect(onChange).toHaveBeenLastCalledWith([])
      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('the clear control empties the value', () => {
      const onChange = vi.fn()
      show({ mode: 'multiple', value: ['a', 'b'], local: people, onChange })
      const clear = within(screen.getByRole('combobox')).getByRole('button')
      fireEvent.click(clear)
      expect(onChange).toHaveBeenCalledWith([])
    })

    it('searches the directory only from two typed characters', async () => {
      const directoryFn = vi.fn(async () => [] as Person[])
      show({ local: people, directoryFn })
      const search = screen.getByPlaceholderText('Search...')
      fireEvent.change(search, { target: { value: 'a' } })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
      expect(directoryFn).not.toHaveBeenCalled()
      fireEvent.change(search, { target: { value: 'an' } })
      await waitFor(() => expect(directoryFn).toHaveBeenCalledWith('an'), {
        timeout: 2000,
      })
    })
  })

  describe('combobox presentation', () => {
    const people: Person[] = [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Bo' },
    ]

    it('multiple: shows one named chip per person and removes only that one', () => {
      const onChange = vi.fn()
      const onOpenChange = vi.fn()
      show({
        presentation: 'combobox',
        value: ['a', 'b'],
        local: people,
        onChange,
        onOpenChange,
      })
      expect(
        screen.getByRole('button', { name: 'Remove Ana' })
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Remove Bo' }))
      expect(onChange).toHaveBeenCalledWith(['a'])
      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('multiple: Backspace on an empty input removes the last chip', () => {
      const onChange = vi.fn()
      show({
        presentation: 'combobox',
        value: ['a', 'b'],
        local: people,
        onChange,
      })
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })
      expect(onChange).toHaveBeenCalledWith(['a'])
    })

    it('multiple: Backspace with text in the input removes nothing', () => {
      const onChange = vi.fn()
      show({
        presentation: 'combobox',
        value: ['a'],
        local: people,
        onChange,
      })
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'b' } })
      fireEvent.keyDown(input, { key: 'Backspace' })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('multiple: choosing a person adds it and clears the typed text', () => {
      const onChange = vi.fn()
      show({
        presentation: 'combobox',
        value: ['a'],
        local: people,
        onChange,
      })
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'bo' } })
      expect(
        screen.queryByText('Ana', { selector: 'span' })
      ).toBeInTheDocument()
      fireEvent.click(screen.getByText('Bo'))
      expect(onChange).toHaveBeenCalledWith(['a', 'b'])
      expect(input).toHaveValue('')
    })

    it('multiple: names a chip for an id it cannot resolve', () => {
      show({ presentation: 'combobox', value: ['ghost'], local: people })
      expect(
        screen.getByRole('button', { name: 'Remove ghost' })
      ).toBeInTheDocument()
    })

    it('multiple: a chip outlives the result set that held the person', () => {
      const picked: Person = { id: 'cached-1', name: 'Cy' }
      const first = show({
        presentation: 'combobox',
        value: [],
        local: [picked],
      })
      fireEvent.click(screen.getByText('Cy'))
      first.unmount()
      show({ presentation: 'combobox', value: ['cached-1'], local: [] })
      expect(
        screen.getByRole('button', { name: 'Remove Cy' })
      ).toBeInTheDocument()
    })

    it('single: typing narrows the list and choosing closes it', () => {
      const onChange = vi.fn()
      const onOpenChange = vi.fn()
      show({
        presentation: 'combobox',
        mode: 'single',
        value: '',
        local: people,
        onChange,
        onOpenChange,
      })
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'bo' },
      })
      expect(screen.queryByText('Ana')).not.toBeInTheDocument()
      fireEvent.click(screen.getByText('Bo'))
      expect(onChange).toHaveBeenCalledWith('b')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('single: holds the chosen name and searches from empty when reopened', () => {
      function Harness() {
        const [open, setOpen] = useState(true)
        return (
          <>
            <button onClick={() => setOpen(false)}>close</button>
            <PersonPicker
              presentation='combobox'
              mode='single'
              value='b'
              onChange={() => {}}
              local={people}
              open={open}
              onOpenChange={setOpen}
            />
          </>
        )
      }
      const client = new QueryClient()
      render(
        <QueryClientProvider client={client}>
          <I18nProvider i18n={i18n}>
            <Harness />
          </I18nProvider>
        </QueryClientProvider>
      )
      const input = screen.getByRole('combobox')
      expect(input).toHaveValue('Bo')
      fireEvent.change(input, { target: { value: 'an' } })
      expect(input).toHaveValue('an')
      expect(screen.queryByText('Bo', { selector: 'span' })).toBeNull()
      fireEvent.click(screen.getByText('close'))
      expect(input).toHaveValue('Bo')
    })

    it('single: the clear button empties the value', () => {
      const onChange = vi.fn()
      show({
        presentation: 'combobox',
        mode: 'single',
        value: 'a',
        local: people,
        onChange,
      })
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
      expect(onChange).toHaveBeenCalledWith('')
    })

    it('single: no clear button while nothing is chosen', () => {
      show({
        presentation: 'combobox',
        mode: 'single',
        value: '',
        local: people,
      })
      expect(
        screen.queryByRole('button', { name: 'Clear' })
      ).not.toBeInTheDocument()
    })

    it('searches the directory only from two typed characters', async () => {
      const directoryFn = vi.fn(async () => [] as Person[])
      show({ presentation: 'combobox', local: people, directoryFn })
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'a' } })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400))
      })
      expect(directoryFn).not.toHaveBeenCalled()
      fireEvent.change(input, { target: { value: 'an' } })
      await waitFor(() => expect(directoryFn).toHaveBeenCalledWith('an'), {
        timeout: 2000,
      })
    })

    it('shows a spinner while the directory loads', async () => {
      const directoryFn = vi.fn(() => new Promise<Person[]>(() => {}))
      show({ presentation: 'combobox', local: people, directoryFn })
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'zz' },
      })
      await waitFor(
        () =>
          expect(
            document.querySelector(
              '[data-slot="combobox-content"] .animate-spin'
            )
          ).not.toBeNull(),
        { timeout: 2000 }
      )
    })

    it('shows the empty message only after a completed search', async () => {
      const directoryFn = vi.fn(async () => [] as Person[])
      show({ presentation: 'combobox', local: [], directoryFn })
      expect(screen.queryByText('No people found')).not.toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'zz' },
      })
      expect(await screen.findByText('No people found')).toBeInTheDocument()
    })

    it('heads a group only when there is more than one', async () => {
      show({
        presentation: 'combobox',
        local: [{ id: 'a', name: 'Ann' }],
        localLabel: 'Team',
      })
      await act(async () => {})
      expect(screen.getByText('Ann')).toBeInTheDocument()
      expect(screen.queryByText('Team')).not.toBeInTheDocument()
    })

    it('heads each group when there are several', async () => {
      show({
        presentation: 'combobox',
        local: [{ id: 'a', name: 'Ann' }],
        localLabel: 'Team',
        friendsFn: async () => [{ id: 'b', name: 'Bob' }],
      })
      await screen.findByText('Bob')
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Friends')).toBeInTheDocument()
    })

    it('fetches nothing when the caller supplies only local people', async () => {
      show({ presentation: 'combobox', local: people })
      await act(async () => {})
      expect(requestHelpers.get).not.toHaveBeenCalled()
    })

    it('disabled: blocks typing and chip removal', () => {
      show({
        presentation: 'combobox',
        value: ['a'],
        local: people,
        disabled: true,
      })
      expect(screen.getByRole('combobox')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Remove Ana' })).toBeDisabled()
    })

    it('leaves the default presentation as the button trigger', () => {
      show({ local: people })
      expect(screen.getByRole('combobox').tagName).toBe('BUTTON')
    })
  })
})
