// src/lib/strategy/orderflow.ts
// Order Flow & Market Depth Strategy Engine — Consolidated
//
// Synthesises order flow signals from 5-min OHLCV+volume data since
// Level 2 depth is not available from Yahoo Finance.
//
// Proxy mapping:
//   Bid-Ask Ratio  → volume × close-position-in-range (buying/selling pressure)
//   Absorption     → high volume at S/R with breakout
//   Stacking       → consecutive candles with rising volume at support/resistance
//   Spoofing       → volume spike with long wicks (fake move)
//   Cum. Delta     → running buy vs sell volume classifier
//   Iceberg        → repeated volume bursts at same price level

// ═══════════════════════════════════════════════════════════
// SECTION 1: CONFIG, TYPES, ENUMS
// ═══════════════════════════════════════════════════════════

export const OF_MODE = { STANDALONE: 'STANDALONE', CONFIRMATION: 'CONFIRMATION' } as const
export const DIRECTION = { LONG: 'LONG', SHORT: 'SHORT', NONE: 'NONE' } as const
export const OF_BIAS = { BULLISH: 'BULLISH', BEARISH: 'BEARISH', NEUTRAL: 'NEUTRAL' } as const

export const OF_PATTERN = {
  ABSORPTION_BULLISH: 'ABSORPTION_BULLISH',
  ABSORPTION_BEARISH: 'ABSORPTION_BEARISH',
  STACKING_BID: 'STACKING_BID',
  STACKING_ASK: 'STACKING_ASK',
  SPOOF_BID: 'SPOOF_BID',
  SPOOF_ASK: 'SPOOF_ASK',
  ICEBERG_BID: 'ICEBERG_BID',
  ICEBERG_ASK: 'ICEBERG_ASK',
  BID_DOMINANCE: 'BID_DOMINANCE',
  ASK_DOMINANCE: 'ASK_DOMINANCE',
  DELTA_SURGE_POSITIVE: 'DELTA_SURGE_POSITIVE',
  DELTA_SURGE_NEGATIVE: 'DELTA_SURGE_NEGATIVE',
} as const

export const EXIT_REASON = {
  TARGET_1: 'TARGET_1',
  TRAIL_STOP: 'TRAIL_STOP',
  STOP_LOSS: 'STOP_LOSS',
  DEPTH_REVERSAL: 'DEPTH_REVERSAL',
  LARGE_OPPOSING_FLOW: 'LARGE_OPPOSING_FLOW',
  TIME_STOP_EOD: 'TIME_STOP_EOD',
} as const

export const OF_CONFIG = {
  // Market timings IST
  MARKET_OPEN_H: 9, MARKET_OPEN_M: 15,
  MARKET_CLOSE_H: 15, MARKET_CLOSE_M: 30,
  MIS_EXIT_H: 15, MIS_EXIT_M: 15,
  CANDLE_INTERVAL_MIN: 5,

  // BAR thresholds (synthetic)
  BAR_BULLISH_THRESHOLD: 1.3,
  BAR_BEARISH_THRESHOLD: 0.7,
  BAR_NEUTRAL_LOW: 0.8,
  BAR_NEUTRAL_HIGH: 1.2,
  BAR_SMOOTHING_WINDOW: 5,

  // Absorption
  ABSORPTION_VOL_MULTIPLE: 2.0,   // volume ≥ 2× average at key level
  ABSORPTION_MIN_CANDLES: 3,
  ABSORPTION_BREAKOUT_PCT: 0.003, // 0.3% price move after absorption

  // Stacking
  STACKING_MIN_CANDLES: 3,
  STACKING_VOL_GROWTH_MIN: 1.2,   // each candle's volume ≥ 1.2× previous
  STACKING_PRICE_BAND_PCT: 0.005, // support/resistance within 0.5%

  // Spoofing (fake moves)
  SPOOF_WICK_RATIO: 0.6,         // wick ≥ 60% of total candle range
  SPOOF_VOL_MULTIPLE: 1.8,       // volume spike
  SPOOF_REVERSAL_PCT: 0.003,     // price reverses by 0.3% in next candle

  // Iceberg
  ICEBERG_PRICE_TOLERANCE: 0.002,
  ICEBERG_MIN_REPEATS: 3,
  ICEBERG_VOL_MIN_MULTIPLE: 1.5,

  // Delta
  DELTA_SURGE_THRESHOLD: 2.0,
  DELTA_AVG_WINDOW: 10,

  // Signal
  STANDALONE_MIN_SCORE: 60,
  NO_TRADE_BEFORE_H: 9, NO_TRADE_BEFORE_M: 20,
  LAST_ENTRY_H: 14, LAST_ENTRY_M: 30,

  // Trade management
  SL_PCT: 0.005,
  MAX_SL_PCT: 0.008,
  TARGET_RR: 1.5,
  TARGET_1_QTY_PCT: 0.60,
  TRAIL_QTY_PCT: 0.40,
  SLIPPAGE_PER_SIDE: 0.0005,
  COMMISSION_PER_SIDE: 20,
  DEFAULT_CAPITAL: 100_000,
  MAX_TRADES_PER_DAY: 3,

  // Confirmation mode
  CONFIRM_MIN_BAR: 1.2,
  CONFIRM_MAX_BAR: 0.8,
}

interface Candle {
  time: Date | string
  open: number; high: number; low: number; close: number; volume: number
}

