// src/app/(dashboard)/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { Json } from '@/lib/supabase/types'
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
  AlertTriangle
} from 'lucide-react'

// ============================================================
// TOGGLE COMPONENT
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
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full 
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? 'bg-blue-600' : 'bg-gray-700'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full 
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
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
    setSaved(false) // Reset saved state when changes are made
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
      notification_preferences: notifications as unknown as Json,  // ✅ Fixed
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

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Profile</h2>
            <p className="text-sm text-gray-500">Your personal information</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => handleFieldChange('full_name', e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 cursor-not-allowed"
              />
              <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            </div>
            <p className="mt-1 text-xs text-gray-600">Email cannot be changed for security reasons</p>
          </div>

          {/* Telegram Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Telegram Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <input
                type="text"
                value={formData.telegram_username}
                onChange={(e) => handleFieldChange('telegram_username', e.target.value.replace('@', ''))}
                className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="username"
              />
            </div>
            <p className="mt-1 text-xs text-gray-600">Required for Telegram alerts</p>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Bell className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
            <p className="text-sm text-gray-500">How you want to be notified</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* In-App Notifications */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
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
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
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
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <MessageCircle className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="font-medium text-white">Telegram</p>
                <p className="text-sm text-gray-500">Get alerts via Telegram bot</p>
                {notifications.telegram && !formData.telegram_username && (
                  <p className="text-xs text-yellow-400 mt-1">⚠️ Add your username above</p>
                )}
              </div>
            </div>
            <Toggle
              checked={notifications.telegram}
              onChange={(checked) => handleNotificationChange('telegram', checked)}
            />
          </div>

          {/* Email */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
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
        <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
          <p className="text-xs text-yellow-400/80">
            💡 Telegram and Email notifications require the Alerts feature to be set up. Coming soon!
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        {/* Unsaved Changes Indicator */}
        <div>
          {hasChanges() && !saved && (
            <p className="text-sm text-yellow-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              You have unsaved changes
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || (!hasChanges() && !saved)}
          className={`
            flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-all
            ${saved 
              ? 'bg-emerald-600 text-white' 
              : 'bg-blue-600 hover:bg-blue-500 text-white'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
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

      {/* Keyboard Shortcut Hint */}
      <p className="text-xs text-gray-600 text-center">
        Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">Ctrl</kbd> + 
        <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">S</kbd> to save
      </p>
    </div>
  )
}