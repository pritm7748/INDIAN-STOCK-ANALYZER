// src/lib/strategy/gap-continuation.ts
// Strategy 11: Gap Continuation Swing (2-5 Days)
// Core thesis: Post-gap stocks on strong volume + bullish close drift 5-10%
// over 3-5 days. Since we don't have live earnings data from Yahoo Finance,
// we detect the gap purely from OHLCV: gap ≥ 3%, volume ≥ 3×, close near high,
// above 50-SMA, Day-2 pullback entry window.

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════

function r(v: number | null | undefined, d = 2): number {
  if (v == null || isNaN(v)) return 0
  return Math.round(v * 10 ** d) / 10 ** d
}
function clamp(v: number, min = 0, max = 100) { return Math.min(max, Math.max(min, v)) }
function mapRange(v: number, a: number, b: number, c: number, d: number) {
  return ((v - a) / (b - a)) * (d - c) + c
}

interface Candle { date: string; open: number; high: number; low: number; close: number; volume: number }

// ═══════════════════════════════════════════════════════
//  TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════

function sma(values: number[], period: number): number | null {
  if (!values || values.length < period) return null
  return r(values.slice(-period).reduce((a, b) => a + b, 0) / period)
}

function rsi(closes: number[], period = 14): number | null {
  if (!closes || closes.length < period + 1) return null
  let ag = 0, al = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) ag += d; else al -= d
  }
  ag /= period; al /= period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    ag = (ag * (period - 1) + Math.max(d, 0)) / period
    al = (al * (period - 1) + Math.max(-d, 0)) / period
  }
  return al === 0 ? 100 : r(100 - 100 / (1 + ag / al))
}

function atr(candles: Candle[], period = 14): number | null {
  if (!candles || candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ))
  }
  let val = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) val = (val * (period - 1) + trs[i]) / period
  return r(val)
}

function avgVolume(candles: Candle[], period = 20): number {
  if (!candles || candles.length < period) return 0
  return Math.round(candles.slice(-period).reduce((s, c) => s + c.volume, 0) / period)
}

// ═══════════════════════════════════════════════════════
//  GAP DETECTION & MEASUREMENT
// ═══════════════════════════════════════════════════════

interface GapData {
  gapPercent: number; absGap: number; isGapUp: boolean
  closePosition: number; idealClose: boolean; strongClose: boolean
  gapExtended: boolean; gapFilledIntraday: boolean; retracePct: number
  hasRejection: boolean; isMarubozu: boolean; rangeVsGap: number
  bodyPercent: number; upperWickPct: number; lowerWickPct: number
  gapDayHigh: number; gapDayLow: number; gapDayClose: number; gapDayOpen: number
  prevClose: number; gapDayVolume: number; date: string
}

function detectGap(gapDay: Candle, prevDay: Candle): GapData | null {
  if (!gapDay || !prevDay) return null

  const gapPercent = ((gapDay.open - prevDay.close) / prevDay.close) * 100
  const absGap = Math.abs(gapPercent)
  const isGapUp = gapPercent > 0

  const range = gapDay.high - gapDay.low
  const body = Math.abs(gapDay.close - gapDay.open)
  const closePosition = range > 0 ? (gapDay.close - gapDay.low) / range : 0.5

  const isBullish = gapDay.close >= gapDay.open
  const upperWick = range > 0 ? (gapDay.high - (isBullish ? gapDay.close : gapDay.open)) / range : 0
  const lowerWick = range > 0 ? ((isBullish ? gapDay.open : gapDay.close) - gapDay.low) / range : 0

  // gap fill: did price retrace to prev close during the day?
  const gapFilledIntraday = isGapUp ? gapDay.low <= prevDay.close : gapDay.high >= prevDay.close

  // retrace calculation
  let retracePct = 0
  if (isGapUp && gapDay.low < gapDay.open) {
    const gapSize = gapDay.open - prevDay.close
    retracePct = gapSize > 0 ? ((gapDay.open - gapDay.low) / gapSize) * 100 : 0
  } else if (!isGapUp && gapDay.high > gapDay.open) {
    const gapSize = prevDay.close - gapDay.open
    retracePct = gapSize > 0 ? ((gapDay.high - gapDay.open) / gapSize) * 100 : 0
  }

  // did gap EXTEND during the day?
  const gapExtended = isGapUp ? gapDay.close > gapDay.open : gapDay.close < gapDay.open

  // closing strength
  const idealClose = isGapUp ? closePosition > 0.80 : closePosition < 0.20
  const strongClose = isGapUp ? closePosition > 0.65 : closePosition < 0.35

  // rejection wick
  const hasRejection = isGapUp ? upperWick > 0.30 : lowerWick > 0.30

  // marubozu-like: full body, no wicks
  const isMarubozu = body / range > 0.80 && isBullish === isGapUp

  const rangeVsGap = absGap > 0 ? ((range / prevDay.close) * 100) / absGap : 1

  return {
    gapPercent: r(gapPercent), absGap: r(absGap), isGapUp,
    closePosition: r(closePosition, 3), idealClose, strongClose,
    gapExtended, gapFilledIntraday, retracePct: r(retracePct),
    hasRejection, isMarubozu, rangeVsGap: r(rangeVsGap),
    bodyPercent: r((body / range) * 100),
    upperWickPct: r(upperWick * 100), lowerWickPct: r(lowerWick * 100),
    gapDayHigh: r(gapDay.high), gapDayLow: r(gapDay.low),
    gapDayClose: r(gapDay.close), gapDayOpen: r(gapDay.open),
    prevClose: r(prevDay.close), gapDayVolume: gapDay.volume, date: gapDay.date,
  }
}

