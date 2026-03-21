// VWAP Trading Strategy — Indian Markets (NSE)
// Intraday: Pullback (trend continuation), Breakout (reversal), PDC Confluence
// Consolidated from vwap-config, vwap-filters, vwap-core, vwap-analyzer, vwap-runner

// ============================== ENUMS ==============================
export const VWAP_SETUP = { PULLBACK: 'PULLBACK' as const, BREAKOUT: 'BREAKOUT' as const, PDC_CONFLUENCE: 'PDC_CONFLUENCE' as const }
export const DIRECTION = { LONG: 'LONG' as const, SHORT: 'SHORT' as const, NONE: 'NONE' as const }
export const BIAS = { BULLISH: 'BULLISH' as const, BEARISH: 'BEARISH' as const, NEUTRAL: 'NEUTRAL' as const }
export const VWAP_EXIT = {
  TARGET_1: 'TARGET_1', TARGET_2_TRAIL: 'TARGET_2_TRAIL',
  STOP_LOSS: 'STOP_LOSS', VWAP_CROSS_AGAINST: 'VWAP_CROSS_AGAINST',
  TRAIL_STOP: 'TRAIL_STOP', TIME_STOP_EOD: 'TIME_STOP_EOD',
  TIME_STOP_AFTERNOON: 'TIME_STOP_AFTERNOON',
} as const

// ============================== CONFIGURATION ==============================
export const VWAP_CONFIG = {
  // Market timings (IST)
  MARKET_OPEN_H: 9, MARKET_OPEN_M: 15,
  MARKET_CLOSE_H: 15, MARKET_CLOSE_M: 30,
  MIS_EXIT_H: 15, MIS_EXIT_M: 15,

  // VWAP-specific time windows
  NO_TRADE_BEFORE_H: 9, NO_TRADE_BEFORE_M: 30,       // skip first 15 min
  VWAP_RELIABLE_H: 10, VWAP_RELIABLE_M: 0,             // VWAP reliable after 10:00
  PULLBACK_WINDOW_START_H: 10, PULLBACK_WINDOW_START_M: 0,
  PULLBACK_WINDOW_END_H: 12, PULLBACK_WINDOW_END_M: 30, // pullback sweet spot
  LAST_ENTRY_H: 14, LAST_ENTRY_M: 30,                   // no new entries after 2:30

  CANDLE_INTERVAL_MIN: 5,

  // VWAP zone tolerance
  VWAP_TOUCH_TOLERANCE: 0.002,     // within 0.2% = "at VWAP"
  VWAP_PROXIMITY_ZONE: 0.001,      // within 0.1% = touching

  // SD bands
  BAND_SD_1: 1.0,
  BAND_SD_2: 2.0,

  // EMA
  EMA_PERIOD: 9,

  // Pullback setup (A)
  PULLBACK_MIN_TREND_CANDLES: 6,       // 30 min above VWAP
  PULLBACK_VOLUME_DECAY: 0.8,          // pullback vol < 80% rally vol
  PULLBACK_REJECTION_WICK_RATIO: 0.5,  // wick > 50% of range
  PULLBACK_SL_BELOW_VWAP_PCT: 0.003,   // SL = 0.3% below VWAP
  PULLBACK_MIN_RR: 1.0,

  // Breakout setup (B)
  BREAKOUT_MIN_TIME_BELOW_CANDLES: 12,  // 1 hour on opposite side
  BREAKOUT_VOLUME_MULTIPLE: 1.5,        // crossover vol > 1.5× avg
  BREAKOUT_CONFIRMATION_CANDLES: 2,     // 2 candles confirm
  BREAKOUT_SL_BELOW_VWAP_PCT: 0.003,
  BREAKOUT_AVG_VOLUME_LOOKBACK: 12,

  // Targets & position sizing
  TARGET_1_QTY_PCT: 0.60,
  TRAIL_QTY_PCT: 0.40,

  // Risk
  MAX_SL_PCT: 0.007,
  DEFAULT_RISK_PER_TRADE: 0.01,
  SLIPPAGE_PER_SIDE: 0.0003,
  COMMISSION_PER_SIDE: 20,

  MIN_AVG_DAILY_VOLUME: 5_000_000,
  DEFAULT_CAPITAL: 100_000,
}

// ============================== CANDLE INTERFACE ==============================
export interface VWAPCandle {
  time: Date | string
  open: number; high: number; low: number; close: number; volume: number
  vwap?: number; vwapSD?: number
  vwapUpper1?: number; vwapLower1?: number
  vwapUpper2?: number; vwapLower2?: number
  ema9?: number; dayHigh?: number; dayLow?: number
}

