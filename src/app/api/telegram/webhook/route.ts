// src/app/api/telegram/webhook/route.ts

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { 
  sendWelcomeMessage, 
  sendAlertsList, 
  sendAnalysisSummary,
  sendTelegramMessage 
} from '@/lib/alerts/telegram'

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
  }
}

export async function POST(request: Request) {
  // Verify webhook secret
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
    console.warn('Invalid Telegram webhook secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update: TelegramUpdate = await request.json()
    
    if (!update.message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = update.message.chat.id.toString()
    const text = update.message.text.trim()
    const username = update.message.from.username
    const firstName = update.message.from.first_name

    const supabase = createAdminClient()

    // Handle commands
    if (text.startsWith('/start')) {
      await handleStart(supabase, chatId, text, firstName, username)
    } else if (text === '/alerts') {
      await handleAlerts(supabase, chatId)
    } else if (text === '/check') {
      await handleCheck(supabase, chatId)
    } else if (text.startsWith('/analyze')) {
      await handleAnalyze(chatId, text)
    } else if (text === '/help') {
      await handleHelp(chatId)
    } else {
      // Unknown command
      await sendTelegramMessage({
        chatId,
        text: '❓ Unknown command. Use /help to see available commands.'
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * /start - Connect Telegram to TradeSense account
 * Usage: /start <connection_token>
 */
async function handleStart(
  supabase: any, 
  chatId: string, 
  text: string,
  firstName: string,
  username?: string
) {
  const parts = text.split(' ')
  const connectionToken = parts[1]

  if (!connectionToken) {
    // No token - send instructions
    await sendTelegramMessage({
      chatId,
      text: `
👋 <b>Welcome to TradeSense AI Bot!</b>

To receive alert notifications, you need to connect this chat to your TradeSense account.

<b>How to connect:</b>
1. Go to your TradeSense dashboard
2. Open Settings → Notifications
3. Click "Connect Telegram"
4. Click the link provided

<i>Already have an account? Go to Settings to connect.</i>
`.trim()
    })
    return
  }

  // Verify and link the token
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_connection_token', connectionToken)
    .single()

  if (error || !profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ Invalid or expired connection link. Please try again from your TradeSense settings.'
    })
    return
  }

  // Save chat ID and clear token
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      telegram_chat_id: chatId,
      telegram_username: username || null,
      telegram_connection_token: null, // Clear token after use
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error('Failed to save telegram chat ID:', updateError)
    await sendTelegramMessage({
      chatId,
      text: '❌ Something went wrong. Please try again.'
    })
    return
  }

  // Also update notification preferences to enable telegram
  await supabase
    .from('profiles')
    .update({
      notification_preferences: {
        email: false,
        telegram: true,
        browser_push: true,
        in_app: true
      }
    })
    .eq('id', profile.id)

  // Send welcome message
  await sendWelcomeMessage(chatId, profile.full_name || firstName)
}

/**
 * /alerts - List user's active alerts
 */
async function handleAlerts(supabase: any, chatId: string) {
  // Find user by chat ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ Your Telegram is not connected to a TradeSense account.\n\nUse /start to learn how to connect.'
    })
    return
  }

  // Get user's alerts
  const { data: alerts } = await supabase
    .from('alerts')
    .select('symbol, alert_type, condition, is_active')
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .eq('is_triggered', false)

  await sendAlertsList(chatId, alerts || [])
}

/**
 * /check - Manually trigger alert check (sends to dashboard)
 */
async function handleCheck(supabase: any, chatId: string) {
  // Find user by chat ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ Your Telegram is not connected to a TradeSense account.'
    })
    return
  }

  // Get count of active alerts
  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .eq('is_triggered', false)

  await sendTelegramMessage({
    chatId,
    text: `
🔍 <b>Alert Check</b>

You have <b>${count || 0}</b> active alerts.

⚠️ <b>Note:</b> Alerts are checked automatically when your TradeSense dashboard is open.

To check alerts now, please open your dashboard:
<a href="https://your-app.vercel.app/dashboard/alerts">Open Dashboard</a>

<i>We're working on background checking - coming soon!</i>
`.trim()
  })
}

/**
 * /analyze SYMBOL - Quick stock analysis
 */
async function handleAnalyze(chatId: string, text: string) {
  const parts = text.split(' ')
  let symbol = parts[1]?.toUpperCase()

  if (!symbol) {
    await sendTelegramMessage({
      chatId,
      text: '❓ Please specify a stock symbol.\n\nExample: /analyze RELIANCE'
    })
    return
  }

  // Add .NS suffix if not present
  if (!symbol.endsWith('.NS')) {
    symbol = `${symbol}.NS`
  }

  await sendTelegramMessage({
    chatId,
    text: `⏳ Analyzing ${symbol.replace('.NS', '')}...`
  })

  try {
    // Call our analyze API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze?symbol=${symbol}&timeframe=1M`)
    
    if (!response.ok) {
      throw new Error('Analysis failed')
    }

    const analysis = await response.json()

    await sendAnalysisSummary(chatId, {
      symbol: analysis.symbol,
      price: analysis.price,
      change: analysis.change,
      changePercent: analysis.changePercent,
      score: analysis.score,
      recommendation: analysis.recommendation,
      rsi: analysis.metrics?.rsi || 50,
    })
  } catch (error) {
    await sendTelegramMessage({
      chatId,
      text: `❌ Failed to analyze ${symbol.replace('.NS', '')}. Please check the symbol and try again.`
    })
  }
}

/**
 * /help - Show available commands
 */
async function handleHelp(chatId: string) {
  await sendTelegramMessage({
    chatId,
    text: `
📚 <b>TradeSense AI Bot Commands</b>

/start - Connect your TradeSense account
/alerts - View your active alerts
/check - Check alert status
/analyze SYMBOL - Quick stock analysis

<b>Examples:</b>
• /analyze RELIANCE
• /analyze TCS
• /analyze INFY

<b>Note:</b> Alerts are checked automatically when your dashboard is open. You'll receive notifications here when alerts trigger.

<a href="https://your-app.vercel.app/dashboard">Open Dashboard</a>
`.trim()
  })
}

// Handle GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook active' })
}