// ═══════════════════════════════════════════════════════
//  PRE-GAP TREND ANALYSIS
// ═══════════════════════════════════════════════════════

interface TrendContext {
  above50SMA: boolean | null; above200SMA: boolean | null
  wasConsolidating: boolean; nearATH: boolean
  sma50: number | null; sma200: number | null
  meetsStrategyFilter: boolean; trendScore: number
}

function preGapTrend(candles: Candle[], gapDayIndex: number): TrendContext | null {
  if (!candles || gapDayIndex < 60) return null

  const prior = candles.slice(0, gapDayIndex)
  const closes = prior.map(c => c.close)
  const last = closes[closes.length - 1]

  const sma50 = sma(closes, 50)
  const sma200 = closes.length >= 200 ? sma(closes, 200) : null

  const above50 = sma50 ? last > sma50 : null
  const above200 = sma200 ? last > sma200 : null

  // was consolidating? (tight range = setup for gap breakout)
  const last10 = prior.slice(-10)
  const rangePct = last > 0
    ? ((Math.max(...last10.map(c => c.high)) - Math.min(...last10.map(c => c.low))) / last) * 100
    : 0
  const wasConsolidating = rangePct < 6

  // 52W high proximity
  const high52 = closes.length >= 250 ? Math.max(...closes.slice(-250)) : Math.max(...closes)
  const nearATH = ((high52 - last) / high52) * 100 < 10

  const trendScore = r(clamp(
    (above50 ? 30 : 0) + (above200 ? 25 : 0)
    + (wasConsolidating ? 15 : 0) + (nearATH ? 15 : 0) + 15
  ))

  return {
    above50SMA: above50, above200SMA: above200,
    wasConsolidating, nearATH,
    sma50, sma200,
    meetsStrategyFilter: above50 === true,
    trendScore,
  }
}

// ═══════════════════════════════════════════════════════
//  DAY-2 PULLBACK ASSESSMENT
// ═══════════════════════════════════════════════════════

interface Day2Assessment {
  canEnter: boolean; openType: string; d2OpenVsGapClose: number
  marketEntry: number; stopLoss: number; stopLossPercent: number
  stopByGapLow: number; stopBy5Pct: number
  heldGapDayLow: boolean; d2Bullish: boolean
  d2ClosePosition: number; d2Continuation: boolean
  pullbackScore: number
}

