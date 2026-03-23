// Opening Range Breakout (ORB) Strategy — Indian Markets (NSE)
// Intraday: 15-min & 5-min ORB variants with VWAP, volume, gap filters
// Consolidated from orb-config, orb-filters, orb-core, orb-analyzer, orb-runner

// ============================== ENUMS ==============================
export const ORB_VARIANT = { ORB_15: '15min' as const, ORB_5: '5min' as const }
export const TRADE_DIRECTION = { LONG: 'LONG' as const, SHORT: 'SHORT' as const, NONE: 'NONE' as const }
export const EXIT_REASON = {
  TARGET_1: 'TARGET_1', TARGET_2: 'TARGET_2', TARGET_3_TRAIL: 'TARGET_3_TRAIL',
  STOP_LOSS: 'STOP_LOSS', TIME_STOP_NOON: 'TIME_STOP_NOON', TIME_STOP_EOD: 'TIME_STOP_EOD',
  TRAIL_STOP: 'TRAIL_STOP', RE_ENTRY_RANGE: 'RE_ENTRY_RANGE',
} as const

// ============================== CONFIGURATION ==============================
export const CONFIG = {
  // Market timings (IST)
  MARKET_OPEN_H: 9, MARKET_OPEN_M: 15,
  MARKET_CLOSE_H: 15, MARKET_CLOSE_M: 30,
  MIS_EXIT_H: 15, MIS_EXIT_M: 15,

  // ORB range window
  ORB_15_END_M: 30,         // 9:30 AM
  ORB_5_END_M: 20,          // 9:20 AM
  CANDLE_INTERVAL_MIN: 5,

  // Range width filter (fraction of price)
  RANGE_WIDTH_MIN: 0.002,   // 0.2%
  RANGE_WIDTH_MAX: 0.015,   // 1.5%
  RANGE_WIDTH_SKIP: 0.02,   // 2% → too wide

  // Volume filter
  VOLUME_BREAKOUT_FACTOR: 1.0,
  VOLUME_AVG_CANDLE_COUNT: 3,

  // Stop-loss
  MAX_SL_PCT: 0.007,        // 0.7% of capital
  USE_MIDPOINT_SL_WHEN_WIDE: true,
  WIDE_RANGE_THRESHOLD: 0.01,

  // Targets (multiples of range width)
  TARGET_1_MULTIPLE: 1.0,
  TARGET_2_MULTIPLE: 2.0,
  TARGET_1_QTY_PCT: 0.50,
  TARGET_2_QTY_PCT: 0.30,
  TRAIL_QTY_PCT: 0.20,

  // Time stops
  NOON_DEADLINE_H: 12, NOON_DEADLINE_M: 0,

  // Options (index ORB)
  OPTION_SL_PCT: 0.30,
  OPTION_TARGET_PCT_LO: 0.50,
  OPTION_TARGET_PCT_HI: 0.80,

  // Stock screening
  MIN_AVG_DAILY_VOLUME: 5_000_000,
  MIN_ATR_PCT: 0.015,
  MAX_SPREAD_PCT: 0.0005,

  // Backtest
  DEFAULT_CAPITAL: 100_000,
  DEFAULT_RISK_PER_TRADE: 0.01,
  SLIPPAGE_PER_SIDE: 0.0003,
  COMMISSION_PER_SIDE: 20,
}

// ============================== CANDLE TYPE ==============================
export interface Candle {
  time: Date | string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap?: number
}

