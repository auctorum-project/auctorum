import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type ThemeName = 'dracula' | 'monokai' | 'matrix' | 'nord'

interface ThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dracula',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    return (localStorage.getItem('auctorum-theme') as ThemeName) || 'dracula'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dracula') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    localStorage.setItem('auctorum-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