function day2Assessment(gapData: GapData, day2Candle: Candle): Day2Assessment | null {
  if (!gapData || !day2Candle) return null

  const d2 = day2Candle
  const gapClose = gapData.gapDayClose
  const d2OpenVsGapClose = ((d2.open - gapClose) / gapClose) * 100
  const isGapUp = gapData.isGapUp

  // STRICT strategy filter: -2% to +2%, NOT if gaps up another 3%+
  let canEnter: boolean, openType: string

  if (isGapUp) {
    if (d2OpenVsGapClose > 3) { canEnter = false; openType = 'TOO_EXTENDED' }
    else if (d2OpenVsGapClose >= -2 && d2OpenVsGapClose <= 2) {
      canEnter = true
      openType = d2OpenVsGapClose < -0.5 ? 'IDEAL_PULLBACK' : 'FLAT_OPEN'
    }
    else if (d2OpenVsGapClose >= -4) { canEnter = false; openType = 'DEEP_PULLBACK' }
    else { canEnter = false; openType = 'GAP_FAILING' }
  } else {
    if (d2OpenVsGapClose < -3) { canEnter = false; openType = 'TOO_EXTENDED' }
    else if (d2OpenVsGapClose >= -2 && d2OpenVsGapClose <= 2) {
      canEnter = true
      openType = d2OpenVsGapClose > 0.5 ? 'IDEAL_BOUNCE' : 'FLAT_OPEN'
    }
    else { canEnter = false; openType = 'GAP_FAILING' }
  }

  const marketEntry = r(d2.open)

  // STOP LOSS: below gap-day low OR 5%, whichever is TIGHTER
  const stopByGapLow = isGapUp ? gapData.gapDayLow : gapData.gapDayHigh
  const stopBy5Pct = isGapUp ? d2.open * 0.95 : d2.open * 1.05
  let stopLoss = isGapUp
    ? Math.max(stopByGapLow, stopBy5Pct) // MAX = tighter for longs
    : Math.min(stopByGapLow, stopBy5Pct) // MIN = tighter for shorts
  let stopPercent = Math.abs((d2.open - stopLoss) / d2.open) * 100
  // P1: Enforce max SL cap
  if (stopPercent > 6) {
    stopLoss = isGapUp ? r(d2.open * 0.94) : r(d2.open * 1.06)
    stopPercent = 6
  }

  // Day-2 quality
  const heldGapDayLow = isGapUp ? d2.low > gapData.gapDayLow : d2.high < gapData.gapDayHigh
  const d2Range = d2.high - d2.low
  const d2ClosePos = d2Range > 0 ? (d2.close - d2.low) / d2Range : 0.5
  const d2Bullish = d2.close > d2.open
  const d2Continuation = isGapUp ? d2Bullish && d2ClosePos > 0.6 : !d2Bullish && d2ClosePos < 0.4

  const pullbackScore = r(clamp(
    (openType === 'IDEAL_PULLBACK' || openType === 'IDEAL_BOUNCE' ? 40 : 0)
    + (openType === 'FLAT_OPEN' ? 30 : 0)
    + (openType === 'DEEP_PULLBACK' ? 15 : 0)
    + (heldGapDayLow ? 20 : -5)
    + (d2Continuation ? 15 : 0)
    + (canEnter ? 10 : 0)
  ))

  return {
    canEnter, openType, d2OpenVsGapClose: r(d2OpenVsGapClose),
    marketEntry, stopLoss: r(stopLoss), stopLossPercent: r(stopPercent),
    stopByGapLow: r(stopByGapLow), stopBy5Pct: r(stopBy5Pct),
    heldGapDayLow, d2Bullish, d2ClosePosition: r(d2ClosePos, 3),
    d2Continuation, pullbackScore,
  }
}

// ═══════════════════════════════════════════════════════
//  HISTORICAL GAP STATS (per stock)
// ═══════════════════════════════════════════════════════

function historicalGapStats(candles: Candle[], minGapPct = 3, fwdDays = 5) {
  if (!candles || candles.length < 100) return null
  const events: { gapPct: number; finalRet: number; continued: boolean }[] = []

  for (let i = 1; i < candles.length - fwdDays - 1; i++) {
    const gapPct = ((candles[i].open - candles[i - 1].close) / candles[i - 1].close) * 100
    if (Math.abs(gapPct) < minGapPct) continue
    const entry = candles[i + 1].open
    const returns: number[] = []
    for (let d = 1; d <= fwdDays && i + 1 + d < candles.length; d++) {
      returns.push(((candles[i + 1 + d].close - entry) / entry) * 100)
    }
    const finalRet = returns.length > 0 ? returns[returns.length - 1] : 0
    const continued = gapPct > 0 ? finalRet > 0 : finalRet < 0
    events.push({ gapPct: r(gapPct), finalRet: r(finalRet), continued })
  }

  if (events.length < 2) return null
  const ups = events.filter(e => e.gapPct > 0)
  const downs = events.filter(e => e.gapPct < 0)

  const analyze = (arr: typeof events) => {
    if (arr.length === 0) return { count: 0, continuationRate: 0, avgReturn: 0 }
    const cont = arr.filter(e => e.continued)
    return {
      count: arr.length,
      continuationRate: r((cont.length / arr.length) * 100),
      avgReturn: r(arr.reduce((s, e) => s + e.finalRet, 0) / arr.length),
    }
  }

  return { gapUp: analyze(ups), gapDown: analyze(downs), totalGaps: events.length }
}

// ═══════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════

const GC_CONFIG = {
  MIN_GAP_PCT: 3,          // minimum gap % to consider (relaxed from 5% to 3% for more signals since we don't filter by earnings)
  MAX_GAP_PCT: 20,         // gaps > 20% too extreme
  MIN_VOL_MULTIPLE: 2.5,   // volume ≥ 2.5× avg (relaxed from 3× since no earnings filter)
  MIN_CLOSE_POS: 0.65,     // close position for strong close
  MAX_HOLD_DAYS: 5,
  RSI_EXIT_LONG: 75,
  RSI_EXIT_SHORT: 25,
  TRAIL_ACTIVATION: 3,     // trailing activates at 3% profit
  TRAIL_PROTECT: 0.50,     // lock 50% of peak profit
  MAX_DAY2_GAP_UP: 3,      // Day-2 open must not gap another 3%+
  MAX_DAY2_PULLBACK: -4,   // Day-2 can pull back at most -4%
  MAX_POSITIONS_PER_DAY: 3,
  LOOKBACK: 60,
  MAX_SL_PCT: 6,
  MIN_AVG_VOLUME: 300000,
}

// ═══════════════════════════════════════════════════════
//  LIVE SCANNER
// ═══════════════════════════════════════════════════════