// ============================== UTILITY ==============================
function round2(n: number): number { return Math.round(n * 100) / 100 }
function round4(n: number): number { return Math.round(n * 10000) / 10000 }
function mean(arr: number[]): number { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

// ============================== TIME HELPERS ==============================
export function timeOfDay(date: Date): { h: number; m: number } {
  return { h: date.getHours(), m: date.getMinutes() }
}

export function toMinutes(h: number, m: number): number { return h * 60 + m }

export function isInORBWindow(candleDate: Date, variant: string): boolean {
  const { h, m } = timeOfDay(candleDate)
  const t = toMinutes(h, m)
  const open = toMinutes(CONFIG.MARKET_OPEN_H, CONFIG.MARKET_OPEN_M)
  const endMin = variant === '15min' ? CONFIG.ORB_15_END_M : CONFIG.ORB_5_END_M
  const end = toMinutes(CONFIG.MARKET_OPEN_H, endMin)
  return t >= open && t < end
}

// ============================== FILTERS ==============================
export function filterRangeWidth(orbHigh: number, orbLow: number, refPrice: number) {
  const rangeWidth = orbHigh - orbLow
  const rangePct = rangeWidth / refPrice
  if (rangePct < CONFIG.RANGE_WIDTH_MIN)
    return { pass: false, reason: `Range too narrow: ${(rangePct * 100).toFixed(3)}% < ${CONFIG.RANGE_WIDTH_MIN * 100}%` }
  if (rangePct > CONFIG.RANGE_WIDTH_SKIP)
    return { pass: false, reason: `Range too wide: ${(rangePct * 100).toFixed(3)}% > ${CONFIG.RANGE_WIDTH_SKIP * 100}%` }
  if (rangePct > CONFIG.RANGE_WIDTH_MAX)
    return { pass: true, reason: `Range wide but tradeable: ${(rangePct * 100).toFixed(3)}% (use midpoint SL)`, wide: true }
  return { pass: true, wide: false }
}

export function filterBreakoutVolume(breakoutVolume: number, orbCandleVolumes: number[]) {
  const count = Math.min(orbCandleVolumes.length, CONFIG.VOLUME_AVG_CANDLE_COUNT)
  if (count === 0) return { pass: false, reason: 'No ORB candles to average volume' }
  const avgVol = orbCandleVolumes.slice(0, count).reduce((a, b) => a + b, 0) / count
  const required = avgVol * CONFIG.VOLUME_BREAKOUT_FACTOR
  if (breakoutVolume >= required) return { pass: true, ratio: breakoutVolume / avgVol }
  return { pass: false, reason: `Breakout vol ${breakoutVolume} < required ${required.toFixed(0)} (avg × ${CONFIG.VOLUME_BREAKOUT_FACTOR})` }
}

export function filterVWAP(price: number, vwap: number, direction: string) {
  if (direction === TRADE_DIRECTION.LONG && price > vwap) return { pass: true }
  if (direction === TRADE_DIRECTION.SHORT && price < vwap) return { pass: true }
  return { pass: false, reason: `VWAP misaligned: price=${price}, vwap=${vwap}, dir=${direction}` }
}

export function filterGapAlignment(direction: string, todayOpen: number, prevClose: number) {
  const gapPct = (todayOpen - prevClose) / prevClose
  if (direction === TRADE_DIRECTION.LONG && gapPct > 0) return { pass: true, gapPct }
  if (direction === TRADE_DIRECTION.SHORT && gapPct < 0) return { pass: true, gapPct }
  if (Math.abs(gapPct) < 0.001) return { pass: true, gapPct, note: 'Flat open — gap filter neutral' }
  return { pass: false, reason: `Gap direction (${(gapPct * 100).toFixed(2)}%) conflicts with ${direction}` }
}

export function filterStockEligibility(stockMeta: { avgDailyVolume: number; atr14Pct: number; avgSpreadPct: number }) {
  const reasons: string[] = []
  if (stockMeta.avgDailyVolume < CONFIG.MIN_AVG_DAILY_VOLUME) reasons.push(`Volume ${stockMeta.avgDailyVolume} < ${CONFIG.MIN_AVG_DAILY_VOLUME}`)
  if (stockMeta.atr14Pct < CONFIG.MIN_ATR_PCT) reasons.push(`ATR% ${(stockMeta.atr14Pct * 100).toFixed(2)}% < ${CONFIG.MIN_ATR_PCT * 100}%`)
  if (stockMeta.avgSpreadPct > CONFIG.MAX_SPREAD_PCT) reasons.push(`Spread ${(stockMeta.avgSpreadPct * 100).toFixed(4)}% > ${CONFIG.MAX_SPREAD_PCT * 100}%`)
  return reasons.length === 0 ? { pass: true } : { pass: false, reason: reasons.join('; ') }
}

export function runAllFilters(ctx: any) {
  const results: any[] = []
  results.push({ name: 'RangeWidth', ...filterRangeWidth(ctx.orbHigh, ctx.orbLow, ctx.refPrice) })
  results.push({ name: 'Volume', ...filterBreakoutVolume(ctx.breakoutVolume, ctx.orbCandleVolumes) })
  results.push({ name: 'VWAP', ...filterVWAP(ctx.breakoutClose, ctx.vwap, ctx.direction) })
  if (ctx.useGapFilter) results.push({ name: 'GapAlign', ...filterGapAlignment(ctx.direction, ctx.todayOpen, ctx.prevClose) })
  return { pass: results.every(r => r.pass), filters: results }
}

// ============================== ORB RANGE CONSTRUCTION ==============================
export function buildORBRange(candles: any[], variant = ORB_VARIANT.ORB_15) {
  const orbCandles = candles.filter((c: any) => isInORBWindow(c.time instanceof Date ? c.time : new Date(c.time), variant))
  if (orbCandles.length === 0) return null
  let orbHigh = -Infinity, orbLow = Infinity
  for (const c of orbCandles) {
    if (c.high > orbHigh) orbHigh = c.high
    if (c.low < orbLow) orbLow = c.low
  }
  const rangeWidth = orbHigh - orbLow
  const midpoint = (orbHigh + orbLow) / 2
  const refPrice = orbCandles[0].open
  const rangeWidthPct = rangeWidth / refPrice
  return { orbHigh, orbLow, rangeWidth, rangeWidthPct, midpoint, orbCandles, refPrice, todayOpen: refPrice }
}

// ============================== VWAP COMPUTATION ==============================
export function computeVWAP(candles: any[]) {
  let cumTPV = 0, cumVol = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    cumTPV += tp * c.volume
    cumVol += c.volume
    c.vwap = cumVol > 0 ? cumTPV / cumVol : c.close
  }
}

