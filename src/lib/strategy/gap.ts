// Gap Trading Strategy — Indian Markets (NSE)
// Intraday: Gap and Go (continuation), Gap Fill (mean reversion)
// Consolidated from gap-config, gap-classifier, gap-filters, gap-core, gap-analyzer, gap-runner

// ============================== ENUMS ==============================
export const GAP_TYPE = {
  FULL_GAP_UP: 'FULL_GAP_UP' as const,
  FULL_GAP_DOWN: 'FULL_GAP_DOWN' as const,
  PARTIAL_GAP_UP: 'PARTIAL_GAP_UP' as const,
  PARTIAL_GAP_DOWN: 'PARTIAL_GAP_DOWN' as const,
  NO_GAP: 'NO_GAP' as const,
}

export const GAP_SIZE = {
  NONE: 'NONE' as const,
  SMALL: 'SMALL' as const,       // 0.3% – 0.7%
  MEDIUM: 'MEDIUM' as const,     // 0.7% – 1.5%
  LARGE: 'LARGE' as const,       // 1.5% – 3.0%
  HUGE: 'HUGE' as const,         // > 3.0%
}

export const GAP_STRATEGY = {
  GAP_AND_GO: 'GAP_AND_GO' as const,
  GAP_FILL: 'GAP_FILL' as const,
}

export const DIRECTION = { LONG: 'LONG' as const, SHORT: 'SHORT' as const, NONE: 'NONE' as const }

export const GAP_EXIT = {
  TARGET_1: 'TARGET_1', TRAIL_STOP: 'TRAIL_STOP',
  GAP_FILL_COMPLETE: 'GAP_FILL_COMPLETE',
  STOP_LOSS: 'STOP_LOSS', TIME_STOP_NOON: 'TIME_STOP_NOON',
  TIME_STOP_EOD: 'TIME_STOP_EOD',
} as const

// ============================== CONFIGURATION ==============================
export const GAP_CONFIG = {
  // Market timings (IST)
  MARKET_OPEN_H: 9, MARKET_OPEN_M: 15,
  MARKET_CLOSE_H: 15, MARKET_CLOSE_M: 30,
  MIS_EXIT_H: 15, MIS_EXIT_M: 15,

  // ORB window (used internally by Gap and Go)
  ORB_END_H: 9, ORB_END_M: 30,
  CANDLE_INTERVAL_MIN: 5,

  // Gap size thresholds (fraction of prev close)
  GAP_MIN_THRESHOLD: 0.003,    // 0.3% minimum
  GAP_SMALL_MAX: 0.007,        // up to 0.7%
  GAP_MEDIUM_MAX: 0.015,       // up to 1.5%
  GAP_LARGE_MAX: 0.030,        // up to 3.0%

  // Strategy A: Gap and Go
  GAG_MIN_GAP_PCT: 0.015,                   // only gaps > 1.5%
  GAG_FIRST_15_VOLUME_MULTIPLE: 3.0,        // vol > 3× normal
  GAG_MUST_HOLD_ABOVE_OPEN: true,
  GAG_ENTRY_BUFFER: 1,                      // ₹1 above ORB high
  GAG_TARGET_1_QTY_PCT: 0.50,
  GAG_TRAIL_QTY_PCT: 0.50,

  // Strategy B: Gap Fill
  GF_MIN_GAP_PCT: 0.003,
  GF_MAX_GAP_PCT: 0.015,
  GF_REQUIRES_NO_CATALYST: true,
  GF_SL_ABOVE_DAY_HIGH_PCT: 0.003,         // 0.3% above day high
  GF_TIME_STOP_H: 12, GF_TIME_STOP_M: 0,   // exit by noon
  GF_RSI_PERIOD: 14,
  GF_RSI_OVERBOUGHT: 70,
  GF_RSI_OVERSOLD: 30,

  // Common
  MAX_SL_PCT: 0.015,                        // 1.5% max stop
  DEFAULT_RISK_PER_TRADE: 0.01,
  SLIPPAGE_PER_SIDE: 0.0003,
  COMMISSION_PER_SIDE: 20,
  DEFAULT_CAPITAL: 100_000,
  MIN_AVG_DAILY_VOLUME: 5_000_000,
}

// ============================== INTERFACES ==============================
interface PrevDay { open: number; high: number; low: number; close: number }

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

function isInORBWindow(candle: any): boolean {
  const t = candleMinutes(candle)
  return t >= toMinutes(GAP_CONFIG.MARKET_OPEN_H, GAP_CONFIG.MARKET_OPEN_M) &&
         t < toMinutes(GAP_CONFIG.ORB_END_H, GAP_CONFIG.ORB_END_M)
}

function isPostORB(candle: any): boolean {
  return candleMinutes(candle) >= toMinutes(GAP_CONFIG.ORB_END_H, GAP_CONFIG.ORB_END_M)
}