export interface GapCandidate {
  symbol: string; direction: 'LONG' | 'SHORT'
  gapData: GapData; trend: TrendContext | null
  gapHistory: ReturnType<typeof historicalGapStats>
  day2: Day2Assessment | null
  gapDayScore: number; combinedScore: number
  rsi14: number | null; atr14: number | null; avgVol: number; volRatio: number
  entryPrice: number; stopLoss: number; slPct: number
  target1: number; tgt1Pct: number; target2: number; tgt2Pct: number
  riskReward: number
  gapType: 'TODAY_GAP' | 'YESTERDAY_GAP_ENTRY'
  grade: string
  btWinRate: number | null; btTrades: number; btAvgPnl: number | null
  exitRules: any
}

export function scanGapContinuation(
  stocks: { symbol: string; dailyCandles: Candle[] }[],
  niftyCandles: Candle[],
  vix: number | null,
): { todayGaps: GapCandidate[]; yesterdayEntry: GapCandidate[]; meta: any } {

  const todayGaps: GapCandidate[] = []  // stocks that gapped today (watchlist for tomorrow)
  const yesterdayEntry: GapCandidate[] = [] // stocks that gapped yesterday → enter today

  for (const stock of stocks) {
    const daily = stock.dailyCandles
    if (!daily || daily.length < GC_CONFIG.LOOKBACK + 5) continue
    // P1: Liquidity filter
    if (avgVolume(daily.slice(0, daily.length - 1), 20) < GC_CONFIG.MIN_AVG_VOLUME) continue

    // ─── CHECK: Gap YESTERDAY → entry TODAY ───
    const len = daily.length
    const yesterday = daily[len - 2]
    const dayBefore = daily[len - 3]
    const today = daily[len - 1]

    if (yesterday && dayBefore) {
      const gapData = detectGap(yesterday, dayBefore)
      if (gapData && gapData.absGap >= GC_CONFIG.MIN_GAP_PCT && gapData.absGap <= GC_CONFIG.MAX_GAP_PCT) {
        const avgVol = avgVolume(daily.slice(0, len - 2), 20)
        const volRatio = avgVol > 0 ? yesterday.volume / avgVol : 0

        if (volRatio >= GC_CONFIG.MIN_VOL_MULTIPLE) {
          const isGapUp = gapData.isGapUp
          const okClose = isGapUp ? gapData.strongClose : gapData.closePosition < 0.35

          if (okClose) {
            const trend = preGapTrend(daily, len - 2)
            // P1: Gap-ups need above 50-SMA; shorts need NOT above 50-SMA
            const trendOk = isGapUp ? trend?.above50SMA === true : trend?.above50SMA !== true

            if (trendOk) {
              // Day-2 = today
              const d2 = day2Assessment(gapData, today)
              if (d2 && d2.canEnter) {
                const gapHistory = historicalGapStats(daily, 3, 5)
                const closes = daily.map(c => c.close)
                const rsi14 = rsi(closes, 14)
                const atr14 = atr(daily, 14)

                // Score
                let score = 0
                score += clamp(mapRange(gapData.absGap, 3, 10, 40, 80)) / 100 * 20
                score += (trend?.trendScore || 40) / 100 * 15
                score += clamp(mapRange(volRatio, 2.5, 7, 50, 100)) / 100 * 10
                if (gapData.idealClose) score += 8; else if (gapData.strongClose) score += 5
                if (gapData.isMarubozu) score += 3
                if (gapData.hasRejection) score -= 5
                if (gapData.gapFilledIntraday) score -= 5
                if (gapData.gapExtended) score += 3
                // P1: Day-2 held gap-day low — strong confirmation
                if (d2.heldGapDayLow) score += 5
                // P1: Per-stock gap history
                if (gapHistory) {
                  const cr = isGapUp ? gapHistory.gapUp?.continuationRate : gapHistory.gapDown?.continuationRate
                  if (cr && cr > 60) score += 5; else if (cr && cr < 40) score -= 3
                }
                // P2: VIX penalty
                if (vix !== null && vix > 18) score -= 3

                const combined = r(score * 0.65 + d2.pullbackScore * 0.35)

                // Targets
                const entry = d2.marketEntry
                const gapRange = gapData.gapDayHigh - gapData.gapDayLow
                const t1 = isGapUp ? r(gapData.gapDayHigh + gapRange * 0.5) : r(gapData.gapDayLow - gapRange * 0.5)
                const t2 = atr14 ? (isGapUp ? r(entry + atr14 * 3) : r(entry - atr14 * 3)) : (isGapUp ? r(entry * 1.08) : r(entry * 0.92))
                const riskPerShare = Math.abs(entry - d2.stopLoss)
                const rr = riskPerShare > 0 ? r(Math.abs(t1 - entry) / riskPerShare) : 0
                const slPct = entry > 0 ? r(Math.abs(entry - d2.stopLoss) / entry * 100) : 0
                const t1Pct = entry > 0 ? r(Math.abs(t1 - entry) / entry * 100) : 0
                const t2Pct = entry > 0 ? r(Math.abs(t2 - entry) / entry * 100) : 0

                const grade = combined >= 55 ? 'A' : combined >= 40 ? 'B' : 'C'

                yesterdayEntry.push({
                  symbol: stock.symbol, direction: isGapUp ? 'LONG' : 'SHORT',
                  gapData, trend, gapHistory, day2: d2,
                  gapDayScore: r(score), combinedScore: combined,
                  rsi14, atr14, avgVol, volRatio: r(volRatio),
                  entryPrice: entry, stopLoss: d2.stopLoss, slPct,
                  target1: t1, tgt1Pct: t1Pct, target2: t2, tgt2Pct: t2Pct,
                  riskReward: rr, gapType: 'YESTERDAY_GAP_ENTRY', grade,
                  btWinRate: null, btTrades: 0, btAvgPnl: null,
                  exitRules: {
                    rsiExit: isGapUp ? `RSI(14) \u2265 ${GC_CONFIG.RSI_EXIT_LONG}` : `RSI(14) \u2264 ${GC_CONFIG.RSI_EXIT_SHORT}`,
                    trailing: `+${GC_CONFIG.TRAIL_ACTIVATION}% activates, locks ${GC_CONFIG.TRAIL_PROTECT * 100}% of peak`,
                    maxHold: `${GC_CONFIG.MAX_HOLD_DAYS} days`,
                  },
                })
              }
            }
          }
        }
      }
    }

    // ─── CHECK: Gap TODAY (watchlist for tomorrow) ───
    const todayCandle = daily[len - 1]
    const prevDay = daily[len - 2]
    if (todayCandle && prevDay) {
      const gapData = detectGap(todayCandle, prevDay)
      if (gapData && gapData.absGap >= GC_CONFIG.MIN_GAP_PCT && gapData.absGap <= GC_CONFIG.MAX_GAP_PCT) {
        const avVol = avgVolume(daily.slice(0, len - 1), 20)
        const vr = avVol > 0 ? todayCandle.volume / avVol : 0

        if (vr >= GC_CONFIG.MIN_VOL_MULTIPLE) {
          const isGapUp = gapData.isGapUp
          const okClose = isGapUp ? gapData.strongClose : gapData.closePosition < 0.35

          if (okClose) {
            const trend = preGapTrend(daily, len - 1)
            const trendOk = isGapUp ? trend?.above50SMA === true : trend?.above50SMA !== true

            if (trendOk) {
              const gapHistory = historicalGapStats(daily, 3, 5)
              const closes = daily.map(c => c.close)
              const rsi14v = rsi(closes, 14)
              const atr14v = atr(daily, 14)

              let score = 0
              score += clamp(mapRange(gapData.absGap, 3, 10, 40, 80)) / 100 * 20
              score += (trend?.trendScore || 40) / 100 * 15
              score += clamp(mapRange(vr, 2.5, 7, 50, 100)) / 100 * 10
              if (gapData.idealClose) score += 8; else if (gapData.strongClose) score += 5
              if (gapData.isMarubozu) score += 3
              if (gapData.hasRejection) score -= 5
              if (gapData.gapFilledIntraday) score -= 5
              if (gapData.gapExtended) score += 3
              // P1: Per-stock gap history
              if (gapHistory) {
                const cr = isGapUp ? gapHistory.gapUp?.continuationRate : gapHistory.gapDown?.continuationRate
                if (cr && cr > 60) score += 5; else if (cr && cr < 40) score -= 3
              }
              // P2: VIX penalty
              if (vix !== null && vix > 18) score -= 3

              // Tentative target (will refine on Day-2)
              const tentativeEntry = gapData.gapDayClose
              const gapRange = gapData.gapDayHigh - gapData.gapDayLow
              const t1 = isGapUp ? r(gapData.gapDayHigh + gapRange * 0.5) : r(gapData.gapDayLow - gapRange * 0.5)
              const tentativeSL = isGapUp
                ? Math.max(gapData.gapDayLow, tentativeEntry * 0.95)
                : Math.min(gapData.gapDayHigh, tentativeEntry * 1.05)
              const t2 = atr14v ? (isGapUp ? r(tentativeEntry + atr14v * 3) : r(tentativeEntry - atr14v * 3)) : r(tentativeEntry * (isGapUp ? 1.08 : 0.92))
              const riskPS = Math.abs(tentativeEntry - tentativeSL)
              const rr = riskPS > 0 ? r(Math.abs(t1 - tentativeEntry) / riskPS) : 0
              const slPct = tentativeEntry > 0 ? r(Math.abs(tentativeEntry - tentativeSL) / tentativeEntry * 100) : 0
              const t1Pct = tentativeEntry > 0 ? r(Math.abs(t1 - tentativeEntry) / tentativeEntry * 100) : 0
              const t2Pct = tentativeEntry > 0 ? r(Math.abs(t2 - tentativeEntry) / tentativeEntry * 100) : 0

              const grade = score >= 55 ? 'A' : score >= 40 ? 'B' : 'C'

              todayGaps.push({
                symbol: stock.symbol, direction: isGapUp ? 'LONG' : 'SHORT',
                gapData, trend, gapHistory, day2: null,
                gapDayScore: r(score), combinedScore: r(score),
                rsi14: rsi14v, atr14: atr14v, avgVol: avVol, volRatio: r(vr),
                entryPrice: tentativeEntry, stopLoss: r(tentativeSL), slPct,
                target1: t1, tgt1Pct: t1Pct, target2: t2, tgt2Pct: t2Pct,
                riskReward: rr, gapType: 'TODAY_GAP', grade,
                btWinRate: null, btTrades: 0, btAvgPnl: null,
                exitRules: {
                  rsiExit: isGapUp ? `RSI(14) \u2265 ${GC_CONFIG.RSI_EXIT_LONG}` : `RSI(14) \u2264 ${GC_CONFIG.RSI_EXIT_SHORT}`,
                  trailing: `+${GC_CONFIG.TRAIL_ACTIVATION}% activates, locks ${GC_CONFIG.TRAIL_PROTECT * 100}% of peak`,
                  maxHold: `${GC_CONFIG.MAX_HOLD_DAYS} days`,
                },
              })
            }
          }
        }
      }
    }
  }

  todayGaps.sort((a, b) => b.gapDayScore - a.gapDayScore)
  yesterdayEntry.sort((a, b) => b.combinedScore - a.combinedScore)

  return {
    todayGaps,
    yesterdayEntry,
    meta: {
      todayGapCount: todayGaps.length,
      yesterdayEntryCount: yesterdayEntry.length,
      longEntries: yesterdayEntry.filter(c => c.direction === 'LONG').length,
      shortEntries: yesterdayEntry.filter(c => c.direction === 'SHORT').length,
    },
  }
}

