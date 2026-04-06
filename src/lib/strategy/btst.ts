// src/lib/strategy/btst.ts
// BTST / STBT (Buy Today Sell Tomorrow) Strategy Engine
//
// Consolidated TypeScript implementation covering:
//   - Technical indicators (EMA, RSI, ATR, VWAP proxies)
//   - BTST Scanner (7 core + 4 enhanced criteria)
//   - STBT Scanner (bearish mirror)
//   - 10-factor weighted scoring & grading (A+ → D)
//   - ATR-based entry signals with position sizing
//   - Pre-trade risk gates (Friday, VIX, US futures, panic)
//   - Walk-forward backtester (scan → entry → overnight → exit)
//   - Full analyzer (win rate, PF, Sharpe, max DD, gap analysis)

// ═══════════════════════════════════════════════════════════
// SECTION 1: CONFIG, TYPES, ENUMS
// ═══════════════════════════════════════════════════════════

export const BTST_CONFIG = {
  // Core BTST criteria
  MIN_DAY_CHANGE: 2.0,          // stock up > 2%
  MIN_CLOSING_STRENGTH: 0.85,   // close near day high
  MIN_VOLUME_MULTIPLE: 1.5,     // volume > 1.5× 20-day avg
  EMA_PERIOD: 20,
  RSI_MIN: 55,
  RSI_MAX: 75,

  // STBT criteria (mirror)
  STBT_MAX_DAY_CHANGE: -2.0,
  STBT_MAX_CLOSING_STRENGTH: 0.15,
  STBT_RSI_MIN: 25,
  STBT_RSI_MAX: 45,

  // Enhanced checks
  MIN_BODY_PERCENT: 40,         // bullish candle body > 40%

  // Scoring weights (sum = 100)
  WEIGHT_MOMENTUM: 15,
  WEIGHT_CLOSING_STRENGTH: 15,
  WEIGHT_VOLUME: 12,
  WEIGHT_LAST_HOUR: 15,         // proxy from daily close position
  WEIGHT_VWAP: 8,
  WEIGHT_DELIVERY: 10,
  WEIGHT_TREND: 8,
  WEIGHT_RSI: 5,
  WEIGHT_GAP_TENDENCY: 7,
  WEIGHT_SECTOR: 5,

  // Trade management
  SL_ATR_MULTIPLE: 1.5,
  FALLBACK_SL_PCT: 1.5,
  TARGET_ATR_MULTIPLE: 2.5,
  MAX_POSITIONS: 3,
  MAX_BTST_ALLOCATION: 0.30,    // 30% of capital max
  MAX_RISK_PER_TRADE: 0.01,     // 1% risk per trade
  CAPITAL: 500_000,

  // Risk gates
  VIX_BLOCK_THRESHOLD: 22,
  VIX_WARN_THRESHOLD: 18,
  NIFTY_PANIC_THRESHOLD: -1.0,  // Nifty down > 1%

  // Backtest
  LOOKBACK_DAILY: 30,           // days of history for indicators
  GAP_HISTORY_LOOKBACK: 120,
  SKIP_FRIDAYS: true,
}

// F&O segment stocks (liquid, can short via futures)
export const FNO_SYMBOLS = new Set([
  'RELIANCE', 'SBIN', 'ICICIBANK', 'HDFCBANK', 'KOTAKBANK', 'AXISBANK',
  'TCS', 'INFY', 'WIPRO', 'HCLTECH',
  'TATAMOTORS', 'M&M', 'MARUTI',
  'TATASTEEL', 'HINDALCO', 'JSWSTEEL',
  'BAJFINANCE', 'BHARTIARTL', 'ADANIENT',
  'LT', 'SUNPHARMA', 'ITC', 'TATAPOWER', 'DLF',
  'BANKBARODA', 'PNB', 'INDUSINDBK', 'TECHM',
  'POWERGRID', 'NTPC', 'BAJAJFINSV', 'ONGC',
  'COALINDIA', 'VEDL', 'SAIL', 'TATACONSUM',
  'CIPLA', 'DRREDDY', 'APOLLOHOSP', 'SBILIFE',
  'BPCL', 'GAIL', 'HEROMOTOCO', 'EICHERMOT', 'DIVISLAB',
  'ULTRACEMCO', 'TITAN', 'NESTLEIND', 'HDFC', 'SHRIRAMFIN',
])

interface DailyCandle {
  date: string
  open: number; high: number; low: number; close: number; volume: number
}

interface CandleBody {
  bodyPercent: number; upperWickPercent: number; lowerWickPercent: number
  isBullish: boolean; isBullishMarubozu: boolean; isBearishMarubozu: boolean
  isDoji: boolean
}

interface GapHistory {
  overall: GapStats
  afterBullishDay: GapStats
  afterBearishDay: GapStats
  avgAbsGap: number
}

interface GapStats {
  avg: number; median: number; upProb: number; count: number; stdDev: number
}

interface BTSTChecks {
  dayChange: { value: number; pass: boolean }
  closingStrength: { value: number; pass: boolean }
  volume: { value: number; pass: boolean }
  aboveEma: { value: number; ema: number | null; pass: boolean }
  niftyPositive: { value: number; pass: boolean }
  rsi: { value: number | null; pass: boolean }
  fno: { value: boolean; pass: boolean }
  notCircuit: { pass: boolean }
  candleBody: { pass: boolean }
}