function isPastTimeStop(candle: any, h: number, m: number): boolean {
  return candleMinutes(candle) >= toMinutes(h, m)
}

// ============================== GAP CLASSIFIER ==============================
export function classifyGap(todayOpen: number, prevDay: PrevDay) {
  const { high: prevHigh, low: prevLow, close: prevClose } = prevDay
  const gapFromClose = todayOpen - prevClose
  const gapPct = gapFromClose / prevClose
  const absGapPct = Math.abs(gapPct)

  let type: string = GAP_TYPE.NO_GAP
  let direction: string = DIRECTION.NONE
  let gapFillTarget = prevClose
  let gapFromRange = 0

  if (todayOpen > prevHigh) {
    type = GAP_TYPE.FULL_GAP_UP; direction = DIRECTION.LONG
    gapFromRange = todayOpen - prevHigh; gapFillTarget = prevHigh
  } else if (todayOpen < prevLow) {
    type = GAP_TYPE.FULL_GAP_DOWN; direction = DIRECTION.SHORT
    gapFromRange = prevLow - todayOpen; gapFillTarget = prevLow
  } else if (todayOpen > prevClose && absGapPct >= GAP_CONFIG.GAP_MIN_THRESHOLD) {
    type = GAP_TYPE.PARTIAL_GAP_UP; direction = DIRECTION.LONG; gapFillTarget = prevClose
  } else if (todayOpen < prevClose && absGapPct >= GAP_CONFIG.GAP_MIN_THRESHOLD) {
    type = GAP_TYPE.PARTIAL_GAP_DOWN; direction = DIRECTION.SHORT; gapFillTarget = prevClose
  }

  const gapSize = classifyGapSize(absGapPct)

  return {
    type, direction, gapSize,
    gapPct: r4(gapPct), gapPctAbs: r4(absGapPct),
    gapAbsolute: r2(Math.abs(gapFromClose)),
    gapFromClose, gapFromRange: r2(gapFromRange),
    prevClose, prevHigh, prevLow, todayOpen, gapFillTarget,
    isGapUp: gapFromClose > 0, isGapDown: gapFromClose < 0,
    isFullGap: type === GAP_TYPE.FULL_GAP_UP || type === GAP_TYPE.FULL_GAP_DOWN,
  }
}

function classifyGapSize(absGapPct: number): string {
  if (absGapPct < GAP_CONFIG.GAP_MIN_THRESHOLD) return GAP_SIZE.NONE
  if (absGapPct < GAP_CONFIG.GAP_SMALL_MAX) return GAP_SIZE.SMALL
  if (absGapPct < GAP_CONFIG.GAP_MEDIUM_MAX) return GAP_SIZE.MEDIUM
  if (absGapPct < GAP_CONFIG.GAP_LARGE_MAX) return GAP_SIZE.LARGE
  return GAP_SIZE.HUGE
}

// ============================== CATALYST SCORING ==============================
function scoreCatalyst(gapInfo: any, first15Volume: number, avgFirst15Volume: number) {
  let score = 0
  const signals: string[] = []

  // Large/huge gap = likely catalyst-driven
  if (gapInfo.gapSize === GAP_SIZE.LARGE) { score += 40; signals.push('large_gap') }
  if (gapInfo.gapSize === GAP_SIZE.HUGE) { score += 60; signals.push('huge_gap') }

  // Full gap (beyond prev day range) = stronger conviction
  if (gapInfo.isFullGap) { score += 20; signals.push('full_gap') }

  // First-15-min volume surge
  if (avgFirst15Volume > 0) {
    const volRatio = first15Volume / avgFirst15Volume
    if (volRatio >= 3.0) { score += 30; signals.push(`vol_surge_${volRatio.toFixed(1)}x`) }
    else if (volRatio >= 2.0) { score += 15; signals.push(`vol_elevated`) }
    else if (volRatio < 1.0) { score -= 10; signals.push('vol_below_avg') }
  }

  score = Math.max(0, Math.min(100, score))
  return { hasCatalyst: score >= 50, catalystScore: score, inference: signals.join(', ') }
}

