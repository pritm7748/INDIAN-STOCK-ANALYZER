// src/lib/alerts/conditions.ts

import { RSI, SMA, MACD } from 'technicalindicators'

export interface AlertCondition {
  indicator: 'price' | 'rsi' | 'score' | 'volume' | 'macd' | 'sma_cross'
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below'
  value: number
  compareTo?: string
}

export interface QuoteData {
  price: number
  previousClose: number
  volume: number
  avgVolume: number
}

export interface HistoricalData {
  closes: number[]
  highs: number[]
  lows: number[]
}

export interface ConditionResult {
  triggered: boolean
  currentValue: number
  message: string
}

// Simple previous value tracker (in-memory for browser session)
const previousValues = new Map<string, number>()

/**
 * Check price condition
 */
export function checkPriceCondition(
  condition: AlertCondition,
  quote: QuoteData,
  symbol: string,
  alertId: string
): ConditionResult {
  const currentValue = quote.price
  const symbolClean = symbol.replace('.NS', '')
  const cacheKey = `${alertId}_price`
  
  let triggered = false
  let message = ''

  switch (condition.operator) {
    case 'above':
      triggered = currentValue > condition.value
      message = `${symbolClean} is above ₹${condition.value.toLocaleString('en-IN')} (now ₹${currentValue.toFixed(2)})`
      break
    
    case 'below':
      triggered = currentValue < condition.value
      message = `${symbolClean} is below ₹${condition.value.toLocaleString('en-IN')} (now ₹${currentValue.toFixed(2)})`
      break
    
    case 'crosses_above':
      const prevAbove = previousValues.get(cacheKey)
      if (prevAbove !== undefined) {
        triggered = prevAbove <= condition.value && currentValue > condition.value
      }
      previousValues.set(cacheKey, currentValue)
      message = `${symbolClean} crossed above ₹${condition.value.toLocaleString('en-IN')}`
      break
    
    case 'crosses_below':
      const prevBelow = previousValues.get(cacheKey)
      if (prevBelow !== undefined) {
        triggered = prevBelow >= condition.value && currentValue < condition.value
      }
      previousValues.set(cacheKey, currentValue)
      message = `${symbolClean} crossed below ₹${condition.value.toLocaleString('en-IN')}`
      break
  }

  return { triggered, currentValue, message }
}

/**
 * Check RSI condition
 */
export function checkRSICondition(
  condition: AlertCondition,
  historical: HistoricalData,
  symbol: string
): ConditionResult {
  const symbolClean = symbol.replace('.NS', '')
  
  const rsiValues = RSI.calculate({ values: historical.closes, period: 14 })
  const currentRSI = rsiValues[rsiValues.length - 1] || 50

  let triggered = false
  let message = ''

  if (condition.operator === 'above') {
    triggered = currentRSI > condition.value
    message = `${symbolClean} RSI is above ${condition.value} (now ${currentRSI.toFixed(1)})`
  } else {
    triggered = currentRSI < condition.value
    message = `${symbolClean} RSI is below ${condition.value} (now ${currentRSI.toFixed(1)})`
  }

  return { triggered, currentValue: currentRSI, message }
}

/**
 * Check volume spike condition
 */
export function checkVolumeCondition(
  condition: AlertCondition,
  quote: QuoteData,
  symbol: string
): ConditionResult {
  const symbolClean = symbol.replace('.NS', '')
  const volumeRatio = quote.avgVolume > 0 ? quote.volume / quote.avgVolume : 0

  const triggered = volumeRatio >= condition.value
  const message = `${symbolClean} volume spike: ${volumeRatio.toFixed(1)}x average`

  return { triggered, currentValue: volumeRatio, message }
}

/**
 * Check SMA cross (Golden/Death Cross)
 */
export function checkSMACrossCondition(
  condition: AlertCondition,
  historical: HistoricalData,
  symbol: string,
  alertId: string
): ConditionResult {
  const symbolClean = symbol.replace('.NS', '')
  
  const sma50 = SMA.calculate({ values: historical.closes, period: 50 })
  const sma200 = SMA.calculate({ values: historical.closes, period: 200 })

  if (sma50.length < 2 || sma200.length < 2) {
    return { triggered: false, currentValue: 0, message: '' }
  }

  const curr50 = sma50[sma50.length - 1]
  const curr200 = sma200[sma200.length - 1]
  const prev50 = sma50[sma50.length - 2]
  const prev200 = sma200[sma200.length - 2]

  let triggered = false
  let message = ''

  if (condition.operator === 'crosses_above') {
    triggered = prev50 <= prev200 && curr50 > curr200
    message = `${symbolClean} Golden Cross! SMA50 crossed above SMA200`
  } else {
    triggered = prev50 >= prev200 && curr50 < curr200
    message = `${symbolClean} Death Cross! SMA50 crossed below SMA200`
  }

  return { triggered, currentValue: curr50 - curr200, message }
}

/**
 * Main condition checker
 */
export function checkCondition(
  condition: AlertCondition,
  quote: QuoteData,
  historical: HistoricalData | null,
  symbol: string,
  alertId: string
): ConditionResult {
  switch (condition.indicator) {
    case 'price':
      return checkPriceCondition(condition, quote, symbol, alertId)
    
    case 'volume':
      return checkVolumeCondition(condition, quote, symbol)
    
    case 'rsi':
      if (!historical) return { triggered: false, currentValue: 0, message: 'No data' }
      return checkRSICondition(condition, historical, symbol)
    
    case 'sma_cross':
      if (!historical) return { triggered: false, currentValue: 0, message: 'No data' }
      return checkSMACrossCondition(condition, historical, symbol, alertId)
    
    default:
      return { triggered: false, currentValue: 0, message: 'Unknown indicator' }
  }
}

export function needsHistoricalData(indicator: string): boolean {
  return ['rsi', 'sma_cross', 'macd', 'score'].includes(indicator)
}