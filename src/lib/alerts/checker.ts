// src/lib/alerts/checker.ts

import { createClient } from '@/lib/supabase/client'
import { Alert } from '@/lib/supabase/types'
import { AlertCondition, checkCondition, needsHistoricalData, QuoteData, HistoricalData } from './conditions'

export interface CheckResult {
  alertId: string
  symbol: string
  triggered: boolean
  currentValue: number
  message: string
  error?: string
}

export interface CheckSummary {
  checked: number
  triggered: number
  errors: number
  results: CheckResult[]
  timestamp: string
}

// In-memory cache
const quoteCache = new Map<string, { data: QuoteData; timestamp: number }>()
const historicalCache = new Map<string, { data: HistoricalData; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

/**
 * Fetch quote via our API (handles Yahoo Finance)
 */
async function getQuote(symbol: string): Promise<QuoteData | null> {
  const cached = quoteCache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    const response = await fetch(`/api/quote?symbol=${symbol}`)
    if (!response.ok) throw new Error('Quote fetch failed')
    
    const data = await response.json()
    
    const quoteData: QuoteData = {
      price: data.price || 0,
      previousClose: data.previousClose || 0,
      volume: data.volume || 0,
      avgVolume: data.avgVolume || 0,
    }

    quoteCache.set(symbol, { data: quoteData, timestamp: Date.now() })
    return quoteData
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch historical data for indicators
 */
async function getHistoricalData(symbol: string): Promise<HistoricalData | null> {
  const cached = historicalCache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 5) {
    return cached.data
  }

  try {
    // Use analyze endpoint to get historical data (it already fetches it)
    const response = await fetch(`/api/analyze?symbol=${symbol}&timeframe=1M`)
    if (!response.ok) throw new Error('Analysis failed')
    
    const data = await response.json()
    
    // Extract closing prices from history
    const historicalData: HistoricalData = {
      closes: data.history?.map((h: any) => h.price) || [],
      highs: [], // Not returned by current API, would need update
      lows: [],
    }

    if (historicalData.closes.length > 0) {
      historicalCache.set(symbol, { data: historicalData, timestamp: Date.now() })
    }
    
    return historicalData
  } catch (error) {
    console.error(`Failed to fetch historical data for ${symbol}:`, error)
    return null
  }
}

/**
 * Check a single alert
 */
async function checkSingleAlert(alert: Alert): Promise<CheckResult> {
  const condition = alert.condition as unknown as AlertCondition

  // Get quote
  const quote = await getQuote(alert.symbol)
  if (!quote) {
    return {
      alertId: alert.id,
      symbol: alert.symbol,
      triggered: false,
      currentValue: 0,
      message: '',
      error: 'Failed to fetch price'
    }
  }

  // Get historical data if needed
  let historical: HistoricalData | null = null
  if (needsHistoricalData(condition.indicator)) {
    historical = await getHistoricalData(alert.symbol)
  }

  // Check condition
  const result = checkCondition(condition, quote, historical, alert.symbol, alert.id)

  return {
    alertId: alert.id,
    symbol: alert.symbol,
    triggered: result.triggered,
    currentValue: result.currentValue,
    message: result.message,
  }
}

/**
 * Check all alerts for the current user (browser-side)
 */
export async function checkUserAlerts(userId: string): Promise<CheckSummary> {
  const supabase = createClient()
  const summary: CheckSummary = {
    checked: 0,
    triggered: 0,
    errors: 0,
    results: [],
    timestamp: new Date().toISOString()
  }

  try {
    // Get active, non-triggered alerts
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_triggered', false)

    if (error) throw error
    if (!alerts || alerts.length === 0) return summary

    // Group by symbol to minimize API calls
    const alertsBySymbol = new Map<string, Alert[]>()
    for (const alert of alerts) {
      // Skip expired alerts
      if (alert.expires_at && new Date(alert.expires_at) < new Date()) {
        await supabase
          .from('alerts')
          .update({ is_active: false })
          .eq('id', alert.id)
        continue
      }

      const existing = alertsBySymbol.get(alert.symbol) || []
      existing.push(alert)
      alertsBySymbol.set(alert.symbol, existing)
    }

    // Check each symbol
    for (const [symbol, symbolAlerts] of alertsBySymbol) {
      for (const alert of symbolAlerts) {
        summary.checked++

        const result = await checkSingleAlert(alert)
        summary.results.push(result)

        if (result.error) {
          summary.errors++
          continue
        }

        if (result.triggered) {
          summary.triggered++

          // Update alert in database
          await supabase
            .from('alerts')
            .update({
              is_triggered: !alert.is_recurring,
              is_active: alert.is_recurring,
              triggered_at: new Date().toISOString(),
              triggered_value: result.currentValue,
              last_checked_at: new Date().toISOString(),
            })
            .eq('id', alert.id)

          // Add to history
          await supabase.from('alert_history').insert({
            alert_id: alert.id,
            user_id: userId,
            symbol: alert.symbol,
            alert_type: alert.alert_type,
            condition: alert.condition,
            triggered_value: result.currentValue,
            message: result.message,
            notification_sent_to: alert.notification_channels,
          })

          // Send Telegram notification if enabled
          if (alert.notification_channels?.includes('telegram')) {
            await sendTelegramAlert(userId, result)
          }
        } else {
          // Update last checked
          await supabase
            .from('alerts')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', alert.id)
        }
      }

      // Small delay between symbols to avoid rate limiting
      await new Promise(r => setTimeout(r, 100))
    }

    return summary
  } catch (error: any) {
    console.error('Error checking alerts:', error)
    summary.errors++
    return summary
  }
}

/**
 * Send Telegram notification for triggered alert
 */
async function sendTelegramAlert(userId: string, result: CheckResult): Promise<void> {
  try {
    await fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        symbol: result.symbol,
        message: result.message,
        currentValue: result.currentValue,
      }),
    })
  } catch (error) {
    console.error('Failed to send Telegram notification:', error)
  }
}

/**
 * Check if Indian market is open
 */
export function isMarketOpen(): boolean {
  const now = new Date()
  
  // Get IST time
  const istOffset = 5.5 * 60 // IST is UTC+5:30
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const istMinutes = utcMinutes + istOffset

  const day = now.getUTCDay()
  
  // Adjust day if IST crosses midnight
  let istDay = day
  if (istMinutes >= 24 * 60) {
    istDay = (day + 1) % 7
  }

  // Weekend
  if (istDay === 0 || istDay === 6) return false

  // Market hours: 9:15 AM to 3:30 PM IST
  const marketOpen = 9 * 60 + 15  // 555 minutes
  const marketClose = 15 * 60 + 30 // 930 minutes
  
  const istMinutesNormalized = istMinutes % (24 * 60)

  return istMinutesNormalized >= marketOpen && istMinutesNormalized <= marketClose
}

/**
 * Clear caches
 */
export function clearCaches(): void {
  quoteCache.clear()
  historicalCache.clear()
}