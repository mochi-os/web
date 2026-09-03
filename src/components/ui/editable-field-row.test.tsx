// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { EditableFieldRow } from './editable-field-row'

describe('EditableFieldRow', () => {
  it('passes the caller\'s length cap to the editor', () => {
    render(
      <I18nProvider i18n={i18n}>
        <EditableFieldRow label='Description' value='x' onSave={vi.fn()} multiline maxLength={10000} />
      </I18nProvider>
    )
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '10000')
  })
})
