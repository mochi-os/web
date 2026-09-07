// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../components/entity/entity-test-utils'
import { AccessList } from './access-list'

// Every app marks the resource owner's rule with the `owner` wire key. The
// owner row is the one that loses its level picker, so the key has to be the
// one the servers actually send.
describe('AccessList', () => {
  it('renders the owner rule read-only from the owner wire key', () => {
    render(
      <AccessList
        rules={[
          { subject: 'ownerid', operation: '*', grant: 1, name: 'Owner Person', owner: true },
          { subject: 'memberid', operation: 'view', grant: 1, name: 'Member Person' },
        ]}
        levels={[
          { value: 'view', label: 'View only' },
          { value: 'none', label: 'No access' },
        ]}
        onLevelChange={vi.fn(async () => {})}
        onRevoke={vi.fn(async () => {})}
      />
    )
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })
})
