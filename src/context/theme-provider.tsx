// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react'
import {
  type ColorTheme,
  getShellInitData,
  isFetchingValue,
  isInShell,
  isThemeFontSize,
  isThemeProperty,
  onShellMessage,
} from '../lib/shell-bridge'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

type ThemeProviderProps = {
  children: React.ReactNode
}

type ThemeProviderState = {
  defaultTheme: Theme
  resolvedTheme: ResolvedTheme
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
  colorTheme: ColorTheme | null
  setColorTheme: (theme: ColorTheme | null) => void
}

const initialState: ThemeProviderState = {
  defaultTheme: 'system',
  resolvedTheme: 'light',
  theme: 'system',
  setTheme: () => null,
  resetTheme: () => null,
  colorTheme: null,
  setColorTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

function getInitialTheme(): Theme {
  // In the shell iframe, use the theme from the init message
  const shellData = getShellInitData()
  if (shellData?.theme) {
    return shellData.theme as Theme
  }
  // The server states the preference when it is "follow the system", because
  // the class it renders alongside is only what that resolved to at load. Read
  // it first: a page served while the OS was dark carries class="dark", and
  // taking that as the preference freezes it there — the change listener below
  // is gated on 'system', so it would never fire again and the page would stop
  // following the system until a reload.
  if (document.documentElement.dataset.appearance === 'auto') return 'system'
  // Respect server-rendered class (shell page sets class="dark" before JS loads)
  if (document.documentElement.classList.contains('dark')) return 'dark'
  if (document.documentElement.classList.contains('light')) return 'light'
  // Unauthenticated / non-shell: use system preference
  return 'system'
}

function getInitialColorTheme(): ColorTheme | null {
  const shellData = getShellInitData()
  if (shellData?.colorTheme) {
    return shellData.colorTheme
  }
  // Read from server-injected inline style (for non-shell / shell page itself)
  const root = document.documentElement
  const hue = root.style.getPropertyValue('--hue')
  // Collect non-anchor overrides (e.g. --radius from border_radius pref)
  const overrides: Record<string, string> = {}
  for (let i = 0; i < root.style.length; i++) {
    const prop = root.style[i]
    if (prop.startsWith('--') && prop !== '--hue' && prop !== '--hue-chroma' && prop !== '--hue-bg') {
      overrides[prop] = root.style.getPropertyValue(prop).trim()
    }
  }
  const hasOverrides = Object.keys(overrides).length > 0
  if (hue) {
    return {
      hue: hue.trim(),
      chroma: (root.style.getPropertyValue('--hue-chroma') || '').trim(),
      hueBg: (root.style.getPropertyValue('--hue-bg') || '').trim(),
      ...(hasOverrides && { overrides }),
    }
  }
  if (hasOverrides) {
    // No color theme, but has CSS var overrides (e.g. border_radius) — preserve them
    return { hue: '', chroma: '', hueBg: '', overrides }
  }
  return null
}

// What a theme may install is decided by isThemeProperty / isFetchingValue /
// isThemeFontSize in shell-bridge — a theme reaches this provider from an
// untrusted app via the shell's relay, never only from the validated manifest.

// Inline properties this provider has installed on <html>, so cleanup removes
// exactly what the theme system owns and nothing else (authenticated-layout's
// --sheet-top-offset must survive a theme switch). Seeded at module evaluation
// — before any effect can add unrelated properties — with the server-rendered
// theme variables, which the provider replaces from state on first apply.
const installedProperties = new Set<string>()
{
  const style = document.documentElement.style
  for (let i = 0; i < style.length; i++) {
    if (style[i].startsWith('--')) installedProperties.add(style[i])
  }
}

function applyColorThemeToDOM(ct: ColorTheme | null) {
  const root = document.documentElement
  for (const prop of installedProperties) {
    root.style.removeProperty(prop)
  }
  installedProperties.clear()
  const install = (key: string, val: string) => {
    root.style.setProperty(key, val)
    installedProperties.add(key)
  }
  if (ct) {
    // The hue triple arrives over postMessage from an app we do not trust -
    // the shell relays whatever any app sends to every other app's iframe - so
    // it gets the same guard as the overrides below rather than being install-
    // on-sight. These three substitute into oklch(), where a fetching value
    // makes the declaration invalid rather than beaconing, but validating both
    // paths the same way is what makes that reasoning checkable.
    if (ct.hue && !isFetchingValue(ct.hue) && !isFetchingValue(ct.chroma) && !isFetchingValue(ct.hueBg)) {
      install('--hue', ct.hue)
      install('--hue-chroma', ct.chroma)
      install('--hue-bg', ct.hueBg)
    }
    if (ct.overrides) {
      for (const [key, val] of Object.entries(ct.overrides)) {
        if (isFetchingValue(val)) continue
        if (key === 'font-size') {
          if (isThemeFontSize(val)) install(key, val)
          continue
        }
        if (!isThemeProperty(key)) continue
        install(key, val)
      }
    }
  }
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(getInitialTheme)
  const [colorTheme, _setColorTheme] = useState<ColorTheme | null>(
    getInitialColorTheme
  )

  // Optimized: Memoize the resolved theme calculation to prevent unnecessary re-computations
  const resolvedTheme = useMemo((): ResolvedTheme => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme as ResolvedTheme
  }, [theme])

  // Apply appearance (light/dark)
  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (currentResolvedTheme: ResolvedTheme) => {
      root.classList.remove('light', 'dark')
      root.classList.add(currentResolvedTheme)
    }

    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        applyTheme(systemTheme)
      }
    }

    applyTheme(resolvedTheme)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, resolvedTheme])

  // Apply color theme
  useEffect(() => {
    applyColorThemeToDOM(colorTheme)
  }, [colorTheme])

  // Listen for shell messages
  useEffect(() => {
    const syncShellInitData = () => {
      const shellData = getShellInitData()
      if (!shellData) return

      if (typeof shellData.theme === 'string') {
        _setTheme(shellData.theme as Theme)
      }
      if ('colorTheme' in shellData) {
        _setColorTheme(shellData.colorTheme || null)
      }
    }

    syncShellInitData()

    const unsubShell = onShellMessage((msg) => {
      // Appearance messages
      if (
        (msg.type === 'init' ||
          msg.type === 'theme-change' ||
          msg.type === 'theme-set') &&
        typeof msg.theme === 'string'
      ) {
        _setTheme(msg.theme as Theme)
      }
      // Color theme messages
      if (msg.type === 'init' && 'colorTheme' in msg) {
        _setColorTheme((msg.colorTheme as ColorTheme) || null)
      }
      if (msg.type === 'color-theme-change') {
        _setColorTheme((msg.colorTheme as ColorTheme) || null)
      }
    })
    return () => unsubShell()
  }, [])

  const setTheme = useCallback((theme: Theme) => {
    _setTheme(theme)
    if (isInShell()) {
      window.parent.postMessage({ type: 'theme-set', theme }, '*')
    }
  }, [])

  const setColorTheme = useCallback((ct: ColorTheme | null) => {
    _setColorTheme(ct)
    if (isInShell()) {
      window.parent.postMessage(
        { type: 'color-theme-set', colorTheme: ct },
        '*'
      )
    }
  }, [])

  const contextValue = {
    defaultTheme: 'system' as Theme,
    resolvedTheme,
    theme,
    setTheme,
    resetTheme: () => setTheme('system'),
    colorTheme,
    setColorTheme,
  }

  return (
    <ThemeContext value={contextValue} {...props}>
      {children}
    </ThemeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
