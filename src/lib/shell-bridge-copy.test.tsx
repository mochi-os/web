// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'

// Inside the shell the copy goes through a hidden textarea and
// execCommand('copy'), which copies whatever holds focus. An open Radix menu
// traps focus, and a textarea outside the trap is refocused away from: the
// copy then reports success having copied nothing. These tests render the real
// menu and record what had focus when execCommand ran.

let copied: string | null

beforeEach(() => {
  copied = null
  // A sandboxed iframe: parent is another window whose document is blocked.
  const parent = {
    postMessage: vi.fn(),
    get document(): never {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get: () => parent,
  })
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => {
      const focused = document.activeElement
      copied = focused instanceof HTMLTextAreaElement ? focused.value : null
      return true
    },
  })
  vi.resetModules()
})

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get: () => window,
  })
})

describe('shellClipboardWrite inside an open menu', () => {
  it('copies the text from a menu item', async () => {
    const { shellClipboardWrite } = await import('./shell-bridge')
    let result: Promise<boolean> | undefined
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              result = shellClipboardWrite('https://example.com/thread')
            }}
          >
            Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const item = screen.getByRole('menuitem', { name: 'Copy link' })
    item.focus()
    fireEvent.click(item)

    expect(await result).toBe(true)
    expect(copied).toBe('https://example.com/thread')
  })
})