// ═══════════════════════════════════════════════════════
//  BACKTESTER
// ═══════════════════════════════════════════════════════

interface BtTrade {
  gapDate: string; entryDate: string; exitDate: string; symbol: string
  direction: 'LONG' | 'SHORT'
  gapPercent: number; absGap: number; closePosition: number
  volumeRatio: number; gapHeld: boolean; gapFilled: boolean
  hasRejection: boolean; isMarubozu: boolean
  d2OpenType: string; d2GapPct: number; d2Continuation: boolean
  entryPrice: number; stopLoss: number; exitPrice: number; exitReason: string
  pnlPercent: number; result: 'WIN' | 'LOSS' | 'FLAT'
  holdDays: number; peakProfit: number
  trendBefore: string
}

export function runGapBacktest(
  stocksHistory: Record<string, Candle[]>,
  niftyDaily: Candle[],
  _options: { vix?: number } = {},
) {
  const dates = niftyDaily.map(c => c.date)
  const start = GC_CONFIG.LOOKBACK
  const end = dates.length - GC_CONFIG.MAX_HOLD_DAYS - 2

  const trades: BtTrade[] = []

  for (let i = start; i < end; i++) {
    const gapDate = dates[i]
    const entryDate = dates[i + 1]
    if (!entryDate) continue

    let dayTrades = 0

    for (const [symbol, candles] of Object.entries(stocksHistory)) {
      if (dayTrades >= GC_CONFIG.MAX_POSITIONS_PER_DAY) break

      const gapIdx = candles.findIndex(c => c.date === gapDate)
      if (gapIdx < GC_CONFIG.LOOKBACK || gapIdx + GC_CONFIG.MAX_HOLD_DAYS + 2 >= candles.length) continue

      const gapDay = candles[gapIdx]
      const prevDay = candles[gapIdx - 1]
      const d2 = candles[gapIdx + 1]

      const gapData = detectGap(gapDay, prevDay)
      if (!gapData || gapData.absGap < GC_CONFIG.MIN_GAP_PCT || gapData.absGap > GC_CONFIG.MAX_GAP_PCT) continue

      // volume filter
      const avVol = avgVolume(candles.slice(Math.max(0, gapIdx - 20), gapIdx), 20)
      const volRatio = avVol > 0 ? gapDay.volume / avVol : 0
      if (volRatio < GC_CONFIG.MIN_VOL_MULTIPLE) continue

      // close quality
      if (gapData.isGapUp && !gapData.strongClose) continue
      if (!gapData.isGapUp && gapData.closePosition > 0.35) continue

      // pre-gap trend
      const trend = preGapTrend(candles, gapIdx)
      if (gapData.isGapUp && !trend?.above50SMA) continue

      // Day-2 validation
      const d2a = day2Assessment(gapData, d2)
      if (!d2a || !d2a.canEnter) continue

      // entry at Day-2 open
      const entryPrice = d2.open
      const isLong = gapData.isGapUp
      const stopLoss = d2a.stopLoss

      // simulate
      const exitResult = simulate(candles, gapIdx + 1, entryPrice, stopLoss, isLong)

      const pnl = isLong
        ? ((exitResult.exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitResult.exitPrice) / entryPrice) * 100

      trades.push({
        gapDate, entryDate: d2.date, exitDate: exitResult.exitDate, symbol,
        direction: isLong ? 'LONG' : 'SHORT',
        gapPercent: gapData.gapPercent, absGap: gapData.absGap,
        closePosition: gapData.closePosition, volumeRatio: r(volRatio),
        gapHeld: gapData.gapExtended, gapFilled: gapData.gapFilledIntraday,
        hasRejection: gapData.hasRejection, isMarubozu: gapData.isMarubozu,
        d2OpenType: d2a.openType, d2GapPct: d2a.d2OpenVsGapClose,
        d2Continuation: d2a.d2Continuation,
        entryPrice: r(entryPrice), stopLoss: r(stopLoss),
        exitPrice: r(exitResult.exitPrice), exitReason: exitResult.reason,
        pnlPercent: r(pnl),
        result: pnl > 0.1 ? 'WIN' : pnl < -0.1 ? 'LOSS' : 'FLAT',
        holdDays: exitResult.holdDays, peakProfit: r(exitResult.peakProfit),
        trendBefore: trend?.above50SMA ? 'ABOVE_50SMA' : 'BELOW',
      })

      dayTrades++
    }
  }

  return {
    trades,
    summary: summarize(trades),
    analysis: analyze(trades),
  }
}

