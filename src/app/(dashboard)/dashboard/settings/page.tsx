// src/app/(dashboard)/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { Json } from '@/lib/supabase/types'
import { getCacheStats, clearAllCache, formatAge, formatBytes } from '@/lib/cache'
import { TelegramConnect } from '@/components/settings/TelegramConnect'
import {
  User,
  Bell,
  Save,
  Loader2,
  Check,
  Shield,
  Smartphone,
  Mail,
  MessageCircle,
  Globe,
  AlertTriangle,
  Trash2,
  Database,
  Settings,
  Zap
} from 'lucide-react'

// ============================================================
// TOGGLE COMPONENT - Premium styling
// ============================================================

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full 
        border-2 border-transparent transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30' : 'bg-gray-700'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6 transform rounded-full 
          bg-white shadow-lg ring-0 transition-all duration-300 ease-in-out
          ${checked ? 'translate-x-5 scale-110' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

// ============================================================
// SECTION CARD COMPONENT
// ============================================================

function SectionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  children,
  delay = 0
}: {
  icon: any
  iconColor: string
  title: string
  description: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <div
      className="glass-card p-6 hover:shadow-xl transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 ${iconColor} rounded-xl shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ============================================================
// NOTIFICATION PREFERENCES TYPE
// ============================================================

interface NotificationPreferences {
  in_app: boolean
  browser_push: boolean
  telegram: boolean
  email: boolean
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  in_app: true,
  browser_push: true,
  telegram: false,
  email: false,
}

// ============================================================
// MAIN SETTINGS PAGE
// ============================================================

export default function SettingsPage() {
  const { profile, refreshProfile, fullName, email } = useUser()
  const supabase = createClient()

  // Form State
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Profile Fields
  const [formData, setFormData] = useState({
    full_name: '',
    telegram_username: '',
  })

  // Notification Preferences
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  // Cache state
  const [cacheStats, setCacheStats] = useState<{
    count: number
    totalSize: number
    entries: Array<{ symbol: string; timeframe: string; age: number; isStale: boolean }>
  } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)

  // Load cache stats on mount
  useEffect(() => {
    setCacheStats(getCacheStats())
  }, [])

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || fullName || '',
        telegram_username: profile.telegram_username || '',
      })

      // Parse notification preferences from profile
      const prefs = profile.notification_preferences as NotificationPreferences | null
      if (prefs) {
        setNotifications({
          in_app: prefs.in_app ?? DEFAULT_PREFERENCES.in_app,
          browser_push: prefs.browser_push ?? DEFAULT_PREFERENCES.browser_push,
          telegram: prefs.telegram ?? DEFAULT_PREFERENCES.telegram,
          email: prefs.email ?? DEFAULT_PREFERENCES.email,
        })
      }
    }
  }, [profile, fullName])

  // Handle notification toggle
  const handleNotificationChange = (key: keyof NotificationPreferences, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value,
    }))
    setSaved(false)
  }

  // Handle text field change
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
    setSaved(false)
  }

  // Save all settings
  const handleSave = async () => {
    if (!profile?.id) return

    setIsLoading(true)
    setSaved(false)
    setError(null)

    try {
      // Validate telegram username if telegram notifications are enabled
      if (notifications.telegram && !formData.telegram_username.trim()) {
        setError('Please enter your Telegram username to enable Telegram notifications')
        setIsLoading(false)
        return
      }

      const updateData = {
        full_name: formData.full_name.trim(),
        telegram_username: formData.telegram_username.trim(),
        notification_preferences: notifications as unknown as Json,
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (updateError) throw updateError

      await refreshProfile()
      setSaved(true)

      // Reset saved message after 3 seconds
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      setError(err.message || 'Failed to save settings. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Request browser push permission
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported in this browser')
      return
    }

    const permission = await Notification.requestPermission()

    if (permission === 'granted') {
      handleNotificationChange('browser_push', true)
    } else if (permission === 'denied') {
      alert('Push notifications were denied. Please enable them in your browser settings.')
      handleNotificationChange('browser_push', false)
    }
  }

  // Check if form has unsaved changes
  const hasChanges = () => {
    if (!profile) return false

    const prefs = profile.notification_preferences as NotificationPreferences | null
    const profilePrefs = prefs || DEFAULT_PREFERENCES
    const profileName = profile.full_name || fullName || ''
    const profileTelegram = profile.telegram_username || ''

    return (
      formData.full_name !== profileName ||
      formData.telegram_username !== profileTelegram ||
      notifications.in_app !== (profilePrefs.in_app ?? true) ||
      notifications.browser_push !== (profilePrefs.browser_push ?? true) ||
      notifications.telegram !== (profilePrefs.telegram ?? false) ||
      notifications.email !== (profilePrefs.email ?? false)
    )
  }

  // Handle clear cache
  const handleClearCache = async () => {
    setClearingCache(true)
    await new Promise(r => setTimeout(r, 500))
    const cleared = clearAllCache()
    setCacheStats({ count: 0, entries: [], totalSize: 0 })
    setClearingCache(false)
    alert(`Cleared ${cleared} cached analyses`)
  }

  return (
    <div className="max-w-2xl space-y-6 pb-8">
      {/* Header */}
      <div className="animate-fade-in-down">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 animate-scale-in backdrop-blur-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Profile Section */}
      <SectionCard
        icon={User}
        iconColor="bg-gradient-to-br from-blue-500 to-cyan-500"
        title="Profile"
        description="Your personal information"
        delay={0.1}
      >
        <div className="space-y-4">
          {/* Full Name */}
          <div className="group">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => handleFieldChange('full_name', e.target.value)}
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20"
              placeholder="Your name"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email || ''}
                disabled
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-gray-500 cursor-not-allowed"
              />
              <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            </div>
            <p className="mt-1.5 text-xs text-gray-600 flex items-center gap-1">
              <Shield size={10} /> Email cannot be changed for security reasons
            </p>
          </div>

          {/* Telegram Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Telegram Username
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors">@</span>
              <input
                type="text"
                value={formData.telegram_username}
                onChange={(e) => handleFieldChange('telegram_username', e.target.value.replace('@', ''))}
                className="w-full pl-8 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20"
                placeholder="username"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-600">Required for Telegram alerts</p>
          </div>
        </div>
      </SectionCard>

      {/* Notification Preferences */}
      <SectionCard
        icon={Bell}
        iconColor="bg-gradient-to-br from-amber-500 to-orange-500"
        title="Notifications"
        description="How you want to be notified"
        delay={0.2}
      >
        <div className="space-y-3">
          {/* In-App Notifications */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all duration-200 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">In-App Notifications</p>
                <p className="text-sm text-gray-500">Show notifications within the app</p>
              </div>
            </div>
            <Toggle
              checked={notifications.in_app}
              onChange={(checked) => handleNotificationChange('in_app', checked)}
            />
          </div>

          {/* Browser Push */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all duration-200 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                <Smartphone className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white">Browser Push</p>
                <p className="text-sm text-gray-500">Receive push notifications in your browser</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!notifications.browser_push && (
                <button
                  onClick={requestPushPermission}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded-lg hover:bg-blue-500/10"
                >
                  Enable
                </button>
              )}
              <Toggle
                checked={notifications.browser_push}
                onChange={(checked) => {
                  if (checked) {
                    requestPushPermission()
                  } else {
                    handleNotificationChange('browser_push', false)
                  }
                }}
              />
            </div>
          </div>

          {/* Telegram */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all duration-200 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                <MessageCircle className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="font-medium text-white">Telegram</p>
                <p className="text-sm text-gray-500">Get alerts via Telegram bot</p>
                {notifications.telegram && !formData.telegram_username && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <Zap size={10} /> Add your username above
                  </p>
                )}
              </div>
            </div>
            <Toggle
              checked={notifications.telegram}
              onChange={(checked) => handleNotificationChange('telegram', checked)}
            />
          </div>

          {/* Email */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-all duration-200 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                <Mail className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-white">Email</p>
                <p className="text-sm text-gray-500">Receive email notifications</p>
              </div>
            </div>
            <Toggle
              checked={notifications.email}
              onChange={(checked) => handleNotificationChange('email', checked)}
            />
          </div>
        </div>

        {/* Coming Soon Note */}
        <div className="mt-4 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-xs text-amber-400/80 flex items-center gap-2">
            <Zap size={12} className="animate-pulse" />
            Telegram and Email notifications require the Alerts feature to be set up.
          </p>
        </div>
      </SectionCard>

      {/* Telegram Integration */}
      <SectionCard
        icon={MessageCircle}
        iconColor="bg-gradient-to-br from-cyan-500 to-blue-500"
        title="Telegram Bot"
        description="Receive alerts via Telegram"
        delay={0.3}
      >
        <TelegramConnect />
      </SectionCard>

      {/* Cache Management */}
      <SectionCard
        icon={Database}
        iconColor="bg-gradient-to-br from-purple-500 to-pink-500"
        title="Analysis Cache"
        description="Cached analyses for faster loading"
        delay={0.4}
      >
        {cacheStats && cacheStats.count > 0 ? (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
                <p className="text-xs text-gray-500 mb-1">Cached Analyses</p>
                <p className="text-2xl font-bold text-gradient">{cacheStats.count}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
                <p className="text-xs text-gray-500 mb-1">Cache Size</p>
                <p className="text-2xl font-bold text-white">{formatBytes(cacheStats.totalSize)}</p>
              </div>
            </div>

            {/* Cached Items List */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {cacheStats.entries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/[0.07] transition-colors"
                >
                  <div>
                    <span className="font-medium text-white">
                      {entry.symbol.replace('.NS', '')}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({entry.timeframe})
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${entry.isStale ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                    {formatAge(entry.age)}
                  </span>
                </div>
              ))}
            </div>

            {/* Clear Cache Button */}
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-medium rounded-xl transition-all duration-300 disabled:opacity-50 hover:shadow-lg hover:shadow-rose-500/10 group"
            >
              {clearingCache ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
              )}
              Clear All Cache
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database size={32} className="text-purple-400/50" />
            </div>
            <p className="text-gray-500">No cached analyses</p>
            <p className="text-xs text-gray-600 mt-1">
              Analyses are cached for 15 minutes to speed up repeat views
            </p>
          </div>
        )}
      </SectionCard>

      {/* Save Button */}
      <div className="flex items-center justify-between p-4 glass-card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
        {/* Unsaved Changes Indicator */}
        <div>
          {hasChanges() && !saved && (
            <p className="text-sm text-amber-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              You have unsaved changes
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || (!hasChanges() && !saved)}
          className={`
            flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-all duration-300
            ${saved
              ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 shadow-lg shadow-emerald-500/30'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5'
            }
            text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          `}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : saved ? (
            <Check size={18} />
          ) : (
            <Save size={18} />
          )}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}