// ============================== UTILITY ==============================
function r2(n: number): number { return Math.round(n * 100) / 100 }
function r4(n: number): number { return Math.round(n * 10000) / 10000 }
function safeMean(arr: number[]): number { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = safeMean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

// ============================== TIME HELPERS ==============================
function toMinutes(h: number, m: number): number { return h * 60 + m }

function candleMinutes(candle: any): number {
  const d = candle.time instanceof Date ? candle.time : new Date(candle.time)
  return toMinutes(d.getHours(), d.getMinutes())
}

export function isInTradeWindow(candle: any): boolean {
  const t = candleMinutes(candle)
  return t >= toMinutes(VWAP_CONFIG.NO_TRADE_BEFORE_H, VWAP_CONFIG.NO_TRADE_BEFORE_M) &&
         t <= toMinutes(VWAP_CONFIG.LAST_ENTRY_H, VWAP_CONFIG.LAST_ENTRY_M)
}

function isVWAPReliable(candle: any): boolean {
  return candleMinutes(candle) >= toMinutes(VWAP_CONFIG.VWAP_RELIABLE_H, VWAP_CONFIG.VWAP_RELIABLE_M)
}

function isInPullbackWindow(candle: any): boolean {
  const t = candleMinutes(candle)
  return t >= toMinutes(VWAP_CONFIG.PULLBACK_WINDOW_START_H, VWAP_CONFIG.PULLBACK_WINDOW_START_M) &&
         t <= toMinutes(VWAP_CONFIG.PULLBACK_WINDOW_END_H, VWAP_CONFIG.PULLBACK_WINDOW_END_M)
}

function isPastAfternoonCutoff(candle: any): boolean {
  return candleMinutes(candle) >= toMinutes(VWAP_CONFIG.LAST_ENTRY_H, VWAP_CONFIG.LAST_ENTRY_M)
}

function isPastMISExit(candle: any): boolean {
  return candleMinutes(candle) >= toMinutes(VWAP_CONFIG.MIS_EXIT_H, VWAP_CONFIG.MIS_EXIT_M)
}

// ============================== VWAP PROXIMITY & ZONE ==============================
function vwapProximity(price: number, vwap: number) {
  const distance = price - vwap
  const distancePct = Math.abs(distance) / vwap
  return {
    inZone: distancePct <= VWAP_CONFIG.VWAP_TOUCH_TOLERANCE,
    touching: distancePct <= VWAP_CONFIG.VWAP_PROXIMITY_ZONE,
    distance, distancePct,
    side: distance > 0 ? 'ABOVE' : distance < 0 ? 'BELOW' : 'AT',
  }
}

// ============================== CANDLE PATTERN DETECTION ==============================
function detectRejectionAtVWAP(candle: any, vwap: number, direction: string) {
  const { open, high, low, close } = candle
  const body = Math.abs(close - open)
  const range = high - low
  if (range === 0) return { isRejection: false, pattern: 'DOJI_FLAT' }

  const upperWick = high - Math.max(open, close)
  const lowerWick = Math.min(open, close) - low
  const bodyPct = body / range
  const lowerWickPct = lowerWick / range
  const upperWickPct = upperWick / range
  const isBullish = close > open
  const isBearish = close < open

  if (direction === DIRECTION.LONG) {
    const wickTouchesVWAP = low <= vwap * (1 + VWAP_CONFIG.VWAP_TOUCH_TOLERANCE)
    const closesAbove = close > vwap
    const strongLowerWick = lowerWickPct >= VWAP_CONFIG.PULLBACK_REJECTION_WICK_RATIO

    if (wickTouchesVWAP && closesAbove && strongLowerWick && isBullish)
      return { isRejection: true, pattern: 'BULLISH_HAMMER' }
    if (wickTouchesVWAP && closesAbove && bodyPct < 0.1)
      return { isRejection: true, pattern: 'DOJI_AT_VWAP' }
    if (wickTouchesVWAP && closesAbove && isBullish)
      return { isRejection: true, pattern: 'BULLISH_REJECTION' }
    return { isRejection: false, pattern: 'NONE' }
  }

  if (direction === DIRECTION.SHORT) {
    const wickTouchesVWAP = high >= vwap * (1 - VWAP_CONFIG.VWAP_TOUCH_TOLERANCE)
    const closesBelow = close < vwap
    const strongUpperWick = upperWickPct >= VWAP_CONFIG.PULLBACK_REJECTION_WICK_RATIO

    if (wickTouchesVWAP && closesBelow && strongUpperWick && isBearish)
      return { isRejection: true, pattern: 'BEARISH_SHOOTING_STAR' }
    if (wickTouchesVWAP && closesBelow && bodyPct < 0.1)
      return { isRejection: true, pattern: 'DOJI_AT_VWAP' }
    if (wickTouchesVWAP && closesBelow && isBearish)
      return { isRejection: true, pattern: 'BEARISH_REJECTION' }
    return { isRejection: false, pattern: 'NONE' }
  }
  return { isRejection: false, pattern: 'NONE' }
}

// ============================== VOLUME FILTERS ==============================
function filterPullbackVolumeDecay(rallyVolumes: number[], pullbackVolumes: number[]) {
  if (rallyVolumes.length === 0 || pullbackVolumes.length === 0) return { pass: false }
  const rallyAvg = safeMean(rallyVolumes)
  const pullbackAvg = safeMean(pullbackVolumes)
  const ratio = pullbackAvg / rallyAvg
  return { pass: ratio < VWAP_CONFIG.PULLBACK_VOLUME_DECAY, ratio: r2(ratio) }
}

function filterBreakoutVolumeSurge(crossoverVolume: number, recentVolumes: number[]) {
  const lookback = Math.min(recentVolumes.length, VWAP_CONFIG.BREAKOUT_AVG_VOLUME_LOOKBACK)
  if (lookback === 0) return { pass: false, multiple: 0 }
  const avgVol = recentVolumes.slice(-lookback).reduce((a, b) => a + b, 0) / lookback
  const multiple = avgVol > 0 ? crossoverVolume / avgVol : 0
  return { pass: crossoverVolume >= avgVol * VWAP_CONFIG.BREAKOUT_VOLUME_MULTIPLE, multiple: r2(multiple) }
}

// ============================== EMA & PDC FILTERS ==============================
function filterEMATrend(ema9: number, vwap: number, direction: string) {
  if (direction === DIRECTION.LONG && ema9 > vwap) return { pass: true }
  if (direction === DIRECTION.SHORT && ema9 < vwap) return { pass: true }
  return { pass: false }
}

function determinePDCBias(price: number, vwap: number, prevDayClose: number) {
  const aboveVWAP = price > vwap
  const abovePDC = price > prevDayClose
  if (aboveVWAP && abovePDC) return { bias: BIAS.BULLISH }
  if (!aboveVWAP && !abovePDC) return { bias: BIAS.BEARISH }
  return { bias: BIAS.NEUTRAL }
}

function filterPDCAlignment(direction: string, price: number, vwap: number, prevDayClose: number) {
  const { bias } = determinePDCBias(price, vwap, prevDayClose)
  if (bias === BIAS.BULLISH && direction === DIRECTION.LONG) return { pass: true, bias }
  if (bias === BIAS.BEARISH && direction === DIRECTION.SHORT) return { pass: true, bias }
  return { pass: false, bias }
}

// ============================== TREND PERSISTENCE ==============================
function countPriorSideDuration(candles: any[], priorSide: string): number {
  let count = 0
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i]
    if (c.vwap == null) break
    if (priorSide === 'BELOW' && c.close < c.vwap) count++
    else if (priorSide === 'ABOVE' && c.close > c.vwap) count++
    else break
  }
  return count
}

