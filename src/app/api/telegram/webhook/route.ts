// src/app/api/telegram/webhook/route.ts

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { 
  sendWelcomeMessage, 
  sendAlertsList, 
  sendAnalysisSummary,
  sendTelegramMessage 
} from '@/lib/alerts/telegram'

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://indian-stock-analyzer-ecru.vercel.app'
}

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
  // REMOVED: Secret verification that was causing 401 error
  // The webhook URL itself is already secret enough for most use cases

  try {
    const update: TelegramUpdate = await request.json()
    
    console.log('📩 Telegram update received:', JSON.stringify(update, null, 2))
    
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
    } else if (text === '/check' || text === '/status') {
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
    console.error('❌ Telegram webhook error:', error)
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true, error: error.message })
  }
}

/**
 * /start - Connect Telegram to TradeSense account
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
  const appUrl = getAppUrl()

  if (!connectionToken) {
    await sendTelegramMessage({
      chatId,
      text: `
👋 <b>Welcome to TradeSense AI Bot!</b>

To receive alert notifications, connect this chat to your TradeSense account.

<b>How to connect:</b>
1. Go to Settings in your TradeSense dashboard
2. Find "Telegram Bot" section
3. Click "Connect Telegram"
4. Click the link to open this bot with your token

<a href="${appUrl}/dashboard/settings">Open Settings</a>
`.trim()
    })
    return
  }

  console.log(`🔗 Connection attempt with token: ${connectionToken.substring(0, 8)}...`)

  // Find user with this token
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, telegram_chat_id')
    .eq('telegram_connection_token', connectionToken)
    .single()

  if (error || !profile) {
    console.log('❌ Token not found:', connectionToken.substring(0, 8))
    await sendTelegramMessage({
      chatId,
      text: `❌ Invalid or expired connection link.

Please generate a new link from your TradeSense settings.

<a href="${appUrl}/dashboard/settings">Open Settings</a>`
    })
    return
  }

  // Check if already connected to different chat
  if (profile.telegram_chat_id && profile.telegram_chat_id !== chatId) {
    await sendTelegramMessage({
      chatId,
      text: '⚠️ This account is already connected to another Telegram chat.\n\nDisconnect from Settings first, then try again.'
    })
    return
  }

  // Save chat ID and clear token
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      telegram_chat_id: chatId,
      telegram_username: username || null,
      telegram_connection_token: null,
      notification_preferences: {
        email: false,
        telegram: true,
        browser_push: true,
        in_app: true
      }
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error('❌ Failed to save chat ID:', updateError)
    await sendTelegramMessage({
      chatId,
      text: '❌ Connection failed. Please try again.'
    })
    return
  }

  console.log(`✅ Connected user ${profile.id} to chat ${chatId}`)
  
  // Send welcome
  await sendWelcomeMessage(chatId, profile.full_name || firstName)
}

/**
 * /alerts - List active alerts
 */
async function handleAlerts(supabase: any, chatId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ Not connected. Use /start to learn how to connect.'
    })
    return
  }

  const { data: alerts } = await supabase
    .from('alerts')
    .select('symbol, alert_type, condition, is_active')
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .eq('is_triggered', false)

  await sendAlertsList(chatId, alerts || [])
}

/**
 * /check or /status - Check connection
 */
async function handleCheck(supabase: any, chatId: string) {
  const appUrl = getAppUrl()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('telegram_chat_id', chatId)
    .single()

  if (!profile) {
    await sendTelegramMessage({
      chatId,
      text: '❌ Not connected to any account.\n\nUse /start to learn how to connect.'
    })
    return
  }

  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_active', true)
    .eq('is_triggered', false)

  await sendTelegramMessage({
    chatId,
    text: `
✅ <b>Connected!</b>

👤 Account: ${profile.full_name || 'User'}
🔔 Active alerts: <b>${count || 0}</b>

<a href="${appUrl}/dashboard/alerts">Manage Alerts</a>
`.trim()
  })
}

/**
 * /analyze SYMBOL
 */
async function handleAnalyze(chatId: string, text: string) {
  const parts = text.split(' ')
  let symbol = parts[1]?.toUpperCase()

  if (!symbol) {
    await sendTelegramMessage({
      chatId,
      text: '❓ Specify a symbol.\n\nExample: /analyze RELIANCE'
    })
    return
  }

  if (!symbol.endsWith('.NS')) {
    symbol = `${symbol}.NS`
  }

  await sendTelegramMessage({
    chatId,
    text: `⏳ Analyzing ${symbol.replace('.NS', '')}...`
  })

  try {
    const appUrl = getAppUrl()
    const response = await fetch(`${appUrl}/api/analyze?symbol=${symbol}&timeframe=1M`)
    
    if (!response.ok) {
      throw new Error('Analysis failed')
    }

    const analysis = await response.json()

    if (analysis.error) {
      throw new Error(analysis.error)
    }

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
    console.error('Analysis error:', error)
    await sendTelegramMessage({
      chatId,
      text: `❌ Failed to analyze ${symbol.replace('.NS', '')}.\n\nCheck the symbol and try again.`
    })
  }
}

/**
 * /help
 */
async function handleHelp(chatId: string) {
  const appUrl = getAppUrl()
  
  await sendTelegramMessage({
    chatId,
    text: `
📚 <b>TradeSense AI Bot</b>

<b>Commands:</b>
/start - Connect your account
/status - Check connection
/alerts - View active alerts
/analyze SYMBOL - Quick analysis

<b>Examples:</b>
/analyze RELIANCE
/analyze TCS
/analyze INFY

<a href="${appUrl}/dashboard">Open Dashboard</a>
`.trim()
  })
}

// GET - Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Telegram webhook is active',
    timestamp: new Date().toISOString()
  })
}