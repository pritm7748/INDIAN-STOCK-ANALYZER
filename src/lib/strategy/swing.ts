// src/lib/strategy/swing.ts
// Swing Trading with Technical Analysis — Indian Markets (NSE)
// 20-EMA Pullback + MACD Crossover setups — COMPLETE TypeScript port

// ============================================================================
// TYPES
// ============================================================================

export interface SwingConfig {
  // Moving averages
  EMA_FAST: number       // trailing stop EMA (10)
  EMA_MID: number        // pullback EMA (20)
  SMA_SLOW: number       // trend filter SMA (50)

  // RSI
  RSI_PERIOD: number
  RSI_RESET_LOW: number  // 40
  RSI_RESET_HIGH: number // 55

  // MACD
  MACD_FAST: number      // 12
  MACD_SLOW: number      // 26
  MACD_SIGNAL: number    // 9

  // Setup A: 20 EMA Pullback
  PULLBACK_PROXIMITY_PCT: number       // 0.01 = within 1%
  TRIGGER_VOLUME_MULTIPLIER: number    // 1.2x
  HIGHER_HIGH_LOOKBACK: number         // 30
  MIN_STOP_DISTANCE_PCT: number        // 0.04 = 4%
  PARTIAL_EXIT_PCT: number             // 0.50 = 50%
  DEAD_MONEY_DAYS: number              // 15
  DEAD_MONEY_THRESHOLD: number         // 0.05 = 5%

  // Setup B: MACD Crossover
  MACD_VOLUME_MULTIPLIER: number       // 1.5x
  MACD_STOP_MAX_PCT: number            // 0.05 = 5%

  // General
  MAX_HOLDING_DAYS: number             // 20
  MIN_HOLDING_DAYS: number             // 10
  VOLUME_AVG_PERIOD: number            // 20
  SWING_LOOKBACK: number               // 20

  // Indian market filters
  MIN_DELIVERY_PCT: number             // 40
  LOW_DELIVERY_WARNING: number         // 30
  MIN_AVG_TURNOVER_CR: number          // 10
  EARNINGS_MONTHS: number[]            // [1,4,7,10]

  // Risk
  MAX_RISK_PER_TRADE_PCT: number       // 0.02
  MAX_CONCURRENT_POSITIONS: number     // 8
  TRAILING_STOP_EMA: number            // 10

  // Analytics
  TRADING_DAYS_PER_YEAR: number
  RISK_FREE_RATE: number
}

export interface SwingStockData {
  symbol: string
  name: string
  sector: string
  opens: number[]
  highs: number[]
  lows: number[]
  closes: number[]
  volumes: number[]
  avgDailyTurnoverCr: number
  deliveryPct?: number | null
  isFnO?: boolean
  earningsDate?: string | null
}

export interface IndicatorSnapshot {
  open: number
  high: number
  low: number
  close: number
  volume: number
  ema10: number | null
  ema20: number | null
  sma50: number | null
  sma50Rising: boolean
  rsi: number | null
  macdLine: number | null
  signalLine: number | null
  histogram: number | null
  macdLinePrev: number | null
  signalLinePrev: number | null
  histogramPrev: number | null
  macdBullishCrossover: boolean
  histogramTurnedPositive: boolean
  avgVolume20: number | null
  volumeRatio: number | null
  recentSwingHigh: number | null
  recentSwingLow: number | null
  hasHigherHigh: boolean
  isBullishCandle: boolean
  distanceToEma20: number | null
  volatility: number | null
}

export interface TradeParams {
  entry: number
  stopLoss: number
  riskPct: string
  target1?: number
  target1Pct?: string
  target2Method?: string
  targetMethod?: string
  riskRewardRatio?: string | number
  partialExitAt?: string
  timeStop?: string
  maxHoldingDays?: number
}

export interface SetupResult {
  setup: 'A_EMA_PULLBACK' | 'B_MACD_CROSSOVER'
  triggered: boolean
  score: number
  totalConditions: number
  confluenceRatio: string
  reasons: string[]
  trade: TradeParams | null
}

export interface SwingSignal {
  symbol: string
  name: string
  sector: string
  setup: 'A_EMA_PULLBACK' | 'B_MACD_CROSSOVER'
  triggered: boolean
  score: number
  totalConditions: number
  confluenceRatio: string
  reasons: string[]
  trade: TradeParams | null
  warnings: string[]
  indicators: {
    close: number
    ema20: number | null
    sma50?: number | null
    rsi?: number | null
    macdLine: number | null
    signalLine?: number | null
    histogram?: number | null
    volumeRatio: number | null
    volatility?: string | null
  }
}

export interface FilterResult {
  pass: boolean
  warnings: string[]
  reason?: string
}

export interface PositionSizing {
  shares: number
  positionValue: number
  positionPctOfCapital: string
  riskPerShare: number
  totalRisk: number
  riskPctOfCapital: string
  error?: string
}

export interface ScanResult {
  date: string
  setupA_signals: SwingSignal[]
  setupB_signals: SwingSignal[]
  totalScanned: number
  totalFiltered: number
  totalSignals: number
  filtered: { symbol: string; name: string; reason: string }[]
  nearMiss: { symbol: string; name: string; setupA_score: string; setupB_score: string }[]
  performance: {
    expectedWinRate: string
    rewardRisk: string
    avgHoldingDays: string
    methodology: string
  }
  config: SwingConfig
}


// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_SWING_CONFIG: SwingConfig = {
  EMA_FAST: 10,
  EMA_MID: 20,
  SMA_SLOW: 50,

  RSI_PERIOD: 14,
  RSI_RESET_LOW: 40,
  RSI_RESET_HIGH: 55,

  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,

  PULLBACK_PROXIMITY_PCT: 0.01,
  TRIGGER_VOLUME_MULTIPLIER: 1.2,
  HIGHER_HIGH_LOOKBACK: 30,
  MIN_STOP_DISTANCE_PCT: 0.04,
  PARTIAL_EXIT_PCT: 0.50,
  DEAD_MONEY_DAYS: 15,
  DEAD_MONEY_THRESHOLD: 0.05,

  MACD_VOLUME_MULTIPLIER: 1.5,
  MACD_STOP_MAX_PCT: 0.05,

  MAX_HOLDING_DAYS: 20,
  MIN_HOLDING_DAYS: 10,
  VOLUME_AVG_PERIOD: 20,
  SWING_LOOKBACK: 20,

  MIN_DELIVERY_PCT: 40,
  LOW_DELIVERY_WARNING: 30,
  MIN_AVG_TURNOVER_CR: 10,
  EARNINGS_MONTHS: [1, 4, 7, 10],

  MAX_RISK_PER_TRADE_PCT: 0.02,
  MAX_CONCURRENT_POSITIONS: 8,
  TRAILING_STOP_EMA: 10,

  TRADING_DAYS_PER_YEAR: 252,
  RISK_FREE_RATE: 0.065,
}