// ============================== COMPOSITE FILTERS ==============================
function filterPullbackEntry(ctx: any) {
  const checks = [
    isInPullbackWindow(ctx.candle),
    isVWAPReliable(ctx.candle),
    ctx.rejection?.isRejection ?? false,
    filterPullbackVolumeDecay(ctx.rallyVolumes, ctx.pullbackVolumes).pass,
    filterEMATrend(ctx.ema9, ctx.vwap, ctx.direction).pass,
    ctx.trendDuration >= VWAP_CONFIG.PULLBACK_MIN_TREND_CANDLES,
  ]
  if (ctx.usePDCFilter && ctx.prevDayClose != null) {
    checks.push(filterPDCAlignment(ctx.direction, ctx.candle.close, ctx.vwap, ctx.prevDayClose).pass)
  }
  return { pass: checks.every(Boolean) }
}

function filterBreakoutEntry(ctx: any) {
  const checks = [
    isInTradeWindow(ctx.candle),
    isVWAPReliable(ctx.candle),
    ctx.priorSideDuration >= VWAP_CONFIG.BREAKOUT_MIN_TIME_BELOW_CANDLES,
    filterBreakoutVolumeSurge(ctx.crossoverVolume, ctx.recentVolumes).pass,
  ]
  if (ctx.usePDCFilter && ctx.prevDayClose != null) {
    checks.push(filterPDCAlignment(ctx.direction, ctx.candle.close, ctx.vwap, ctx.prevDayClose).pass)
  }
  return { pass: checks.every(Boolean) }
}

// ============================== VWAP + BANDS COMPUTATION ==============================
export function computeVWAPWithBands(candles: any[]) {
  let cumTPV = 0, cumVol = 0, cumTP2V = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    cumTPV += tp * c.volume
    cumVol += c.volume
    cumTP2V += tp * tp * c.volume
    if (cumVol === 0) {
      c.vwap = c.close; c.vwapSD = 0
      c.vwapUpper1 = c.close; c.vwapLower1 = c.close
      c.vwapUpper2 = c.close; c.vwapLower2 = c.close
      continue
    }
    const vwap = cumTPV / cumVol
    const variance = (cumTP2V / cumVol) - (vwap * vwap)
    const sd = Math.sqrt(Math.max(0, variance))
    c.vwap = vwap; c.vwapSD = sd
    c.vwapUpper1 = vwap + VWAP_CONFIG.BAND_SD_1 * sd
    c.vwapLower1 = vwap - VWAP_CONFIG.BAND_SD_1 * sd
    c.vwapUpper2 = vwap + VWAP_CONFIG.BAND_SD_2 * sd
    c.vwapLower2 = vwap - VWAP_CONFIG.BAND_SD_2 * sd
  }
}

// ============================== EMA COMPUTATION ==============================
export function computeEMA(candles: any[], period = VWAP_CONFIG.EMA_PERIOD) {
  if (candles.length === 0) return
  const k = 2 / (period + 1)
  candles[0].ema9 = candles[0].close
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].ema9 ?? candles[i - 1].close
    candles[i].ema9 = candles[i].close * k + prev * (1 - k)
  }
}

// ============================== DAY HIGH/LOW ==============================
function computeDayHighLow(candles: any[]) {
  let dayHigh = -Infinity, dayLow = Infinity
  for (const c of candles) {
    if (c.high > dayHigh) dayHigh = c.high
    if (c.low < dayLow) dayLow = c.low
    c.dayHigh = dayHigh; c.dayLow = dayLow
  }
}