interface SynthDepth {
  bar: number      // bid-ask ratio proxy
  buyVol: number   // estimated buy volume
  sellVol: number  // estimated sell volume
  delta: number    // buy - sell
  pressure: number // -1 (all sell) to +1 (all buy)
  closePosition: number // 0 (at low) to 1 (at high)
}

interface PatternEvent {
  pattern: string
  direction: string // BULLISH or BEARISH
  score: number
  candleIndex: number
  time: Date | string
  detail: string
}

interface Signal {
  mode: string; direction: string
  entryPrice: number; entryTime: Date | string; entryIndex: number
  sl: number; targets: { price: number | null; qtyPct: number; label: string }[]
  patternScore: number; primaryPattern: string | null
  patterns: PatternEvent[]
  bar: number; cumDelta: number; bias: string; biasStrength: number
}

interface PartialExit {
  time: Date | string; price: number; qtyPct: number; reason: string
}

interface Trade extends Signal {
  avgExitPrice: number; exitTime: Date | string | null
  grossPnlPct: number; netPnlPct: number; isWinner: boolean
  partialExits: PartialExit[]; primaryExitReason: string
}

// ═══════════════════════════════════════════════════════════
// SECTION 2: SYNTHETIC DEPTH FROM CANDLES
// ═══════════════════════════════════════════════════════════

function toDate(t: Date | string): Date {
  return t instanceof Date ? t : new Date(String(t))
}
function toMinutes(h: number, m: number) { return h * 60 + m }
function candleMinutes(c: Candle) {
  const d = toDate(c.time)
  return toMinutes(d.getUTCHours(), d.getUTCMinutes()) + 330 // UTC → IST
}
function isInTradeWindow(c: Candle) {
  const t = candleMinutes(c)
  return t >= toMinutes(OF_CONFIG.NO_TRADE_BEFORE_H, OF_CONFIG.NO_TRADE_BEFORE_M) &&
         t <= toMinutes(OF_CONFIG.LAST_ENTRY_H, OF_CONFIG.LAST_ENTRY_M)
}
function isPastMISExit(c: Candle) {
  return candleMinutes(c) >= toMinutes(OF_CONFIG.MIS_EXIT_H, OF_CONFIG.MIS_EXIT_M)
}

/**
 * Synthesise depth metrics from a single candle.
 * Close position in the range determines buying/selling pressure.
 */
function synthDepthFromCandle(c: Candle): SynthDepth {
  const range = c.high - c.low
  const closePosition = range > 0 ? (c.close - c.low) / range : 0.5

  // Buy volume: proportion of volume attributed to buyers
  const buyVol = Math.round(c.volume * closePosition)
  const sellVol = c.volume - buyVol
  const delta = buyVol - sellVol

  // BAR: ratio of buy to sell pressure
  const bar = sellVol > 0 ? buyVol / sellVol : (buyVol > 0 ? 5.0 : 1.0)
  const pressure = c.volume > 0 ? delta / c.volume : 0 // -1 to +1

  return { bar: r4(bar), buyVol, sellVol, delta, pressure: r4(pressure), closePosition: r4(closePosition) }
}

/**
 * Compute smoothed BAR over a window of candles.
 */
function computeSmoothedBAR(candles: Candle[], windowSize = OF_CONFIG.BAR_SMOOTHING_WINDOW) {
  const recent = candles.slice(-windowSize)
  if (recent.length === 0) return { smoothedBAR: 1.0, avgPressure: 0, samples: 0 }

  const depths = recent.map(c => synthDepthFromCandle(c))
  const avgBAR = safeMean(depths.map(d => d.bar))
  const avgPressure = safeMean(depths.map(d => d.pressure))

  return { smoothedBAR: r4(avgBAR), avgPressure: r4(avgPressure), samples: recent.length }
}

/**
 * Determine directional bias from synthetic depth.
 */
function determineBias(bar: number, pressure: number): { bias: string; strength: number; reason: string } {
  let bias: string = OF_BIAS.NEUTRAL, strength = 0, reason = ''

  if (bar >= OF_CONFIG.BAR_BULLISH_THRESHOLD) {
    bias = OF_BIAS.BULLISH
    strength = Math.min(100, Math.round(((bar - 1.0) / 1.0) * 100))
    reason = `BAR ${bar} ≥ ${OF_CONFIG.BAR_BULLISH_THRESHOLD} (buyers dominant)`
  } else if (bar <= OF_CONFIG.BAR_BEARISH_THRESHOLD) {
    bias = OF_BIAS.BEARISH
    strength = Math.min(100, Math.round(((1.0 - bar) / 1.0) * 100))
    reason = `BAR ${bar} ≤ ${OF_CONFIG.BAR_BEARISH_THRESHOLD} (sellers dominant)`
  } else if (bar > OF_CONFIG.BAR_NEUTRAL_HIGH) {
    bias = OF_BIAS.BULLISH
    strength = Math.min(50, Math.round(((bar - 1.0) / 0.3) * 50))
    reason = `BAR ${bar} mildly bullish`
  } else if (bar < OF_CONFIG.BAR_NEUTRAL_LOW) {
    bias = OF_BIAS.BEARISH
    strength = Math.min(50, Math.round(((1.0 - bar) / 0.3) * 50))
    reason = `BAR ${bar} mildly bearish`
  } else {
    reason = `BAR ${bar} neutral`
  }

  // Boost if pressure aligns
  if (pressure > 0.3 && bias === OF_BIAS.BULLISH) strength = Math.min(100, strength + 15)
  if (pressure < -0.3 && bias === OF_BIAS.BEARISH) strength = Math.min(100, strength + 15)

  return { bias, strength, reason }
}

