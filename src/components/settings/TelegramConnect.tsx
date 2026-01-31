// src/components/settings/TelegramConnect.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import {
  MessageCircle,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unlink
} from 'lucide-react'

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'tradesense_alerts_bot'

export function TelegramConnect() {
  const { profile, refreshProfile, userId } = useUser()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const isConnected = !!profile?.telegram_chat_id

  // Generate random token
  const generateToken = () => {
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
  }

  const generateConnectionLink = async () => {
    if (!userId) return

    setIsGenerating(true)
    setError(null)

    try {
      const token = generateToken()

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ telegram_connection_token: token })
        .eq('id', userId)

      if (updateError) throw updateError

      const url = `https://t.me/${BOT_USERNAME}?start=${token}`
      setConnectionUrl(url)
    } catch (err: any) {
      console.error('Failed to generate link:', err)
      setError('Failed to generate connection link')
    } finally {
      setIsGenerating(false)
    }
  }

  const disconnectTelegram = async () => {
    if (!userId) return

    setIsDisconnecting(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_connection_token: null,
        })
        .eq('id', userId)

      if (updateError) throw updateError

      await refreshProfile()
      setConnectionUrl(null)
    } catch (err: any) {
      setError('Failed to disconnect')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const checkConnection = async () => {
    await refreshProfile()
    if (profile?.telegram_chat_id) {
      setConnectionUrl(null)
    }
  }

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-cyan-500/20' : 'bg-gray-500/20'}`}>
            <MessageCircle size={20} className={isConnected ? 'text-cyan-400' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-medium text-white">Telegram</p>
            <p className="text-xs text-gray-500">
              {isConnected
                ? `Connected${profile?.telegram_username ? ` as @${profile.telegram_username}` : ''}`
                : 'Not connected'}
            </p>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
              <Check size={12} />
              Connected
            </span>
            <button
              onClick={disconnectTelegram}
              disabled={isDisconnecting}
              className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-colors"
            >
              {isDisconnecting ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
            </button>
          </div>
        ) : (
          <button
            onClick={generateConnectionLink}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
            Connect
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {connectionUrl && !isConnected && (
        <div className="space-y-3">
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <p className="text-sm text-cyan-300 mb-3">
              Click below to connect via Telegram:
            </p>
            <a
              href={connectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg"
            >
              <MessageCircle size={16} />
              Open Telegram
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">After connecting, click refresh.</p>
            <button onClick={checkConnection} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <p className="text-xs text-gray-500">✅ You'll receive alerts via Telegram</p>
      )}
    </div>
  )
}