// ============================== STRATEGY ELIGIBILITY ==============================
function determineEligibleStrategies(gapInfo: any, catalystInfo: any) {
  const eligible: string[] = []

  if (gapInfo.type === GAP_TYPE.NO_GAP) return { eligible: [], primary: null }

  // Gap and Go: gap >= 1.5% with catalyst
  if (gapInfo.gapPctAbs >= GAP_CONFIG.GAG_MIN_GAP_PCT && catalystInfo.hasCatalyst) {
    eligible.push(GAP_STRATEGY.GAP_AND_GO)
  }

  // Gap Fill: gap 0.3%-1.5% without catalyst
  if (gapInfo.gapPctAbs >= GAP_CONFIG.GF_MIN_GAP_PCT &&
      gapInfo.gapPctAbs <= GAP_CONFIG.GF_MAX_GAP_PCT &&
      !catalystInfo.hasCatalyst) {
    eligible.push(GAP_STRATEGY.GAP_FILL)
  }

  // Weak catalyst in fill range — still eligible for fill
  if (gapInfo.gapPctAbs >= GAP_CONFIG.GF_MIN_GAP_PCT &&
      gapInfo.gapPctAbs <= GAP_CONFIG.GF_MAX_GAP_PCT &&
      catalystInfo.catalystScore > 0 && catalystInfo.catalystScore < 50 &&
      !eligible.includes(GAP_STRATEGY.GAP_FILL)) {
    eligible.push(GAP_STRATEGY.GAP_FILL)
  }

  return { eligible, primary: eligible[0] || null }
}

// ============================== ORB RANGE BUILDER ==============================
function buildORBRange(candles: any[]) {
  const orbCandles = candles.filter((c: any) => isInORBWindow(c))
  if (orbCandles.length === 0) return null

  let orbHigh = -Infinity, orbLow = Infinity, orbVolume = 0
  for (const c of orbCandles) {
    if (c.high > orbHigh) orbHigh = c.high
    if (c.low < orbLow) orbLow = c.low
    orbVolume += c.volume
  }

  return { orbHigh, orbLow, orbRange: orbHigh - orbLow, orbVolume, openPrice: orbCandles[0].open }
}

// ============================== RSI COMPUTATION ==============================
function computeRSI(candles: any[], period = GAP_CONFIG.GF_RSI_PERIOD) {
  if (candles.length < period + 1) { candles.forEach((c: any) => { c.rsi = 50 }); return }

  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change)
  }
  avgGain /= period; avgLoss /= period

  for (let i = 0; i <= period; i++) {
    candles[i].rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
  }

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = ((avgGain * (period - 1)) + gain) / period
    avgLoss = ((avgLoss * (period - 1)) + loss) / period
    candles[i].rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
  }
}