/**
 * Compute cumulative delta across candles.
 */
function computeCumulativeDelta(candles: Candle[]) {
  let cumDelta = 0
  const recentDeltas: number[] = []
  const results: { cumDelta: number; tickDelta: number; avgDelta: number; isSurge: boolean; surgeDir: string }[] = []

  for (const c of candles) {
    const depth = synthDepthFromCandle(c)
    const tickDelta = depth.delta
    cumDelta += tickDelta
    recentDeltas.push(tickDelta)
    if (recentDeltas.length > OF_CONFIG.DELTA_AVG_WINDOW) recentDeltas.shift()

    const avgDelta = safeMean(recentDeltas)
    const absAvg = Math.abs(avgDelta) || 1
    const ratio = Math.abs(tickDelta) / absAvg
    const isSurge = ratio >= OF_CONFIG.DELTA_SURGE_THRESHOLD
    const surgeDir = tickDelta > 0 ? 'POSITIVE' : tickDelta < 0 ? 'NEGATIVE' : 'NONE'

    results.push({ cumDelta, tickDelta, avgDelta: Math.round(avgDelta), isSurge, surgeDir })
  }
  return results
}


// ═══════════════════════════════════════════════════════════
// SECTION 3: PATTERN DETECTION (from candle proxies)
// ═══════════════════════════════════════════════════════════

function avgVolume(candles: Candle[], end: number, window = 20): number {
  const start = Math.max(0, end - window)
  const slice = candles.slice(start, end)
  return slice.length > 0 ? safeMean(slice.map(c => c.volume)) : 1
}

/**
 * ABSORPTION: high volume at a price level with breakout.
 * Asks absorbed (bullish) = price breaks resistance; Bids absorbed (bearish) = breaks support.
 */
function detectAbsorption(candles: Candle[]): PatternEvent[] {
  const events: PatternEvent[] = []
  if (candles.length < 5) return events

  for (let i = OF_CONFIG.ABSORPTION_MIN_CANDLES; i < candles.length - 1; i++) {
    const avgVol = avgVolume(candles, i)
    const c = candles[i]
    const next = candles[i + 1]

    // Check for high volume touch at a resistance/support
    if (c.volume < avgVol * OF_CONFIG.ABSORPTION_VOL_MULTIPLE) continue

    // Bullish absorption: high volume at resistance (high area), then breakout up
    const priceBreakUp = (next.close - c.high) / c.high
    if (priceBreakUp >= OF_CONFIG.ABSORPTION_BREAKOUT_PCT && c.close > c.open) {
      // Confirm: multiple touches near this high in recent candles
      const level = c.high
      const touches = candles.slice(Math.max(0, i - 5), i + 1)
        .filter(cc => Math.abs(cc.high - level) / level < 0.003).length
      if (touches >= 2) {
        events.push({
          pattern: OF_PATTERN.ABSORPTION_BULLISH,
          direction: 'BULLISH',
          score: Math.min(100, 30 + Math.round((c.volume / avgVol) * 15) + touches * 10),
          candleIndex: i,
          time: c.time,
          detail: `Vol ${r0(c.volume)} (${r1(c.volume / avgVol)}× avg), ${touches} touches at ${r2(level)}, breakout +${r2(priceBreakUp * 100)}%`,
        })
      }
    }

    // Bearish absorption: high volume at support, then breakdown
    const priceBreakDown = (c.low - next.close) / c.low
    if (priceBreakDown >= OF_CONFIG.ABSORPTION_BREAKOUT_PCT && c.close < c.open) {
      const level = c.low
      const touches = candles.slice(Math.max(0, i - 5), i + 1)
        .filter(cc => Math.abs(cc.low - level) / level < 0.003).length
      if (touches >= 2) {
        events.push({
          pattern: OF_PATTERN.ABSORPTION_BEARISH,
          direction: 'BEARISH',
          score: Math.min(100, 30 + Math.round((c.volume / avgVol) * 15) + touches * 10),
          candleIndex: i,
          time: c.time,
          detail: `Vol ${r0(c.volume)} at support ${r2(level)}, breakdown -${r2(priceBreakDown * 100)}%`,
        })
      }
    }
  }
  return events
}

/**
 * STACKING: consecutive candles with increasing volume at support/resistance.
 */
