// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react'
import { Trash2 } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './alert-dialog'

describe('AlertDialogAction loading state', () => {
  it('replaces the resting icon and keeps the label', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          <AlertDialogAction
            loading
            icon={<Trash2 data-testid='resting-icon' />}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    )

    const action = screen.getByRole('button', { name: 'Delete' })
    expect(action).toBeDisabled()
    expect(action).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('resting-icon')).not.toBeInTheDocument()
    expect(action.querySelector('[data-slot="button-spinner"]')).not.toBeNull()
  })
})