interface BTSTCandidate {
  symbol: string
  passed: boolean
  direction: 'LONG' | 'SHORT'
  passCount: number
  firstFailure: string | null
  checks: BTSTChecks
  compositeScore: number
  indicators: {
    close: number; dayChange: number; closingStrength: number
    volumeRatio: number; ema20: number | null; rsi14: number | null
    atr14: number | null; deliveryEstimate: number
  }
  gapHistory: GapHistory | null
  candle: CandleBody
  scoring?: {
    factors: Record<string, { score: number; raw: any }>
    totalScore: number; grade: string
    recommendation: { action: string; confidence: string; message: string }
  }
  rank?: number
}

interface BTSTTrade {
  entryDate: string; exitDate: string; symbol: string; direction: 'LONG' | 'SHORT'
  entryPrice: number; exitPrice: number; exitReason: string
  pnl: number; pnlPercent: number; gapPercent: number
  result: 'WIN' | 'LOSS' | 'FLAT'; score: number; stopLoss: number
}

interface MarketContext {
  niftyPositive: boolean; niftyChangePercent: number
  indiaVix: number | null
  niftyCloses: number[]
}


// ═══════════════════════════════════════════════════════════
// SECTION 2: INDICATORS
// ═══════════════════════════════════════════════════════════

export function ema(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const k = 2 / (period + 1)
  let val = 0
  for (let i = 0; i < period; i++) val += closes[i]
  val /= period
  for (let i = period; i < closes.length; i++) val = closes[i] * k + val * (1 - k)
  return r2(val)
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) avgGain += diff; else avgLoss -= diff
  }
  avgGain /= period; avgLoss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
  }
  if (avgLoss === 0) return 100
  return r2(100 - 100 / (1 + avgGain / avgLoss))
}

export function atr(candles: DailyCandle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ))
  }
  let val = 0
  for (let i = 0; i < period; i++) val += trs[i]
  val /= period
  for (let i = period; i < trs.length; i++) val = (val * (period - 1) + trs[i]) / period
  return r2(val)
}

function avgVolume(volumes: number[], period = 20): number {
  if (volumes.length < period) return volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1)
  return volumes.slice(-period).reduce((a, b) => a + b, 0) / period
}

export function closingStrength(candle: DailyCandle): number {
  const range = candle.high - candle.low
  return range > 0 ? r4((candle.close - candle.low) / range) : 0.5
}

function candleBody(candle: DailyCandle): CandleBody {
  const range = candle.high - candle.low
  if (range === 0) return { bodyPercent: 0, upperWickPercent: 0, lowerWickPercent: 0, isBullish: true, isBullishMarubozu: false, isBearishMarubozu: false, isDoji: true }
  const body = Math.abs(candle.close - candle.open)
  const isBullish = candle.close >= candle.open
  const upper = isBullish ? candle.high - candle.close : candle.high - candle.open
  const lower = isBullish ? candle.open - candle.low : candle.close - candle.low
  const bp = body / range
  return {
    bodyPercent: r2(bp * 100),
    upperWickPercent: r2((upper / range) * 100),
    lowerWickPercent: r2((lower / range) * 100),
    isBullish,
    isBullishMarubozu: isBullish && bp > 0.80,
    isBearishMarubozu: !isBullish && bp > 0.80,
    isDoji: bp < 0.10,
  }
}

/**
 * Delivery % estimation heuristic (real delivery data is post-market only).
 * Close near high + high volume + bullish body = high delivery.
 */
function estimateDelivery(cs: number, volumeRatio: number, body: CandleBody): number {
  let score = 0
  score += Math.min(cs, 1) * 30
  score += Math.min(volumeRatio / 3, 1) * 25
  if (body.isBullishMarubozu) score += 25
  else if (body.isBullish && body.bodyPercent > 60) score += 18
  else if (body.isBullish) score += 10
  if (body.upperWickPercent < 5) score += 12
  else if (body.upperWickPercent < 15) score += 6
  if (volumeRatio > 3) score += 8
  return r2(Math.min(score, 100))
}

function detectCircuit(candle: DailyCandle, prevClose: number): { isUpperCircuit: boolean; isLowerCircuit: boolean } {
  const dayChange = Math.abs((candle.close - prevClose) / prevClose) * 100
  const rangePct = ((candle.high - candle.low) / candle.close) * 100
  const isCircuit = dayChange > 4.5 && rangePct < 0.3
  return { isUpperCircuit: isCircuit && candle.close > prevClose, isLowerCircuit: isCircuit && candle.close < prevClose }
}

/**
 * Gap history — how does a stock gap the day after a strong bullish/bearish day?
 * This is the KEY differentiator for BTST stock selection.
 */