function detectStacking(candles: Candle[]): PatternEvent[] {
  const events: PatternEvent[] = []
  if (candles.length < OF_CONFIG.STACKING_MIN_CANDLES + 1) return events

  for (let i = OF_CONFIG.STACKING_MIN_CANDLES; i < candles.length; i++) {
    const window = candles.slice(i - OF_CONFIG.STACKING_MIN_CANDLES, i + 1)

    // Check price band (all within tight range)
    const avgClose = safeMean(window.map(c => c.close))
    const allInBand = window.every(c => Math.abs(c.close - avgClose) / avgClose < OF_CONFIG.STACKING_PRICE_BAND_PCT)
    if (!allInBand) continue

    // Check volume growth
    let volGrowing = true
    for (let j = 1; j < window.length; j++) {
      if (window[j].volume < window[j - 1].volume * OF_CONFIG.STACKING_VOL_GROWTH_MIN * 0.8) {
        volGrowing = false; break
      }
    }
    if (!volGrowing) continue

    const totalVol = window.reduce((s, c) => s + c.volume, 0)
    const avgVol = avgVolume(candles, i - OF_CONFIG.STACKING_MIN_CANDLES)

    // Determine direction: if price is consolidating near lows → bid stacking (bullish)
    const avgHigh = safeMean(window.map(c => c.high))
    const avgLow = safeMean(window.map(c => c.low))
    const relPos = avgHigh > avgLow ? (avgClose - avgLow) / (avgHigh - avgLow) : 0.5

    const isBidStack = relPos < 0.4 // consolidating near support
    const pattern = isBidStack ? OF_PATTERN.STACKING_BID : OF_PATTERN.STACKING_ASK
    const dir = isBidStack ? 'BULLISH' : 'BEARISH'

    events.push({
      pattern, direction: dir,
      score: Math.min(100, 25 + Math.round((totalVol / (avgVol * window.length)) * 20) + window.length * 8),
      candleIndex: i,
      time: candles[i].time,
      detail: `${window.length} candles, vol growing, total ${r0(totalVol)}, ${dir.toLowerCase()} stacking`,
    })
  }
  return events
}

/**
 * SPOOFING: volume spike with long wick = fake move reversed.
 */
function detectSpoofing(candles: Candle[]): PatternEvent[] {
  const events: PatternEvent[] = []
  if (candles.length < 3) return events

  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i]
    const next = candles[i + 1]
    const avgVol = avgVolume(candles, i)
    const range = c.high - c.low
    if (range <= 0 || c.volume < avgVol * OF_CONFIG.SPOOF_VOL_MULTIPLE) continue

    const upperWick = c.high - Math.max(c.open, c.close)
    const lowerWick = Math.min(c.open, c.close) - c.low

    // Spoof bid (fake buying → long upper wick → bearish)
    if (upperWick / range >= OF_CONFIG.SPOOF_WICK_RATIO) {
      const reversal = (c.high - next.close) / c.high
      if (reversal >= OF_CONFIG.SPOOF_REVERSAL_PCT) {
        events.push({
          pattern: OF_PATTERN.SPOOF_BID,
          direction: 'BEARISH',
          score: Math.min(85, 30 + Math.round((upperWick / range) * 30) + Math.round(reversal * 3000)),
          candleIndex: i,
          time: c.time,
          detail: `Upper wick ${r1(upperWick / range * 100)}% of range, vol ${r1(c.volume / avgVol)}× avg, reversed -${r2(reversal * 100)}%`,
        })
      }
    }

    // Spoof ask (fake selling → long lower wick → bullish)
    if (lowerWick / range >= OF_CONFIG.SPOOF_WICK_RATIO) {
      const reversal = (next.close - c.low) / c.low
      if (reversal >= OF_CONFIG.SPOOF_REVERSAL_PCT) {
        events.push({
          pattern: OF_PATTERN.SPOOF_ASK,
          direction: 'BULLISH',
          score: Math.min(85, 30 + Math.round((lowerWick / range) * 30) + Math.round(reversal * 3000)),
          candleIndex: i,
          time: c.time,
          detail: `Lower wick ${r1(lowerWick / range * 100)}% of range, reversed +${r2(reversal * 100)}%`,
        })
      }
    }
  }
  return events
}

/**
 * ICEBERG: repeated volume bursts at the same price level.
 */
function detectIceberg(candles: Candle[]): PatternEvent[] {
  const events: PatternEvent[] = []
  if (candles.length < OF_CONFIG.ICEBERG_MIN_REPEATS + 2) return events

  // Group candles by price level (rounded)
  const priceGroups = new Map<number, { indices: number[]; totalVol: number }>()

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const avgVol = avgVolume(candles, i)
    if (c.volume < avgVol * OF_CONFIG.ICEBERG_VOL_MIN_MULTIPLE) continue

    // Use the candle's value area (close) as the price key
    const priceKey = Math.round(c.close * 5) / 5 // round to 0.20

    if (!priceGroups.has(priceKey)) priceGroups.set(priceKey, { indices: [], totalVol: 0 })
    const grp = priceGroups.get(priceKey)!
    grp.indices.push(i)
    grp.totalVol += c.volume
  }

  for (const [price, grp] of priceGroups) {
    if (grp.indices.length < OF_CONFIG.ICEBERG_MIN_REPEATS) continue

    // Check they're within a tight window (not spread across whole day)
    const span = grp.indices[grp.indices.length - 1] - grp.indices[0]
    if (span > 20) continue // too spread out

    // Determine direction: if buyers keep coming at this level → bullish support
    const lastIdx = grp.indices[grp.indices.length - 1]
    const c = candles[lastIdx]
    const direction = c.close >= c.open ? 'BULLISH' : 'BEARISH'
    const pattern = direction === 'BULLISH' ? OF_PATTERN.ICEBERG_BID : OF_PATTERN.ICEBERG_ASK

    events.push({
      pattern, direction,
      score: Math.min(90, 20 + grp.indices.length * 12 + Math.min(30, Math.round(grp.totalVol / 50000))),
      candleIndex: lastIdx,
      time: c.time,
      detail: `${grp.indices.length} volume bursts at ₹${r2(price)}, total vol ${r0(grp.totalVol)}`,
    })
  }
  return events
}