// ============================== VWAP COMPUTATION ==============================
function computeVWAP(candles: any[]) {
  let cumTPV = 0, cumVol = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    cumTPV += tp * c.volume; cumVol += c.volume
    c.vwap = cumVol > 0 ? cumTPV / cumVol : c.close
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

// ============================== GAP AND GO FILTERS ==============================
function filterGapAndGo(ctx: any) {
  const { gapInfo, catalystInfo, orb, avgFirst15Vol, breakoutCandle } = ctx
  const checks: boolean[] = []

  // 1. Gap >= 1.5%
  checks.push(gapInfo.gapPctAbs >= GAP_CONFIG.GAG_MIN_GAP_PCT)
  // 2. Has catalyst
  checks.push(catalystInfo.hasCatalyst)
  // 3. Price holds above opening price in ORB
  if (GAP_CONFIG.GAG_MUST_HOLD_ABOVE_OPEN && orb) {
    const holds = gapInfo.isGapUp
      ? orb.orbLow >= gapInfo.todayOpen * 0.998
      : orb.orbHigh <= gapInfo.todayOpen * 1.002
    checks.push(holds)
  }
  // 4. First-15 vol >= 3× avg
  if (orb && avgFirst15Vol > 0) {
    checks.push(orb.orbVolume / avgFirst15Vol >= GAP_CONFIG.GAG_FIRST_15_VOLUME_MULTIPLE)
  }
  // 5. Breakout confirmed
  if (breakoutCandle && orb) {
    const valid = gapInfo.isGapUp
      ? breakoutCandle.close > orb.orbHigh
      : breakoutCandle.close < orb.orbLow
    checks.push(valid)
  }

  return { pass: checks.every(Boolean) }
}

// ============================== GAP FILL FILTERS ==============================
function filterGapFill(ctx: any) {
  const { gapInfo, catalystInfo, orb, avgFirst15Vol, rsiAtEntry, vwapAtEntry, entryPrice } = ctx
  const checks: boolean[] = []

  // 1. Gap in fill range
  checks.push(gapInfo.gapPctAbs >= GAP_CONFIG.GF_MIN_GAP_PCT && gapInfo.gapPctAbs <= GAP_CONFIG.GF_MAX_GAP_PCT)
  // 2. No strong catalyst
  checks.push(!catalystInfo.hasCatalyst)
  // 3. First 15 min shows weakness
  if (orb) {
    const weakness = gapInfo.isGapUp
      ? orb.orbLow < gapInfo.todayOpen || (orb as any).orbCandles?.some((c: any) => c.close < gapInfo.todayOpen)
      : orb.orbHigh > gapInfo.todayOpen || (orb as any).orbCandles?.some((c: any) => c.close > gapInfo.todayOpen)
    checks.push(weakness ?? true)
  }
  // 4. Volume avg or below (no conviction)
  if (orb && avgFirst15Vol > 0) {
    checks.push(orb.orbVolume / avgFirst15Vol <= 1.5)
  }
  // 5. RSI extreme
  if (rsiAtEntry != null) {
    const rsiValid = gapInfo.isGapUp ? rsiAtEntry >= GAP_CONFIG.GF_RSI_OVERBOUGHT : rsiAtEntry <= GAP_CONFIG.GF_RSI_OVERSOLD
    checks.push(rsiValid)
  }
  // 6. Entry trigger (below VWAP for gap-up fade)
  if (vwapAtEntry != null) {
    const trigger = gapInfo.isGapUp ? entryPrice < vwapAtEntry : entryPrice > vwapAtEntry
    checks.push(trigger)
  }

  return { pass: checks.every(Boolean) }
}

// ============================== GAP AND GO SIGNAL ==============================
function detectGapAndGoSignal(candles: any[], gapInfo: any, catalystInfo: any, avgFirst15Vol: number) {
  const orb = buildORBRange(candles)
  if (!orb) return null
  const direction = gapInfo.isGapUp ? DIRECTION.LONG : DIRECTION.SHORT

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    if (!isPostORB(c)) continue
    if (isPastTimeStop(c, GAP_CONFIG.GF_TIME_STOP_H, GAP_CONFIG.GF_TIME_STOP_M)) break

    const isBreakout = direction === DIRECTION.LONG ? c.close > orb.orbHigh : c.close < orb.orbLow
    if (!isBreakout) continue

    if (!filterGapAndGo({ gapInfo, catalystInfo, orb, avgFirst15Vol, breakoutCandle: c }).pass) continue

    const isLong = direction === DIRECTION.LONG
    const entryPrice = isLong
      ? Math.max(c.close, orb.orbHigh + GAP_CONFIG.GAG_ENTRY_BUFFER)
      : Math.min(c.close, orb.orbLow - GAP_CONFIG.GAG_ENTRY_BUFFER)

    // SL = ORB low/high
    let sl = isLong ? orb.orbLow : orb.orbHigh
    const slPct = Math.abs(entryPrice - sl) / entryPrice
    if (slPct > GAP_CONFIG.MAX_SL_PCT) sl = isLong ? entryPrice * (1 - GAP_CONFIG.MAX_SL_PCT) : entryPrice * (1 + GAP_CONFIG.MAX_SL_PCT)

    // T1 = 1× gap size from breakout
    const gapSize = gapInfo.gapAbsolute
    const t1 = isLong ? entryPrice + gapSize : entryPrice - gapSize

    return {
      strategy: GAP_STRATEGY.GAP_AND_GO, direction,
      entryPrice, entryTime: c.time, entryIndex: i, sl,
      targets: [
        { price: t1, qtyPct: GAP_CONFIG.GAG_TARGET_1_QTY_PCT, label: 'T1_GAP_SIZE' },
        { price: null, qtyPct: GAP_CONFIG.GAG_TRAIL_QTY_PCT, label: 'TRAIL' },
      ],
      gapInfo, catalystInfo, gapType: gapInfo.type, gapSizeLabel: gapInfo.gapSize,
    }
  }
  return null
}

// ============================== GAP FILL SIGNAL ==============================
function detectGapFillSignal(candles: any[], gapInfo: any, catalystInfo: any, avgFirst15Vol: number) {
  const orb = buildORBRange(candles)
  if (!orb) return null

  // Fade the gap: gap up → SHORT, gap down → LONG
  const direction = gapInfo.isGapUp ? DIRECTION.SHORT : DIRECTION.LONG

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    if (!isPostORB(c)) continue
    if (isPastTimeStop(c, GAP_CONFIG.GF_TIME_STOP_H, GAP_CONFIG.GF_TIME_STOP_M)) break

    // Entry trigger: VWAP cross
    if (c.vwap == null) continue
    const triggerMet = gapInfo.isGapUp ? c.close < c.vwap : c.close > c.vwap
    if (!triggerMet) continue

    const entryPrice = c.close
    if (!filterGapFill({ gapInfo, catalystInfo, orb, avgFirst15Vol, rsiAtEntry: c.rsi, vwapAtEntry: c.vwap, entryPrice }).pass) continue

    const isLong = direction === DIRECTION.LONG
    // SL: above day high + 0.3% (for short), below day low - 0.3% (for long)
    let sl: number
    if (isLong) {
      sl = (c.dayLow || entryPrice * 0.99) * (1 - GAP_CONFIG.GF_SL_ABOVE_DAY_HIGH_PCT)
    } else {
      sl = (c.dayHigh || entryPrice * 1.01) * (1 + GAP_CONFIG.GF_SL_ABOVE_DAY_HIGH_PCT)
    }
    const slPct = Math.abs(entryPrice - sl) / entryPrice
    if (slPct > GAP_CONFIG.MAX_SL_PCT) sl = isLong ? entryPrice * (1 - GAP_CONFIG.MAX_SL_PCT) : entryPrice * (1 + GAP_CONFIG.MAX_SL_PCT)

    // Target: previous close (gap fill)
    const gapFillPrice = gapInfo.gapFillTarget

    // Validate R:R
    const risk = Math.abs(entryPrice - sl)
    const reward = Math.abs(gapFillPrice - entryPrice)
    if (risk > 0 && reward / risk < 0.8) continue

    return {
      strategy: GAP_STRATEGY.GAP_FILL, direction,
      entryPrice, entryTime: c.time, entryIndex: i, sl,
      targets: [{ price: gapFillPrice, qtyPct: 1.0, label: 'GAP_FILL_TARGET' }],
      gapInfo, catalystInfo, gapType: gapInfo.type, gapSizeLabel: gapInfo.gapSize,
      rsiAtEntry: c.rsi ? r2(c.rsi) : null,
    }
  }
  return null
}