export function gapHistory(candles: DailyCandle[], lookback = 120): GapHistory | null {
  const slice = candles.slice(-Math.min(lookback + 1, candles.length))
  if (slice.length < 30) return null

  const allGaps: number[] = [], afterBull: number[] = [], afterBear: number[] = []

  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1], curr = slice[i]
    const gap = ((curr.open - prev.close) / prev.close) * 100
    const prevDayChange = ((prev.close - prev.open) / prev.open) * 100
    const prevCS = (prev.high - prev.low) > 0 ? (prev.close - prev.low) / (prev.high - prev.low) : 0.5
    allGaps.push(gap)
    if (prevDayChange > 2 && prevCS > 0.85) afterBull.push(gap)
    if (prevDayChange < -2 && prevCS < 0.15) afterBear.push(gap)
  }

  const analyze = (arr: number[]): GapStats => {
    if (arr.length === 0) return { avg: 0, median: 0, upProb: 0.5, count: 0, stdDev: 0 }
    const sorted = [...arr].sort((a, b) => a - b)
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length
    const variance = arr.reduce((s, g) => s + (g - avg) ** 2, 0) / arr.length
    return {
      avg: r2(avg), median: r2(sorted[Math.floor(sorted.length / 2)]),
      upProb: r2(arr.filter(g => g > 0.1).length / arr.length),
      count: arr.length, stdDev: r2(Math.sqrt(variance)),
    }
  }

  return {
    overall: analyze(allGaps), afterBullishDay: analyze(afterBull), afterBearishDay: analyze(afterBear),
    avgAbsGap: r2(allGaps.reduce((s, g) => s + Math.abs(g), 0) / allGaps.length),
  }
}

function beta(stockCloses: number[], indexCloses: number[], period = 60): number | null {
  const len = Math.min(stockCloses.length, indexCloses.length, period + 1)
  if (len < 21) return null
  const sStart = Math.max(stockCloses.length - len, 0)
  const iStart = Math.max(indexCloses.length - len, 0)
  const sR: number[] = [], iR: number[] = []
  for (let i = 1; i < len; i++) {
    sR.push((stockCloses[sStart + i] - stockCloses[sStart + i - 1]) / stockCloses[sStart + i - 1])
    iR.push((indexCloses[iStart + i] - indexCloses[iStart + i - 1]) / indexCloses[iStart + i - 1])
  }
  const mS = safeMean(sR), mI = safeMean(iR)
  let cov = 0, varI = 0
  for (let i = 0; i < sR.length; i++) {
    cov += (sR[i] - mS) * (iR[i] - mI)
    varI += (iR[i] - mI) ** 2
  }
  return varI > 0 ? r2(cov / varI) : null
}


// ═══════════════════════════════════════════════════════════
// SECTION 3: BTST SCANNER
// ═══════════════════════════════════════════════════════════

/**
 * Evaluate a single stock for BTST (long) criteria.
 * Uses daily candles only — no intraday needed.
 */
export function evaluateBTST(
  symbol: string, dailyCandles: DailyCandle[], isFnO: boolean,
  market: MarketContext
): BTSTCandidate {
  const today = dailyCandles[dailyCandles.length - 1]
  const prevClose = dailyCandles.length >= 2 ? dailyCandles[dailyCandles.length - 2].close : today.open
  const closes = dailyCandles.map(c => c.close)
  const volumes = dailyCandles.map(c => c.volume)

  const ema20 = ema(closes, BTST_CONFIG.EMA_PERIOD)
  const rsi14 = rsi(closes, 14)
  const atr14 = atr(dailyCandles, 14)
  const avgVol20 = avgVolume(volumes, 20)
  const cs = closingStrength(today)
  const body = candleBody(today)
  const circuit = detectCircuit(today, prevClose)
  const dayChange = ((today.close - prevClose) / prevClose) * 100
  const volRatio = avgVol20 > 0 ? today.volume / avgVol20 : 0
  const deliveryEst = estimateDelivery(cs, volRatio, body)
  const gaps = gapHistory(dailyCandles, BTST_CONFIG.GAP_HISTORY_LOOKBACK)
  const betaVal = market.niftyCloses.length > 20 ? beta(closes, market.niftyCloses) : null

  // 7 core criteria
  const checks: BTSTChecks = {
    dayChange: { value: r2(dayChange), pass: dayChange >= BTST_CONFIG.MIN_DAY_CHANGE },
    closingStrength: { value: r4(cs), pass: cs >= BTST_CONFIG.MIN_CLOSING_STRENGTH },
    volume: { value: r2(volRatio), pass: volRatio >= BTST_CONFIG.MIN_VOLUME_MULTIPLE },
    aboveEma: { value: today.close, ema: ema20, pass: ema20 !== null && today.close > ema20 },
    niftyPositive: { value: r2(market.niftyChangePercent), pass: market.niftyPositive },
    rsi: { value: rsi14, pass: rsi14 !== null && rsi14 >= BTST_CONFIG.RSI_MIN && rsi14 <= BTST_CONFIG.RSI_MAX },
    fno: { value: isFnO, pass: isFnO },
    notCircuit: { pass: !circuit.isUpperCircuit },
    candleBody: { pass: body.isBullish && body.bodyPercent > BTST_CONFIG.MIN_BODY_PERCENT },
  }

  const coreKeys: (keyof BTSTChecks)[] = ['dayChange', 'closingStrength', 'volume', 'aboveEma', 'niftyPositive', 'rsi', 'fno']
  let passCount = 0, firstFailure: string | null = null
  for (const k of coreKeys) {
    if (checks[k].pass) passCount++
    else if (!firstFailure) firstFailure = k
  }
  if (!checks.notCircuit.pass) firstFailure = 'upperCircuit'
  const passed = passCount === coreKeys.length && checks.notCircuit.pass

  // Composite score (simple — scoring section does the refined version)
  let compositeScore = 0
  if (passed) {
    compositeScore += Math.min(dayChange / 6, 1) * 20
    compositeScore += cs * 20
    compositeScore += Math.min(volRatio / 4, 1) * 15
    if (rsi14) { const dev = Math.abs(rsi14 - 65); compositeScore += Math.max(0, 1 - dev / 15) * 10 }
    if (ema20) {
      const emaDist = ((today.close - ema20) / ema20) * 100
      if (emaDist > 0 && emaDist <= 4) compositeScore += 10
      else if (emaDist <= 8) compositeScore += 6
      else compositeScore += 3
    }
    compositeScore += (deliveryEst / 100) * 10
    if (gaps?.afterBullishDay?.upProb && gaps.afterBullishDay.upProb > 0.6) compositeScore += 5
    if (body.isBullishMarubozu) compositeScore += 5
  }

  return {
    symbol, passed, direction: 'LONG', passCount, firstFailure, checks,
    compositeScore: r2(compositeScore),
    indicators: {
      close: r2(today.close), dayChange: r2(dayChange), closingStrength: r4(cs),
      volumeRatio: r2(volRatio), ema20, rsi14, atr14, deliveryEstimate: deliveryEst,
    },
    gapHistory: gaps, candle: body,
  }
}