/**
 * Run all pattern detectors + delta/BAR dominance.
 */
function scanAllPatterns(candles: Candle[]): {
  absorptions: PatternEvent[]; spoofs: PatternEvent[]
  icebergs: PatternEvent[]; stackings: PatternEvent[]
  allPatterns: PatternEvent[]; compositeBias: string; compositeScore: number
  bullishScore: number; bearishScore: number
} {
  const absorptions = detectAbsorption(candles)
  const spoofs = detectSpoofing(candles)
  const icebergs = detectIceberg(candles)
  const stackings = detectStacking(candles)

  // Delta dominance
  const deltas = computeCumulativeDelta(candles)
  const deltaSurges: PatternEvent[] = []
  for (let i = 0; i < deltas.length; i++) {
    if (deltas[i].isSurge) {
      const dir = deltas[i].surgeDir === 'POSITIVE' ? 'BULLISH' : 'BEARISH'
      deltaSurges.push({
        pattern: dir === 'BULLISH' ? OF_PATTERN.DELTA_SURGE_POSITIVE : OF_PATTERN.DELTA_SURGE_NEGATIVE,
        direction: dir, score: 25, candleIndex: i, time: candles[i].time,
        detail: `Delta surge ${deltas[i].tickDelta} (${r1(Math.abs(deltas[i].tickDelta) / (Math.abs(deltas[i].avgDelta) || 1))}× avg)`,
      })
    }
  }

  // BAR dominance
  const { smoothedBAR, avgPressure } = computeSmoothedBAR(candles)
  const barDom: PatternEvent[] = []
  if (smoothedBAR >= OF_CONFIG.BAR_BULLISH_THRESHOLD) {
    barDom.push({
      pattern: OF_PATTERN.BID_DOMINANCE, direction: 'BULLISH', score: 20,
      candleIndex: candles.length - 1, time: candles[candles.length - 1]?.time || new Date(),
      detail: `Smoothed BAR ${smoothedBAR}, pressure ${avgPressure}`,
    })
  } else if (smoothedBAR <= OF_CONFIG.BAR_BEARISH_THRESHOLD) {
    barDom.push({
      pattern: OF_PATTERN.ASK_DOMINANCE, direction: 'BEARISH', score: 20,
      candleIndex: candles.length - 1, time: candles[candles.length - 1]?.time || new Date(),
      detail: `Smoothed BAR ${smoothedBAR}, pressure ${avgPressure}`,
    })
  }

  const allPatterns = [...absorptions, ...spoofs, ...icebergs, ...stackings, ...deltaSurges, ...barDom]
    .sort((a, b) => b.score - a.score)

  let bullishScore = 0, bearishScore = 0
  for (const p of allPatterns) {
    if (p.direction === 'BULLISH') bullishScore += p.score
    else if (p.direction === 'BEARISH') bearishScore += p.score
  }

  let compositeBias = 'NEUTRAL'
  let compositeScore = 0
  if (bullishScore > bearishScore && bullishScore > 30) {
    compositeBias = 'BULLISH'; compositeScore = Math.min(100, bullishScore)
  } else if (bearishScore > bullishScore && bearishScore > 30) {
    compositeBias = 'BEARISH'; compositeScore = Math.min(100, bearishScore)
  }

  return { absorptions, spoofs, icebergs, stackings, allPatterns, compositeBias, compositeScore, bullishScore, bearishScore }
}


// ═══════════════════════════════════════════════════════════
// SECTION 4: CONFIRMATION FILTERS
// ═══════════════════════════════════════════════════════════

export function confirmBAR(candles: Candle[], direction: string) {
  const { smoothedBAR } = computeSmoothedBAR(candles)
  const pass = direction === DIRECTION.LONG
    ? smoothedBAR >= OF_CONFIG.CONFIRM_MIN_BAR
    : smoothedBAR <= OF_CONFIG.CONFIRM_MAX_BAR
  return {
    pass, bar: smoothedBAR,
    reason: pass ? `BAR ${smoothedBAR} confirms ${direction}` :
      `BAR ${smoothedBAR} does NOT confirm ${direction}`,
  }
}

export function confirmPatterns(candles: Candle[], direction: string) {
  const scan = scanAllPatterns(candles)
  const expectedBias = direction === DIRECTION.LONG ? 'BULLISH' : 'BEARISH'
  const aligned = scan.allPatterns.filter(p => p.direction === expectedBias)
  const opposing = scan.allPatterns.filter(p => p.direction !== expectedBias && p.direction !== 'NEUTRAL')
  const spoofAgainst = scan.spoofs.filter(s => {
    if (direction === DIRECTION.LONG && s.pattern === OF_PATTERN.SPOOF_BID) return true
    if (direction === DIRECTION.SHORT && s.pattern === OF_PATTERN.SPOOF_ASK) return true
    return false
  })

  const alignedScore = aligned.reduce((s, p) => s + p.score, 0)
  const opposingScore = opposing.reduce((s, p) => s + p.score, 0)
  const pass = spoofAgainst.length === 0 && alignedScore - opposingScore >= 0

  return {
    pass, alignedScore, opposingScore,
    hasStrongPattern: aligned.some(p => p.score >= 60),
    spoofAgainst: spoofAgainst.length,
    reason: pass ? `Patterns confirm ${direction} (score +${alignedScore})` : `Patterns oppose ${direction}`,
  }
}

