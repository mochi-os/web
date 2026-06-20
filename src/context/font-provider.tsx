// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useEffect, useState } from 'react'

const FONT_STORAGE_KEY = 'font'

type FontContextType = {
  font: string
  setFont: (font: string) => void
  resetFont: () => void
}

const FontContext = createContext<FontContextType | null>(null)

type FontProviderProps = {
  children: React.ReactNode
  fonts: readonly string[]
  defaultFont?: string
}

export function FontProvider({
  children,
  fonts,
  defaultFont,
}: FontProviderProps) {
  const fallbackFont = defaultFont ?? fonts[0]

  const [font, _setFont] = useState<string>(() => {
    const savedFont = localStorage.getItem(FONT_STORAGE_KEY)
    return fonts.includes(savedFont as string) ? savedFont! : fallbackFont
  })

  useEffect(() => {
    const applyFont = (font: string) => {
      const root = document.documentElement
      root.classList.forEach((cls) => {
        if (cls.startsWith('font-')) root.classList.remove(cls)
      })
      root.classList.add(`font-${font}`)
    }

    applyFont(font)
  }, [font])

  const setFont = (font: string) => {
    localStorage.setItem(FONT_STORAGE_KEY, font)
    _setFont(font)
  }

  const resetFont = () => {
    localStorage.removeItem(FONT_STORAGE_KEY)
    _setFont(fallbackFont)
  }

  return (
    <FontContext value={{ font, setFont, resetFont }}>{children}</FontContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFont() {
  const context = useContext(FontContext)
  if (!context) {
    throw new Error('useFont must be used within a FontProvider')
  }
  return context
}