// ============================== TRADE SIMULATION: GAP AND GO ==============================
function simulateGapAndGo(candles: any[], signal: any) {
  const { direction, entryPrice, entryIndex, sl, targets } = signal
  const isLong = direction === DIRECTION.LONG
  let remainingQty = 1.0, currentSL = sl
  const partialExits: any[] = []
  let t1Hit = false, trailActive = false

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const c = candles[i]
    if (remainingQty <= 0) break

    // EOD exit
    if (isPastTimeStop(c, GAP_CONFIG.MIS_EXIT_H, GAP_CONFIG.MIS_EXIT_M)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: GAP_EXIT.TIME_STOP_EOD })
      remainingQty = 0; break
    }

    // Stop-loss
    const hitSL = isLong ? c.low <= currentSL : c.high >= currentSL
    if (hitSL) {
      partialExits.push({ time: c.time, price: currentSL, qtyPct: remainingQty, reason: trailActive ? GAP_EXIT.TRAIL_STOP : GAP_EXIT.STOP_LOSS })
      remainingQty = 0; break
    }

    // Target 1
    if (!t1Hit && targets[0] && targets[0].price != null) {
      const hitT1 = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitT1) {
        t1Hit = true
        const exitQty = Math.min(targets[0].qtyPct, remainingQty)
        partialExits.push({ time: c.time, price: targets[0].price, qtyPct: exitQty, reason: GAP_EXIT.TARGET_1 })
        remainingQty -= exitQty
        currentSL = entryPrice; trailActive = true
      }
    }

    // Trail with 5-min candle lows/highs
    if (trailActive && remainingQty > 0) {
      const prev = candles[i - 1]
      if (isLong && prev.low > currentSL) currentSL = prev.low
      if (!isLong && prev.high < currentSL) currentSL = prev.high
    }

    // Noon time stop if T1 not hit
    if (!t1Hit && isPastTimeStop(c, GAP_CONFIG.GF_TIME_STOP_H, GAP_CONFIG.GF_TIME_STOP_M)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: GAP_EXIT.TIME_STOP_NOON })
      remainingQty = 0; break
    }
  }

  return buildGapTradeRecord(signal, partialExits)
}

// ============================== TRADE SIMULATION: GAP FILL ==============================
function simulateGapFill(candles: any[], signal: any) {
  const { direction, entryPrice, entryIndex, sl, gapInfo } = signal
  const isLong = direction === DIRECTION.LONG
  let remainingQty = 1.0
  const partialExits: any[] = []
  const gapFillPrice = gapInfo.gapFillTarget

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const c = candles[i]
    if (remainingQty <= 0) break

    // EOD exit
    if (isPastTimeStop(c, GAP_CONFIG.MIS_EXIT_H, GAP_CONFIG.MIS_EXIT_M)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: GAP_EXIT.TIME_STOP_EOD })
      remainingQty = 0; break
    }

    // Stop-loss
    const hitSL = isLong ? c.low <= sl : c.high >= sl
    if (hitSL) {
      partialExits.push({ time: c.time, price: sl, qtyPct: remainingQty, reason: GAP_EXIT.STOP_LOSS })
      remainingQty = 0; break
    }

    // Gap fill target
    const hitFill = isLong ? c.high >= gapFillPrice : c.low <= gapFillPrice
    if (hitFill) {
      partialExits.push({ time: c.time, price: gapFillPrice, qtyPct: remainingQty, reason: GAP_EXIT.GAP_FILL_COMPLETE })
      remainingQty = 0; break
    }

    // Noon time stop
    if (isPastTimeStop(c, GAP_CONFIG.GF_TIME_STOP_H, GAP_CONFIG.GF_TIME_STOP_M)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: GAP_EXIT.TIME_STOP_NOON })
      remainingQty = 0; break
    }
  }

  return buildGapTradeRecord(signal, partialExits)
}