export function confirmDelta(candles: Candle[], direction: string) {
  const deltas = computeCumulativeDelta(candles)
  if (deltas.length === 0) return { pass: true, cumDelta: 0, reason: 'No data' }
  const last = deltas[deltas.length - 1]
  const pass = direction === DIRECTION.LONG ? last.cumDelta > 0 : last.cumDelta < 0
  return { pass, cumDelta: last.cumDelta, reason: pass ? `Delta confirms ${direction}` : `Delta opposes ${direction}` }
}

/**
 * Composite confirmation filter — the API other strategies call.
 */
export function confirmOrderFlow(candles: Candle[], direction: string): {
  confirmed: boolean; overallScore: number; recommendation: string; reason: string
} {
  if (candles.length === 0) return { confirmed: true, overallScore: 50, recommendation: 'ENTER', reason: 'No data' }

  const barR = confirmBAR(candles, direction)
  const patR = confirmPatterns(candles, direction)
  const delR = confirmDelta(candles, direction)

  const allPassed = barR.pass && patR.pass && delR.pass
  let score = 50
  if (barR.pass) score += 15
  if (patR.pass) score += 5
  if (patR.hasStrongPattern) score += 20
  if (delR.pass) score += 5
  if (!barR.pass) score -= 15
  if (patR.spoofAgainst > 0) score -= 25
  if (!delR.pass) score -= 10
  score = Math.max(0, Math.min(100, score))

  const recommendation = !allPassed ? 'SKIP' : score < 60 ? 'CAUTION' : 'ENTER'
  return { confirmed: allPassed, overallScore: score, recommendation, reason: `BAR:${barR.pass ? '✓' : '✗'} Pat:${patR.pass ? '✓' : '✗'} Δ:${delR.pass ? '✓' : '✗'}` }
}


// ═══════════════════════════════════════════════════════════
// SECTION 5: STANDALONE SIGNAL DETECTION
// ═══════════════════════════════════════════════════════════

function detectStandaloneSignals(candles: Candle[]): Signal[] {
  const signals: Signal[] = []

  for (let i = 10; i < candles.length - 1; i++) {
    const c = candles[i]
    if (!isInTradeWindow(c)) continue

    // Use a lookback window for pattern detection
    const lookback = candles.slice(Math.max(0, i - 15), i + 1)
    const scan = scanAllPatterns(lookback)
    const depth = synthDepthFromCandle(c)
    const { bias, strength } = determineBias(depth.bar, depth.pressure)

    // Filter patterns that occurred at/near this candle
    const recentPatterns = scan.allPatterns.filter(p => p.candleIndex >= lookback.length - 3)
    if (recentPatterns.length === 0) continue

    // Score
    let bullScore = 0, bearScore = 0
    for (const p of recentPatterns) {
      if (p.direction === 'BULLISH') bullScore += p.score
      else bearScore += p.score
    }

    // BAR + delta bonus
    const deltas = computeCumulativeDelta(lookback)
    const lastDelta = deltas[deltas.length - 1]
    if (depth.bar >= OF_CONFIG.BAR_BULLISH_THRESHOLD) bullScore += 15
    if (depth.bar <= OF_CONFIG.BAR_BEARISH_THRESHOLD) bearScore += 15
    if (lastDelta && lastDelta.cumDelta > 0) bullScore += 10
    if (lastDelta && lastDelta.cumDelta < 0) bearScore += 10

    const direction = bullScore > bearScore ? DIRECTION.LONG : DIRECTION.SHORT
    const score = Math.round(Math.max(bullScore, bearScore))

    if (score < OF_CONFIG.STANDALONE_MIN_SCORE) continue

    const entryPrice = c.close
    const isLong = direction === DIRECTION.LONG
    let sl = isLong ? entryPrice * (1 - OF_CONFIG.SL_PCT) : entryPrice * (1 + OF_CONFIG.SL_PCT)
    const slPct = Math.abs(entryPrice - sl) / entryPrice
    if (slPct > OF_CONFIG.MAX_SL_PCT) {
      sl = isLong ? entryPrice * (1 - OF_CONFIG.MAX_SL_PCT) : entryPrice * (1 + OF_CONFIG.MAX_SL_PCT)
    }
    const slDist = Math.abs(entryPrice - sl)
    const t1Price = isLong ? entryPrice + slDist * OF_CONFIG.TARGET_RR : entryPrice - slDist * OF_CONFIG.TARGET_RR

    signals.push({
      mode: OF_MODE.STANDALONE, direction, entryPrice, entryTime: c.time, entryIndex: i, sl,
      targets: [{ price: t1Price, qtyPct: OF_CONFIG.TARGET_1_QTY_PCT, label: 'T1' }, { price: null, qtyPct: OF_CONFIG.TRAIL_QTY_PCT, label: 'TRAIL' }],
      patternScore: score,
      primaryPattern: recentPatterns.length > 0 ? recentPatterns[0].pattern : null,
      patterns: recentPatterns,
      bar: depth.bar, cumDelta: lastDelta?.cumDelta ?? 0, bias, biasStrength: strength,
    })
  }
  return signals
}


// ═══════════════════════════════════════════════════════════
// SECTION 6: TRADE SIMULATION
// ═══════════════════════════════════════════════════════════