// ============================== SIGNAL DETECTION ==============================
export function detectBreakoutSignal(candles: any[], orb: any, opts: any = {}) {
  const { variant = ORB_VARIANT.ORB_15, prevClose = null, useGapFilter = variant === ORB_VARIANT.ORB_5 } = opts
  if (!orb) return null

  const orbEndMin = variant === '15min' ? CONFIG.ORB_15_END_M : CONFIG.ORB_5_END_M
  const orbEndT = toMinutes(CONFIG.MARKET_OPEN_H, orbEndMin)
  const orbCandleVolumes = orb.orbCandles.map((c: any) => c.volume)
  const noonT = toMinutes(CONFIG.NOON_DEADLINE_H, CONFIG.NOON_DEADLINE_M)

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const dt = candle.time instanceof Date ? candle.time : new Date(candle.time)
    const { h, m } = timeOfDay(dt)
    const t = toMinutes(h, m)
    if (t < orbEndT) continue
    if (t >= noonT) break

    // LONG breakout
    if (candle.close > orb.orbHigh) {
      const direction = TRADE_DIRECTION.LONG
      const filterCtx = {
        orbHigh: orb.orbHigh, orbLow: orb.orbLow, refPrice: orb.refPrice,
        breakoutVolume: candle.volume, orbCandleVolumes,
        breakoutClose: candle.close, vwap: candle.vwap ?? candle.close,
        direction, todayOpen: orb.todayOpen, prevClose: prevClose ?? orb.refPrice,
        variant, useGapFilter,
      }
      const fr = runAllFilters(filterCtx)
      if (fr.pass) {
        const entryPrice = Math.max(candle.close, orb.orbHigh + 1)
        const { sl, targets } = computeSLAndTargets(direction, entryPrice, orb)
        return { direction, entryPrice, entryTime: candle.time, entryIndex: i, sl, targets, orbData: orb, filterResults: fr.filters, breakoutCandle: candle }
      }
    }

    // SHORT breakdown
    if (candle.close < orb.orbLow) {
      const direction = TRADE_DIRECTION.SHORT
      const filterCtx = {
        orbHigh: orb.orbHigh, orbLow: orb.orbLow, refPrice: orb.refPrice,
        breakoutVolume: candle.volume, orbCandleVolumes,
        breakoutClose: candle.close, vwap: candle.vwap ?? candle.close,
        direction, todayOpen: orb.todayOpen, prevClose: prevClose ?? orb.refPrice,
        variant, useGapFilter,
      }
      const fr = runAllFilters(filterCtx)
      if (fr.pass) {
        const entryPrice = Math.min(candle.close, orb.orbLow - 1)
        const { sl, targets } = computeSLAndTargets(direction, entryPrice, orb)
        return { direction, entryPrice, entryTime: candle.time, entryIndex: i, sl, targets, orbData: orb, filterResults: fr.filters, breakoutCandle: candle }
      }
    }
  }
  return null
}

