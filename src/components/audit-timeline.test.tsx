// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { AuditTimeline } from './audit-timeline'

describe('AuditTimeline', () => {
  it('labels an action the caller has no word for as Unknown', async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AuditTimeline
          kind='listing'
          object='l1'
          fetchAudit={async () => ({
            audit: [{ id: 'a1', action: 'weird.key', data: '{}', actor: 'system', actor_name: '', timestamp: 1700000000 }],
          })}
          actionLabels={{}}
          formatFingerprint={(actor) => actor}
        />
      </I18nProvider>
    )
    expect(await screen.findByText('Unknown')).toBeInTheDocument()
    expect(screen.queryByText('weird.key')).not.toBeInTheDocument()
  })
})