// ============================================================================
// UTILITY
// ============================================================================

function round2(n: number | null | undefined): number | null {
  return n !== null && n !== undefined ? Math.round(n * 100) / 100 : null
}


// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

/**
 * Simple Moving Average — null-padded at start
 */
function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j]
    }
    result[i] = sum / period
  }
  return result
}

/**
 * Exponential Moving Average — seeded with SMA
 */
function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result

  // Seed with SMA
  let sum = 0
  for (let i = 0; i < period; i++) sum += data[i]
  result[period - 1] = sum / period

  const multiplier = 2 / (period + 1)

  for (let i = period; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]!) * multiplier + result[i - 1]!
  }
  return result
}

/**
 * RSI (Relative Strength Index) — Wilder's smoothing
 */
function calcRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return result

  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    avgGain += gains[i]
    avgLoss += losses[i]
  }
  avgGain /= period
  avgLoss /= period

  if (avgLoss === 0) {
    result[period] = 100
  } else {
    result[period] = 100 - (100 / (1 + avgGain / avgLoss))
  }

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period

    if (avgLoss === 0) {
      result[i + 1] = 100
    } else {
      result[i + 1] = 100 - (100 / (1 + avgGain / avgLoss))
    }
  }

  return result
}

/**
 * MACD (12, 26, 9) — line, signal, histogram
 */
function calcMACD(closes: number[], cfg: SwingConfig) {
  const emaFast = calcEMA(closes, cfg.MACD_FAST)
  const emaSlow = calcEMA(closes, cfg.MACD_SLOW)

  const macdLine: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine[i] = emaFast[i]! - emaSlow[i]!
    }
  }

  // Signal line = 9-EMA of MACD line
  const macdValues = macdLine.filter(v => v !== null) as number[]
  const macdStartIdx = macdLine.findIndex(v => v !== null)
  const signalRaw = calcEMA(macdValues, cfg.MACD_SIGNAL)

  const signalLine: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = 0; i < signalRaw.length; i++) {
    if (signalRaw[i] !== null) {
      signalLine[macdStartIdx + i] = signalRaw[i]
    }
  }

  // Histogram
  const histogram: (number | null)[] = new Array(closes.length).fill(null)
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      histogram[i] = macdLine[i]! - signalLine[i]!
    }
  }

  return { macdLine, signalLine, histogram }
}

/**
 * Find swing highs and swing lows
 * A swing high: higher than `order` bars on each side
 * A swing low: lower than `order` bars on each side
 */
function findSwingPoints(highs: number[], lows: number[], order: number = 5) {
  const swingHighs: { index: number; price: number }[] = []
  const swingLows: { index: number; price: number }[] = []

  for (let i = order; i < highs.length - order; i++) {
    let isHigh = true
    let isLow = true

    for (let j = 1; j <= order; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) isHigh = false
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) isLow = false
    }

    if (isHigh) swingHighs.push({ index: i, price: highs[i] })
    if (isLow) swingLows.push({ index: i, price: lows[i] })
  }

  return { swingHighs, swingLows }
}

/**
 * Check if the stock has made a "higher high" within the lookback window
 */
function hasHigherHigh(highs: number[], lookback: number = 30): boolean {
  if (highs.length < lookback + 10) return false

  const swings = findSwingPoints(
    highs.slice(-lookback - 10),
    highs.map(() => 0), // dummy lows
    3
  )

  const sh = swings.swingHighs
  if (sh.length < 2) return false
  return sh[sh.length - 1].price > sh[sh.length - 2].price
}

/**
 * Check if 50-day SMA has a positive slope
 */
function isSMARising(sma50: (number | null)[], lookback: number = 5): boolean {
  const recent = sma50.filter(v => v !== null) as number[]
  if (recent.length < lookback + 1) return false
  const curr = recent[recent.length - 1]
  const prev = recent[recent.length - 1 - lookback]
  return curr > prev
}

/**
 * Get the most recent swing low (for stop-loss placement)
 */
function getRecentSwingLow(lows: number[], order: number = 5): number | null {
  const swings = findSwingPoints(
    lows.map(() => 999999), // dummy highs
    lows,
    order
  )
  if (swings.swingLows.length === 0) return null
  return swings.swingLows[swings.swingLows.length - 1].price
}

/**
 * Get the most recent swing high (for target placement)
 */
function getRecentSwingHigh(highs: number[], order: number = 5): number | null {
  const swings = findSwingPoints(highs, highs.map(() => 0), order)
  if (swings.swingHighs.length === 0) return null
  return swings.swingHighs[swings.swingHighs.length - 1].price
}

/**
 * Calculate average volume over a period
 */
function calcAvgVolume(volumes: number[], period: number): number | null {
  if (!volumes || volumes.length < period) return null
  const slice = volumes.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / slice.length
}

/**
 * Annualized realized volatility from log returns
 */
