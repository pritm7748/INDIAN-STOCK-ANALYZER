// src/components/layout/Sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { useWatchlists } from '@/lib/hooks/useWatchlists'
import {
  TrendingUp,
  LayoutDashboard,
  Bell,
  Search,
  Bookmark,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  LogOut,
  Crosshair,
  ChevronDown,
  Loader2,
  Sparkles,
  FlaskConical
} from 'lucide-react'

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const { isAuthenticated, fullName, email, signOut, avatarUrl } = useUser()
  const { watchlists, isLoading: watchlistsLoading, createWatchlist } = useWatchlists()

  const [watchlistsExpanded, setWatchlistsExpanded] = useState(true)
  const [showNewWatchlistInput, setShowNewWatchlistInput] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Navigation items with gradients
  const mainNavItems = [
    {
      name: 'Analyze',
      href: '/dashboard',
      icon: LayoutDashboard,
      description: 'Stock analyzer',
      gradient: 'from-blue-500 to-cyan-500',
      activeGlow: 'shadow-blue-500/30'
    },
    {
      name: 'Backtest',
      href: '/dashboard/backtest',
      icon: FlaskConical,
      description: 'Strategy tester',
      gradient: 'from-violet-500 to-fuchsia-500',
      activeGlow: 'shadow-violet-500/30'
    },
    {
      name: 'Screener',
      href: '/dashboard/screener',
      icon: Search,
      description: 'Find stocks',
      gradient: 'from-purple-500 to-pink-500',
      activeGlow: 'shadow-purple-500/30'
    },
    {
      name: 'Alerts',
      href: '/dashboard/alerts',
      icon: Bell,
      description: 'Price alerts',
      gradient: 'from-amber-500 to-orange-500',
      activeGlow: 'shadow-amber-500/30'
    },
    {
      name: 'Signals',
      href: '/dashboard/signals',
      icon: Crosshair,
      description: 'Trade signals',
      gradient: 'from-emerald-500 to-teal-500',
      activeGlow: 'shadow-emerald-500/30'
    },
  ]

  const bottomNavItems = [
    {
      name: 'Portfolio',
      href: 'https://portfolio-os-snowy.vercel.app/',
      icon: ExternalLink,
      external: true,
      description: 'Track holdings'
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      external: false,
      description: 'Preferences'
    },
  ]

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return

    setIsCreating(true)
    try {
      await createWatchlist(newWatchlistName.trim())
      setNewWatchlistName('')
      setShowNewWatchlistInput(false)
    } catch (error) {
      console.error('Failed to create watchlist:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-[var(--card)]/95 backdrop-blur-xl border-r border-[var(--border)] transition-all duration-300 flex flex-col ${isCollapsed ? 'w-[70px]' : 'w-[260px]'
        }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-xl shrink-0 shadow-lg group-hover:shadow-blue-500/30 transition-all duration-300">
              <TrendingUp size={20} className="text-white" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden flex items-center gap-1.5">
              <span className="text-lg font-bold text-[var(--foreground)] whitespace-nowrap">TradeSense</span>
              <span className="text-lg font-bold text-gradient whitespace-nowrap">AI</span>
              <Sparkles size={12} className="text-yellow-400 animate-pulse" />
            </div>
          )}
        </Link>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-200 group"
        >
          {isCollapsed ? (
            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          ) : (
            <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
        {/* Main Nav Items */}
        {mainNavItems.map((item, idx) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative ${active
                ? `bg-gradient-to-r ${item.gradient} bg-opacity-10 text-[var(--foreground)] shadow-lg ${item.activeGlow}`
                : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-[var(--foreground)]'
                }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className={`p-1.5 rounded-lg transition-all ${active ? 'bg-white/20' : 'group-hover:bg-white/5'}`}>
                <item.icon size={18} className="shrink-0" />
              </div>
              {!isCollapsed && (
                <span className="font-medium">{item.name}</span>
              )}

              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r-full" />
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-all duration-200 shadow-xl translate-x-2 group-hover:translate-x-0">
                  {item.name}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--card)] border-l border-b border-[var(--border)] rotate-45" />
                </div>
              )}
            </Link>
          )
        })}

        {/* Watchlists Section */}
        {!isCollapsed && isAuthenticated && (
          <div className="pt-4">
            <button
              onClick={() => setWatchlistsExpanded(!watchlistsExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider hover:text-[var(--foreground)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Bookmark size={14} />
                Watchlists
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-300 ${watchlistsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {watchlistsExpanded && (
              <div className="mt-1 space-y-1">
                {watchlistsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-gray-500" />
                  </div>
                ) : watchlists.length > 0 ? (
                  watchlists.map((watchlist) => (
                    <Link
                      key={watchlist.id}
                      href={`/dashboard/watchlist/${watchlist.id}`}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${pathname === `/dashboard/watchlist/${watchlist.id}`
                        ? 'bg-[var(--background-secondary)] text-[var(--foreground)]'
                        : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-lg"
                        style={{
                          backgroundColor: watchlist.color,
                          boxShadow: `0 0 8px ${watchlist.color}40`
                        }}
                      />
                      <span className="truncate text-sm">{watchlist.name}</span>
                      {watchlist.is_default && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-[var(--background-secondary)] rounded text-[var(--foreground-muted)]">Default</span>
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-[var(--foreground-muted)] italic">No watchlists yet</p>
                )}

                {/* New Watchlist Input */}
                {showNewWatchlistInput ? (
                  <div className="px-3 py-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newWatchlistName}
                        onChange={(e) => setNewWatchlistName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateWatchlist()
                          if (e.key === 'Escape') {
                            setShowNewWatchlistInput(false)
                            setNewWatchlistName('')
                          }
                        }}
                        placeholder="Watchlist name"
                        autoFocus
                        className="flex-1 px-3 py-1.5 text-sm bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                      <button
                        onClick={handleCreateWatchlist}
                        disabled={isCreating || !newWatchlistName.trim()}
                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isCreating ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewWatchlistInput(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors group"
                  >
                    <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                    <span>New Watchlist</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed state watchlist icon */}
        {isCollapsed && isAuthenticated && (
          <Link
            href="/dashboard/watchlist"
            className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 group relative ${pathname.includes('/watchlist')
              ? 'bg-[var(--background-secondary)] text-[var(--foreground)]'
              : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-[var(--foreground)]'
              }`}
          >
            <Bookmark size={20} />
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0 transition-all duration-200">
              Watchlists
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--card)] border-l border-b border-[var(--border)] rotate-45" />
            </div>
          </Link>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-[var(--border)] py-4 px-3 space-y-1.5">
        {bottomNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive(item.href)
              ? 'bg-[var(--background-secondary)] text-[var(--foreground)]'
              : 'text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] hover:text-[var(--foreground)]'
              }`}
          >
            <item.icon size={18} className="shrink-0" />
            {!isCollapsed && (
              <span className="font-medium text-sm">{item.name}</span>
            )}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0 transition-all duration-200">
                {item.name}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--card)] border-l border-b border-[var(--border)] rotate-45" />
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* User Section */}
      {isAuthenticated && (
        <div className="border-t border-[var(--border)] p-3">
          <div className={`flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--background-secondary)] transition-all duration-200 group ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-medium text-sm shrink-0 overflow-hidden shadow-lg group-hover:shadow-blue-500/30 transition-shadow">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--card)]" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {fullName || 'User'}
                </p>
                <p className="text-xs text-[var(--foreground-muted)] truncate">{email}</p>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--foreground-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition-all duration-200"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}