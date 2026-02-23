// src/lib/backtest/indicators.ts
// Configurable indicator evaluator for the strategy builder
// Evaluates rules using ONLY data up to the current bar (look-ahead safe)

import { RSI, SMA, EMA, MACD, BollingerBands, ATR, ADX, StochasticRSI } from 'technicalindicators'
import { BarData, StrategyRule, IndicatorType } from './types'

// ============================================================
// INDICATOR VALUE CACHE
// ============================================================

interface IndicatorCache {
    [key: string]: number | undefined
}

// ============================================================
// COMPUTE INDICATOR VALUE AT A GIVEN BAR INDEX
// ============================================================

export function computeIndicator(
    indicator: IndicatorType,
    bars: BarData[],
    barIndex: number,
    params: Record<string, number> = {}
): number | undefined {
    // Use only data up to barIndex (inclusive) — prevents look-ahead bias
    const slice = bars.slice(0, barIndex + 1)
    const closes = slice.map(b => b.close)
    const highs = slice.map(b => b.high)
    const lows = slice.map(b => b.low)
    const volumes = slice.map(b => b.volume)

    switch (indicator) {
        // ----- RSI -----
        case 'rsi': {
            const period = params.period || 14
            if (closes.length < period + 1) return undefined
            const result = RSI.calculate({ values: closes, period })
            return result.length > 0 ? result[result.length - 1] : undefined
        }

        // ----- MACD -----
        case 'macd':
        case 'macd_signal':
        case 'macd_histogram': {
            const fast = params.fast || 12
            const slow = params.slow || 26
            const signal = params.signal || 9
            if (closes.length < slow + signal) return undefined
            const result = MACD.calculate({
                values: closes,
                fastPeriod: fast,
                slowPeriod: slow,
                signalPeriod: signal,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            })
            if (result.length === 0) return undefined
            const last = result[result.length - 1]
            if (indicator === 'macd') return last.MACD ?? undefined
            if (indicator === 'macd_signal') return last.signal ?? undefined
            return last.histogram ?? undefined
        }

        // ----- Bollinger Bands -----
        case 'bollinger_upper':
        case 'bollinger_lower':
        case 'bollinger_middle': {
            const period = params.period || 20
            const stdDev = params.stdDev || 2
            if (closes.length < period) return undefined
            const result = BollingerBands.calculate({ period, values: closes, stdDev })
            if (result.length === 0) return undefined
            const last = result[result.length - 1]
            if (indicator === 'bollinger_upper') return last.upper
            if (indicator === 'bollinger_lower') return last.lower
            return last.middle
        }

        // ----- SMA -----
        case 'sma': {
            const period = params.period || 20
            if (closes.length < period) return undefined
            const result = SMA.calculate({ values: closes, period })
            return result.length > 0 ? result[result.length - 1] : undefined
        }

        // ----- EMA -----
        case 'ema': {
            const period = params.period || 21
            if (closes.length < period) return undefined
            const result = EMA.calculate({ values: closes, period })
            return result.length > 0 ? result[result.length - 1] : undefined
        }

        // ----- Supertrend -----
        case 'supertrend': {
            const period = params.period || 10
            const multiplier = params.multiplier || 3
            if (closes.length < period + 1) return undefined
            return computeSupertrend(highs, lows, closes, period, multiplier)
        }

        // ----- ADX -----
        case 'adx': {
            const period = params.period || 14
            if (closes.length < period * 2) return undefined
            const result = ADX.calculate({ close: closes, high: highs, low: lows, period })
            return result.length > 0 ? result[result.length - 1].adx : undefined
        }

        // ----- Stochastic RSI -----
        case 'stoch_rsi_k':
        case 'stoch_rsi_d': {
            const period = params.period || 14
            if (closes.length < period * 2) return undefined
            try {
                const result = StochasticRSI.calculate({
                    values: closes,
                    rsiPeriod: period,
                    stochasticPeriod: period,
                    kPeriod: 3,
                    dPeriod: 3
                })
                if (result.length === 0) return undefined
                const last = result[result.length - 1]
                return indicator === 'stoch_rsi_k' ? last.k : last.d
            } catch {
                return undefined
            }
        }

        // ----- ATR -----
        case 'atr': {
            const period = params.period || 14
            if (closes.length < period + 1) return undefined
            const result = ATR.calculate({ high: highs, low: lows, close: closes, period })
            return result.length > 0 ? result[result.length - 1] : undefined
        }

        // ----- OBV Trend (1 = bullish, -1 = bearish, 0 = neutral) -----
        case 'obv_trend': {
            if (closes.length < 20) return undefined
            return computeOBVTrend(closes, volumes)
        }

        // ----- VWAP -----
        case 'vwap': {
            const lookback = params.lookback || 20
            if (closes.length < lookback) return undefined
            return computeVWAP(highs, lows, closes, volumes, lookback)
        }

        // ----- Ichimoku -----
        case 'ichimoku_tenkan': {
            if (closes.length < 9) return undefined
            return computeIchimokuLine(highs, lows, 9)
        }
        case 'ichimoku_kijun': {
            if (closes.length < 26) return undefined
            return computeIchimokuLine(highs, lows, 26)
        }
        case 'ichimoku_cloud': {
            // Returns 1 if price above cloud, -1 if below, 0 if inside
            if (closes.length < 52) return undefined
            return computeIchimokuCloudPosition(highs, lows, closes)
        }

        // ----- Price -----
        case 'price': {
            return closes[closes.length - 1]
        }

        // ----- Volume -----
        case 'volume': {
            return volumes[volumes.length - 1]
        }

        // ----- Volume SMA -----
        case 'volume_sma': {
            const period = params.period || 20
            if (volumes.length < period) return undefined
            const result = SMA.calculate({ values: volumes, period })
            return result.length > 0 ? result[result.length - 1] : undefined
        }

        default:
            return undefined
    }
}

