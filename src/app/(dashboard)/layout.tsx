// src/app/(dashboard)/layout.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { useUser } from '@/lib/hooks/useUser'
import { useAlertChecker } from '@/lib/hooks/useAlertChecker'
import { useNotifications } from '@/components/notifications/NotificationProvider'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { isLoading, isAuthenticated } = useUser()
  const { addNotification } = useNotifications()
  const router = useRouter()

  // Start alert checker when dashboard loads
  const { lastResult, marketOpen } = useAlertChecker({
    enabled: isAuthenticated,
    intervalMs: 5 * 60 * 1000, // Check every 5 minutes
    onTriggered: (results) => {
      results.forEach((result) => {
        addNotification({
          type: 'alert',
          title: 'Alert Triggered! 🔔',
          message: result.message,
          symbol: result.symbol,
          duration: 10000,
          action: {
            label: 'Analyze',
            href: `/dashboard?symbol=${result.symbol}`
          }
        })
      })
    }
  })

  // Load sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved) {
      setSidebarCollapsed(JSON.parse(saved))
    }
  }, [])

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-blue-500" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          isCollapsed={sidebarCollapsed} 
          setIsCollapsed={setSidebarCollapsed}
        />
      </div>

      {/* Mobile Navigation */}
      <MobileNav 
        isOpen={mobileNavOpen} 
        onClose={() => setMobileNavOpen(false)} 
      />

      {/* Header */}
      <Header 
        onMenuClick={() => setMobileNavOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <main 
        className={`pt-16 min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-17.5' : 'lg:pl-65'
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Market Status Indicator (optional) */}
      {!marketOpen && (
        <div className="fixed bottom-4 right-4 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-xs text-yellow-400">
          Market Closed
        </div>
      )}
    </div>
  )
}