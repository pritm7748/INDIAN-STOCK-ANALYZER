// src/components/layout/MobileNav.tsx
'use client'

import { useEffect } from 'react'
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
  X,
  ExternalLink,
  LogOut,
  Loader2,
  ChevronRight,
  Crosshair,
  FlaskConical
} from 'lucide-react'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const { isAuthenticated, fullName, email, signOut, avatarUrl } = useUser()
  const { watchlists, isLoading: watchlistsLoading } = useWatchlists()

  // Close on route change
  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const navItems: { name: string; href: string; icon: any; badge?: string }[] = [
    { name: 'Analyze', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Backtest', href: '/dashboard/backtest', icon: FlaskConical },
    { name: 'Screener', href: '/dashboard/screener', icon: Search },
    { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
    { name: 'Signals', href: '/dashboard/signals', icon: Crosshair },
  ]

  const bottomItems = [
    { name: 'Portfolio', href: 'https://your-portfolio-app.vercel.app', icon: ExternalLink, external: true },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--background)] border-r border-[var(--border)] lg:hidden animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)]">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-lg font-bold text-[var(--foreground)]">TradeSense</span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--card-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {/* Main Nav */}
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${isActive(item.href)
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'text-[var(--foreground-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]'
                  }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-[var(--card)] text-[var(--foreground-muted)] rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Watchlists */}
          {isAuthenticated && (
            <div className="mt-6">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                  Watchlists
                </span>
              </div>

              {watchlistsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-gray-500" />
                </div>
              ) : watchlists.length > 0 ? (
                <div className="space-y-1">
                  {watchlists.map((watchlist) => (
                    <Link
                      key={watchlist.id}
                      href={`/dashboard/watchlist/${watchlist.id}`}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${pathname === `/dashboard/watchlist/${watchlist.id}`
                        ? 'bg-blue-600/10 text-blue-400'
                        : 'text-[var(--foreground-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]'
                        }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: watchlist.color }}
                      />
                      <span className="truncate">{watchlist.name}</span>
                      <ChevronRight size={16} className="ml-auto text-gray-600" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm text-[var(--foreground-muted)] italic">No watchlists yet</p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="my-4 border-t border-[var(--border)]" />

          {/* Bottom Nav */}
          <div className="space-y-1">
            {bottomItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                onClick={!item.external ? onClose : undefined}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-[var(--foreground-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] transition-all"
              >
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
                {item.external && (
                  <ChevronRight size={16} className="ml-auto text-gray-600" />
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* User Section */}
        {isAuthenticated && (
          <div className="border-t border-[var(--border)] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--foreground)] truncate">{fullName || 'User'}</p>
                <p className="text-sm text-[var(--foreground-muted)] truncate">{email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                signOut()
                onClose()
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] rounded-xl transition-colors"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        )}

        {/* Login Button for non-authenticated users */}
        {!isAuthenticated && (
          <div className="border-t border-[var(--border)] p-4">
            <Link
              href="/login"
              onClick={onClose}
              className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl text-center"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </>
  )
}