function calcVolatility(closes: number[], window: number = 20, tradingDays: number = 252): number | null {
  if (closes.length < window + 1) return null
  const rets: number[] = []
  for (let i = closes.length - window; i < closes.length; i++) {
    if (closes[i - 1] === 0) return null
    rets.push(Math.log(closes[i] / closes[i - 1]))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  return Math.sqrt(variance) * Math.sqrt(tradingDays)
}


// ============================================================================
// COMPLETE INDICATOR SNAPSHOT — All indicators for one stock at current bar
// ============================================================================

export function computeIndicators(stock: SwingStockData, cfg: SwingConfig = DEFAULT_SWING_CONFIG): IndicatorSnapshot | null {
  const { opens, highs, lows, closes, volumes } = stock
  const len = closes.length
  if (len < cfg.SMA_SLOW + 10) return null

  const ema10 = calcEMA(closes, cfg.EMA_FAST)
  const ema20 = calcEMA(closes, cfg.EMA_MID)
  const sma50 = calcSMA(closes, cfg.SMA_SLOW)
  const rsi = calcRSI(closes, cfg.RSI_PERIOD)
  const macd = calcMACD(closes, cfg)
  const avgVol20 = calcAvgVolume(volumes, cfg.VOLUME_AVG_PERIOD)

  const i = len - 1 // latest bar index

  // Previous bar MACD for crossover detection
  const macdPrev = i >= 1 ? macd.macdLine[i - 1] : null
  const signalPrev = i >= 1 ? macd.signalLine[i - 1] : null
  const histPrev = i >= 1 ? macd.histogram[i - 1] : null

  return {
    open: opens[i],
    high: highs[i],
    low: lows[i],
    close: closes[i],
    volume: volumes[i],

    ema10: ema10[i],
    ema20: ema20[i],
    sma50: sma50[i],
    sma50Rising: isSMARising(sma50),

    rsi: rsi[i],

    macdLine: macd.macdLine[i],
    signalLine: macd.signalLine[i],
    histogram: macd.histogram[i],
    macdLinePrev: macdPrev,
    signalLinePrev: signalPrev,
    histogramPrev: histPrev,

    macdBullishCrossover:
      macdPrev !== null && signalPrev !== null &&
      macd.macdLine[i] !== null && macd.signalLine[i] !== null &&
      macdPrev <= signalPrev && macd.macdLine[i]! > macd.signalLine[i]!,

    histogramTurnedPositive:
      histPrev !== null && macd.histogram[i] !== null &&
      histPrev <= 0 && macd.histogram[i]! > 0,

    avgVolume20: avgVol20,
    volumeRatio: avgVol20 ? volumes[i] / avgVol20 : null,

    recentSwingHigh: getRecentSwingHigh(highs),
    recentSwingLow: getRecentSwingLow(lows),
    hasHigherHigh: hasHigherHigh(highs, cfg.HIGHER_HIGH_LOOKBACK),

    isBullishCandle: closes[i] > opens[i],

    distanceToEma20:
      ema20[i] !== null
        ? (closes[i] - ema20[i]!) / ema20[i]!
        : null,

    volatility: calcVolatility(closes),
  }
}


// ============================================================================
// SETUP A: 20-EMA PULLBACK DETECTION (7 conditions)
// ============================================================================

export function checkSetupA_EmaPullback(indicators: IndicatorSnapshot, cfg: SwingConfig = DEFAULT_SWING_CONFIG): SetupResult {
  const reasons: string[] = []
  let score = 0
  const totalConditions = 7

  // CONDITION 1: Uptrend — Price > 50-day SMA
  const aboveSma50 = indicators.sma50 !== null && indicators.close > indicators.sma50
  if (aboveSma50) {
    score++
    reasons.push('✓ Price above 50-SMA')
  } else {
    reasons.push('✗ Price below 50-SMA (no uptrend)')
  }

  // CONDITION 2: 50-day SMA is rising
  if (indicators.sma50Rising) {
    score++
    reasons.push('✓ 50-SMA slope positive')
  } else {
    reasons.push('✗ 50-SMA slope flat/negative')
  }

  // CONDITION 3: Higher high in past 30 days
  if (indicators.hasHigherHigh) {
    score++
    reasons.push('✓ Higher high confirmed')
  } else {
    reasons.push('✗ No higher high pattern')
  }

  // CONDITION 4: Pullback to 20 EMA (within 1%)
  const nearEma20 =
    indicators.distanceToEma20 !== null &&
    Math.abs(indicators.distanceToEma20) <= cfg.PULLBACK_PROXIMITY_PCT

  // Also accept if price touched EMA intraday (low <= ema20 <= high)
  const touchedEma20 =
    indicators.ema20 !== null &&
    indicators.low <= indicators.ema20 * (1 + cfg.PULLBACK_PROXIMITY_PCT) &&
    indicators.close >= indicators.ema20 * (1 - cfg.PULLBACK_PROXIMITY_PCT)

  if (nearEma20 || touchedEma20) {
    score++
    reasons.push(`✓ Pullback to 20-EMA (distance: ${((indicators.distanceToEma20 || 0) * 100).toFixed(2)}%)`)
  } else {
    reasons.push(`✗ Not near 20-EMA (distance: ${((indicators.distanceToEma20 || 0) * 100).toFixed(2)}%)`)
  }

  // CONDITION 5: RSI in "reset" zone (40–55)
  const rsiInZone =
    indicators.rsi !== null &&
    indicators.rsi >= cfg.RSI_RESET_LOW &&
    indicators.rsi <= cfg.RSI_RESET_HIGH

  if (rsiInZone) {
    score++
    reasons.push(`✓ RSI in reset zone (${indicators.rsi!.toFixed(1)})`)
  } else {
    reasons.push(`✗ RSI outside reset zone (${indicators.rsi ? indicators.rsi.toFixed(1) : 'N/A'})`)
  }

  // CONDITION 6: Bullish trigger candle with volume
  const bullishTrigger =
    indicators.isBullishCandle &&
    indicators.volumeRatio !== null &&
    indicators.volumeRatio >= cfg.TRIGGER_VOLUME_MULTIPLIER

  if (bullishTrigger) {
    score++
    reasons.push(`✓ Bullish candle with volume surge (${indicators.volumeRatio!.toFixed(1)}x avg)`)
  } else {
    const parts: string[] = []
    if (!indicators.isBullishCandle) parts.push('bearish candle')
    if (indicators.volumeRatio !== null && indicators.volumeRatio < cfg.TRIGGER_VOLUME_MULTIPLIER) {
      parts.push(`volume only ${indicators.volumeRatio.toFixed(1)}x`)
    }
    reasons.push(`✗ No bullish trigger (${parts.join(', ')})`)
  }

  // CONDITION 7: MACD confirmation
  const macdConfirm =
    (indicators.macdLine !== null && indicators.signalLine !== null &&
     indicators.macdLine > indicators.signalLine) ||
    indicators.macdBullishCrossover

  if (macdConfirm) {
    score++
    reasons.push('✓ MACD confirms (line above signal)')
  } else {
    reasons.push('✗ MACD not confirming')
  }

  // SIGNAL DECISION — 6 of 7 = strong; must include price>SMA50, near EMA20, bullish trigger
  const triggered = score >= 6 && aboveSma50 && (nearEma20 || touchedEma20) && bullishTrigger

  // CALCULATE ENTRY, STOP, TARGETS
  let trade: TradeParams | null = null

  if (triggered) {
    const entry = indicators.high * 1.001 // tiny buffer above high

    // Stop: below recent swing low OR below 50-SMA, whichever tighter, but at least 4% away
    const swingLowStop = indicators.recentSwingLow ? indicators.recentSwingLow * 0.995 : null
    const sma50Stop = indicators.sma50 ? indicators.sma50 * 0.995 : null

    let candidateStop: number | null = null
    if (swingLowStop && sma50Stop) {
      candidateStop = Math.max(swingLowStop, sma50Stop) // tighter
    } else {
      candidateStop = swingLowStop || sma50Stop
    }

    const minStop = entry * (1 - cfg.MIN_STOP_DISTANCE_PCT)
    if (candidateStop && candidateStop > minStop) {
      candidateStop = minStop
    }
    const stopLoss = candidateStop || minStop

    // Target 1: previous swing high
    const target1 = indicators.recentSwingHigh || entry * 1.08

    // Risk-reward
    const risk = entry - stopLoss
    const reward = target1 - entry
    const riskRewardRatio = risk > 0 ? reward / risk : null

    trade = {
      entry: round2(entry)!,
      stopLoss: round2(stopLoss)!,
      riskPct: round2(((entry - stopLoss) / entry) * 100) + '%',
      target1: round2(target1)!,
      target1Pct: round2(((target1 - entry) / entry) * 100) + '%',
      target2Method: '10-EMA trailing stop',
      riskRewardRatio: riskRewardRatio ? round2(riskRewardRatio)! : 'N/A',
      partialExitAt: 'Target 1 (book 50%)',
      timeStop: `${cfg.DEAD_MONEY_DAYS} days if < ${cfg.DEAD_MONEY_THRESHOLD * 100}% move`,
    }
  }

  return {
    setup: 'A_EMA_PULLBACK',
    triggered,
    score,
    totalConditions,
    confluenceRatio: `${score}/${totalConditions}`,
    reasons,
    trade,
  }
}


// ============================================================================
// SETUP B: MACD BULLISH CROSSOVER + VOLUME SURGE (5 conditions)
// ============================================================================

export function checkSetupB_MacdCrossover(indicators: IndicatorSnapshot, cfg: SwingConfig = DEFAULT_SWING_CONFIG): SetupResult {
  const reasons: string[] = []
  let score = 0
  const totalConditions = 5

  // CONDITION 1: MACD line crosses above signal line
  if (indicators.macdBullishCrossover) {
    score++
    reasons.push('✓ MACD bullish crossover detected')
  } else {
    reasons.push('✗ No MACD crossover')
  }

  // CONDITION 2: Histogram turned positive (first green bar)
  if (indicators.histogramTurnedPositive) {
    score++
    reasons.push('✓ Histogram turned positive (first green bar)')
  } else {
    reasons.push('✗ Histogram not turning positive')
  }

  // CONDITION 3: Crossover above or at zero line
  const aboveZero = indicators.macdLine !== null && indicators.macdLine >= 0
  const nearZero = indicators.macdLine !== null && Math.abs(indicators.macdLine) < 0.5

  if (aboveZero) {
    score++
    reasons.push(`✓ MACD crossover above zero line (MACD: ${indicators.macdLine!.toFixed(2)})`)
  } else if (nearZero) {
    score += 0.5 // partial credit
    reasons.push(`~ MACD crossover near zero line (MACD: ${indicators.macdLine?.toFixed(2)})`)
  } else {
    reasons.push(`✗ MACD crossover below zero line (MACD: ${indicators.macdLine?.toFixed(2) || 'N/A'})`)
  }

  // CONDITION 4: Volume surge
  const volumeSurge =
    indicators.volumeRatio !== null &&
    indicators.volumeRatio >= cfg.MACD_VOLUME_MULTIPLIER

  if (volumeSurge) {
    score++
    reasons.push(`✓ Volume surge (${indicators.volumeRatio!.toFixed(1)}x avg)`)
  } else {
    reasons.push(`✗ Insufficient volume (${(indicators.volumeRatio || 0).toFixed(1)}x avg, need ${cfg.MACD_VOLUME_MULTIPLIER}x)`)
  }

  // CONDITION 5: Price closes above 20 EMA
  const aboveEma20 = indicators.ema20 !== null && indicators.close > indicators.ema20
  if (aboveEma20) {
    score++
    reasons.push('✓ Close above 20-EMA')
  } else {
    reasons.push('✗ Close below 20-EMA')
  }

  // SIGNAL DECISION — 4 of 5 met AND must have crossover AND volume surge
  // P0: Also require uptrend (price > SMA50 or at minimum EMA20)
  const hasUptrend = indicators.sma50 !== null
    ? indicators.close > indicators.sma50
    : (indicators.ema20 !== null && indicators.close > indicators.ema20)
  const triggered = score >= 4 && indicators.macdBullishCrossover && volumeSurge && hasUptrend

  if (!hasUptrend && !reasons.some(r => r.includes('uptrend'))) {
    reasons.push('✗ No uptrend (price below 50-SMA)')
  }

  let trade: TradeParams | null = null

  if (triggered) {
    const entry = indicators.close
    const candleLowStop = indicators.low * 0.998
    const pctStop = entry * (1 - cfg.MACD_STOP_MAX_PCT)
    const stopLoss = Math.max(candleLowStop, pctStop) // tighter stop

    trade = {
      entry: round2(entry)!,
      stopLoss: round2(stopLoss)!,
      riskPct: round2(((entry - stopLoss) / entry) * 100) + '%',
      targetMethod: '10-EMA trailing stop for 3-4 weeks',
      maxHoldingDays: cfg.MAX_HOLDING_DAYS,
    }
  }

  return {
    setup: 'B_MACD_CROSSOVER',
    triggered,
    score,
    totalConditions,
    confluenceRatio: `${score}/${totalConditions}`,
    reasons,
    trade,
  }
}


// ============================================================================
// INDIAN MARKET FILTERS
// ============================================================================

export function applyIndianMarketFilters(
  stock: SwingStockData,
  currentDate: string | null = null,
  cfg: SwingConfig = DEFAULT_SWING_CONFIG,
): FilterResult {
  const warnings: string[] = []

  // 1. Prefer F&O stocks
  if (stock.isFnO === false) {
    warnings.push('Not an F&O stock — wider spreads, lower liquidity')
  }

  // 2. Minimum turnover
  if (stock.avgDailyTurnoverCr == null || stock.avgDailyTurnoverCr < cfg.MIN_AVG_TURNOVER_CR) {
    return {
      pass: false,
      warnings,
      reason: `Avg turnover ₹${(stock.avgDailyTurnoverCr ?? 0).toFixed(1)}cr < ₹${cfg.MIN_AVG_TURNOVER_CR}cr minimum`,
    }
  }

  // 3. Delivery percentage
  if (stock.deliveryPct !== undefined && stock.deliveryPct !== null) {
    if (stock.deliveryPct < cfg.LOW_DELIVERY_WARNING) {
      return {
        pass: false,
        warnings,
        reason: `Delivery % = ${stock.deliveryPct}% < ${cfg.LOW_DELIVERY_WARNING}% (likely speculative)`,
      }
    }
    if (stock.deliveryPct < cfg.MIN_DELIVERY_PCT) {
      warnings.push(`Delivery % = ${stock.deliveryPct}% (below preferred ${cfg.MIN_DELIVERY_PCT}%)`)
    }
  }

  // 4. Earnings season avoidance
  if (currentDate) {
    const month = new Date(currentDate).getMonth() + 1
    if (cfg.EARNINGS_MONTHS.includes(month)) {
      if (stock.earningsDate) {
        const earnDate = new Date(stock.earningsDate)
        const currDate = new Date(currentDate)
        if (earnDate > currDate) {
          warnings.push('EARNINGS PENDING — high event risk (consider skipping)')
        } else {
          warnings.push('Earnings already reported — OK to trade')
        }
      } else {
        warnings.push('Earnings season — verify if results are out before entering')
      }
    }
  }

  return { pass: true, warnings }
}


// ============================================================================
// POSITION SIZING
// ============================================================================

export function calcPositionSize(
  capital: number,
  entryPrice: number,
  stopLoss: number,
  cfg: SwingConfig = DEFAULT_SWING_CONFIG,
): PositionSizing {
  const riskPerShare = entryPrice - stopLoss
  if (riskPerShare <= 0) {
    return {
      shares: 0, positionValue: 0, positionPctOfCapital: '0%',
      riskPerShare: 0, totalRisk: 0, riskPctOfCapital: '0%',
      error: 'Stop loss >= entry price',
    }
  }

  const maxRiskAmount = capital * cfg.MAX_RISK_PER_TRADE_PCT
  const shares = Math.floor(maxRiskAmount / riskPerShare)
  const positionValue = shares * entryPrice
  const positionPctOfCapital = positionValue / capital
  const actualRisk = shares * riskPerShare

  return {
    shares,
    positionValue: Math.round(positionValue),
    positionPctOfCapital: round2(positionPctOfCapital * 100) + '%',
    riskPerShare: round2(riskPerShare)!,
    totalRisk: Math.round(actualRisk),
    riskPctOfCapital: round2((actualRisk / capital) * 100) + '%',
  }
}


// ============================================================================
// SIGNAL SCANNER — SCAN UNIVERSE FOR SETUPS
// ============================================================================

export function scanUniverse(
  universe: SwingStockData[],
  currentDate: string | null = null,
  cfg: SwingConfig = DEFAULT_SWING_CONFIG,
): ScanResult {
  const signalsA: SwingSignal[] = []
  const signalsB: SwingSignal[] = []
  const noSignal: { symbol: string; name: string; setupA_score: string; setupB_score: string }[] = []
  const filtered: { symbol: string; name: string; reason: string }[] = []

  for (const stock of universe) {
    // Apply Indian market filters first
    const filterResult = applyIndianMarketFilters(stock, currentDate, cfg)
    if (!filterResult.pass) {
      filtered.push({
        symbol: stock.symbol,
        name: stock.name,
        reason: filterResult.reason!,
      })
      continue
    }

    // Compute indicators
    const indicators = computeIndicators(stock, cfg)
    if (!indicators) {
      filtered.push({
        symbol: stock.symbol,
        name: stock.name,
        reason: 'Insufficient price history for indicators',
      })
      continue
    }

    // Check Setup A
    const setupA = checkSetupA_EmaPullback(indicators, cfg)
    if (setupA.triggered) {
      signalsA.push({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        ...setupA,
        warnings: filterResult.warnings,
        indicators: {
          close: indicators.close,
          ema20: round2(indicators.ema20),
          sma50: round2(indicators.sma50),
          rsi: round2(indicators.rsi),
          macdLine: round2(indicators.macdLine),
          volumeRatio: round2(indicators.volumeRatio),
          volatility: indicators.volatility ? round2(indicators.volatility * 100) + '%' : null,
        },
      })
    }

    // Check Setup B
    const setupB = checkSetupB_MacdCrossover(indicators, cfg)
    if (setupB.triggered) {
      signalsB.push({
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        ...setupB,
        warnings: filterResult.warnings,
        indicators: {
          close: indicators.close,
          ema20: round2(indicators.ema20),
          macdLine: round2(indicators.macdLine),
          signalLine: round2(indicators.signalLine),
          histogram: round2(indicators.histogram),
          volumeRatio: round2(indicators.volumeRatio),
        },
      })
    }

    if (!setupA.triggered && !setupB.triggered) {
      noSignal.push({
        symbol: stock.symbol,
        name: stock.name,
        setupA_score: setupA.confluenceRatio,
        setupB_score: setupB.confluenceRatio,
      })
    }
  }

  // Sort by confluence score (higher = better)
  signalsA.sort((a, b) => b.score - a.score)
  signalsB.sort((a, b) => b.score - a.score)

  return {
    date: currentDate || new Date().toISOString().split('T')[0],
    setupA_signals: signalsA,
    setupB_signals: signalsB,
    totalScanned: universe.length,
    totalFiltered: filtered.length,
    totalSignals: signalsA.length + signalsB.length,
    filtered,
    nearMiss: noSignal
      .filter(s => {
        const aScore = parseInt(s.setupA_score)
        const bScore = parseInt(s.setupB_score)
        return aScore >= 5 || bScore >= 3
      })
      .slice(0, 20),
    performance: {
      expectedWinRate: '55-65% (academic benchmark)',
      rewardRisk: '2:1 to 3:1 (academic benchmark)',
      avgHoldingDays: '10-20 trading days',
      methodology: 'Mark Minervini 20-EMA pullback + MACD crossover. Metrics are academic benchmarks, not backtested on this universe.',
    },
    config: cfg,
  }
}


// ============================================================================
// STANDALONE HELPERS
// ============================================================================

/**
 * Detect a bullish candle (close > open)
 */
export function isBullishCandle(open: number, close: number): boolean {
  return close > open
}


// ============================================================================
// POSITION MANAGEMENT — INTRA-TRADE MONITORING
// ============================================================================

export interface OpenPosition {
  symbol: string
  setup: 'A' | 'B'
  entryDate: string
  entryPrice: number
  stopLoss: number
  target1: number | null
  shares: number
  daysSinceEntry: number
  partialExitDone: boolean
  partialPnl: number
  dailyCloses: number[]
  dailyHighs: number[]
  dailyLows: number[]
  ema10Values: (number | null)[]
}

export interface PositionAction {
  action: 'EXIT_FULL' | 'PARTIAL_EXIT' | 'HOLD'
  reason?: string
  exitPrice?: number
  pnlPct?: number
  urgency?: string
  exitQuantityPct?: number
  newStopLoss?: number
  note?: string
  daysSinceEntry?: number
  currentClose?: number
  stopLoss?: number
  ema10?: number | null
  distanceToStop?: string
  distanceToTarget?: string
}

/**
 * Monitor an open swing trade position and determine action
 */
export function monitorPosition(
  position: OpenPosition,
  daysSinceEntry: number,
  cfg: SwingConfig = DEFAULT_SWING_CONFIG,
): PositionAction {
  const { entryPrice, stopLoss, target1, partialExitDone, dailyCloses, dailyLows, ema10Values } = position

  const currentClose = dailyCloses[dailyCloses.length - 1]
  const currentLow = dailyLows[dailyLows.length - 1]
  const currentEma10 = ema10Values[ema10Values.length - 1]
  const pnlPct = (currentClose / entryPrice) - 1

  // 1. HARD STOP-LOSS HIT
  if (currentLow <= stopLoss) {
    return {
      action: 'EXIT_FULL',
      reason: 'STOP_LOSS_HIT',
      exitPrice: stopLoss,
      pnlPct: ((stopLoss / entryPrice) - 1),
      urgency: 'IMMEDIATE',
    }
  }

  // 2. TARGET 1 HIT (partial exit for Setup A)
  if (target1 && !partialExitDone && currentClose >= target1) {
    return {
      action: 'PARTIAL_EXIT',
      reason: 'TARGET_1_HIT',
      exitQuantityPct: cfg.PARTIAL_EXIT_PCT,
      exitPrice: target1,
      pnlPct: ((target1 / entryPrice) - 1),
      newStopLoss: entryPrice, // move stop to breakeven
      note: `Book ${cfg.PARTIAL_EXIT_PCT * 100}% — trail remainder with 10-EMA`,
    }
  }

  // 3. TRAILING STOP: Close below 10-EMA (after partial exit or for Setup B)
  if (partialExitDone || position.setup === 'B') {
    if (currentEma10 !== null && currentClose < currentEma10) {
      return {
        action: 'EXIT_FULL',
        reason: 'TRAILING_10EMA_VIOLATED',
        exitPrice: currentClose,
        pnlPct,
        note: 'Closed below 10-EMA — trailing exit triggered',
      }
    }
  }

  // 4. DEAD MONEY TIME STOP — exit if barely moved after 15 days
  if (daysSinceEntry >= cfg.DEAD_MONEY_DAYS && pnlPct < 0.01) {
    return {
      action: 'EXIT_FULL',
      reason: 'DEAD_MONEY',
      exitPrice: currentClose,
      pnlPct,
      note: `${cfg.DEAD_MONEY_DAYS} days passed, stock only moved ${(pnlPct * 100).toFixed(1)}%`,
    }
  }

  // 5. MAX HOLDING PERIOD
  if (daysSinceEntry >= cfg.MAX_HOLDING_DAYS) {
    return {
      action: 'EXIT_FULL',
      reason: 'MAX_HOLDING_PERIOD',
      exitPrice: currentClose,
      pnlPct,
    }
  }

  // 6. ALL GOOD — HOLD
  return {
    action: 'HOLD',
    daysSinceEntry,
    pnlPct,
    currentClose,
    stopLoss,
    ema10: currentEma10 ? round2(currentEma10) : null,
    distanceToStop: round2(((currentClose - stopLoss) / currentClose) * 100) + '%',
    distanceToTarget: target1
      ? round2(((target1 - currentClose) / currentClose) * 100) + '%'
      : 'trailing',
  }
}


// ============================================================================
// ANALYTICS HELPERS
// ============================================================================

export function calcSharpeRatio(returns: number[], periodsPerYear: number, cfg: SwingConfig = DEFAULT_SWING_CONFIG): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  const std = Math.sqrt(variance)
  const annReturn = mean * periodsPerYear
  const annStd = std * Math.sqrt(periodsPerYear)
  if (annStd === 0) return null
  return (annReturn - cfg.RISK_FREE_RATE) / annStd
}

