// src/app/(dashboard)/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { 
  User, 
  Bell, 
  Save,
  Loader2,
  Check
} from 'lucide-react'

export default function SettingsPage() {
  const { profile, refreshProfile, fullName, email } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    telegram_username: '',
  })

  const supabase = createClient()

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || fullName || '',
        telegram_username: profile.telegram_username || '',
      })
    }
  }, [profile, fullName])

  const handleSave = async () => {
    if (!profile?.id) return

    setIsLoading(true)
    setSaved(false)

    try {
      const updateData = {
        full_name: formData.full_name,
        telegram_username: formData.telegram_username,
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      alert('Failed to save settings')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

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
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email || ''}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-600">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Telegram Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <input
                type="text"
                value={formData.telegram_username}
                onChange={(e) => setFormData(prev => ({ ...prev, telegram_username: e.target.value }))}
                className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="username"
              />
            </div>
            <p className="mt-1 text-xs text-gray-600">For Telegram alerts (optional)</p>
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
          {[
            { key: 'in_app', label: 'In-App Notifications', description: 'Show notifications in the app' },
            { key: 'browser_push', label: 'Browser Push', description: 'Receive browser push notifications' },
            { key: 'telegram', label: 'Telegram', description: 'Get alerts via Telegram bot' },
            { key: 'email', label: 'Email', description: 'Receive email notifications' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div>
                <p className="font-medium text-white">{item.label}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
              <div className="w-12 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
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