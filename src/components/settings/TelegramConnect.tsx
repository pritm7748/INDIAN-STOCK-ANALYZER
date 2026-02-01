// src/components/settings/TelegramConnect.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import {
  MessageCircle,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unlink,
  Copy,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'TradeSenseAI_bot'

export function TelegramConnect() {
  const { profile, refreshProfile, userId } = useUser()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)

  const supabase = createClient()
  const isConnected = !!profile?.telegram_chat_id

  // Generate random token
  const generateToken = () => {
    const array = new Uint8Array(24)
    window.crypto.getRandomValues(array)
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
  }

  const generateConnectionLink = async () => {
    if (!userId) return

    setIsGenerating(true)
    setError(null)
    setConnectionUrl(null)

    try {
      const token = generateToken()

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ telegram_connection_token: token })
        .eq('id', userId)

      if (updateError) throw updateError

      const url = `https://t.me/${BOT_USERNAME}?start=${token}`
      setConnectionUrl(url)
      
      console.log('Generated connection URL:', url)
    } catch (err: any) {
      console.error('Failed to generate link:', err)
      setError('Failed to generate connection link. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (!connectionUrl) return
    
    try {
      await navigator.clipboard.writeText(connectionUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const disconnectTelegram = async () => {
    if (!userId) return

    if (!confirm('Are you sure you want to disconnect Telegram? You will stop receiving alert notifications.')) {
      return
    }

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
      setError('Failed to disconnect. Please try again.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const checkConnection = async () => {
    setIsCheckingConnection(true)
    await refreshProfile()
    setIsCheckingConnection(false)
    
    // If now connected, clear the URL
    if (profile?.telegram_chat_id) {
      setConnectionUrl(null)
    }
  }

  // Auto-check connection status periodically when URL is shown
  useEffect(() => {
    if (!connectionUrl || isConnected) return

    const interval = setInterval(async () => {
      await refreshProfile()
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [connectionUrl, isConnected, refreshProfile])

  // Clear URL when connected
  useEffect(() => {
    if (isConnected && connectionUrl) {
      setConnectionUrl(null)
    }
  }, [isConnected, connectionUrl])

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-cyan-500/20' : 'bg-gray-500/20'}`}>
            <MessageCircle size={24} className={isConnected ? 'text-cyan-400' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-medium text-white">Telegram Notifications</p>
            <p className="text-sm text-gray-500">
              {isConnected
                ? `Connected${profile?.telegram_username ? ` as @${profile.telegram_username}` : ''}`
                : 'Not connected'}
            </p>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm rounded-full">
              <Check size={14} />
              Connected
            </span>
            <button
              onClick={disconnectTelegram}
              disabled={isDisconnecting}
              className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-colors"
              title="Disconnect Telegram"
            >
              {isDisconnecting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Unlink size={18} />
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={generateConnectionLink}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {isGenerating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <MessageCircle size={18} />
            )}
            Connect Telegram
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Connection Link */}
      {connectionUrl && !isConnected && (
        <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg shrink-0">
              <MessageCircle size={20} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-cyan-300 font-medium mb-1">
                Connect your Telegram
              </p>
              <p className="text-xs text-cyan-300/70">
                Click the button below to open Telegram and connect your account. 
                After connecting, you'll receive alert notifications in Telegram.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={connectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <MessageCircle size={18} />
              Open in Telegram
              <ExternalLink size={14} />
            </a>
            
            <button
              onClick={copyToClipboard}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle size={16} className="text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy Link
                </>
              )}
            </button>
          </div>

          {/* Manual Check */}
          <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
            <p className="text-xs text-cyan-300/70">
              After connecting in Telegram, click refresh to verify.
            </p>
            <button 
              onClick={checkConnection}
              disabled={isCheckingConnection}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw size={14} className={isCheckingConnection ? 'animate-spin' : ''} />
              {isCheckingConnection ? 'Checking...' : 'Refresh'}
            </button>
          </div>
        </div>
      )}

      {/* Connected Info */}
      {isConnected && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle size={16} />
            You'll receive alert notifications via Telegram
          </p>
          <p className="text-xs text-emerald-400/70 mt-1 ml-6">
            Make sure your alerts have "Telegram" enabled in notification channels.
          </p>
        </div>
      )}

      {/* Bot Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Bot: @{BOT_USERNAME}</p>
        <p>Commands: /alerts, /analyze SYMBOL, /help</p>
      </div>
    </div>
  )
}