// ============================== PULLBACK STATE MACHINE ==============================
function detectPullbackSignals(candles: any[], opts: any = {}) {
  const { prevDayClose = null, usePDCFilter = false } = opts
  const signals: any[] = []

  for (const direction of [DIRECTION.LONG, DIRECTION.SHORT]) {
    let state: 'IDLE' | 'TRENDING' | 'PULLING_BACK' = 'IDLE'
    let trendStartIdx = -1, pullbackStartIdx = -1
    let rallyVolumes: number[] = []

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i]
      if (!isInTradeWindow(c) || !isVWAPReliable(c) || c.vwap == null) continue

      const isOnTrendSide = direction === DIRECTION.LONG ? c.close > c.vwap : c.close < c.vwap
      const proximity = vwapProximity(c.close, c.vwap)

      switch (state) {
        case 'IDLE':
          if (isOnTrendSide) { state = 'TRENDING'; trendStartIdx = i; rallyVolumes = [c.volume] }
          break

        case 'TRENDING':
          if (isOnTrendSide) {
            rallyVolumes.push(c.volume)
            if (i - trendStartIdx + 1 < VWAP_CONFIG.PULLBACK_MIN_TREND_CANDLES) continue
          }
          if (proximity.inZone || !isOnTrendSide) { state = 'PULLING_BACK'; pullbackStartIdx = i }
          break

        case 'PULLING_BACK': {
          const pullbackVolumes: number[] = []
          for (let j = pullbackStartIdx; j <= i; j++) pullbackVolumes.push(candles[j].volume)

          const rejection = detectRejectionAtVWAP(c, c.vwap, direction)
          if (rejection.isRejection && proximity.inZone) {
            const trendDuration = pullbackStartIdx - trendStartIdx
            const filterCtx = {
              candle: c, vwap: c.vwap, ema9: c.ema9 ?? c.close, direction,
              rallyVolumes, pullbackVolumes, trendDuration, prevDayClose, usePDCFilter,
              rejection,
            }
            if (filterPullbackEntry(filterCtx).pass) {
              const entry = computePullbackEntry(c, direction)
              if (entry.meetsMinRR) {
                signals.push({
                  setup: VWAP_SETUP.PULLBACK, direction,
                  entryPrice: entry.entryPrice, entryTime: c.time, entryIndex: i,
                  sl: entry.sl, targets: entry.targets,
                  rejectionPattern: rejection.pattern, trendDuration,
                  pullbackCandles: i - pullbackStartIdx + 1,
                })
                state = 'IDLE'; trendStartIdx = -1; rallyVolumes = []
                break
              }
            }
          }

          // Back to trending if price moves away from VWAP
          if (isOnTrendSide && !proximity.inZone) { state = 'TRENDING'; pullbackStartIdx = -1 }

          // Pullback failed — crossed through VWAP
          const crossedThrough = direction === DIRECTION.LONG
            ? c.close < c.vwap * (1 - VWAP_CONFIG.VWAP_TOUCH_TOLERANCE * 2)
            : c.close > c.vwap * (1 + VWAP_CONFIG.VWAP_TOUCH_TOLERANCE * 2)
          if (crossedThrough) { state = 'IDLE'; trendStartIdx = -1; rallyVolumes = [] }
          break
        }
      }
    }
  }
  return signals
}