// ============================== TRADE RECORD BUILDER ==============================
function buildGapTradeRecord(signal: any, partialExits: any[]) {
  const { direction, entryPrice, strategy, gapInfo } = signal
  const isLong = direction === DIRECTION.LONG

  let weightedExit = 0, totalQty = 0
  for (const e of partialExits) { weightedExit += e.price * e.qtyPct; totalQty += e.qtyPct }
  const avgExitPrice = totalQty > 0 ? weightedExit / totalQty : entryPrice
  const grossPnlPct = isLong ? (avgExitPrice - entryPrice) / entryPrice : (entryPrice - avgExitPrice) / entryPrice
  const netPnlPct = grossPnlPct - (GAP_CONFIG.SLIPPAGE_PER_SIDE * 2)
  const lastExit = partialExits[partialExits.length - 1]

  const reasonMap: Record<string, number> = {}
  for (const e of partialExits) reasonMap[e.reason] = (reasonMap[e.reason] || 0) + e.qtyPct
  let primaryReason = 'NONE', maxQty = 0
  for (const [r, q] of Object.entries(reasonMap)) { if (q > maxQty) { maxQty = q; primaryReason = r } }

  const gapFilled = partialExits.some((e: any) => e.reason === GAP_EXIT.GAP_FILL_COMPLETE)

  return {
    strategy, direction, entryPrice, avgExitPrice,
    entryTime: signal.entryTime, exitTime: lastExit?.time ?? null,
    grossPnlPct, netPnlPct, isWinner: netPnlPct > 0,
    partialExits, primaryExitReason: primaryReason,
    gapType: gapInfo?.type ?? null, gapSizeLabel: gapInfo?.gapSize ?? null,
    gapPctAbs: gapInfo?.gapPctAbs ?? null,
    gapDirection: gapInfo?.isGapUp ? 'UP' : 'DOWN',
    gapFilled, gapFillTarget: gapInfo?.gapFillTarget ?? null,
    catalystScore: signal.catalystInfo?.catalystScore ?? null,
    sl: signal.sl,
  }
}

// ============================== SINGLE-DAY ORCHESTRATOR ==============================
export function runGapForDay(dayCandlesRaw: any[], opts: any = {}) {
  const {
    prevDay = null,
    avgFirst15Volume = 0,
    enabledStrategies = [GAP_STRATEGY.GAP_AND_GO, GAP_STRATEGY.GAP_FILL],
    maxTradesPerDay = 1,
  } = opts

  if (!prevDay) return []

  const candles = dayCandlesRaw.map((c: any) => ({ ...c, time: c.time instanceof Date ? c.time : new Date(c.time) }))
  if (candles.length < 6) return []

  // Compute indicators
  computeVWAP(candles)
  computeRSI(candles)
  computeDayHighLow(candles)

  const todayOpen = candles[0].open
  const gapInfo = classifyGap(todayOpen, prevDay)
  if (gapInfo.type === GAP_TYPE.NO_GAP) return []

  // Score catalyst
  const orb = buildORBRange(candles)
  const first15Vol = orb ? orb.orbVolume : 0
  const estAvg15 = avgFirst15Volume > 0 ? avgFirst15Volume : first15Vol
  const catalystInfo = scoreCatalyst(gapInfo, first15Vol, estAvg15)
  const eligibility = determineEligibleStrategies(gapInfo, catalystInfo)

  const trades: any[] = []

  // Gap and Go
  if (enabledStrategies.includes(GAP_STRATEGY.GAP_AND_GO) && eligibility.eligible.includes(GAP_STRATEGY.GAP_AND_GO)) {
    const signal = detectGapAndGoSignal(candles, gapInfo, catalystInfo, estAvg15)
    if (signal) {
      const trade = simulateGapAndGo(candles, signal)
      if (trade) trades.push(trade)
    }
  }

  // Gap Fill
  if (trades.length < maxTradesPerDay && enabledStrategies.includes(GAP_STRATEGY.GAP_FILL) && eligibility.eligible.includes(GAP_STRATEGY.GAP_FILL)) {
    const signal = detectGapFillSignal(candles, gapInfo, catalystInfo, estAvg15)
    if (signal) {
      const trade = simulateGapFill(candles, signal)
      if (trade) trades.push(trade)
    }
  }

  return trades
}

