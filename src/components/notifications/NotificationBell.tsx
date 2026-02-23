// src/components/notifications/NotificationBell.tsx

'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useNotifications } from './NotificationProvider'
import {
  Bell,
  X,
  Trash2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Clock
} from 'lucide-react'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { notifications, unreadCount, removeNotification, clearAll } = useNotifications()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-[var(--card-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-blue-400" />
              <span className="font-medium text-[var(--foreground)]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                  {unreadCount}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground-secondary)] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-[var(--card-hover)] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg shrink-0 ${notification.type === 'alert' ? 'bg-purple-500/20 text-purple-400' :
                          notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                            notification.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
                              'bg-blue-500/20 text-blue-400'
                        }`}>
                        {notification.type === 'alert' ? <TrendingUp size={14} /> :
                          notification.type === 'success' ? <CheckCircle size={14} /> :
                            notification.type === 'error' ? <AlertTriangle size={14} /> :
                              <Bell size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)]">{notification.title}</p>
                        {notification.message && (
                          <p className="text-xs text-[var(--foreground-muted)] mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        {notification.action && (
                          <Link
                            href={notification.action.href}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300"
                          >
                            {notification.action.label}
                            <ExternalLink size={10} />
                          </Link>
                        )}
                      </div>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Bell size={32} className="mx-auto mb-3 text-gray-600" />
                <p className="text-[var(--foreground-muted)] text-sm">No notifications</p>
                <p className="text-[var(--foreground-muted)] opacity-60 text-xs mt-1">
                  You'll see triggered alerts here
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--border)]">
            <Link
              href="/dashboard/alerts"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              View all alerts
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}