// ============================== BREAKOUT DETECTION ==============================
function detectBreakoutSignals(candles: any[], opts: any = {}) {
  const { prevDayClose = null, usePDCFilter = false } = opts
  const signals: any[] = []

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i]
    if (!isInTradeWindow(c) || !isVWAPReliable(c) || c.vwap == null) continue

    // Bullish crossover
    if (c.close > c.vwap) {
      const prev = candles[i - 1]
      if (prev.close < prev.vwap) {
        const crossoverCandle = c
        const priorDuration = countPriorSideDuration(candles.slice(0, i), 'BELOW')
        if (priorDuration >= VWAP_CONFIG.BREAKOUT_MIN_TIME_BELOW_CANDLES) {
          if (i + VWAP_CONFIG.BREAKOUT_CONFIRMATION_CANDLES < candles.length) {
            let confirmed = true
            for (let j = 1; j <= VWAP_CONFIG.BREAKOUT_CONFIRMATION_CANDLES; j++) {
              if (candles[i + j].close <= (candles[i + j].vwap ?? 0)) { confirmed = false; break }
            }
            if (confirmed) {
              const confirmIdx = i + VWAP_CONFIG.BREAKOUT_CONFIRMATION_CANDLES
              const confirmCandle = candles[confirmIdx]
              const recentVolumes = candles.slice(Math.max(0, i - VWAP_CONFIG.BREAKOUT_AVG_VOLUME_LOOKBACK), i).map((cc: any) => cc.volume)
              const filterCtx = {
                candle: confirmCandle, vwap: confirmCandle.vwap, direction: DIRECTION.LONG,
                crossoverVolume: crossoverCandle.volume, recentVolumes,
                priorSideDuration: priorDuration, prevDayClose, usePDCFilter,
              }
              if (filterBreakoutEntry(filterCtx).pass) {
                const entry = computeBreakoutEntry(confirmCandle, DIRECTION.LONG)
                const volSurge = filterBreakoutVolumeSurge(crossoverCandle.volume, recentVolumes)
                signals.push({
                  setup: VWAP_SETUP.BREAKOUT, direction: DIRECTION.LONG,
                  entryPrice: entry.entryPrice, entryTime: confirmCandle.time, entryIndex: confirmIdx,
                  sl: entry.sl, targets: entry.targets,
                  crossoverTime: crossoverCandle.time, priorDurationBelow: priorDuration,
                  volumeMultiple: volSurge.multiple,
                })
              }
            }
          }
        }
      }
    }

    // Bearish breakdown
    if (c.close < c.vwap) {
      const prev = candles[i - 1]
      if (prev.close > prev.vwap) {
        const crossoverCandle = c
        const priorDuration = countPriorSideDuration(candles.slice(0, i), 'ABOVE')
        if (priorDuration >= VWAP_CONFIG.BREAKOUT_MIN_TIME_BELOW_CANDLES) {
          if (i + VWAP_CONFIG.BREAKOUT_CONFIRMATION_CANDLES < candles.length) {
            let confirmed = true
            for (let j = 1; j <= VWAP_CONFIG.BREAKOUT_CONFIRMATION_CANDLES; j++) {
              if (candles[i + j].close >= (candles[i + j].vwap ?? Infinity)) { confirmed = false; break }
            }
            if (confirmed) {
              const confirmIdx = i + VWAP_CONFIG.BREAKOUT_CONFIRMATION_CANDLES
              const confirmCandle = candles[confirmIdx]
              const recentVolumes = candles.slice(Math.max(0, i - VWAP_CONFIG.BREAKOUT_AVG_VOLUME_LOOKBACK), i).map((cc: any) => cc.volume)
              const filterCtx = {
                candle: confirmCandle, vwap: confirmCandle.vwap, direction: DIRECTION.SHORT,
                crossoverVolume: crossoverCandle.volume, recentVolumes,
                priorSideDuration: priorDuration, prevDayClose, usePDCFilter,
              }
              if (filterBreakoutEntry(filterCtx).pass) {
                const entry = computeBreakoutEntry(confirmCandle, DIRECTION.SHORT)
                const volSurge = filterBreakoutVolumeSurge(crossoverCandle.volume, recentVolumes)
                signals.push({
                  setup: VWAP_SETUP.BREAKOUT, direction: DIRECTION.SHORT,
                  entryPrice: entry.entryPrice, entryTime: confirmCandle.time, entryIndex: confirmIdx,
                  sl: entry.sl, targets: entry.targets,
                  crossoverTime: crossoverCandle.time, priorDurationAbove: priorDuration,
                  volumeMultiple: volSurge.multiple,
                })
              }
            }
          }
        }
      }
    }
  }
  return signals
}

// ============================== ENTRY / SL / TARGETS ==============================
function computePullbackEntry(candle: any, direction: string) {
  const entryPrice = candle.close
  const vwap = candle.vwap
  const isLong = direction === DIRECTION.LONG
  let sl: number
  const targets: any[] = []

  if (isLong) {
    const slBelowVWAP = vwap * (1 - VWAP_CONFIG.PULLBACK_SL_BELOW_VWAP_PCT)
    sl = Math.max(slBelowVWAP, candle.low - 1)
    const slPct = (entryPrice - sl) / entryPrice
    if (slPct > VWAP_CONFIG.MAX_SL_PCT) sl = entryPrice * (1 - VWAP_CONFIG.MAX_SL_PCT)

    const dayHigh = candle.dayHigh || entryPrice * 1.01
    targets.push({ price: dayHigh, qtyPct: VWAP_CONFIG.TARGET_1_QTY_PCT, label: 'T1_DAY_HIGH' })
    const sd1 = candle.vwapUpper1 || entryPrice * 1.015
    targets.push({ price: Math.max(sd1, dayHigh), qtyPct: VWAP_CONFIG.TRAIL_QTY_PCT, label: 'T2_VWAP_1SD' })
  } else {
    const slAboveVWAP = vwap * (1 + VWAP_CONFIG.PULLBACK_SL_BELOW_VWAP_PCT)
    sl = Math.min(slAboveVWAP, candle.high + 1)
    const slPct = (sl - entryPrice) / entryPrice
    if (slPct > VWAP_CONFIG.MAX_SL_PCT) sl = entryPrice * (1 + VWAP_CONFIG.MAX_SL_PCT)

    const dayLow = candle.dayLow || entryPrice * 0.99
    targets.push({ price: dayLow, qtyPct: VWAP_CONFIG.TARGET_1_QTY_PCT, label: 'T1_DAY_LOW' })
    const sd1 = candle.vwapLower1 || entryPrice * 0.985
    targets.push({ price: Math.min(sd1, dayLow), qtyPct: VWAP_CONFIG.TRAIL_QTY_PCT, label: 'T2_VWAP_1SD' })
  }

  const risk = Math.abs(entryPrice - sl)
  const reward = Math.abs(targets[0].price - entryPrice)
  const rr = risk > 0 ? reward / risk : 0
  return { entryPrice, sl, targets, riskReward: rr, meetsMinRR: rr >= VWAP_CONFIG.PULLBACK_MIN_RR }
}

