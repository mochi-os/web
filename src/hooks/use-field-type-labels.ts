// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'

/** Display names for the entity field types, keyed by the stored type. */
export function useFieldTypeLabels(): Record<string, string> {
  const { t } = useLingui()
  return useMemo(
    () => ({
      checkbox: t`Checkbox`,
      checklist: t`Checklist`,
      date: t`Date`,
      number: t`Number`,
      enumerated: t`Select`,
      text: t`Text`,
      user: t`User`,
    }),
    [t],
  )
}