// ============================== PERFORMANCE ANALYZER ==============================
export function analyzeGapPerformance(trades: any[], capital = GAP_CONFIG.DEFAULT_CAPITAL) {
  if (trades.length === 0) return { error: 'No trades' }

  const winners = trades.filter((t: any) => t.isWinner)
  const losers = trades.filter((t: any) => !t.isWinner)
  const pnls = trades.map((t: any) => t.netPnlPct)

  const totalTrades = trades.length
  const winRate = winners.length / totalTrades
  const avgWin = safeMean(winners.map((t: any) => t.netPnlPct))
  const avgLoss = safeMean(losers.map((t: any) => t.netPnlPct))
  const avgWLR = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : Infinity
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)

  const equityCurve = buildGapEquityCurve(trades, capital)
  const totalReturnPct = ((equityCurve[equityCurve.length - 1].equity - capital) / capital) * 100
  const maxDD = computeMaxDrawdown(equityCurve)
  const { maxWinStreak, maxLossStreak } = computeStreaks(trades)
  const sharpe = pnls.length >= 2 ? (safeMean(pnls) / stddev(pnls)) * Math.sqrt(250) : 0

  let grossProfit = 0, grossLoss = 0
  for (const t of trades) { if (t.netPnlPct > 0) grossProfit += t.netPnlPct; else grossLoss += Math.abs(t.netPnlPct) }
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity

  // Strategy breakdown
  const stratBD: Record<string, any> = {}
  for (const t of trades) {
    const key = t.strategy || 'UNKNOWN'
    if (!stratBD[key]) stratBD[key] = { count: 0, wins: 0, pnls: [], gapsFilled: 0 }
    stratBD[key].count++
    if (t.isWinner) stratBD[key].wins++
    stratBD[key].pnls.push(t.netPnlPct)
    if (t.gapFilled) stratBD[key].gapsFilled++
  }
  for (const k of Object.keys(stratBD)) {
    const d = stratBD[k]
    d.winRatePct = r2((d.wins / d.count) * 100)
    d.avgPnlPct = r4(safeMean(d.pnls) * 100)
    d.gapFillRate = r2((d.gapsFilled / d.count) * 100)
    delete d.pnls
  }

  // Gap size breakdown
  const gapSizeBD: Record<string, any> = {}
  for (const t of trades) {
    const key = t.gapSizeLabel || 'UNKNOWN'
    if (!gapSizeBD[key]) gapSizeBD[key] = { count: 0, wins: 0, filled: 0 }
    gapSizeBD[key].count++
    if (t.isWinner) gapSizeBD[key].wins++
    if (t.gapFilled) gapSizeBD[key].filled++
  }
  for (const k of Object.keys(gapSizeBD)) {
    const d = gapSizeBD[k]
    d.winRatePct = r2((d.wins / d.count) * 100)
    d.fillRatePct = r2((d.filled / d.count) * 100)
  }

  // Exit reasons
  const exitBD: Record<string, any> = {}
  for (const t of trades) {
    const reason = t.primaryExitReason || 'UNKNOWN'
    if (!exitBD[reason]) exitBD[reason] = { count: 0, totalPnl: 0, wins: 0 }
    exitBD[reason].count++; exitBD[reason].totalPnl += t.netPnlPct; if (t.isWinner) exitBD[reason].wins++
  }
  for (const r of Object.keys(exitBD)) {
    const d = exitBD[r]; d.winRatePct = r2((d.wins / d.count) * 100); d.avgPnlPct = r4((d.totalPnl / d.count) * 100)
  }

  // Gap direction
  const ups = trades.filter((t: any) => t.gapDirection === 'UP')
  const downs = trades.filter((t: any) => t.gapDirection === 'DOWN')
  const gapDirStats = {
    UP: ups.length > 0 ? { count: ups.length, winRatePct: r2((ups.filter((t: any) => t.isWinner).length / ups.length) * 100), fillRate: r2((ups.filter((t: any) => t.gapFilled).length / ups.length) * 100) } : { count: 0 },
    DOWN: downs.length > 0 ? { count: downs.length, winRatePct: r2((downs.filter((t: any) => t.isWinner).length / downs.length) * 100), fillRate: r2((downs.filter((t: any) => t.gapFilled).length / downs.length) * 100) } : { count: 0 },
  }

  const gapsFilled = trades.filter((t: any) => t.gapFilled).length

  return {
    totalTrades, winners: winners.length, losers: losers.length,
    winRatePct: r2(winRate * 100),
    avgWinPct: r4(avgWin * 100), avgLossPct: r4(avgLoss * 100),
    avgWinLossRatio: r2(avgWLR), expectancyPct: r4(expectancy * 100),
    totalReturnPct: r2(totalReturnPct),
    totalReturnAbs: r2(equityCurve[equityCurve.length - 1].equity - capital),
    maxDrawdownPct: r2(maxDD), sharpeRatio: r2(sharpe), profitFactor: r2(profitFactor),
    maxWinStreak, maxLossStreak,
    gapsFilled, gapFillRatePct: r2((gapsFilled / totalTrades) * 100),
    strategyBreakdown: stratBD, gapSizeBreakdown: gapSizeBD,
    exitReasonBreakdown: exitBD, gapDirectionStats: gapDirStats,
    equityCurve,
  }
}