function computeBreakoutEntry(candle: any, direction: string) {
  const entryPrice = candle.close
  const vwap = candle.vwap
  const isLong = direction === DIRECTION.LONG
  let sl: number
  const targets: any[] = []

  if (isLong) {
    sl = vwap * (1 - VWAP_CONFIG.BREAKOUT_SL_BELOW_VWAP_PCT)
    const slPct = (entryPrice - sl) / entryPrice
    if (slPct > VWAP_CONFIG.MAX_SL_PCT) sl = entryPrice * (1 - VWAP_CONFIG.MAX_SL_PCT)
    targets.push({ price: candle.vwapUpper1 || entryPrice * 1.01, qtyPct: VWAP_CONFIG.TARGET_1_QTY_PCT, label: 'T1_VWAP_1SD' })
    targets.push({ price: null, qtyPct: VWAP_CONFIG.TRAIL_QTY_PCT, label: 'TRAIL' })
  } else {
    sl = vwap * (1 + VWAP_CONFIG.BREAKOUT_SL_BELOW_VWAP_PCT)
    const slPct = (sl - entryPrice) / entryPrice
    if (slPct > VWAP_CONFIG.MAX_SL_PCT) sl = entryPrice * (1 + VWAP_CONFIG.MAX_SL_PCT)
    targets.push({ price: candle.vwapLower1 || entryPrice * 0.99, qtyPct: VWAP_CONFIG.TARGET_1_QTY_PCT, label: 'T1_VWAP_1SD' })
    targets.push({ price: null, qtyPct: VWAP_CONFIG.TRAIL_QTY_PCT, label: 'TRAIL' })
  }
  return { entryPrice, sl, targets }
}

// ============================== TRADE SIMULATION ==============================
function simulateVWAPTrade(candles: any[], signal: any) {
  const { direction, entryPrice, entryIndex, sl, targets } = signal
  const isLong = direction === DIRECTION.LONG
  let remainingQty = 1.0
  let currentSL = sl
  const partialExits: any[] = []
  let t1Hit = false, trailActive = false

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const c = candles[i]
    if (remainingQty <= 0) break

    // EOD forced exit
    if (isPastMISExit(c)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: VWAP_EXIT.TIME_STOP_EOD })
      remainingQty = 0; break
    }

    // Afternoon cutoff (if T1 not hit)
    if (!t1Hit && isPastAfternoonCutoff(c)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: VWAP_EXIT.TIME_STOP_AFTERNOON })
      remainingQty = 0; break
    }

    // Stop-loss
    const hitSL = isLong ? c.low <= currentSL : c.high >= currentSL
    if (hitSL) {
      partialExits.push({
        time: c.time, price: currentSL, qtyPct: remainingQty,
        reason: trailActive ? VWAP_EXIT.TRAIL_STOP : VWAP_EXIT.STOP_LOSS,
      })
      remainingQty = 0; break
    }

    // VWAP cross against (only when trailing)
    if (trailActive && c.vwap != null) {
      const crossedAgainst = isLong
        ? c.close < c.vwap * (1 - VWAP_CONFIG.VWAP_TOUCH_TOLERANCE)
        : c.close > c.vwap * (1 + VWAP_CONFIG.VWAP_TOUCH_TOLERANCE)
      if (crossedAgainst) {
        partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: VWAP_EXIT.VWAP_CROSS_AGAINST })
        remainingQty = 0; break
      }
    }

    // Target 1
    if (!t1Hit && targets[0] && targets[0].price != null) {
      const hitT1 = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitT1) {
        t1Hit = true
        const exitQty = Math.min(targets[0].qtyPct, remainingQty)
        partialExits.push({ time: c.time, price: targets[0].price, qtyPct: exitQty, reason: VWAP_EXIT.TARGET_1 })
        remainingQty -= exitQty
        currentSL = entryPrice // breakeven
        trailActive = true
      }
    }

    // Trail via EMA(9)
    if (trailActive && remainingQty > 0 && c.ema9 != null) {
      if (isLong) {
        const emaTrail = candles[i - 1]?.ema9 ?? currentSL
        if (emaTrail > currentSL) currentSL = emaTrail
      } else {
        const emaTrail = candles[i - 1]?.ema9 ?? currentSL
        if (emaTrail < currentSL) currentSL = emaTrail
      }

      // T2 check
      if (targets[1] && targets[1].price != null) {
        const hitT2 = isLong ? c.high >= targets[1].price : c.low <= targets[1].price
        if (hitT2) {
          partialExits.push({ time: c.time, price: targets[1].price, qtyPct: remainingQty, reason: VWAP_EXIT.TARGET_2_TRAIL })
          remainingQty = 0; break
        }
      }
    }
  }

  return buildVWAPTradeRecord(signal, partialExits)
}

// ============================== TRADE RECORD BUILDER ==============================
function buildVWAPTradeRecord(signal: any, partialExits: any[]) {
  const { direction, entryPrice, entryTime } = signal
  const isLong = direction === DIRECTION.LONG
  let weightedExit = 0, totalQty = 0
  for (const e of partialExits) { weightedExit += e.price * e.qtyPct; totalQty += e.qtyPct }
  const avgExitPrice = totalQty > 0 ? weightedExit / totalQty : entryPrice
  const grossPnlPct = isLong ? (avgExitPrice - entryPrice) / entryPrice : (entryPrice - avgExitPrice) / entryPrice
  const netPnlPct = grossPnlPct - (VWAP_CONFIG.SLIPPAGE_PER_SIDE * 2)
  const lastExit = partialExits[partialExits.length - 1]

  const reasonMap: Record<string, number> = {}
  for (const e of partialExits) reasonMap[e.reason] = (reasonMap[e.reason] || 0) + e.qtyPct
  let primaryReason = 'NONE', maxQty = 0
  for (const [r, q] of Object.entries(reasonMap)) { if (q > maxQty) { maxQty = q; primaryReason = r } }

  return {
    setup: signal.setup, direction, entryPrice, avgExitPrice,
    entryTime, exitTime: lastExit?.time ?? null,
    grossPnlPct, netPnlPct, isWinner: netPnlPct > 0,
    partialExits, primaryExitReason: primaryReason,
    rejectionPattern: signal.rejectionPattern || null,
    trendDuration: signal.trendDuration || null,
    volumeMultiple: signal.volumeMultiple || null,
    sl: signal.sl,
  }
}