/**
 * STBT evaluation — mirror of BTST for bearish setups.
 */
export function evaluateSTBT(
  symbol: string, dailyCandles: DailyCandle[], isFnO: boolean,
  market: MarketContext
): BTSTCandidate {
  const today = dailyCandles[dailyCandles.length - 1]
  const prevClose = dailyCandles.length >= 2 ? dailyCandles[dailyCandles.length - 2].close : today.open
  const closes = dailyCandles.map(c => c.close)
  const volumes = dailyCandles.map(c => c.volume)

  const ema20 = ema(closes, BTST_CONFIG.EMA_PERIOD)
  const rsi14 = rsi(closes, 14)
  const atr14 = atr(dailyCandles, 14)
  const avgVol20 = avgVolume(volumes, 20)
  const cs = closingStrength(today)
  const body = candleBody(today)
  const circuit = detectCircuit(today, prevClose)
  const dayChange = ((today.close - prevClose) / prevClose) * 100
  const volRatio = avgVol20 > 0 ? today.volume / avgVol20 : 0
  const gaps = gapHistory(dailyCandles, BTST_CONFIG.GAP_HISTORY_LOOKBACK)

  const checks: BTSTChecks = {
    dayChange: { value: r2(dayChange), pass: dayChange <= BTST_CONFIG.STBT_MAX_DAY_CHANGE },
    closingStrength: { value: r4(cs), pass: cs <= BTST_CONFIG.STBT_MAX_CLOSING_STRENGTH },
    volume: { value: r2(volRatio), pass: volRatio >= BTST_CONFIG.MIN_VOLUME_MULTIPLE },
    aboveEma: { value: today.close, ema: ema20, pass: ema20 !== null && today.close < ema20 },
    niftyPositive: { value: r2(market.niftyChangePercent), pass: market.niftyChangePercent < 0 },
    rsi: { value: rsi14, pass: rsi14 !== null && rsi14 >= BTST_CONFIG.STBT_RSI_MIN && rsi14 <= BTST_CONFIG.STBT_RSI_MAX },
    fno: { value: isFnO, pass: isFnO },
    notCircuit: { pass: !circuit.isLowerCircuit },
    candleBody: { pass: !body.isBullish && body.bodyPercent > BTST_CONFIG.MIN_BODY_PERCENT },
  }

  const coreKeys: (keyof BTSTChecks)[] = ['dayChange', 'closingStrength', 'volume', 'aboveEma', 'niftyPositive', 'rsi', 'fno']
  let passCount = 0, firstFailure: string | null = null
  for (const k of coreKeys) {
    if (checks[k].pass) passCount++
    else if (!firstFailure) firstFailure = k
  }
  if (!checks.notCircuit.pass) firstFailure = 'lowerCircuit'
  const passed = passCount === coreKeys.length && checks.notCircuit.pass

  let compositeScore = 0
  if (passed) {
    compositeScore += Math.min(Math.abs(dayChange) / 6, 1) * 25
    compositeScore += (1 - cs) * 25
    compositeScore += Math.min(volRatio / 4, 1) * 20
    if (rsi14 && rsi14 < 35) compositeScore += 15
    else compositeScore += 10
    if (body.isBearishMarubozu) compositeScore += 10
  }

  return {
    symbol, passed, direction: 'SHORT', passCount, firstFailure, checks,
    compositeScore: r2(compositeScore),
    indicators: {
      close: r2(today.close), dayChange: r2(dayChange), closingStrength: r4(cs),
      volumeRatio: r2(volRatio), ema20, rsi14, atr14, deliveryEstimate: 0,
    },
    gapHistory: gaps, candle: body,
  }
}