// ============================== SL & TARGETS ==============================
export function computeSLAndTargets(direction: string, entryPrice: number, orb: any) {
  const { orbHigh, orbLow, rangeWidth, midpoint, rangeWidthPct } = orb
  const isWide = rangeWidthPct > CONFIG.WIDE_RANGE_THRESHOLD
  const useMid = CONFIG.USE_MIDPOINT_SL_WHEN_WIDE && isWide
  let sl: number
  const targets: any[] = []

  if (direction === TRADE_DIRECTION.LONG) {
    sl = useMid ? midpoint : orbLow
    const slPct = (entryPrice - sl) / entryPrice
    if (slPct > CONFIG.MAX_SL_PCT) sl = entryPrice * (1 - CONFIG.MAX_SL_PCT)
    targets.push({ price: entryPrice + rangeWidth * CONFIG.TARGET_1_MULTIPLE, qtyPct: CONFIG.TARGET_1_QTY_PCT, label: 'T1' })
    targets.push({ price: entryPrice + rangeWidth * CONFIG.TARGET_2_MULTIPLE, qtyPct: CONFIG.TARGET_2_QTY_PCT, label: 'T2' })
    targets.push({ price: null, qtyPct: CONFIG.TRAIL_QTY_PCT, label: 'TRAIL' })
  } else {
    sl = useMid ? midpoint : orbHigh
    const slPct = (sl - entryPrice) / entryPrice
    if (slPct > CONFIG.MAX_SL_PCT) sl = entryPrice * (1 + CONFIG.MAX_SL_PCT)
    targets.push({ price: entryPrice - rangeWidth * CONFIG.TARGET_1_MULTIPLE, qtyPct: CONFIG.TARGET_1_QTY_PCT, label: 'T1' })
    targets.push({ price: entryPrice - rangeWidth * CONFIG.TARGET_2_MULTIPLE, qtyPct: CONFIG.TARGET_2_QTY_PCT, label: 'T2' })
    targets.push({ price: null, qtyPct: CONFIG.TRAIL_QTY_PCT, label: 'TRAIL' })
  }
  return { sl, targets }
}

// ============================== TRADE SIMULATION ==============================
export function simulateTrade(candles: any[], signal: any) {
  const { direction, entryPrice, entryIndex, sl, targets, orbData } = signal
  const isLong = direction === TRADE_DIRECTION.LONG
  let remainingQtyPct = 1.0
  const partialExits: any[] = []
  let currentSL = sl
  let t1Hit = false, t2Hit = false, trailActive = false
  const noonT = toMinutes(CONFIG.NOON_DEADLINE_H, CONFIG.NOON_DEADLINE_M)
  const eodT = toMinutes(CONFIG.MIS_EXIT_H, CONFIG.MIS_EXIT_M)

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const c = candles[i]
    const dt = c.time instanceof Date ? c.time : new Date(c.time)
    const { h, m } = timeOfDay(dt)
    const t = toMinutes(h, m)
    if (remainingQtyPct <= 0) break

    // TIME STOP: EOD
    if (t >= eodT) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQtyPct, reason: EXIT_REASON.TIME_STOP_EOD })
      remainingQtyPct = 0; break
    }

    // STOP-LOSS CHECK
    const hitSL = isLong ? c.low <= currentSL : c.high >= currentSL
    if (hitSL) {
      partialExits.push({ time: c.time, price: currentSL, qtyPct: remainingQtyPct, reason: trailActive ? EXIT_REASON.TRAIL_STOP : EXIT_REASON.STOP_LOSS })
      remainingQtyPct = 0; break
    }

    // TARGET 1
    if (!t1Hit && targets[0]) {
      const hitT1 = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitT1) {
        t1Hit = true
        const exitQty = Math.min(targets[0].qtyPct, remainingQtyPct)
        partialExits.push({ time: c.time, price: targets[0].price, qtyPct: exitQty, reason: EXIT_REASON.TARGET_1 })
        remainingQtyPct -= exitQty
        currentSL = entryPrice // move SL to breakeven
      }
    }

    // TARGET 2
    if (t1Hit && !t2Hit && targets[1]) {
      const hitT2 = isLong ? c.high >= targets[1].price : c.low <= targets[1].price
      if (hitT2) {
        t2Hit = true
        const exitQty = Math.min(targets[1].qtyPct, remainingQtyPct)
        partialExits.push({ time: c.time, price: targets[1].price, qtyPct: exitQty, reason: EXIT_REASON.TARGET_2 })
        remainingQtyPct -= exitQty
        trailActive = true
        currentSL = targets[0].price // trail SL = T1 level
      }
    }

    // TRAILING STOP UPDATE
    if (trailActive && remainingQtyPct > 0) {
      const backInRange = c.close >= orbData.orbLow && c.close <= orbData.orbHigh
      if (backInRange) {
        partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQtyPct, reason: EXIT_REASON.RE_ENTRY_RANGE })
        remainingQtyPct = 0; break
      }
      if (isLong) { const newTrail = candles[i - 1].low; if (newTrail > currentSL) currentSL = newTrail }
      else { const newTrail = candles[i - 1].high; if (newTrail < currentSL) currentSL = newTrail }
    }

    // TIME STOP: NOON (if T1 not hit)
    if (!t1Hit && t >= noonT) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQtyPct, reason: EXIT_REASON.TIME_STOP_NOON })
      remainingQtyPct = 0; break
    }
  }

  return buildTradeRecord(signal, partialExits)
}

