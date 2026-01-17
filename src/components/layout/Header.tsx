// src/components/layout/Header.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { UserMenu } from './UserMenu'
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
      // Navigate to analyzer with the search query
      router.push(`/dashboard?symbol=${searchQuery.trim().toUpperCase()}`)
      setShowSearch(false)
      setSearchQuery('')
    }
  }

  return (
    <header className={`fixed top-0 right-0 z-30 h-16 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300 ${
      sidebarCollapsed ? 'left-[70px]' : 'left-[260px]'
    } lg:left-[var(--sidebar-width)]`}
    style={{ '--sidebar-width': sidebarCollapsed ? '70px' : '260px' } as React.CSSProperties}
    >
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left Section - Mobile Menu + Search */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Menu size={20} />
          </button>

          {/* Search */}
          {showSearch ? (
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="Search stock symbol..."
                autoFocus
                className="w-64 pl-10 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false)
                  setSearchQuery('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              <Search size={16} />
              <span>Search stocks...</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-400">
                <Command size={10} />K
              </kbd>
            </button>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          {isAuthenticated && (
            <button className="relative p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
              {/* Notification badge */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
            </button>
          )}

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="sm:hidden px-4 pb-3 -mt-1">
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 text-sm"
        >
          <Search size={16} />
          <span>Search stocks...</span>
        </button>
      </div>
    </header>
  )
}