export function calcSortinoRatio(returns: number[], periodsPerYear: number, cfg: SwingConfig = DEFAULT_SWING_CONFIG): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const downside = returns.filter(r => r < 0)
  if (downside.length === 0) return Infinity
  const dsVar = downside.reduce((s, r) => s + r ** 2, 0) / downside.length
  const dsDev = Math.sqrt(dsVar) * Math.sqrt(periodsPerYear)
  const annReturn = mean * periodsPerYear
  if (dsDev === 0) return Infinity
  return (annReturn - cfg.RISK_FREE_RATE) / dsDev
}

/**
 * Calculate stats for a subset of trades (by setup type)
 */
export function calcSetupStats(trades: ClosedTrade[]) {
  if (trades.length === 0) return { trades: 0 }
  const winners = trades.filter(t => t.pnl > 0)
  return {
    trades: trades.length,
    winRate: round2((winners.length / trades.length) * 100) + '%',
    avgPnlPct: round2(trades.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / trades.length) + '%',
    totalPnl: Math.round(trades.reduce((s, t) => s + t.pnl, 0)),
    avgHoldingDays: round2(trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length),
  }
}

/**
 * Analyze which exit reasons produce the best/worst outcomes
 */
export function analyzeExitEffectiveness(trades: ClosedTrade[]) {
  const byReason: Record<string, { count: number; totalPnl: number; wins: number; pnlPcts: number[] }> = {}

  for (const t of trades) {
    if (!byReason[t.exitReason]) {
      byReason[t.exitReason] = { count: 0, totalPnl: 0, wins: 0, pnlPcts: [] }
    }
    byReason[t.exitReason].count++
    byReason[t.exitReason].totalPnl += t.pnl
    byReason[t.exitReason].pnlPcts.push(parseFloat(t.pnlPct))
    if (t.pnl > 0) byReason[t.exitReason].wins++
  }

  const result: Record<string, { count: number; winRate: string; avgPnlPct: string; totalPnl: number }> = {}
  for (const [reason, data] of Object.entries(byReason)) {
    result[reason] = {
      count: data.count,
      winRate: round2((data.wins / data.count) * 100) + '%',
      avgPnlPct: round2(data.pnlPcts.reduce((s, p) => s + p, 0) / data.count) + '%',
      totalPnl: Math.round(data.totalPnl),
    }
  }
  return result
}