// ============================== TRADE RECORD BUILDER ==============================
function buildTradeRecord(signal: any, partialExits: any[]) {
  const { direction, entryPrice, entryTime, orbData } = signal
  const isLong = direction === TRADE_DIRECTION.LONG
  let weightedExitPrice = 0, totalQtyExited = 0
  for (const exit of partialExits) { weightedExitPrice += exit.price * exit.qtyPct; totalQtyExited += exit.qtyPct }
  const avgExitPrice = totalQtyExited > 0 ? weightedExitPrice / totalQtyExited : entryPrice
  const grossPnlPct = isLong ? (avgExitPrice - entryPrice) / entryPrice : (entryPrice - avgExitPrice) / entryPrice
  const netPnlPct = grossPnlPct - (CONFIG.SLIPPAGE_PER_SIDE * 2)
  const lastExit = partialExits[partialExits.length - 1]
  const primaryExitReason = determinePrimaryExitReason(partialExits)
  return {
    direction, entryPrice, entryTime, avgExitPrice,
    exitTime: lastExit?.time ?? null,
    grossPnlPct, netPnlPct, partialExits, primaryExitReason,
    orbHigh: orbData.orbHigh, orbLow: orbData.orbLow,
    rangeWidth: orbData.rangeWidth, rangeWidthPct: orbData.rangeWidthPct,
    isWinner: netPnlPct > 0,
  }
}

function determinePrimaryExitReason(partialExits: any[]): string {
  if (partialExits.length === 0) return 'NONE'
  const byReason: Record<string, number> = {}
  for (const e of partialExits) byReason[e.reason] = (byReason[e.reason] || 0) + e.qtyPct
  let maxReason = '', maxQty = 0
  for (const [reason, qty] of Object.entries(byReason)) { if (qty > maxQty) { maxQty = qty; maxReason = reason } }
  return maxReason
}

// ============================== SINGLE-DAY ORCHESTRATOR ==============================
export function runORBForDay(dayCandlesRaw: any[], opts: any = {}) {
  const { variant = ORB_VARIANT.ORB_15, prevClose = null, useGapFilter } = opts
  const candles = dayCandlesRaw.map((c: any) => ({ ...c, time: c.time instanceof Date ? c.time : new Date(c.time) }))
  if (candles[0]?.vwap == null) computeVWAP(candles)
  const orb = buildORBRange(candles, variant)
  if (!orb) return null
  const signal = detectBreakoutSignal(candles, orb, { variant, prevClose, useGapFilter })
  if (!signal) return null
  return simulateTrade(candles, signal)
}

// ============================== PERFORMANCE ANALYZER ==============================
export function analyzePerformance(trades: any[], capital = CONFIG.DEFAULT_CAPITAL) {
  if (trades.length === 0) return { error: 'No trades to analyze' }

  const winners = trades.filter((t: any) => t.isWinner)
  const losers = trades.filter((t: any) => !t.isWinner)
  const longs = trades.filter((t: any) => t.direction === TRADE_DIRECTION.LONG)
  const shorts = trades.filter((t: any) => t.direction === TRADE_DIRECTION.SHORT)
  const pnlArray = trades.map((t: any) => t.netPnlPct)
  const winPnls = winners.map((t: any) => t.netPnlPct)
  const lossPnls = losers.map((t: any) => t.netPnlPct)

  const totalTrades = trades.length
  const winRate = winners.length / totalTrades
  const avgWin = mean(winPnls)
  const avgLoss = mean(lossPnls)
  const avgWinLossRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : Infinity
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)

  const equityCurve = buildEquityCurve(trades, capital)
  const totalReturnPct = ((equityCurve[equityCurve.length - 1].equity - capital) / capital) * 100
  const maxDrawdown = computeMaxDrawdown(equityCurve)
  const { maxWinStreak, maxLossStreak } = computeStreaks(trades)
  const exitReasonBreakdown = computeExitReasonBreakdown(trades)
  const longStats = computeDirectionStats(longs)
  const shortStats = computeDirectionStats(shorts)
  const pnlDistribution = computePnLDistribution(pnlArray)
  const sharpe = computeSharpe(pnlArray)
  const profitFactor = computeProfitFactor(trades)
  const calmar = totalReturnPct / (Math.abs(maxDrawdown.pct) || 1)

  return {
    totalTrades, winners: winners.length, losers: losers.length,
    winRate: round4(winRate), winRatePct: round2(winRate * 100),
    avgWinPct: round4(avgWin * 100), avgLossPct: round4(avgLoss * 100),
    avgWinLossRatio: round2(avgWinLossRatio),
    expectancyPct: round4(expectancy * 100), totalReturnPct: round2(totalReturnPct),
    totalReturnAbs: round2(equityCurve[equityCurve.length - 1].equity - capital),
    maxDrawdownPct: round2(maxDrawdown.pct), maxDrawdownAbs: round2(maxDrawdown.abs),
    maxDrawdownDuration: maxDrawdown.duration,
    sharpeRatio: round2(sharpe), profitFactor: round2(profitFactor), calmarRatio: round2(calmar),
    maxWinStreak, maxLossStreak,
    longTrades: longs.length, shortTrades: shorts.length,
    longWinRate: round2(longStats.winRate * 100), shortWinRate: round2(shortStats.winRate * 100),
    longAvgPnlPct: round4(longStats.avgPnl * 100), shortAvgPnlPct: round4(shortStats.avgPnl * 100),
    exitReasonBreakdown, pnlDistribution,
    profitableDaysPct: round2((winners.length / totalTrades) * 100),
    equityCurve, pnlArray: pnlArray.map((p: number) => round4(p * 100)),
  }
}