// ============================== SINGLE-DAY ORCHESTRATOR ==============================
export function runVWAPForDay(dayCandlesRaw: any[], opts: any = {}) {
  const {
    prevDayClose = null, usePDCFilter = false,
    enabledSetups = [VWAP_SETUP.PULLBACK, VWAP_SETUP.BREAKOUT],
    maxTradesPerDay = 2,
  } = opts

  const candles = dayCandlesRaw.map((c: any) => ({ ...c, time: c.time instanceof Date ? c.time : new Date(c.time) }))
  computeVWAPWithBands(candles)
  computeEMA(candles)
  computeDayHighLow(candles)

  const allSignals: any[] = []
  if (enabledSetups.includes(VWAP_SETUP.PULLBACK)) allSignals.push(...detectPullbackSignals(candles, { prevDayClose, usePDCFilter }))
  if (enabledSetups.includes(VWAP_SETUP.BREAKOUT)) allSignals.push(...detectBreakoutSignals(candles, { prevDayClose, usePDCFilter }))

  allSignals.sort((a, b) => {
    const ta = a.entryTime instanceof Date ? a.entryTime : new Date(a.entryTime)
    const tb = b.entryTime instanceof Date ? b.entryTime : new Date(b.entryTime)
    return ta.getTime() - tb.getTime()
  })

  const trades: any[] = []
  let lastExitIndex = -1
  for (const signal of allSignals) {
    if (trades.length >= maxTradesPerDay) break
    if (signal.entryIndex <= lastExitIndex) continue
    const trade = simulateVWAPTrade(candles, signal)
    trades.push(trade)
    const exitCandle = trade.partialExits[trade.partialExits.length - 1]
    if (exitCandle) {
      const exitTime = exitCandle.time instanceof Date ? exitCandle.time : new Date(exitCandle.time)
      for (let j = signal.entryIndex; j < candles.length; j++) {
        const ct = candles[j].time instanceof Date ? candles[j].time : new Date(candles[j].time)
        if (ct >= exitTime) { lastExitIndex = j; break }
      }
    }
  }
  return trades
}

// ============================== PERFORMANCE ANALYZER ==============================
export function analyzeVWAPPerformance(trades: any[], capital = VWAP_CONFIG.DEFAULT_CAPITAL) {
  if (trades.length === 0) return { error: 'No trades' }

  const winners = trades.filter((t: any) => t.isWinner)
  const losers = trades.filter((t: any) => !t.isWinner)
  const longs = trades.filter((t: any) => t.direction === DIRECTION.LONG)
  const shorts = trades.filter((t: any) => t.direction === DIRECTION.SHORT)
  const pnls = trades.map((t: any) => t.netPnlPct)

  const totalTrades = trades.length
  const winRate = winners.length / totalTrades
  const avgWin = safeMean(winners.map((t: any) => t.netPnlPct))
  const avgLoss = safeMean(losers.map((t: any) => t.netPnlPct))
  const avgWinLossRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : Infinity
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)

  const equityCurve = buildVWAPEquityCurve(trades, capital)
  const totalReturnPct = ((equityCurve[equityCurve.length - 1].equity - capital) / capital) * 100
  const maxDD = computeMaxDrawdown(equityCurve)
  const { maxWinStreak, maxLossStreak } = computeStreaks(trades)
  const sharpe = pnls.length >= 2 ? (safeMean(pnls) / stddev(pnls)) * Math.sqrt(250) : 0
  let grossProfit = 0, grossLoss = 0
  for (const t of trades) { if (t.netPnlPct > 0) grossProfit += t.netPnlPct; else grossLoss += Math.abs(t.netPnlPct) }
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity

  // Setup breakdown
  const setupBD: Record<string, any> = {}
  for (const t of trades) {
    const key = t.setup || 'UNKNOWN'
    if (!setupBD[key]) setupBD[key] = { count: 0, wins: 0, pnls: [] }
    setupBD[key].count++; if (t.isWinner) setupBD[key].wins++; setupBD[key].pnls.push(t.netPnlPct)
  }
  for (const k of Object.keys(setupBD)) {
    const d = setupBD[k]
    d.winRatePct = r2((d.wins / d.count) * 100)
    d.avgPnlPct = r4(safeMean(d.pnls) * 100)
    delete d.pnls
  }

  // Exit reason breakdown
  const exitBD: Record<string, any> = {}
  for (const t of trades) {
    const reason = t.primaryExitReason || 'UNKNOWN'
    if (!exitBD[reason]) exitBD[reason] = { count: 0, totalPnl: 0, wins: 0 }
    exitBD[reason].count++; exitBD[reason].totalPnl += t.netPnlPct; if (t.isWinner) exitBD[reason].wins++
  }
  for (const r of Object.keys(exitBD)) {
    const d = exitBD[r]
    d.winRatePct = r2((d.wins / d.count) * 100)
    d.avgPnlPct = r4((d.totalPnl / d.count) * 100)
    d.totalPnlPct = r4(d.totalPnl * 100)
  }

  const longStats = longs.length > 0 ? { winRate: r2((longs.filter((t: any) => t.isWinner).length / longs.length) * 100), avgPnl: r4(safeMean(longs.map((t: any) => t.netPnlPct)) * 100) } : { winRate: 0, avgPnl: 0 }
  const shortStats = shorts.length > 0 ? { winRate: r2((shorts.filter((t: any) => t.isWinner).length / shorts.length) * 100), avgPnl: r4(safeMean(shorts.map((t: any) => t.netPnlPct)) * 100) } : { winRate: 0, avgPnl: 0 }

  return {
    totalTrades, winners: winners.length, losers: losers.length,
    winRatePct: r2(winRate * 100),
    avgWinPct: r4(avgWin * 100), avgLossPct: r4(avgLoss * 100),
    avgWinLossRatio: r2(avgWinLossRatio),
    expectancyPct: r4(expectancy * 100),
    totalReturnPct: r2(totalReturnPct),
    totalReturnAbs: r2(equityCurve[equityCurve.length - 1].equity - capital),
    maxDrawdownPct: r2(maxDD.pct),
    sharpeRatio: r2(sharpe), profitFactor: r2(profitFactor),
    maxWinStreak, maxLossStreak,
    longTrades: longs.length, shortTrades: shorts.length,
    longWinRate: longStats.winRate, shortWinRate: shortStats.winRate,
    setupBreakdown: setupBD, exitReasonBreakdown: exitBD,
    equityCurve,
  }
}