function simulateTrade(candles: Candle[], signal: Signal): Trade {
  const { direction, entryPrice, entryIndex, sl, targets } = signal
  const isLong = direction === DIRECTION.LONG

  let remainingQty = 1.0, currentSL = sl, t1Hit = false, trailActive = false
  const partialExits: PartialExit[] = []

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const c = candles[i]
    if (remainingQty <= 0) break

    // EOD exit
    if (isPastMISExit(c)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: EXIT_REASON.TIME_STOP_EOD })
      remainingQty = 0; break
    }

    // Stop-loss
    const hitSL = isLong ? c.low <= currentSL : c.high >= currentSL
    if (hitSL) {
      partialExits.push({ time: c.time, price: currentSL, qtyPct: remainingQty, reason: trailActive ? EXIT_REASON.TRAIL_STOP : EXIT_REASON.STOP_LOSS })
      remainingQty = 0; break
    }

    // Depth reversal check (synthetic — BAR flips against position)
    if (i >= entryIndex + 3) {
      const recentCandles = candles.slice(Math.max(0, i - 4), i + 1)
      const { smoothedBAR } = computeSmoothedBAR(recentCandles)
      const barFlipped = isLong ? smoothedBAR <= OF_CONFIG.BAR_BEARISH_THRESHOLD : smoothedBAR >= OF_CONFIG.BAR_BULLISH_THRESHOLD

      if (barFlipped && trailActive) {
        partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: EXIT_REASON.DEPTH_REVERSAL })
        remainingQty = 0; break
      }
      if (barFlipped && !t1Hit) {
        // Large opposing flow before T1 — exit
        partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: EXIT_REASON.LARGE_OPPOSING_FLOW })
        remainingQty = 0; break
      }
    }

    // Target 1
    if (!t1Hit && targets[0]?.price != null) {
      const hitT1 = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitT1) {
        t1Hit = true
        const exitQty = Math.min(targets[0].qtyPct, remainingQty)
        partialExits.push({ time: c.time, price: targets[0].price, qtyPct: exitQty, reason: EXIT_REASON.TARGET_1 })
        remainingQty -= exitQty
        trailActive = true
        currentSL = entryPrice // breakeven
      }
    }

    // Trailing stop
    if (trailActive && remainingQty > 0 && i > entryIndex + 1) {
      const prev = candles[i - 1]
      if (isLong && prev.low > currentSL) currentSL = prev.low
      if (!isLong && prev.high < currentSL) currentSL = prev.high
    }
  }

  return buildTradeRecord(signal, partialExits)
}

function buildTradeRecord(signal: Signal, partialExits: PartialExit[]): Trade {
  const { direction, entryPrice } = signal
  const isLong = direction === DIRECTION.LONG

  let weightedExit = 0, totalQty = 0
  for (const e of partialExits) { weightedExit += e.price * e.qtyPct; totalQty += e.qtyPct }

  const avgExitPrice = totalQty > 0 ? weightedExit / totalQty : entryPrice
  const grossPnlPct = isLong ? (avgExitPrice - entryPrice) / entryPrice : (entryPrice - avgExitPrice) / entryPrice
  const netPnlPct = grossPnlPct - (OF_CONFIG.SLIPPAGE_PER_SIDE * 2)

  const lastExit = partialExits[partialExits.length - 1]
  const reasonMap: Record<string, number> = {}
  for (const e of partialExits) reasonMap[e.reason] = (reasonMap[e.reason] || 0) + e.qtyPct
  let primaryReason = 'NONE', maxQ = 0
  for (const [r, q] of Object.entries(reasonMap)) { if (q > maxQ) { maxQ = q; primaryReason = r } }

  return {
    ...signal,
    avgExitPrice: r2(avgExitPrice),
    exitTime: lastExit?.time ?? null,
    grossPnlPct: r4(grossPnlPct),
    netPnlPct: r4(netPnlPct),
    isWinner: netPnlPct > 0,
    partialExits,
    primaryExitReason: primaryReason,
  }
}


// ═══════════════════════════════════════════════════════════
// SECTION 7: ANALYZER
// ═══════════════════════════════════════════════════════════

export function analyzePerformance(trades: Trade[], capital = OF_CONFIG.DEFAULT_CAPITAL) {
  if (trades.length === 0) return null

  const winners = trades.filter(t => t.isWinner)
  const losers = trades.filter(t => !t.isWinner)
  const pnls = trades.map(t => t.netPnlPct)

  const totalTrades = trades.length
  const winRate = winners.length / totalTrades
  const avgWin = safeMean(winners.map(t => t.netPnlPct))
  const avgLoss = safeMean(losers.map(t => t.netPnlPct))
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)

  // Equity curve
  let equity = capital
  let peak = capital, maxDD = 0
  for (const t of trades) {
    const slDist = Math.abs(t.entryPrice - t.sl) || t.entryPrice * 0.005
    const riskAmt = equity * 0.01
    const qty = Math.floor(riskAmt / slDist)
    equity += qty * t.entryPrice * t.netPnlPct - OF_CONFIG.COMMISSION_PER_SIDE * 2
    if (equity > peak) peak = equity
    const dd = (peak - equity) / peak
    if (dd > maxDD) maxDD = dd
  }

  const totalReturn = ((equity - capital) / capital) * 100
  const sharpe = pnls.length >= 2 ? computeSharpe(pnls) : 0

  let gp = 0, gl = 0
  for (const t of trades) { if (t.netPnlPct > 0) gp += t.netPnlPct; else gl += Math.abs(t.netPnlPct) }
  const profitFactor = gl > 0 ? gp / gl : gp > 0 ? Infinity : 0

  return {
    totalTrades,
    winners: winners.length, losers: losers.length,
    winRatePct: r2(winRate * 100),
    avgWinPct: r4(avgWin * 100), avgLossPct: r4(avgLoss * 100),
    expectancyPct: r4(expectancy * 100),
    totalReturnPct: r2(totalReturn),
    maxDrawdownPct: r2(maxDD * 100),
    sharpeRatio: r2(sharpe),
    profitFactor: r2(profitFactor),
  }
}