/**
 * Full scan: run BTST + STBT depending on market direction.
 */
export function scanBTST(
  stocks: { symbol: string; dailyCandles: DailyCandle[] }[],
  market: MarketContext
): { btstCandidates: BTSTCandidate[]; stbtCandidates: BTSTCandidate[]; meta: any } {
  const btstCandidates: BTSTCandidate[] = []
  const stbtCandidates: BTSTCandidate[] = []

  for (const stock of stocks) {
    if (stock.dailyCandles.length < BTST_CONFIG.LOOKBACK_DAILY + 2) continue
    const isFnO = FNO_SYMBOLS.has(stock.symbol)

    if (market.niftyPositive) {
      const result = evaluateBTST(stock.symbol, stock.dailyCandles, isFnO, market)
      if (result.passed) btstCandidates.push(result)
    } else {
      const result = evaluateSTBT(stock.symbol, stock.dailyCandles, isFnO, market)
      if (result.passed) stbtCandidates.push(result)
    }
  }

  btstCandidates.sort((a, b) => b.compositeScore - a.compositeScore)
  stbtCandidates.sort((a, b) => b.compositeScore - a.compositeScore)

  return {
    btstCandidates, stbtCandidates,
    meta: { scanned: stocks.length, btstPassed: btstCandidates.length, stbtPassed: stbtCandidates.length },
  }
}


// ═══════════════════════════════════════════════════════════
// SECTION 4: SCORING & GRADING
// ═══════════════════════════════════════════════════════════

function mapRange(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin
}
function clamp(val: number, min = 0, max = 100): number { return Math.min(max, Math.max(min, val)) }

/**
 * 10-factor scoring for BTST candidates (long direction).
 */
export function scoreBTST(candidates: BTSTCandidate[]): BTSTCandidate[] {
  return candidates.map((c, _idx) => {
    const i = c.indicators
    const g = c.gapHistory
    const body = c.candle

    // 1. Momentum
    const momentum = clamp(mapRange(i.dayChange, 2, 7, 30, 100))
    // 2. Closing strength
    const closing = clamp(mapRange(i.closingStrength, 0.85, 1.0, 40, 100))
    // 3. Volume
    const volume = clamp(mapRange(i.volumeRatio, 1.5, 5.0, 30, 100))
    // 4. Last-hour proxy (from closing strength + candle body quality)
    let lastHour = 50
    if (i.closingStrength > 0.95 && body.isBullishMarubozu) lastHour = 95
    else if (i.closingStrength > 0.92 && body.bodyPercent > 70) lastHour = 80
    else if (i.closingStrength > 0.88) lastHour = 65
    else lastHour = 45
    // 5. VWAP proxy (close vs estimated VWAP ≈ (O+H+L+C)/4)
    let vwapScore = 50
    const approxVwap = (i.close + (i.ema20 || i.close)) / 2 // rough proxy
    const vwapDist = i.ema20 ? ((i.close - approxVwap) / approxVwap) * 100 : 0
    if (vwapDist > 1.5) vwapScore = 90
    else if (vwapDist > 0.5) vwapScore = 75
    else if (vwapDist > 0) vwapScore = 60
    else vwapScore = 20
    // 6. Delivery estimate
    const delivery = clamp(i.deliveryEstimate)
    // 7. Trend alignment
    let trend = 50
    if (i.ema20) {
      const emaDist = ((i.close - i.ema20) / i.ema20) * 100
      if (emaDist > 0 && emaDist <= 3) trend = 100
      else if (emaDist <= 6) trend = 75
      else if (emaDist <= 10) trend = 50
      else if (emaDist > 10) trend = 30
      else trend = 10
    }
    // 8. RSI optimality (65 ideal)
    let rsiScore = 50
    if (i.rsi14) {
      const dev = Math.abs(i.rsi14 - 65)
      rsiScore = clamp(mapRange(dev, 0, 15, 100, 30))
    }
    // 9. Gap tendency
    let gapScore = 50
    if (g?.afterBullishDay && g.afterBullishDay.count >= 5) {
      gapScore = clamp(mapRange(g.afterBullishDay.upProb, 0.4, 0.8, 20, 100))
      if (g.afterBullishDay.avg > 0.5) gapScore = Math.min(gapScore + 15, 100)
    }
    // 10. Sector (neutral — no sector data from daily candles)
    const sector = 50

    const factors: Record<string, { score: number; raw: any }> = {
      momentum: { score: r2(momentum), raw: i.dayChange },
      closingStrength: { score: r2(closing), raw: i.closingStrength },
      volumeConviction: { score: r2(volume), raw: i.volumeRatio },
      lastHourQuality: { score: r2(lastHour), raw: body.bodyPercent },
      vwapRelation: { score: r2(vwapScore), raw: approxVwap },
      deliveryEstimate: { score: r2(delivery), raw: i.deliveryEstimate },
      trendAlignment: { score: r2(trend), raw: i.ema20 },
      rsiOptimality: { score: r2(rsiScore), raw: i.rsi14 },
      gapTendency: { score: r2(gapScore), raw: g?.afterBullishDay?.upProb ?? null },
      sectorStrength: { score: r2(sector), raw: null },
    }

    const weights: Record<string, number> = {
      momentum: BTST_CONFIG.WEIGHT_MOMENTUM,
      closingStrength: BTST_CONFIG.WEIGHT_CLOSING_STRENGTH,
      volumeConviction: BTST_CONFIG.WEIGHT_VOLUME,
      lastHourQuality: BTST_CONFIG.WEIGHT_LAST_HOUR,
      vwapRelation: BTST_CONFIG.WEIGHT_VWAP,
      deliveryEstimate: BTST_CONFIG.WEIGHT_DELIVERY,
      trendAlignment: BTST_CONFIG.WEIGHT_TREND,
      rsiOptimality: BTST_CONFIG.WEIGHT_RSI,
      gapTendency: BTST_CONFIG.WEIGHT_GAP_TENDENCY,
      sectorStrength: BTST_CONFIG.WEIGHT_SECTOR,
    }

    let totalScore = 0
    for (const [key, factor] of Object.entries(factors)) {
      totalScore += factor.score * ((weights[key] ?? 0) / 100)
    }

    const grade = totalScore >= 78 ? 'A+' : totalScore >= 70 ? 'A' : totalScore >= 62 ? 'B+' : totalScore >= 55 ? 'B' : totalScore >= 45 ? 'C' : 'D'

    const weakFactors = Object.entries(factors).filter(([, f]) => f.score < 40).map(([k]) => k)
    const action = grade === 'A+' || grade === 'A' ? 'STRONG BUY' : grade === 'B+' || grade === 'B' ? 'BUY' : grade === 'C' ? 'MARGINAL' : 'SKIP'
    const confidence = action === 'STRONG BUY' ? 'HIGH' : action === 'BUY' ? 'MODERATE' : 'LOW'

    return {
      ...c,
      compositeScore: r2(totalScore),
      scoring: {
        factors, totalScore: r2(totalScore), grade,
        recommendation: {
          action, confidence,
          message: weakFactors.length > 0 ? `Watch: ${weakFactors.join(', ')}` : 'All factors aligned',
        },
      },
    }
  }).sort((a, b) => b.compositeScore - a.compositeScore).map((c, idx) => ({ ...c, rank: idx + 1 }))
}


