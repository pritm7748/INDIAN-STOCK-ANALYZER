// src/components/layout/Sidebar.tsx
'use client'

import { useState, useEffect } from 'react'
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
  HelpCircle, 
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
  LogOut,
  ChevronDown,
  Loader2
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

  // Navigation items
  const mainNavItems = [
    { 
      name: 'Analyze', 
      href: '/dashboard', 
      icon: LayoutDashboard,
      description: 'Stock analyzer'
    },
    { 
      name: 'Screener', 
      href: '/dashboard/screener', 
      icon: Search,
      description: 'Find stocks',
      badge: 'Soon'
    },
    { 
      name: 'Alerts', 
      href: '/dashboard/alerts', 
      icon: Bell,
      description: 'Price alerts',
      badge: 'Soon'
    },
  ]

  const bottomNavItems = [
    { 
      name: 'Portfolio', 
      href: 'https://your-portfolio-app.vercel.app', // Replace with your portfolio app URL
      icon: ExternalLink,
      external: true,
      description: 'Track holdings'
    },
    { 
      name: 'Settings', 
      href: '/dashboard/settings', 
      icon: Settings,
      description: 'Preferences'
    },
    { 
      name: 'Help', 
      href: '/dashboard/help', 
      icon: HelpCircle,
      description: 'Documentation'
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
      className={`fixed left-0 top-0 z-40 h-screen bg-[#0A0A0A] border-r border-white/5 transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-[70px]' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl shrink-0">
            <TrendingUp size={20} className="text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <span className="text-lg font-bold text-white whitespace-nowrap">TradeSense</span>
            </div>
          )}
        </Link>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Main Nav Items */}
        {mainNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
              isActive(item.href)
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon size={20} className="shrink-0" />
            {!isCollapsed && (
              <>
                <span className="font-medium">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-white/10 text-gray-400 rounded">
                    {item.badge}
                  </span>
                )}
              </>
            )}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {item.name}
                {item.badge && <span className="ml-2 text-gray-400">({item.badge})</span>}
              </div>
            )}
          </Link>
        ))}

        {/* Watchlists Section */}
        {!isCollapsed && isAuthenticated && (
          <div className="pt-4">
            <button
              onClick={() => setWatchlistsExpanded(!watchlistsExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Bookmark size={14} />
                Watchlists
              </span>
              <ChevronDown 
                size={14} 
                className={`transition-transform ${watchlistsExpanded ? 'rotate-180' : ''}`}
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all group ${
                        pathname === `/dashboard/watchlist/${watchlist.id}`
                          ? 'bg-blue-600/10 text-blue-400'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div 
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: watchlist.color }}
                      />
                      <span className="truncate text-sm">{watchlist.name}</span>
                      {watchlist.is_default && (
                        <span className="ml-auto text-[10px] text-gray-500">Default</span>
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500 italic">No watchlists yet</p>
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
                        className="flex-1 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleCreateWatchlist}
                        disabled={isCreating || !newWatchlistName.trim()}
                        className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {isCreating ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewWatchlistInput(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Plus size={14} />
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
            className={`flex items-center justify-center p-2.5 rounded-xl transition-all group relative ${
              pathname.includes('/watchlist')
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Bookmark size={20} />
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              Watchlists
            </div>
          </Link>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-white/5 py-4 px-3 space-y-1">
        {bottomNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
              isActive(item.href)
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon size={20} className="shrink-0" />
            {!isCollapsed && (
              <span className="font-medium">{item.name}</span>
            )}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                {item.name}
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* User Section */}
      {isAuthenticated && (
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {fullName || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{email}</p>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
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