// ============================================================
// EVALUATE A STRATEGY RULE AT A GIVEN BAR
// ============================================================

export function evaluateRule(
    rule: StrategyRule,
    bars: BarData[],
    barIndex: number
): boolean {
    const currentValue = computeIndicator(rule.indicator, bars, barIndex, rule.params)
    if (currentValue === undefined) return false

    // For crossover detection, we need the previous bar's values too
    if (rule.operator === 'crosses_above' || rule.operator === 'crosses_below') {
        if (barIndex < 1) return false
        const prevValue = computeIndicator(rule.indicator, bars, barIndex - 1, rule.params)
        if (prevValue === undefined) return false

        // Compare against another indicator or a fixed value
        if (rule.compareTo) {
            const currentCompare = computeIndicator(rule.compareTo, bars, barIndex, rule.compareParams)
            const prevCompare = computeIndicator(rule.compareTo, bars, barIndex - 1, rule.compareParams)
            if (currentCompare === undefined || prevCompare === undefined) return false

            if (rule.operator === 'crosses_above') {
                return prevValue <= prevCompare && currentValue > currentCompare
            }
            return prevValue >= prevCompare && currentValue < currentCompare
        }

        // Compare against fixed value
        if (rule.operator === 'crosses_above') {
            return prevValue <= rule.value && currentValue > rule.value
        }
        return prevValue >= rule.value && currentValue < rule.value
    }

    // Simple comparisons
    if (rule.compareTo) {
        const compareValue = computeIndicator(rule.compareTo, bars, barIndex, rule.compareParams)
        if (compareValue === undefined) return false

        switch (rule.operator) {
            case 'above': return currentValue > compareValue
            case 'below': return currentValue < compareValue
            case 'equals': return Math.abs(currentValue - compareValue) < 0.01
            default: return false
        }
    }

    switch (rule.operator) {
        case 'above': return currentValue > rule.value
        case 'below': return currentValue < rule.value
        case 'equals': return Math.abs(currentValue - rule.value) < 0.01
        case 'between': return false // needs two values, handled differently
        default: return false
    }
}

// ============================================================
// EVALUATE ALL ENTRY/EXIT RULES (AND logic)
// ============================================================

export function evaluateAllRules(
    rules: StrategyRule[],
    bars: BarData[],
    barIndex: number
): { triggered: boolean; reasons: string[] } {
    if (rules.length === 0) return { triggered: false, reasons: [] }

    const reasons: string[] = []
    let allTrue = true

    for (const rule of rules) {
        const result = evaluateRule(rule, bars, barIndex)
        if (result) {
            reasons.push(formatRuleDescription(rule))
        } else {
            allTrue = false
        }
    }

    return { triggered: allTrue, reasons }
}

// ============================================================
// HELPER: Format rule as human-readable string
// ============================================================

function formatRuleDescription(rule: StrategyRule): string {
    const indicator = formatIndicatorName(rule.indicator, rule.params)
    const operator = rule.operator.replace(/_/g, ' ')

    if (rule.compareTo) {
        const compare = formatIndicatorName(rule.compareTo, rule.compareParams)
        return `${indicator} ${operator} ${compare}`
    }

    return `${indicator} ${operator} ${rule.value}`
}