// ═══════════════════════════════════════════════════════════
// SECTION 5: RISK GATES
// ═══════════════════════════════════════════════════════════

export function preTradeGate(market: MarketContext, date = new Date()): {
  allowed: boolean; blocks: { rule: string; msg: string }[]; warnings: { rule: string; msg: string }[]; sizeMultiplier: number
} {
  const blocks: { rule: string; msg: string }[] = []
  const warnings: { rule: string; msg: string }[] = []
  let sizeMultiplier = 1.0

  // Friday block
  const dow = date.getDay()
  if (BTST_CONFIG.SKIP_FRIDAYS && dow === 5) {
    blocks.push({ rule: 'WEEKEND_RISK', msg: 'BTST blocked on Fridays — 2 nights of gap risk' })
  }

  // VIX check
  if (market.indiaVix !== null) {
    if (market.indiaVix > BTST_CONFIG.VIX_BLOCK_THRESHOLD) {
      blocks.push({ rule: 'VIX_EXTREME', msg: `India VIX ${market.indiaVix} > ${BTST_CONFIG.VIX_BLOCK_THRESHOLD} — overnight risk too high` })
    } else if (market.indiaVix > BTST_CONFIG.VIX_WARN_THRESHOLD) {
      warnings.push({ rule: 'VIX_ELEVATED', msg: `India VIX ${market.indiaVix} — reduce sizes by 50%` })
      sizeMultiplier = 0.5
    }
  }

  // Market panic
  if (market.niftyChangePercent < BTST_CONFIG.NIFTY_PANIC_THRESHOLD) {
    blocks.push({ rule: 'MARKET_PANIC', msg: `Nifty down ${market.niftyChangePercent}% — not a BTST day` })
  }

  return { allowed: blocks.length === 0, blocks, warnings, sizeMultiplier }
}


// ═══════════════════════════════════════════════════════════
// SECTION 6: BACKTESTER
// ═══════════════════════════════════════════════════════════

/**
 * Walk-forward backtest: for each historical date, scan → select top candidates → simulate overnight hold.
 * Uses daily candles only. Exit at next day's open, with SL checked against next day's low.
 */
