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
  isInShell,
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
  if (hue) {
    return {
      hue: hue.trim(),
      chroma: (root.style.getPropertyValue('--hue-chroma') || '').trim(),
      hueBg: (root.style.getPropertyValue('--hue-bg') || '').trim(),
    }
  }
  return null
}

function applyColorThemeToDOM(ct: ColorTheme | null) {
  const root = document.documentElement
  // Remove all inline CSS custom properties
  const props: string[] = []
  for (let i = 0; i < root.style.length; i++) {
    if (root.style[i].startsWith('--')) props.push(root.style[i])
  }
  for (const prop of props) {
    root.style.removeProperty(prop)
  }
  if (ct) {
    root.style.setProperty('--hue', ct.hue)
    root.style.setProperty('--hue-chroma', ct.chroma)
    root.style.setProperty('--hue-bg', ct.hueBg)
    if (ct.overrides) {
      for (const [key, val] of Object.entries(ct.overrides)) {
        root.style.setProperty(key, val)
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
