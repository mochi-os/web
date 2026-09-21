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
          {
            subject: 'ownerid',
            operation: '*',
            grant: 1,
            name: 'Owner Person',
            owner: true,
          },
          {
            subject: 'memberid',
            operation: 'view',
            grant: 1,
            name: 'Member Person',
          },
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

  // Access management sits inside a settings Card almost everywhere, so the
  // table leaves the boundary to the Card unless the caller asks for one.
  it('draws its own border only when asked', () => {
    const props = {
      rules: [{ subject: 'memberid', operation: 'view', grant: 1 }],
      levels: [{ value: 'view', label: 'View only' }],
      onLevelChange: vi.fn(async () => {}),
      onRevoke: vi.fn(async () => {}),
    }
    const container = () =>
      document.querySelector('[data-slot="table-container"]')

    const { unmount } = render(<AccessList {...props} />)
    expect(container()).not.toHaveClass('border')
    unmount()

    render(<AccessList {...props} bordered />)
    expect(container()).toHaveClass('border')
  })
})