function simulate(candles: Candle[], entryIdx: number, entryPrice: number, stopLoss: number, isLong: boolean) {
  let high = entryPrice, low = entryPrice, currentStop = stopLoss

  for (let d = 1; d <= GC_CONFIG.MAX_HOLD_DAYS && entryIdx + d < candles.length; d++) {
    const day = candles[entryIdx + d]
    high = Math.max(high, day.high)
    low = Math.min(low, day.low)

    const profit = isLong
      ? ((day.close - entryPrice) / entryPrice) * 100
      : ((entryPrice - day.close) / entryPrice) * 100

    const peakProfit = isLong
      ? ((high - entryPrice) / entryPrice) * 100
      : ((entryPrice - low) / entryPrice) * 100

    // stop loss
    if (isLong ? day.low <= currentStop : day.high >= currentStop) {
      return { exitPrice: currentStop, exitDate: day.date, reason: 'STOP_LOSS', holdDays: d, peakProfit }
    }

    // RSI exit
    if (d >= 2) {
      const closes = candles.slice(0, entryIdx + d + 1).map(c => c.close)
      const rsi14 = rsi(closes, 14)
      if (rsi14 !== null) {
        if (isLong && rsi14 >= GC_CONFIG.RSI_EXIT_LONG) {
          return { exitPrice: day.close, exitDate: day.date, reason: 'RSI_EXIT', holdDays: d, peakProfit }
        }
        if (!isLong && rsi14 <= GC_CONFIG.RSI_EXIT_SHORT) {
          return { exitPrice: day.close, exitDate: day.date, reason: 'RSI_EXIT', holdDays: d, peakProfit }
        }
      }
    }

    // trailing stop
    if (profit >= GC_CONFIG.TRAIL_ACTIVATION) {
      const peak = isLong ? high : low
      const locked = Math.abs(peak - entryPrice) * GC_CONFIG.TRAIL_PROTECT
      const trail = isLong ? entryPrice + locked : entryPrice - locked
      currentStop = isLong ? Math.max(currentStop, trail) : Math.min(currentStop, trail)

      if (isLong ? day.low <= currentStop : day.high >= currentStop) {
        return { exitPrice: currentStop, exitDate: day.date, reason: 'TRAILING', holdDays: d, peakProfit }
      }
    }

    if (d === GC_CONFIG.MAX_HOLD_DAYS) {
      return { exitPrice: day.close, exitDate: day.date, reason: 'TIME_EXIT', holdDays: d, peakProfit }
    }
  }

  const last = candles[Math.min(entryIdx + GC_CONFIG.MAX_HOLD_DAYS, candles.length - 1)]
  return { exitPrice: last.close, exitDate: last.date, reason: 'TIME_EXIT', holdDays: GC_CONFIG.MAX_HOLD_DAYS, peakProfit: 0 }
}

