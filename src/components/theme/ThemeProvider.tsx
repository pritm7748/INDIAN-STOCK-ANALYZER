// src/components/theme/ThemeProvider.tsx

'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system')
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')
    const [mounted, setMounted] = useState(false)

    // Get system preference
    const getSystemTheme = (): 'light' | 'dark' => {
        if (typeof window === 'undefined') return 'dark'
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    // Apply theme to document
    const applyTheme = (resolved: 'light' | 'dark') => {
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(resolved)
        setResolvedTheme(resolved)
    }

    // Initialize theme
    useEffect(() => {
        const stored = localStorage.getItem('theme') as Theme | null
        const initialTheme = stored || 'system'
        setThemeState(initialTheme)

        const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme
        applyTheme(resolved)
        setMounted(true)
    }, [])

    // Handle theme changes
    useEffect(() => {
        if (!mounted) return

        localStorage.setItem('theme', theme)
        const resolved = theme === 'system' ? getSystemTheme() : theme
        applyTheme(resolved)
    }, [theme, mounted])

    // Listen for system theme changes
    useEffect(() => {
        if (!mounted || theme !== 'system') return

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            applyTheme(getSystemTheme())
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme, mounted])

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
    }

    // Prevent flash of wrong theme
    if (!mounted) {
        return (
            <div style={{ visibility: 'hidden' }}>
                {children}
            </div>
        )
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