function formatIndicatorName(type: IndicatorType, params?: Record<string, number>): string {
    const period = params?.period
    switch (type) {
        case 'rsi': return `RSI(${period || 14})`
        case 'macd': return 'MACD'
        case 'macd_signal': return 'MACD Signal'
        case 'macd_histogram': return 'MACD Hist'
        case 'bollinger_upper': return `BB Upper(${period || 20})`
        case 'bollinger_lower': return `BB Lower(${period || 20})`
        case 'bollinger_middle': return `BB Mid(${period || 20})`
        case 'sma': return `SMA(${period || 20})`
        case 'ema': return `EMA(${period || 21})`
        case 'supertrend': return `ST(${period || 10})`
        case 'adx': return `ADX(${period || 14})`
        case 'stoch_rsi_k': return `StochRSI K(${period || 14})`
        case 'stoch_rsi_d': return `StochRSI D(${period || 14})`
        case 'atr': return `ATR(${period || 14})`
        case 'obv_trend': return 'OBV Trend'
        case 'vwap': return 'VWAP'
        case 'ichimoku_tenkan': return 'Tenkan'
        case 'ichimoku_kijun': return 'Kijun'
        case 'ichimoku_cloud': return 'Cloud'
        case 'price': return 'Price'
        case 'volume': return 'Volume'
        case 'volume_sma': return `Vol SMA(${period || 20})`
        default: return type
    }
}

// ============================================================
// HELPER COMPUTATIONS (inline to avoid external dependencies)
// ============================================================

function computeSupertrend(
    highs: number[], lows: number[], closes: number[],
    period: number, multiplier: number
): number {
    // Compute ATR
    const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period })
    if (atrValues.length === 0) return 0

    const len = closes.length
    let upperBand = 0, lowerBand = 0
    let supertrend = 0
    let prevClose = closes[0]
    let prevUpperBand = Infinity
    let prevLowerBand = -Infinity
    let direction = 1 // 1 = up (bullish), -1 = down (bearish)

    const offset = len - atrValues.length
    for (let i = 0; i < atrValues.length; i++) {
        const idx = offset + i
        const hl2 = (highs[idx] + lows[idx]) / 2
        const atr = atrValues[i]

        upperBand = hl2 + multiplier * atr
        lowerBand = hl2 - multiplier * atr

        if (lowerBand > prevLowerBand || prevClose < prevLowerBand) {
            // keep
        } else {
            lowerBand = prevLowerBand
        }

        if (upperBand < prevUpperBand || prevClose > prevUpperBand) {
            // keep
        } else {
            upperBand = prevUpperBand
        }

        if (direction === 1) {
            if (closes[idx] < lowerBand) {
                direction = -1
                supertrend = upperBand
            } else {
                supertrend = lowerBand
            }
        } else {
            if (closes[idx] > upperBand) {
                direction = 1
                supertrend = lowerBand
            } else {
                supertrend = upperBand
            }
        }

        prevClose = closes[idx]
        prevUpperBand = upperBand
        prevLowerBand = lowerBand
    }

    // Return direction: 1 for BUY signal, -1 for SELL
    return direction
}

function computeOBVTrend(closes: number[], volumes: number[]): number {
    const obv: number[] = [0]
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i])
        else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i])
        else obv.push(obv[i - 1])
    }

    // Check OBV trend using SMA
    const period = 10
    if (obv.length < period) return 0
    const obvSma = SMA.calculate({ values: obv, period })
    if (obvSma.length < 2) return 0

    const current = obv[obv.length - 1]
    const smaVal = obvSma[obvSma.length - 1]

    if (current > smaVal * 1.02) return 1  // Bullish
    if (current < smaVal * 0.98) return -1 // Bearish
    return 0 // Neutral
}

function computeVWAP(
    highs: number[], lows: number[], closes: number[],
    volumes: number[], lookback: number
): number {
    let cumTPV = 0
    let cumVol = 0
    const start = Math.max(0, closes.length - lookback)

    for (let i = start; i < closes.length; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3
        cumTPV += tp * volumes[i]
        cumVol += volumes[i]
    }

    return cumVol > 0 ? cumTPV / cumVol : closes[closes.length - 1]
}

function computeIchimokuLine(highs: number[], lows: number[], period: number): number {
    const recentHighs = highs.slice(-period)
    const recentLows = lows.slice(-period)
    return (Math.max(...recentHighs) + Math.min(...recentLows)) / 2
}

