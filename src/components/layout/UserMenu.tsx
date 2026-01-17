// src/components/layout/UserMenu.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import { 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  CreditCard,
  Bell,
  Moon,
  HelpCircle
} from 'lucide-react'

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, fullName, email, signOut, avatarUrl } = useUser()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Sign up
        </Link>
      </div>
    )
  }

  const menuItems = [
    { name: 'Profile', href: '/dashboard/settings/account', icon: User },
    { name: 'Notifications', href: '/dashboard/settings/notifications', icon: Bell },
    { name: 'Appearance', href: '/dashboard/settings/appearance', icon: Moon },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    { name: 'Help', href: '/dashboard/help', icon: HelpCircle },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User Info */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  fullName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{fullName || 'User'}</p>
                <p className="text-sm text-gray-500 truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <item.icon size={18} />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Sign Out */}
          <div className="border-t border-white/5 py-2">
            <button
              onClick={() => {
                signOut()
                setIsOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}