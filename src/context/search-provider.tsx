// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useEffect, useRef, useState } from 'react'

type SearchContextType = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  setShortcutEnabled: (enabled: boolean) => void
}

const SearchContext = createContext<SearchContextType | null>(null)

type SearchProviderProps = {
  children: React.ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [open, setOpen] = useState(false)
  const shortcutEnabled = useRef(true)

  const setShortcutEnabled = (enabled: boolean) => {
    shortcutEnabled.current = enabled
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && shortcutEnabled.current) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <SearchContext value={{ open, setOpen, setShortcutEnabled }}>
      {children}
    </SearchContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSearch = () => {
  const searchContext = useContext(SearchContext)

  if (!searchContext) {
    throw new Error('useSearch has to be used within SearchProvider')
  }

  return searchContext
}
