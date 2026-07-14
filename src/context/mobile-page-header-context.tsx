// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, type ReactNode } from 'react'

type MobilePageHeaderContextValue = {
  setUsesPageHeaderNavigation: (usesPageHeaderNavigation: boolean) => void
}

const MobilePageHeaderContext =
  createContext<MobilePageHeaderContextValue | null>(null)

export function MobilePageHeaderProvider({
  value,
  children,
}: {
  value: MobilePageHeaderContextValue
  children: ReactNode
}) {
  return (
    <MobilePageHeaderContext.Provider value={value}>
      {children}
    </MobilePageHeaderContext.Provider>
  )
}

export function useMobilePageHeader() {
  return useContext(MobilePageHeaderContext)
}
