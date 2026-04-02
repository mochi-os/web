import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { getShellInitData, isInShell, onShellMessage } from '../lib/shell-bridge'

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
}

const initialState: ThemeProviderState = {
  defaultTheme: 'system',
  resolvedTheme: 'light',
  theme: 'system',
  setTheme: () => null,
  resetTheme: () => null,
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
  // Unauthenticated / non-shell: use system preference
  return 'system'
}

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(getInitialTheme)

  // Optimized: Memoize the resolved theme calculation to prevent unnecessary re-computations
  const resolvedTheme = useMemo((): ResolvedTheme => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme as ResolvedTheme
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (currentResolvedTheme: ResolvedTheme) => {
      root.classList.remove('light', 'dark') // Remove existing theme classes
      root.classList.add(currentResolvedTheme) // Add the new theme class
    }

    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        applyTheme(systemTheme)
      }
    }

    applyTheme(resolvedTheme)

    mediaQuery.addEventListener('change', handleChange)

    // Listen for theme messages:
    // - init/theme-change: from shell to iframe apps
    // - theme-set: from iframe apps to shell (menu picks this up too)
    const unsubShell = onShellMessage((msg) => {
      if ((msg.type === 'init' || msg.type === 'theme-change' || msg.type === 'theme-set') && typeof msg.theme === 'string') {
        _setTheme(msg.theme as Theme)
      }
    })

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      unsubShell()
    }
  }, [theme, resolvedTheme])

  const setTheme = (theme: Theme) => {
    _setTheme(theme)
    // Notify the shell so it can update its own class and sync to other frames
    if (isInShell()) {
      window.parent.postMessage({ type: 'theme-set', theme }, '*')
    }
  }

  const contextValue = {
    defaultTheme: 'system' as Theme,
    resolvedTheme,
    theme,
    setTheme,
    resetTheme: () => setTheme('system'),
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
