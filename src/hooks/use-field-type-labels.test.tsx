// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { useFieldTypeLabels } from './use-field-type-labels'

describe('useFieldTypeLabels', () => {
  it('names every stored field type', () => {
    const { result } = renderHook(() => useFieldTypeLabels(), {
      wrapper: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>,
    })
    expect(result.current).toEqual({
      checkbox: 'Checkbox',
      checklist: 'Checklist',
      date: 'Date',
      number: 'Number',
      enumerated: 'Select',
      text: 'Text',
      user: 'User',
    })
  })
})