// ============================== EQUITY CURVE ==============================
function buildEquityCurve(trades: any[], startCapital: number) {
  const curve = [{ tradeNum: 0, equity: startCapital, date: null as any, pnlPct: 0, direction: '' }]
  let equity = startCapital
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    const riskAmount = equity * CONFIG.DEFAULT_RISK_PER_TRADE
    const slDistance = Math.abs(t.entryPrice - (t.direction === TRADE_DIRECTION.LONG ? t.orbLow : t.orbHigh))
    const slDistanceSafe = Math.max(slDistance, t.entryPrice * 0.001)
    const qty = Math.floor(riskAmount / slDistanceSafe)
    const positionValue = qty * t.entryPrice
    const pnlAbs = positionValue * t.netPnlPct
    const commission = CONFIG.COMMISSION_PER_SIDE * 2
    equity += pnlAbs - commission
    curve.push({ tradeNum: i + 1, equity: round2(equity), date: t.entryTime, pnlPct: round4(t.netPnlPct * 100), direction: t.direction })
  }
  return curve
}

// ============================== DRAWDOWN ==============================
function computeMaxDrawdown(equityCurve: any[]) {
  let peak = equityCurve[0].equity, maxDDPct = 0, maxDDAbs = 0, currentDDStart = 0, maxDDDuration = 0
  for (let i = 1; i < equityCurve.length; i++) {
    const eq = equityCurve[i].equity
    if (eq > peak) { peak = eq; currentDDStart = i }
    const dd = (peak - eq) / peak, ddAbs = peak - eq
    if (dd > maxDDPct) { maxDDPct = dd; maxDDAbs = ddAbs; maxDDDuration = i - currentDDStart }
  }
  return { pct: maxDDPct * 100, abs: maxDDAbs, duration: maxDDDuration }
}

// ============================== STREAKS ==============================
function computeStreaks(trades: any[]) {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0
  for (const t of trades) {
    if (t.isWinner) { curWin++; curLoss = 0; if (curWin > maxWin) maxWin = curWin }
    else { curLoss++; curWin = 0; if (curLoss > maxLoss) maxLoss = curLoss }
  }
  return { maxWinStreak: maxWin, maxLossStreak: maxLoss }
}

// ============================== EXIT REASON BREAKDOWN ==============================
function computeExitReasonBreakdown(trades: any[]) {
  const breakdown: Record<string, any> = {}
  for (const t of trades) {
    const reason = t.primaryExitReason || 'UNKNOWN'
    if (!breakdown[reason]) breakdown[reason] = { count: 0, totalPnlPct: 0, wins: 0 }
    breakdown[reason].count++
    breakdown[reason].totalPnlPct += t.netPnlPct
    if (t.isWinner) breakdown[reason].wins++
  }
  for (const reason of Object.keys(breakdown)) {
    const b = breakdown[reason]
    b.avgPnlPct = round4((b.totalPnlPct / b.count) * 100)
    b.winRate = round2((b.wins / b.count) * 100)
    b.totalPnlPct = round4(b.totalPnlPct * 100)
  }
  return breakdown
}

// ============================== DIRECTION STATS ==============================
function computeDirectionStats(trades: any[]) {
  if (trades.length === 0) return { winRate: 0, avgPnl: 0 }
  const wins = trades.filter((t: any) => t.isWinner).length
  const avgPnl = mean(trades.map((t: any) => t.netPnlPct))
  return { winRate: wins / trades.length, avgPnl }
}