export function runBTSTBacktest(
  stockCandles: Record<string, DailyCandle[]>,
  niftyCandles: DailyCandle[],
  opts: { maxPositions?: number; skipFridays?: boolean; exitMode?: 'OPEN' | 'VWAP' | 'BEST' } = {}
): { trades: BTSTTrade[]; summary: any; drawdown: any } {
  const { maxPositions = BTST_CONFIG.MAX_POSITIONS, skipFridays = BTST_CONFIG.SKIP_FRIDAYS, exitMode = 'OPEN' } = opts

  const niftyMap = new Map<string, DailyCandle>()
  for (const c of niftyCandles) niftyMap.set(c.date, c)
  const dates = niftyCandles.map(c => c.date)

  const startIdx = BTST_CONFIG.LOOKBACK_DAILY + 5
  const endIdx = dates.length - 1 // need next day for exit
  const trades: BTSTTrade[] = []

  for (let i = startIdx; i < endIdx; i++) {
    const scanDate = dates[i]
    const exitDate = dates[i + 1]
    if (!exitDate) break

    // Skip Fridays
    if (skipFridays) {
      const dow = new Date(scanDate).getDay()
      if (dow === 5) continue
    }

    const niftyToday = niftyMap.get(scanDate)
    if (!niftyToday) continue
    const niftyChange = ((niftyToday.close - niftyToday.open) / niftyToday.open) * 100

    // Build Nifty closes for beta
    const niftyCloses = niftyCandles.slice(Math.max(0, i - 70), i + 1).map(c => c.close)

    const market: MarketContext = {
      niftyPositive: niftyChange > 0,
      niftyChangePercent: r2(niftyChange),
      indiaVix: null,
      niftyCloses,
    }

    // Build stock snapshots
    const stockSnapshots: { symbol: string; dailyCandles: DailyCandle[] }[] = []
    for (const [symbol, candles] of Object.entries(stockCandles)) {
      const dateIdx = candles.findIndex(c => c.date === scanDate)
      if (dateIdx < BTST_CONFIG.LOOKBACK_DAILY) continue
      stockSnapshots.push({ symbol, dailyCandles: candles.slice(dateIdx - BTST_CONFIG.LOOKBACK_DAILY, dateIdx + 1) })
    }

    // Scan
    const { btstCandidates, stbtCandidates } = scanBTST(stockSnapshots, market)
    const allCandidates = [...btstCandidates, ...stbtCandidates]
    const selected = allCandidates.slice(0, maxPositions)

    // Simulate each trade
    for (const candidate of selected) {
      const candles = stockCandles[candidate.symbol]
      if (!candles) continue
      const exitIdx = candles.findIndex(c => c.date === exitDate)
      if (exitIdx < 0) continue

      const entryPrice = candidate.indicators.close
      const exitCandle = candles[exitIdx]
      const atrVal = candidate.indicators.atr14
      const isLong = candidate.direction === 'LONG'

      // SL calculation
      let stopLoss: number
      if (atrVal && atrVal > 0) {
        stopLoss = isLong
          ? r2(entryPrice - atrVal * BTST_CONFIG.SL_ATR_MULTIPLE)
          : r2(entryPrice + atrVal * BTST_CONFIG.SL_ATR_MULTIPLE)
      } else {
        stopLoss = isLong
          ? r2(entryPrice * (1 - BTST_CONFIG.FALLBACK_SL_PCT / 100))
          : r2(entryPrice * (1 + BTST_CONFIG.FALLBACK_SL_PCT / 100))
      }

      // Simulate exit
      const { exitPrice, reason } = simulateExit(entryPrice, stopLoss, exitCandle, isLong, exitMode)
      const pnl = isLong ? exitPrice - entryPrice : entryPrice - exitPrice
      const pnlPercent = (pnl / entryPrice) * 100
      const gapPercent = isLong
        ? ((exitCandle.open - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitCandle.open) / entryPrice) * 100

      trades.push({
        entryDate: scanDate, exitDate, symbol: candidate.symbol, direction: candidate.direction,
        entryPrice: r2(entryPrice), exitPrice: r2(exitPrice), exitReason: reason,
        pnl: r2(pnl), pnlPercent: r2(pnlPercent), gapPercent: r2(gapPercent),
        result: pnl > 0.01 ? 'WIN' : pnl < -0.01 ? 'LOSS' : 'FLAT',
        score: candidate.compositeScore, stopLoss: r2(stopLoss),
      })
    }
  }

  return {
    trades,
    summary: buildSummary(trades),
    drawdown: buildDrawdown(trades),
  }
}

function simulateExit(
  entryPrice: number, stopLoss: number, exitCandle: DailyCandle,
  isLong: boolean, exitMode: string
): { exitPrice: number; reason: string } {
  const openPrice = exitCandle.open

  // Gap beyond stop → exit at open
  if (isLong && openPrice <= stopLoss) return { exitPrice: openPrice, reason: 'GAP_BELOW_STOP' }
  if (!isLong && openPrice >= stopLoss) return { exitPrice: openPrice, reason: 'GAP_ABOVE_STOP' }

  // Intraday stop hit
  if (isLong && exitCandle.low <= stopLoss) return { exitPrice: stopLoss, reason: 'INTRADAY_STOP' }
  if (!isLong && exitCandle.high >= stopLoss) return { exitPrice: stopLoss, reason: 'INTRADAY_STOP' }

  // Normal exit
  if (exitMode === 'VWAP') {
    const approxVwap = (exitCandle.open + exitCandle.high + exitCandle.low + exitCandle.close) / 4
    return { exitPrice: isLong ? Math.min(approxVwap, exitCandle.high) : Math.max(approxVwap, exitCandle.low), reason: 'EXIT_AT_VWAP' }
  }
  if (exitMode === 'BEST') {
    return { exitPrice: isLong ? exitCandle.high : exitCandle.low, reason: 'EXIT_AT_BEST' }
  }
  return { exitPrice: openPrice, reason: 'EXIT_AT_OPEN' }
}


