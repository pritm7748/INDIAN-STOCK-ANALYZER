// src/lib/alerts/telegram.ts

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

interface TelegramMessage {
  chatId: string
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disableWebPagePreview?: boolean
}

interface SendResult {
  success: boolean
  error?: string
}

/**
 * Send a message via Telegram Bot
 */
export async function sendTelegramMessage(message: TelegramMessage): Promise<SendResult> {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured')
    return { success: false, error: 'Bot not configured' }
  }

  if (!message.chatId) {
    return { success: false, error: 'No chat ID' }
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chatId,
        text: message.text,
        parse_mode: message.parseMode || 'HTML',
        disable_web_page_preview: message.disableWebPagePreview ?? true,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram API error:', data)
      return { success: false, error: data.description }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Failed to send Telegram message:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send alert triggered notification
 */
export async function sendAlertNotification(
  chatId: string,
  symbol: string,
  message: string,
  currentValue: number,
  alertType: string
): Promise<SendResult> {
  const symbolClean = symbol.replace('.NS', '')
  
  const emoji = alertType.includes('above') || alertType.includes('bullish') ? '📈' : '📉'
  
  const text = `
🔔 <b>Alert Triggered!</b>

${emoji} <b>${symbolClean}</b>
${message}

<i>Current value: ${formatValue(currentValue, alertType)}</i>

<a href="https://indian-stock-analyzer-ecru.vercel.app/dashboard?symbol=${symbol}">📊 View Analysis</a>
`.trim()

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send welcome message when user connects
 */
export async function sendWelcomeMessage(chatId: string, userName?: string): Promise<SendResult> {
  const text = `
🎉 <b>Welcome to TradeSense AI!</b>

${userName ? `Hello ${userName}! ` : ''}Your Telegram is now connected.

You'll receive notifications here when your price alerts are triggered.

<b>Available Commands:</b>
/alerts - View your active alerts
/check - Check all alerts now
/analyze RELIANCE - Quick stock analysis
/help - Show all commands

<i>Tip: Keep your TradeSense dashboard open to ensure alerts are checked regularly.</i>
`.trim()

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send alerts list
 */
export async function sendAlertsList(
  chatId: string, 
  alerts: Array<{ symbol: string; alert_type: string; condition: any; is_active: boolean }>
): Promise<SendResult> {
  if (alerts.length === 0) {
    return sendTelegramMessage({
      chatId,
      text: '📋 You have no active alerts.\n\nCreate alerts at your TradeSense dashboard!'
    })
  }

  const activeAlerts = alerts.filter(a => a.is_active)
  
  let text = `📋 <b>Your Alerts</b> (${activeAlerts.length} active)\n\n`

  activeAlerts.slice(0, 10).forEach((alert, i) => {
    const symbol = alert.symbol.replace('.NS', '')
    const condition = alert.condition as any
    const operator = condition.operator === 'above' ? '↑' : '↓'
    const value = formatValue(condition.value, condition.indicator)
    
    text += `${i + 1}. <b>${symbol}</b> ${condition.indicator} ${operator} ${value}\n`
  })

  if (activeAlerts.length > 10) {
    text += `\n<i>...and ${activeAlerts.length - 10} more</i>`
  }

  text += '\n\n<i>Use /check to check all alerts now</i>'

  return sendTelegramMessage({ chatId, text })
}

/**
 * Send quick analysis summary
 */
export async function sendAnalysisSummary(
  chatId: string,
  analysis: {
    symbol: string
    price: number
    change: number
    changePercent: number
    score: number
    recommendation: string
    rsi: number
  }
): Promise<SendResult> {
  const symbol = analysis.symbol.replace('.NS', '')
  const changeEmoji = analysis.change >= 0 ? '📈' : '📉'
  const changeSign = analysis.change >= 0 ? '+' : ''
  
  const scoreEmoji = analysis.score >= 60 ? '🟢' : analysis.score <= 40 ? '🔴' : '🟡'
  
  const text = `
📊 <b>${symbol} Analysis</b>

💰 <b>Price:</b> ₹${analysis.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
${changeEmoji} <b>Change:</b> ${changeSign}${analysis.change.toFixed(2)} (${changeSign}${analysis.changePercent.toFixed(2)}%)

${scoreEmoji} <b>AI Score:</b> ${analysis.score}/100
📍 <b>Signal:</b> ${analysis.recommendation}
📉 <b>RSI:</b> ${analysis.rsi.toFixed(1)}

<a href="https://indian-stock-analyzer-ecru.vercel.app/dashboard?symbol=${analysis.symbol}">View Full Analysis →</a>
`.trim()

  return sendTelegramMessage({ chatId, text })
}

/**
 * Format value based on indicator type
 */
function formatValue(value: number, indicator: string): string {
  switch (indicator) {
    case 'price':
      return `₹${value.toLocaleString('en-IN')}`
    case 'volume':
      return `${value}x`
    case 'rsi':
    case 'score':
      return value.toString()
    default:
      return value.toString()
  }
}

/**
 * Escape HTML special characters for Telegram
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}