// ============================== PNL DISTRIBUTION ==============================
function computePnLDistribution(pnlArray: number[]) {
  const pctArray = pnlArray.map(p => p * 100)
  const buckets: Record<string, number> = {
    'below -2%': 0, '-2% to -1%': 0, '-1% to -0.5%': 0, '-0.5% to 0%': 0,
    '0% to 0.5%': 0, '0.5% to 1%': 0, '1% to 2%': 0, 'above 2%': 0,
  }
  for (const p of pctArray) {
    if (p < -2) buckets['below -2%']++
    else if (p < -1) buckets['-2% to -1%']++
    else if (p < -0.5) buckets['-1% to -0.5%']++
    else if (p < 0) buckets['-0.5% to 0%']++
    else if (p < 0.5) buckets['0% to 0.5%']++
    else if (p < 1) buckets['0.5% to 1%']++
    else if (p < 2) buckets['1% to 2%']++
    else buckets['above 2%']++
  }
  return buckets
}

// ============================== SHARPE & PROFIT FACTOR ==============================
function computeSharpe(pnlArray: number[]) {
  if (pnlArray.length < 2) return 0
  const avg = mean(pnlArray), std = stddev(pnlArray)
  if (std === 0) return 0
  return (avg / std) * Math.sqrt(250)
}

function computeProfitFactor(trades: any[]) {
  let grossProfit = 0, grossLoss = 0
  for (const t of trades) { if (t.netPnlPct > 0) grossProfit += t.netPnlPct; else grossLoss += Math.abs(t.netPnlPct) }
  return grossLoss > 0 ? grossProfit / grossLoss : Infinity
}

// ============================== MONTHLY BREAKDOWN ==============================
export function monthlyBreakdown(trades: any[]) {
  const groups: Record<string, any[]> = {}
  for (const t of trades) {
    if (!t.entryTime) continue
    const d = t.entryTime instanceof Date ? t.entryTime : new Date(t.entryTime)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  const result: any[] = []
  for (const [month, mTrades] of Object.entries(groups).sort()) {
    const wins = mTrades.filter((t: any) => t.isWinner).length
    const totalPnl = mTrades.reduce((s: number, t: any) => s + t.netPnlPct, 0)
    result.push({ month, totalTrades: mTrades.length, wins, losses: mTrades.length - wins,
      winRatePct: round2((wins / mTrades.length) * 100), netPnlPct: round4(totalPnl * 100),
      avgPnlPct: round4((totalPnl / mTrades.length) * 100) })
  }
  return result
}

// ============================== DAY-OF-WEEK BREAKDOWN ==============================
export function dayOfWeekBreakdown(trades: any[]) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const groups: Record<string, any[]> = {}
  for (const t of trades) {
    if (!t.entryTime) continue
    const d = t.entryTime instanceof Date ? t.entryTime : new Date(t.entryTime)
    const dow = days[d.getDay()]
    if (!groups[dow]) groups[dow] = []
    groups[dow].push(t)
  }
  const result: Record<string, any> = {}
  for (const [dow, dTrades] of Object.entries(groups)) {
    const wins = dTrades.filter((t: any) => t.isWinner).length
    const totalPnl = dTrades.reduce((s: number, t: any) => s + t.netPnlPct, 0)
    result[dow] = { totalTrades: dTrades.length, winRatePct: round2((wins / dTrades.length) * 100),
      avgPnlPct: round4((totalPnl / dTrades.length) * 100) }
  }
  return result
}

// ============================== RANGE WIDTH ANALYSIS ==============================
export function rangeWidthAnalysis(trades: any[]) {
  const buckets: Record<string, any[]> = { '0.2-0.5%': [], '0.5-0.8%': [], '0.8-1.0%': [], '1.0-1.5%': [], '1.5%+': [] }
  for (const t of trades) {
    const rwPct = (t.rangeWidthPct || 0) * 100
    if (rwPct < 0.5) buckets['0.2-0.5%'].push(t)
    else if (rwPct < 0.8) buckets['0.5-0.8%'].push(t)
    else if (rwPct < 1.0) buckets['0.8-1.0%'].push(t)
    else if (rwPct < 1.5) buckets['1.0-1.5%'].push(t)
    else buckets['1.5%+'].push(t)
  }
  const result: Record<string, any> = {}
  for (const [bucket, bTrades] of Object.entries(buckets)) {
    if (bTrades.length === 0) { result[bucket] = { count: 0 }; continue }
    const wins = bTrades.filter((t: any) => t.isWinner).length
    const avgPnl = mean(bTrades.map((t: any) => t.netPnlPct))
    result[bucket] = { count: bTrades.length, winRatePct: round2((wins / bTrades.length) * 100), avgPnlPct: round4(avgPnl * 100) }
  }
  return result
}

// ============================== GROUP BY DAY ==============================
export function groupByDay(candles: any[]) {
  const days = new Map<string, any[]>()
  for (const c of candles) {
    const d = c.time instanceof Date ? c.time : new Date(c.time)
    const key = new Date(d.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10)
    if (!days.has(key)) days.set(key, [])
    days.get(key)!.push(c)
  }
  return days
}

