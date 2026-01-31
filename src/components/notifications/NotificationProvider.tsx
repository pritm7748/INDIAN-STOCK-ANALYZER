// src/components/notifications/NotificationProvider.tsx

'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { X, Bell, CheckCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react'

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'alert'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  symbol?: string
  duration?: number
  action?: {
    label: string
    href: string
  }
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Notification[]>([]) // Temporary toasts
  const [persistent, setPersistent] = useState<Notification[]>([]) // For bell dropdown
  const { userId, isAuthenticated } = useUser()
  const supabase = createClient()

  // Subscribe to new alert history (realtime)
  useEffect(() => {
    if (!isAuthenticated || !userId) return

    const channel = supabase
      .channel('alert_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_history',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const alert = payload.new as any
          const notification: Omit<Notification, 'id'> = {
            type: 'alert',
            title: 'Alert Triggered! 🔔',
            message: alert.message || `${alert.symbol.replace('.NS', '')} condition met`,
            symbol: alert.symbol,
            duration: 10000,
            action: {
              label: 'View',
              href: `/dashboard?symbol=${alert.symbol}`
            }
          }
          addNotification(notification)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAuthenticated, userId])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    const newNotification = { ...notification, id }

    // Add to toasts
    setToasts(prev => [newNotification, ...prev].slice(0, 5))

    // Add to persistent (for bell)
    setPersistent(prev => [newNotification, ...prev].slice(0, 20))

    // Try browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: id,
        })
      } catch (e) {
        // Ignore - not all browsers support this
      }
    }

    // Auto-remove toast
    const duration = notification.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(n => n.id !== id))
      }, duration)
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id))
    setPersistent(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
    setPersistent([])
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications: persistent,
      unreadCount: persistent.length,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-20 right-4 z-100 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

function Toast({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const colors: Record<NotificationType, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10',
    error: 'border-rose-500/30 bg-rose-500/10',
    warning: 'border-yellow-500/30 bg-yellow-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
    alert: 'border-purple-500/30 bg-purple-500/10',
  }

  const icons: Record<NotificationType, any> = {
    success: CheckCircle,
    error: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
    alert: TrendingUp,
  }

  const iconColors: Record<NotificationType, string> = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
    alert: 'text-purple-400',
  }

  const Icon = icons[notification.type]

  return (
    <div className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300 ${colors[notification.type]}`}>
      <Icon size={20} className={`${iconColors[notification.type]} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>
        )}
        {notification.action && (
          <a
            href={notification.action.href}
            className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            {notification.action.label} →
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-white transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}