function computeIchimokuCloudPosition(
    highs: number[], lows: number[], closes: number[]
): number {
    const tenkan = computeIchimokuLine(highs, lows, 9)
    const kijun = computeIchimokuLine(highs, lows, 26)

    // Senkou Span A = (Tenkan + Kijun) / 2
    const spanA = (tenkan + kijun) / 2

    // Senkou Span B = (52-period high + 52-period low) / 2
    const spanB = computeIchimokuLine(highs, lows, 52)

    const cloudTop = Math.max(spanA, spanB)
    const cloudBottom = Math.min(spanA, spanB)
    const price = closes[closes.length - 1]

    if (price > cloudTop) return 1   // Above cloud
    if (price < cloudBottom) return -1 // Below cloud
    return 0 // Inside cloud
}

// ============================================================
// AVAILABLE INDICATORS (for UI dropdowns)
// ============================================================

export interface IndicatorOption {
    value: IndicatorType
    label: string
    category: 'momentum' | 'trend' | 'volatility' | 'volume' | 'price'
    defaultParams?: Record<string, number>
    description: string
}

export const AVAILABLE_INDICATORS: IndicatorOption[] = [
    // Momentum
    { value: 'rsi', label: 'RSI', category: 'momentum', defaultParams: { period: 14 }, description: 'Relative Strength Index — overbought/oversold oscillator' },
    { value: 'stoch_rsi_k', label: 'Stoch RSI %K', category: 'momentum', defaultParams: { period: 14 }, description: 'Stochastic RSI K line — more sensitive than RSI' },
    { value: 'stoch_rsi_d', label: 'Stoch RSI %D', category: 'momentum', defaultParams: { period: 14 }, description: 'Stochastic RSI D line (signal)' },
    { value: 'macd', label: 'MACD Line', category: 'momentum', defaultParams: { fast: 12, slow: 26, signal: 9 }, description: 'MACD line value' },
    { value: 'macd_signal', label: 'MACD Signal', category: 'momentum', defaultParams: { fast: 12, slow: 26, signal: 9 }, description: 'MACD signal line' },
    { value: 'macd_histogram', label: 'MACD Histogram', category: 'momentum', defaultParams: { fast: 12, slow: 26, signal: 9 }, description: 'MACD histogram (momentum)' },

    // Trend
    { value: 'sma', label: 'SMA', category: 'trend', defaultParams: { period: 20 }, description: 'Simple Moving Average' },
    { value: 'ema', label: 'EMA', category: 'trend', defaultParams: { period: 21 }, description: 'Exponential Moving Average' },
    { value: 'supertrend', label: 'Supertrend', category: 'trend', defaultParams: { period: 10, multiplier: 3 }, description: 'Supertrend direction (1=buy, -1=sell)' },
    { value: 'adx', label: 'ADX', category: 'trend', defaultParams: { period: 14 }, description: 'Average Directional Index — trend strength' },
    { value: 'ichimoku_tenkan', label: 'Ichimoku Tenkan', category: 'trend', description: 'Ichimoku Conversion Line (9-period)' },
    { value: 'ichimoku_kijun', label: 'Ichimoku Kijun', category: 'trend', description: 'Ichimoku Base Line (26-period)' },
    { value: 'ichimoku_cloud', label: 'Ichimoku Cloud', category: 'trend', description: 'Cloud position (1=above, -1=below, 0=inside)' },

    // Volatility
    { value: 'bollinger_upper', label: 'BB Upper', category: 'volatility', defaultParams: { period: 20, stdDev: 2 }, description: 'Bollinger Band upper' },
    { value: 'bollinger_lower', label: 'BB Lower', category: 'volatility', defaultParams: { period: 20, stdDev: 2 }, description: 'Bollinger Band lower' },
    { value: 'bollinger_middle', label: 'BB Middle', category: 'volatility', defaultParams: { period: 20, stdDev: 2 }, description: 'Bollinger Band middle (SMA)' },
    { value: 'atr', label: 'ATR', category: 'volatility', defaultParams: { period: 14 }, description: 'Average True Range — volatility measure' },

    // Volume
    { value: 'volume', label: 'Volume', category: 'volume', description: 'Current bar volume' },
    { value: 'volume_sma', label: 'Volume SMA', category: 'volume', defaultParams: { period: 20 }, description: 'Volume moving average' },
    { value: 'obv_trend', label: 'OBV Trend', category: 'volume', description: 'On-Balance Volume trend (1=bull, -1=bear)' },
    { value: 'vwap', label: 'VWAP', category: 'volume', defaultParams: { lookback: 20 }, description: 'Volume Weighted Average Price' },

    // Price
    { value: 'price', label: 'Price', category: 'price', description: 'Current closing price' },
]