// ============================== FULL BACKTEST ==============================
export function runFullBacktest(allCandles: any[], opts: any = {}) {
  const { variant = ORB_VARIANT.ORB_15, capital = 100_000, stockMeta = null, useGapFilter } = opts

  if (stockMeta) {
    const eligible = filterStockEligibility(stockMeta)
    if (!eligible.pass) return { trades: [], report: null, skippedReason: (eligible as any).reason }
  }

  const dayGroups = groupByDay(allCandles)
  const sortedDates = [...dayGroups.keys()].sort()
  const trades: any[] = []
  const skippedDays: any[] = []
  let prevClose: number | null = null

  for (let i = 0; i < sortedDates.length; i++) {
    const dateKey = sortedDates[i]
    const dayCandles = dayGroups.get(dateKey)!
    if (dayCandles.length < 6) {
      skippedDays.push({ date: dateKey, reason: 'Insufficient candles' })
      if (dayCandles.length > 0) prevClose = dayCandles[dayCandles.length - 1].close
      continue
    }
    const trade = runORBForDay(dayCandles, { variant, prevClose, useGapFilter })
    if (trade) { (trade as any).date = dateKey; trades.push(trade) }
    else skippedDays.push({ date: dateKey, reason: 'No valid signal' })
    prevClose = dayCandles[dayCandles.length - 1].close
  }

  const report = trades.length > 0 ? analyzePerformance(trades, capital) : null
  const monthly = trades.length > 0 ? monthlyBreakdown(trades) : []
  const dayOfWeek = trades.length > 0 ? dayOfWeekBreakdown(trades) : {}
  const rangeAnalysis = trades.length > 0 ? rangeWidthAnalysis(trades) : {}

  return {
    trades, report, monthly, dayOfWeek, rangeAnalysis, skippedDays,
    totalDays: sortedDates.length, tradedDays: trades.length,
    hitRate: trades.length > 0 ? round2((trades.length / sortedDates.length) * 100) : 0,
  }
}

// ============================== VARIANT COMPARISON ==============================
export function compareVariants(allCandles: any[], opts: any = {}) {
  const result15 = runFullBacktest(allCandles, { ...opts, variant: ORB_VARIANT.ORB_15 })
  const result5 = runFullBacktest(allCandles, { ...opts, variant: ORB_VARIANT.ORB_5 })
  return {
    orb15: {
      totalTrades: result15.report?.totalTrades, winRatePct: result15.report?.winRatePct,
      avgWinLossRatio: result15.report?.avgWinLossRatio, totalReturnPct: result15.report?.totalReturnPct,
      maxDrawdownPct: result15.report?.maxDrawdownPct, sharpeRatio: result15.report?.sharpeRatio,
      profitFactor: result15.report?.profitFactor, expectancyPct: result15.report?.expectancyPct,
    },
    orb5: {
      totalTrades: result5.report?.totalTrades, winRatePct: result5.report?.winRatePct,
      avgWinLossRatio: result5.report?.avgWinLossRatio, totalReturnPct: result5.report?.totalReturnPct,
      maxDrawdownPct: result5.report?.maxDrawdownPct, sharpeRatio: result5.report?.sharpeRatio,
      profitFactor: result5.report?.profitFactor, expectancyPct: result5.report?.expectancyPct,
    },
  }
}

// ============================== MULTI-STOCK SCANNER ==============================
export function multiStockScan(stockCandles: Map<string, any[]>, stockMetas = new Map<string, any>(), opts: any = {}) {
  const results: any[] = []
  for (const [symbol, candles] of stockCandles) {
    const meta = stockMetas.get(symbol) || null
    const res = runFullBacktest(candles, { ...opts, stockMeta: meta })
    if (res.report) {
      results.push({
        symbol, totalTrades: res.report.totalTrades, winRatePct: res.report.winRatePct,
        expectancyPct: res.report.expectancyPct, totalReturnPct: res.report.totalReturnPct,
        maxDrawdownPct: res.report.maxDrawdownPct, profitFactor: res.report.profitFactor,
        sharpeRatio: res.report.sharpeRatio,
      })
    } else {
      results.push({ symbol, skipped: true, reason: res.skippedReason || 'No trades' })
    }
  }
  results.sort((a, b) => {
    if (a.skipped && !b.skipped) return 1
    if (!a.skipped && b.skipped) return -1
    if (a.skipped && b.skipped) return 0
    return (b.expectancyPct || 0) - (a.expectancyPct || 0)
  })
  return results
}