function summarize(trades: BtTrade[]) {
  if (!trades.length) return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, avgPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, avgHoldDays: 0, best: 0, worst: 0 }
  const w = trades.filter(t => t.result === 'WIN')
  const l = trades.filter(t => t.result === 'LOSS')
  const tot = trades.reduce((s, t) => s + t.pnlPercent, 0)
  const gp = w.reduce((s, t) => s + t.pnlPercent, 0)
  const gl = Math.abs(l.reduce((s, t) => s + t.pnlPercent, 0))

  return {
    totalTrades: trades.length,
    wins: w.length, losses: l.length,
    winRate: r((w.length / trades.length) * 100),
    totalPnl: r(tot), avgPnl: r(tot / trades.length),
    avgWin: w.length ? r(gp / w.length) : 0,
    avgLoss: l.length ? r(-gl / l.length) : 0,
    profitFactor: gl > 0 ? r(gp / gl) : (gp > 0 ? Infinity : 0),
    avgHoldDays: r(trades.reduce((s, t) => s + t.holdDays, 0) / trades.length, 1),
    best: r(Math.max(...trades.map(t => t.pnlPercent))),
    worst: r(Math.min(...trades.map(t => t.pnlPercent))),
  }
}

function analyze(trades: BtTrade[]) {
  if (trades.length < 3) return null
  const avg = (a: BtTrade[]) => a.length ? r(a.reduce((s, t) => s + t.pnlPercent, 0) / a.length) : 0
  const wr = (a: BtTrade[]) => a.length ? r((a.filter(t => t.result === 'WIN').length / a.length) * 100) : 0

  const large = trades.filter(t => t.absGap >= 7)
  const medium = trades.filter(t => t.absGap >= 3 && t.absGap < 7)
  const marubozu = trades.filter(t => t.isMarubozu)
  const withRejection = trades.filter(t => t.hasRejection)
  const gapFilled = trades.filter(t => t.gapFilled)
  const gapNotFilled = trades.filter(t => !t.gapFilled)
  const idealPullback = trades.filter(t => t.d2OpenType === 'IDEAL_PULLBACK' || t.d2OpenType === 'IDEAL_BOUNCE')
  const flatOpen = trades.filter(t => t.d2OpenType === 'FLAT_OPEN')
  const deepPullback = trades.filter(t => t.d2OpenType === 'DEEP_PULLBACK')
  const d2Cont = trades.filter(t => t.d2Continuation)
  const d2NoCont = trades.filter(t => !t.d2Continuation)

  const byExit: Record<string, BtTrade[]> = {}
  for (const t of trades) {
    if (!byExit[t.exitReason]) byExit[t.exitReason] = []
    byExit[t.exitReason].push(t)
  }

  let cum = 0, peak = 0, maxDD = 0
  for (const t of trades) { cum += t.pnlPercent; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum) }

  return {
    byGapSize: {
      large7pctPlus: { count: large.length, avgPnl: avg(large), winRate: wr(large) },
      medium3to7pct: { count: medium.length, avgPnl: avg(medium), winRate: wr(medium) },
    },
    candleQuality: {
      marubozu: { count: marubozu.length, avgPnl: avg(marubozu), winRate: wr(marubozu) },
      withRejection: { count: withRejection.length, avgPnl: avg(withRejection), winRate: wr(withRejection) },
    },
    gapFillEffect: {
      filled: { count: gapFilled.length, avgPnl: avg(gapFilled), winRate: wr(gapFilled) },
      notFilled: { count: gapNotFilled.length, avgPnl: avg(gapNotFilled), winRate: wr(gapNotFilled) },
    },
    day2EntryType: {
      idealPullback: { count: idealPullback.length, avgPnl: avg(idealPullback), winRate: wr(idealPullback) },
      flatOpen: { count: flatOpen.length, avgPnl: avg(flatOpen), winRate: wr(flatOpen) },
      deepPullback: { count: deepPullback.length, avgPnl: avg(deepPullback), winRate: wr(deepPullback) },
    },
    d2ContinuationEffect: {
      continued: { count: d2Cont.length, avgPnl: avg(d2Cont), winRate: wr(d2Cont) },
      noContinuation: { count: d2NoCont.length, avgPnl: avg(d2NoCont), winRate: wr(d2NoCont) },
    },
    byExitReason: Object.fromEntries(
      Object.entries(byExit).map(([k, v]) => [k, { count: v.length, avgPnl: avg(v), winRate: wr(v) }])
    ),
    maxDrawdown: r(maxDD),
    finalCumPnl: r(cum),
  }
}

// ═══════════════════════════════════════════════════════
//  PRE-SCAN RISK GATE
// ═══════════════════════════════════════════════════════

export function preGapGate(params: { indiaVix: number | null }) {
  const blocks: { rule: string; msg: string }[] = []
  const warnings: { rule: string; msg: string }[] = []

  // High VIX = extreme volatility = gap reversals more likely
  if (params.indiaVix !== null) {
    if (params.indiaVix > 24) blocks.push({ rule: 'VIX', msg: `VIX ${params.indiaVix} > 24 — gap reversals likely in panic markets` })
    else if (params.indiaVix > 18) warnings.push({ rule: 'VIX', msg: `VIX ${params.indiaVix} elevated — reduce size` })
  }

  return { allowed: blocks.length === 0, blocks, warnings }
}