/**
 * Analyze trade performance by holding duration buckets
 */
export function analyzeByHoldingDuration(trades: ClosedTrade[]) {
  const buckets: Record<string, { trades: ClosedTrade[]; label: string }> = {
    '1-5 days': { trades: [], label: 'Very short' },
    '6-10 days': { trades: [], label: 'Short' },
    '11-15 days': { trades: [], label: 'Medium' },
    '16-20 days': { trades: [], label: 'Full swing' },
    '20+ days': { trades: [], label: 'Extended' },
  }

  for (const t of trades) {
    if (t.holdingDays <= 5) buckets['1-5 days'].trades.push(t)
    else if (t.holdingDays <= 10) buckets['6-10 days'].trades.push(t)
    else if (t.holdingDays <= 15) buckets['11-15 days'].trades.push(t)
    else if (t.holdingDays <= 20) buckets['16-20 days'].trades.push(t)
    else buckets['20+ days'].trades.push(t)
  }

  const result: Record<string, { count: number; winRate?: string; avgPnlPct?: string }> = {}
  for (const [bucket, data] of Object.entries(buckets)) {
    const bt = data.trades
    if (bt.length === 0) {
      result[bucket] = { count: 0 }
      continue
    }
    const wins = bt.filter(t => t.pnl > 0).length
    result[bucket] = {
      count: bt.length,
      winRate: round2((wins / bt.length) * 100) + '%',
      avgPnlPct: round2(bt.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / bt.length) + '%',
    }
  }
  return result
}


