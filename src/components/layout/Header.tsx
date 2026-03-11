// src/components/layout/Header.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import {
  Menu,
  Bell,
  Search,
  X,
  Command
} from 'lucide-react'

interface HeaderProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

export function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { isAuthenticated } = useUser()
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/dashboard?symbol=${searchQuery.trim().toUpperCase()}`)
      setShowSearch(false)
      setSearchQuery('')
    }
  }

  return (
    <header className={`fixed top-0 right-0 left-0 lg:left-[var(--sidebar-width)] z-30 h-16 bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] transition-all duration-300`}
      style={{ '--sidebar-width': sidebarCollapsed ? '70px' : '260px' } as React.CSSProperties}
    >
      <div className="h-full px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section - Mobile Menu + Search */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
          >
            <Menu size={20} />
          </button>

          {/* Search */}
          {showSearch ? (
            <form onSubmit={handleSearch} className="relative flex-1 max-w-xs sm:max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="Search stock symbol..."
                autoFocus
                className="w-full pl-9 pr-9 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm transition-colors"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]" />
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false)
                  setSearchQuery('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-light)] transition-colors text-sm min-w-0"
            >
              <Search size={16} className="shrink-0" />
              <span className="hidden sm:inline">Search stocks...</span>
              <span className="sm:hidden">Search...</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--background-tertiary)] rounded text-[10px] text-[var(--foreground-muted)]">
                <Command size={10} />K
              </kbd>
            </button>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Alerts */}
          {isAuthenticated && (
            <Link href="/dashboard/alerts" className="relative p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
              <Bell size={20} />
            </Link>
          )}

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}