// ============================== EQUITY CURVE ==============================
function buildGapEquityCurve(trades: any[], startCapital: number) {
  const curve = [{ tradeNum: 0, equity: startCapital }]
  let equity = startCapital
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    const riskAmt = equity * GAP_CONFIG.DEFAULT_RISK_PER_TRADE
    const slDist = Math.abs(t.entryPrice - (t.sl || t.entryPrice * 0.005)) || t.entryPrice * 0.005
    const qty = Math.floor(riskAmt / slDist)
    const pnl = qty * t.entryPrice * t.netPnlPct
    equity += pnl - GAP_CONFIG.COMMISSION_PER_SIDE * 2
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
  return maxDD * 100
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

// ============================== COMPUTE ROLLING AVG FIRST-15 VOLUMES ==============================
function computeAvgFirst15Volumes(dayGroups: Map<string, any[]>, lookback = 20) {
  const sortedDates = [...dayGroups.keys()].sort()
  const first15Volumes: number[] = []
  const avgMap = new Map<string, number>()
  const orbEnd = toMinutes(GAP_CONFIG.ORB_END_H, GAP_CONFIG.ORB_END_M)
  const mktOpen = toMinutes(GAP_CONFIG.MARKET_OPEN_H, GAP_CONFIG.MARKET_OPEN_M)

  for (const dateKey of sortedDates) {
    const dayCandles = dayGroups.get(dateKey)!
    let vol15 = 0
    for (const c of dayCandles) {
      const d = c.time instanceof Date ? c.time : new Date(c.time)
      const t = d.getHours() * 60 + d.getMinutes()
      if (t >= mktOpen && t < orbEnd) vol15 += c.volume
    }
    first15Volumes.push(vol15)

    const windowStart = Math.max(0, first15Volumes.length - lookback - 1)
    const windowEnd = first15Volumes.length - 1
    const window = first15Volumes.slice(windowStart, windowEnd)
    avgMap.set(dateKey, window.length > 0 ? window.reduce((a, b) => a + b, 0) / window.length : vol15)
  }
  return avgMap
}

// ============================== FULL BACKTEST ==============================
export function runFullGapBacktest(allCandles: any[], opts: any = {}) {
  const {
    capital = GAP_CONFIG.DEFAULT_CAPITAL,
    enabledStrategies = [GAP_STRATEGY.GAP_AND_GO, GAP_STRATEGY.GAP_FILL],
    maxTradesPerDay = 1,
  } = opts

  const dayGroups = groupByDay(allCandles)
  const sortedDates = [...dayGroups.keys()].sort()

  if (sortedDates.length < 2) return { trades: [], report: null }

  const avgFirst15Map = computeAvgFirst15Volumes(dayGroups)
  const allTrades: any[] = []
  const skippedDays: any[] = []

  for (let i = 1; i < sortedDates.length; i++) {
    const dateKey = sortedDates[i]
    const prevDateKey = sortedDates[i - 1]
    const dayCandles = dayGroups.get(dateKey)!
    const prevDayCandles = dayGroups.get(prevDateKey)!

    if (dayCandles.length < 6 || prevDayCandles.length < 3) {
      skippedDays.push({ date: dateKey, reason: 'Insufficient candles' }); continue
    }

    const prevDay: PrevDay = {
      open: prevDayCandles[0].open,
      high: Math.max(...prevDayCandles.map((c: any) => c.high)),
      low: Math.min(...prevDayCandles.map((c: any) => c.low)),
      close: prevDayCandles[prevDayCandles.length - 1].close,
    }

    const dayTrades = runGapForDay(dayCandles, {
      prevDay, avgFirst15Volume: avgFirst15Map.get(dateKey) || 0,
      enabledStrategies, maxTradesPerDay,
    })

    for (const t of dayTrades) { t.date = dateKey; allTrades.push(t) }
    if (dayTrades.length === 0) skippedDays.push({ date: dateKey, reason: 'No valid signal' })
  }

  const report = allTrades.length > 0 ? analyzeGapPerformance(allTrades, capital) : null
  return {
    trades: allTrades, report,
    totalDays: sortedDates.length - 1,
    tradedDays: new Set(allTrades.map((t: any) => t.date)).size,
    totalSignals: allTrades.length, skippedDays,
    hitRate: allTrades.length > 0 ? r2((allTrades.length / (sortedDates.length - 1)) * 100) : 0,
  }
}