// ============================================================================
// BACKTEST ENGINE
// ============================================================================

export interface ClosedTrade {
  symbol: string
  setup: string
  entryDate: string
  exitDate: string
  entryPrice: number
  exitPrice: number
  shares: number
  pnl: number
  pnlPct: string
  holdingDays: number
  exitReason: string
}

export interface EquityCurvePoint {
  date: string
  cash: number
  openPositions: number
  totalEquity: number
  drawdown: string
}

export interface BacktestResult {
  summary: Record<string, any>
  bySetup: {
    setupA_EmaPullback: Record<string, any>
    setupB_MacdCrossover: Record<string, any>
  }
  exitReasonBreakdown: Record<string, number>
  trades: ClosedTrade[]
  equityCurve: EquityCurvePoint[]
}

export interface DailyUniverseSnapshot {
  date: string
  stocks: SwingStockData[]
}

/**
 * Backtest the swing strategy over historical data
 */
export function runBacktest(
  dailyUniverseSnapshots: DailyUniverseSnapshot[],
  capitalBase: number = 5000000,
  cfg: SwingConfig = DEFAULT_SWING_CONFIG,
): BacktestResult {
  let capital = capitalBase
  const openPositions: OpenPosition[] = []
  const closedTrades: ClosedTrade[] = []
  const equityCurve: EquityCurvePoint[] = []
  let peakCapital = capitalBase
  let maxDrawdown = 0

  for (let dayIdx = 0; dayIdx < dailyUniverseSnapshots.length; dayIdx++) {
    const { date, stocks } = dailyUniverseSnapshots[dayIdx]

    // MONITOR OPEN POSITIONS
    const toClose: number[] = []

    for (let p = 0; p < openPositions.length; p++) {
      const pos = openPositions[p]
      pos.daysSinceEntry++

      const stockData = stocks.find(s => s.symbol === pos.symbol)
      if (!stockData) continue

      const len = stockData.closes.length
      pos.dailyCloses.push(stockData.closes[len - 1])
      pos.dailyHighs.push(stockData.highs[len - 1])
      pos.dailyLows.push(stockData.lows[len - 1])

      // Compute 10-EMA for trailing
      const ema10Now = calcEMA(pos.dailyCloses, cfg.EMA_FAST)
      pos.ema10Values.push(ema10Now[ema10Now.length - 1])

      const action = monitorPosition(pos, pos.daysSinceEntry, cfg)

      if (action.action === 'EXIT_FULL') {
        const exitPrice = action.exitPrice!
        const pnl = (exitPrice - pos.entryPrice) * pos.shares

        let totalPnl = pnl
        if (pos.partialPnl) totalPnl = pos.partialPnl + pnl * (1 - cfg.PARTIAL_EXIT_PCT)

        closedTrades.push({
          symbol: pos.symbol,
          setup: pos.setup,
          entryDate: pos.entryDate,
          exitDate: date,
          entryPrice: pos.entryPrice,
          exitPrice: round2(exitPrice)!,
          shares: pos.shares,
          pnl: Math.round(totalPnl),
          pnlPct: round2(((exitPrice / pos.entryPrice) - 1) * 100) + '%',
          holdingDays: pos.daysSinceEntry,
          exitReason: action.reason!,
        })

        capital += totalPnl
        toClose.push(p)
      } else if (action.action === 'PARTIAL_EXIT' && !pos.partialExitDone) {
        const partialShares = Math.floor(pos.shares * cfg.PARTIAL_EXIT_PCT)
        const partialPnl = (action.exitPrice! - pos.entryPrice) * partialShares
        capital += partialPnl
        pos.partialPnl = partialPnl
        pos.partialExitDone = true
        pos.shares -= partialShares
        pos.stopLoss = pos.entryPrice // move to breakeven
      }
    }

    // Remove closed (reverse order to preserve indices)
    for (let i = toClose.length - 1; i >= 0; i--) {
      openPositions.splice(toClose[i], 1)
    }

    // SCAN FOR NEW ENTRIES (only if capacity)
    if (openPositions.length < cfg.MAX_CONCURRENT_POSITIONS) {
      const slotsAvailable = cfg.MAX_CONCURRENT_POSITIONS - openPositions.length

      // Scan weekly (every 5 trading days)
      if (dayIdx % 5 === 0) {
        const scanResult = scanUniverse(stocks, date, cfg)
        const allSignals = [
          ...scanResult.setupA_signals.map(s => ({ ...s, setupType: 'A' as const })),
          ...scanResult.setupB_signals.map(s => ({ ...s, setupType: 'B' as const })),
        ]

        allSignals.sort((a, b) => b.score - a.score)
        const newEntries = allSignals.slice(0, slotsAvailable)

        const currentSymbols = new Set(openPositions.map(p => p.symbol))

        for (const signal of newEntries) {
          if (currentSymbols.has(signal.symbol)) continue
          if (!signal.trade) continue

          const sizing = calcPositionSize(capital, signal.trade.entry, signal.trade.stopLoss, cfg)
          if (sizing.shares <= 0) continue

          openPositions.push({
            symbol: signal.symbol,
            setup: signal.setupType,
            entryDate: date,
            entryPrice: signal.trade.entry,
            stopLoss: signal.trade.stopLoss,
            target1: signal.trade.target1 || null,
            shares: sizing.shares,
            daysSinceEntry: 0,
            partialExitDone: false,
            partialPnl: 0,
            dailyCloses: [signal.trade.entry],
            dailyHighs: [signal.trade.entry],
            dailyLows: [signal.trade.entry],
            ema10Values: [signal.trade.entry],
          })

          capital -= sizing.positionValue
          currentSymbols.add(signal.symbol)
        }
      }
    }

    // EQUITY CURVE
    let openValue = 0
    for (const pos of openPositions) {
      const lastClose = pos.dailyCloses[pos.dailyCloses.length - 1]
      openValue += lastClose * pos.shares
    }
    const totalEquity = capital + openValue

    if (totalEquity > peakCapital) peakCapital = totalEquity
    const dd = (peakCapital - totalEquity) / peakCapital
    if (dd > maxDrawdown) maxDrawdown = dd

    equityCurve.push({
      date,
      cash: Math.round(capital),
      openPositions: openPositions.length,
      totalEquity: Math.round(totalEquity),
      drawdown: round2(dd * 100) + '%',
    })
  }

  // FORCE CLOSE remaining positions
  for (const pos of openPositions) {
    const exitPrice = pos.dailyCloses[pos.dailyCloses.length - 1]
    const pnl = (exitPrice - pos.entryPrice) * pos.shares
    closedTrades.push({
      symbol: pos.symbol,
      setup: pos.setup,
      entryDate: pos.entryDate,
      exitDate: 'FORCED_CLOSE',
      entryPrice: pos.entryPrice,
      exitPrice: round2(exitPrice)!,
      shares: pos.shares,
      pnl: Math.round(pnl),
      pnlPct: round2(((exitPrice / pos.entryPrice) - 1) * 100) + '%',
      holdingDays: pos.daysSinceEntry,
      exitReason: 'BACKTEST_END',
    })
    capital += exitPrice * pos.shares
  }

  return buildBacktestSummary(closedTrades, equityCurve, capitalBase, capital, maxDrawdown, cfg)
}