export function patternEffectiveness(trades: Trade[]) {
  const byPattern: Record<string, Trade[]> = {}
  for (const t of trades) {
    const key = t.primaryPattern || 'NO_PATTERN'
    if (!byPattern[key]) byPattern[key] = []
    byPattern[key].push(t)
  }

  const result: Record<string, { count: number; winRatePct: number; avgPnlPct: number }> = {}
  for (const [pattern, pTrades] of Object.entries(byPattern)) {
    const wins = pTrades.filter(t => t.isWinner).length
    result[pattern] = {
      count: pTrades.length,
      winRatePct: r2((wins / pTrades.length) * 100),
      avgPnlPct: r4(safeMean(pTrades.map(t => t.netPnlPct)) * 100),
    }
  }
  return result
}

export function exitReasonBreakdown(trades: Trade[]) {
  const reasons: Record<string, { count: number; winRatePct: number; avgPnlPct: number }> = {}
  for (const t of trades) {
    const r = t.primaryExitReason || 'UNKNOWN'
    if (!reasons[r]) reasons[r] = { count: 0, winRatePct: 0, avgPnlPct: 0 }
    reasons[r].count++
  }
  for (const [r, data] of Object.entries(reasons)) {
    const rTrades = trades.filter(t => (t.primaryExitReason || 'UNKNOWN') === r)
    const wins = rTrades.filter(t => t.isWinner).length
    data.winRatePct = r2((wins / rTrades.length) * 100)
    data.avgPnlPct = r4(safeMean(rTrades.map(t => t.netPnlPct)) * 100)
  }
  return reasons
}


// ═══════════════════════════════════════════════════════════
// SECTION 8: RUNNER (per-day + multi-day backtest)
// ═══════════════════════════════════════════════════════════

export function groupByDay(candles: Candle[], toISTFn?: (d: Date) => string) {
  const days = new Map<string, Candle[]>()
  const toIST = toISTFn || ((d: Date) => {
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
    return ist.toISOString().slice(0, 10)
  })
  for (const c of candles) {
    const d = toDate(c.time)
    const key = toIST(d)
    if (!days.has(key)) days.set(key, [])
    days.get(key)!.push(c)
  }
  return days
}

export function runOrderFlowForDay(dayCandles: Candle[], opts: { maxTrades?: number } = {}): Trade[] {
  const { maxTrades = OF_CONFIG.MAX_TRADES_PER_DAY } = opts
  const candles = dayCandles.map(c => ({ ...c, time: toDate(c.time) }))
  const signals = detectStandaloneSignals(candles)

  const trades: Trade[] = []
  let lastExitIdx = -1

  for (const signal of signals) {
    if (trades.length >= maxTrades) break
    if (signal.entryIndex <= lastExitIdx) continue

    const trade = simulateTrade(candles, signal)
    trades.push(trade)

    const lastPartial = trade.partialExits[trade.partialExits.length - 1]
    if (lastPartial) {
      const exitTime = toDate(lastPartial.time)
      for (let j = signal.entryIndex; j < candles.length; j++) {
        if (toDate(candles[j].time) >= exitTime) { lastExitIdx = j; break }
      }
    }
  }
  return trades
}

export function runFullBacktest(allCandles: Candle[], opts: { capital?: number } = {}) {
  const { capital = OF_CONFIG.DEFAULT_CAPITAL } = opts
  const dayMap = groupByDay(allCandles)
  const sortedDates = [...dayMap.keys()].sort()

  const allTrades: (Trade & { date?: string })[] = []

  for (const dateKey of sortedDates) {
    const dayCandles = dayMap.get(dateKey) || []
    if (dayCandles.length < 15) continue

    const dayTrades = runOrderFlowForDay(dayCandles)
    for (const t of dayTrades) {
      (t as any).date = dateKey
      allTrades.push(t as Trade & { date?: string })
    }
  }

  const report = allTrades.length > 0 ? analyzePerformance(allTrades as Trade[], capital) : null
  return {
    trades: allTrades,
    report,
    totalDays: sortedDates.length,
    tradedDays: new Set(allTrades.map(t => (t as any).date)).size,
  }
}


// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function safeMean(arr: number[]): number { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function r0(n: number) { return Math.round(n) }
function r1(n: number) { return Math.round(n * 10) / 10 }
function r2(n: number) { return Math.round(n * 100) / 100 }
function r4(n: number) { return Math.round(n * 10000) / 10000 }

function computeSharpe(pnls: number[]): number {
  if (pnls.length < 2) return 0
  const avg = safeMean(pnls)
  const std = Math.sqrt(pnls.reduce((s, p) => s + (p - avg) ** 2, 0) / (pnls.length - 1))
  return std === 0 ? 0 : (avg / std) * Math.sqrt(250)
}
