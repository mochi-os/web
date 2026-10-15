// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fixture strings only. No lingui macro in this file: every app's
// lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { GameLayout } from './game-layout'
import type { SidebarData } from './types'

// The shell is not what this file is about. Only the groups it is handed are.
const shellProps = vi.fn()
vi.mock('./authenticated-layout', () => ({
  AuthenticatedLayout: (props: { sidebarData: SidebarData }) => {
    shellProps(props)
    return null
  },
}))

const labels = { active: 'Active', completed: 'Completed', newGame: 'New' }

const games = [
  { id: 'a', updated: 3, status: 'active' },
  { id: 's', updated: 2, status: 'scoring' },
  { id: 'f', updated: 1, status: 'finished' },
]

// Group title to the ids listed under it, leaving out the untitled group that
// holds the new-game entry.
function groups(): Record<string, string[]> {
  const { sidebarData } = shellProps.mock.lastCall![0] as {
    sidebarData: SidebarData
  }
  return Object.fromEntries(
    sidebarData.navGroups
      .filter((group) => group.title)
      .map((group) => [group.title, group.items.map((item) => item.title)])
  )
}

describe('GameLayout groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists only status active as live by default', () => {
    render(
      <GameLayout
        games={games}
        gameTitle={(game) => game.id}
        labels={labels}
        onNewGame={() => {}}
      />
    )

    expect(groups()).toEqual({ Active: ['a'], Completed: ['s', 'f'] })
  })

  it('lets the app say which games are still being played', () => {
    render(
      <GameLayout
        games={games}
        gameTitle={(game) => game.id}
        isLive={(game) => game.status !== 'finished'}
        labels={labels}
        onNewGame={() => {}}
      />
    )

    expect(groups()).toEqual({ Active: ['a', 's'], Completed: ['f'] })
  })

  it('leaves out a group that has no games', () => {
    render(
      <GameLayout
        games={games}
        gameTitle={(game) => game.id}
        isLive={() => true}
        labels={labels}
        onNewGame={() => {}}
      />
    )

    expect(groups()).toEqual({ Active: ['a', 's', 'f'] })
  })
})