/**
 * Build summary statistics from backtest results
 */
export function buildBacktestSummary(
  trades: ClosedTrade[],
  equityCurve: EquityCurvePoint[],
  capitalBase: number,
  finalCapital: number,
  maxDrawdown: number,
  cfg: SwingConfig = DEFAULT_SWING_CONFIG,
): BacktestResult {
  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl <= 0)
  const totalTrades = trades.length

  const winRate = totalTrades > 0 ? winners.length / totalTrades : 0

  const avgWinPct = winners.length > 0
    ? winners.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / winners.length
    : 0
  const avgLossPct = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / losers.length)
    : 0

  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity

  const avgHoldingDays = totalTrades > 0
    ? trades.reduce((s, t) => s + t.holdingDays, 0) / totalTrades
    : 0

  const setupAStats = calcSetupStats(trades.filter(t => t.setup === 'A'))
  const setupBStats = calcSetupStats(trades.filter(t => t.setup === 'B'))

  const exitReasons: Record<string, number> = {}
  for (const t of trades) {
    exitReasons[t.exitReason] = (exitReasons[t.exitReason] || 0) + 1
  }

  // Sharpe from equity curve (weekly returns)
  const periodicReturns: number[] = []
  for (let i = 5; i < equityCurve.length; i += 5) {
    const prev = equityCurve[i - 5].totalEquity
    const curr = equityCurve[i].totalEquity
    if (prev > 0) periodicReturns.push((curr / prev) - 1)
  }

  const sharpe = calcSharpeRatio(periodicReturns, 52, cfg)
  const sortino = calcSortinoRatio(periodicReturns, 52, cfg)

  // Consecutive losses
  let maxConsecLoss = 0
  let currentStreak = 0
  for (const t of trades) {
    if (t.pnl <= 0) {
      currentStreak++
      maxConsecLoss = Math.max(maxConsecLoss, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  const totalReturn = (finalCapital / capitalBase) - 1

  return {
    summary: {
      startingCapital: capitalBase,
      endingCapital: Math.round(finalCapital),
      totalReturn: round2(totalReturn * 100) + '%',
      totalTrades,
      winRate: round2(winRate * 100) + '%',
      avgWinnerPct: round2(avgWinPct) + '%',
      avgLoserPct: round2(avgLossPct) + '%',
      winLossRatio: avgLossPct > 0 ? round2(avgWinPct / avgLossPct) : 'N/A',
      profitFactor: profitFactor !== Infinity ? round2(profitFactor) : 'N/A',
      maxDrawdown: round2(maxDrawdown * 100) + '%',
      avgHoldingDays: round2(avgHoldingDays),
      sharpeRatio: sharpe !== null ? round2(sharpe) : 'N/A',
      sortinoRatio: sortino !== null ? round2(sortino) : 'N/A',
      maxConsecutiveLosses: maxConsecLoss,
    },
    bySetup: {
      setupA_EmaPullback: setupAStats,
      setupB_MacdCrossover: setupBStats,
    },
    exitReasonBreakdown: exitReasons,
    trades,
    equityCurve,
  }
}


// ============================================================================
// ANALYSIS REPORT GENERATOR
// ============================================================================

/**
 * Generate full analysis report from backtest results
 */
export function generateAnalysisReport(backtestResults: BacktestResult) {
  const { trades } = backtestResults

  const top5Winners = [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 5)
  const top5Losers = [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 5)

  return {
    performance: backtestResults.summary,
    setupComparison: backtestResults.bySetup,
    exitEffectiveness: analyzeExitEffectiveness(trades),
    holdingDurationAnalysis: analyzeByHoldingDuration(trades),
    topWinners: top5Winners.map(t => ({
      symbol: t.symbol,
      setup: t.setup,
      pnlPct: t.pnlPct,
      holdingDays: t.holdingDays,
      exitReason: t.exitReason,
    })),
    topLosers: top5Losers.map(t => ({
      symbol: t.symbol,
      setup: t.setup,
      pnlPct: t.pnlPct,
      holdingDays: t.holdingDays,
      exitReason: t.exitReason,
    })),
    equityCurve: backtestResults.equityCurve,
  }
}