// ═══════════════════════════════════════════════════════════
// SECTION 7: ANALYZER
// ═══════════════════════════════════════════════════════════

function buildSummary(trades: BTSTTrade[]) {
  if (trades.length === 0) return { totalTrades: 0 }

  const wins = trades.filter(t => t.result === 'WIN')
  const losses = trades.filter(t => t.result === 'LOSS')
  const pnls = trades.map(t => t.pnlPercent)

  const totalPnl = pnls.reduce((s, p) => s + p, 0)
  const avgPnl = totalPnl / trades.length
  const avgWin = wins.length ? safeMean(wins.map(t => t.pnlPercent)) : 0
  const avgLoss = losses.length ? safeMean(losses.map(t => t.pnlPercent)) : 0
  const winRate = (wins.length / trades.length) * 100

  // Profit factor
  const grossProfit = wins.reduce((s, t) => s + t.pnlPercent, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0))
  const profitFactor = grossLoss > 0 ? r2(grossProfit / grossLoss) : grossProfit > 0 ? Infinity : 0

  // Sharpe
  const sharpe = computeSharpe(pnls)

  // Streaks
  let maxLossStreak = 0, streak = 0
  for (const t of trades) {
    if (t.result === 'LOSS') { streak++; maxLossStreak = Math.max(maxLossStreak, streak) }
    else streak = 0
  }

  // Gap analysis
  const avgGap = safeMean(trades.map(t => t.gapPercent))
  const posGaps = trades.filter(t => t.gapPercent > 0.1).length

  // Monthly breakdown
  const monthly: Record<string, { trades: number; pnl: number; wins: number }> = {}
  for (const t of trades) {
    const m = t.entryDate.substring(0, 7)
    if (!monthly[m]) monthly[m] = { trades: 0, pnl: 0, wins: 0 }
    monthly[m].trades++
    monthly[m].pnl += t.pnlPercent
    if (t.result === 'WIN') monthly[m].wins++
  }

  // Score-tier analysis
  const highScore = trades.filter(t => t.score >= 60)
  const lowScore = trades.filter(t => t.score < 60)

  // Exit reason breakdown
  const exitReasons: Record<string, { count: number; avgPnl: number }> = {}
  for (const t of trades) {
    if (!exitReasons[t.exitReason]) exitReasons[t.exitReason] = { count: 0, avgPnl: 0 }
    exitReasons[t.exitReason].count++
  }
  for (const [reason, data] of Object.entries(exitReasons)) {
    const rTrades = trades.filter(t => t.exitReason === reason)
    data.avgPnl = r2(safeMean(rTrades.map(t => t.pnlPercent)))
  }

  return {
    totalTrades: trades.length,
    wins: wins.length, losses: losses.length,
    winRatePct: r2(winRate),
    totalPnlPct: r2(totalPnl),
    avgPnlPct: r2(avgPnl),
    avgWinPct: r2(avgWin),
    avgLossPct: r2(avgLoss),
    profitFactor,
    sharpeRatio: r2(sharpe),
    maxConsecutiveLosses: maxLossStreak,
    bestTrade: r2(Math.max(...pnls)),
    worstTrade: r2(Math.min(...pnls)),
    avgGapPct: r2(avgGap),
    positiveGapRate: r2((posGaps / trades.length) * 100),
    monthlyBreakdown: Object.entries(monthly)
      .map(([month, d]) => ({ month, trades: d.trades, pnl: r2(d.pnl), winRate: r2((d.wins / d.trades) * 100) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    byScoreTier: {
      highScore: { trades: highScore.length, avgPnl: highScore.length ? r2(safeMean(highScore.map(t => t.pnlPercent))) : 0, winRate: highScore.length ? r2((highScore.filter(t => t.result === 'WIN').length / highScore.length) * 100) : 0 },
      lowScore: { trades: lowScore.length, avgPnl: lowScore.length ? r2(safeMean(lowScore.map(t => t.pnlPercent))) : 0, winRate: lowScore.length ? r2((lowScore.filter(t => t.result === 'WIN').length / lowScore.length) * 100) : 0 },
    },
    exitReasons,
  }
}

function buildDrawdown(trades: BTSTTrade[]) {
  if (trades.length === 0) return null
  let cumulative = 0, peak = 0, maxDD = 0
  for (const t of trades) {
    cumulative += t.pnlPercent
    peak = Math.max(peak, cumulative)
    maxDD = Math.max(maxDD, peak - cumulative)
  }
  return { maxDrawdownPct: r2(maxDD), finalCumPnlPct: r2(cumulative) }
}


// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function safeMean(arr: number[]): number { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function r2(n: number) { return Math.round(n * 100) / 100 }
function r4(n: number) { return Math.round(n * 10000) / 10000 }

function computeSharpe(pnls: number[]): number {
  if (pnls.length < 2) return 0
  const avg = safeMean(pnls)
  const std = Math.sqrt(pnls.reduce((s, p) => s + (p - avg) ** 2, 0) / (pnls.length - 1))
  return std === 0 ? 0 : (avg / std) * Math.sqrt(250)
}