// ============================== EQUITY CURVE ==============================
function buildVWAPEquityCurve(trades: any[], startCapital: number) {
  const curve = [{ tradeNum: 0, equity: startCapital }]
  let equity = startCapital
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    const riskAmt = equity * VWAP_CONFIG.DEFAULT_RISK_PER_TRADE
    const slDist = Math.abs(t.entryPrice - (t.sl || t.entryPrice * 0.003)) || t.entryPrice * 0.003
    const qty = Math.floor(riskAmt / slDist)
    const pnl = qty * t.entryPrice * t.netPnlPct
    equity += pnl - VWAP_CONFIG.COMMISSION_PER_SIDE * 2
    curve.push({ tradeNum: i + 1, equity: r2(equity) })
  }
  return curve
}

function computeMaxDrawdown(curve: any[]) {
  let peak = curve[0].equity, maxDD = 0
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].equity > peak) peak = curve[i].equity
    const dd = (peak - curve[i].equity) / peak
    if (dd > maxDD) maxDD = dd
  }
  return { pct: maxDD * 100 }
}

function computeStreaks(trades: any[]) {
  let mw = 0, ml = 0, cw = 0, cl = 0
  for (const t of trades) {
    if (t.isWinner) { cw++; cl = 0; if (cw > mw) mw = cw }
    else { cl++; cw = 0; if (cl > ml) ml = cl }
  }
  return { maxWinStreak: mw, maxLossStreak: ml }
}

// ============================== GROUP BY DAY ==============================
export function groupByDay(candles: any[]) {
  const days = new Map<string, any[]>()
  for (const c of candles) {
    const d = c.time instanceof Date ? c.time : new Date(c.time)
    const key = d.toISOString().slice(0, 10)
    if (!days.has(key)) days.set(key, [])
    days.get(key)!.push(c)
  }
  return days
}

// ============================== FULL BACKTEST ==============================
export function runFullVWAPBacktest(allCandles: any[], opts: any = {}) {
  const {
    capital = VWAP_CONFIG.DEFAULT_CAPITAL,
    enabledSetups = [VWAP_SETUP.PULLBACK, VWAP_SETUP.BREAKOUT],
    usePDCFilter = false, maxTradesPerDay = 2,
  } = opts

  const dayGroups = groupByDay(allCandles)
  const sortedDates = [...dayGroups.keys()].sort()
  const allTrades: any[] = []
  const skippedDays: any[] = []
  let prevClose: number | null = null

  for (const dateKey of sortedDates) {
    const dayCandles = dayGroups.get(dateKey)!
    if (dayCandles.length < 10) {
      skippedDays.push({ date: dateKey, reason: 'Insufficient candles' })
      if (dayCandles.length > 0) prevClose = dayCandles[dayCandles.length - 1].close
      continue
    }
    const dayTrades = runVWAPForDay(dayCandles, { prevDayClose: prevClose, usePDCFilter, enabledSetups, maxTradesPerDay })
    for (const t of dayTrades) { t.date = dateKey; allTrades.push(t) }
    if (dayTrades.length === 0) skippedDays.push({ date: dateKey, reason: 'No valid signal' })
    prevClose = dayCandles[dayCandles.length - 1].close
  }

  const report = allTrades.length > 0 ? analyzeVWAPPerformance(allTrades, capital) : null
  return {
    trades: allTrades, report, totalDays: sortedDates.length,
    tradedDays: new Set(allTrades.map((t: any) => t.date)).size,
    totalSignals: allTrades.length, skippedDays,
    hitRate: allTrades.length > 0 ? r2((allTrades.length / sortedDates.length) * 100) : 0,
  }
}
