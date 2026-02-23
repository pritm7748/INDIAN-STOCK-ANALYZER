// src/components/theme/ThemeToggle.tsx

'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme()
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const themes = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Monitor },
    ] as const

    const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                className="p-2 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)] border border-[var(--border)] transition-all duration-200"
                aria-label="Toggle theme"
            >
                <CurrentIcon size={18} className="text-[var(--foreground-secondary)]" />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-lg overflow-hidden z-50 animate-fade-in">
                    {themes.map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            onClick={() => {
                                setTheme(value)
                                setOpen(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${theme === value
                                    ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--card-hover)]'
                                }`}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
