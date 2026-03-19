// src/lib/strategy/mean-reversion.ts
// RSI(2) Mean Reversion Strategy — Indian Markets (NSE)
// Based on Connors & Alvarez methodology, adapted for Nifty 100 universe
// Complete TypeScript port of the 2016-line reference

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MeanReversionConfig {
  RSI_SHORT: number
  RSI_LONG: number
  SMA_TREND: number
  SMA_EXIT: number
  ATR_PERIOD: number
  BB_PERIOD: number
  BB_STD_DEV: number
  RSI2_OVERSOLD: number
  MIN_CONSECUTIVE_DOWN: number
  EARNINGS_BLACKOUT_DAYS: number
  RSI2_OVERBOUGHT: number
  TIME_STOP_DAYS: number
  MAX_HOLDING_DAYS: number
  ATR_STOP_MULTIPLIER: number
  MAX_STOP_PCT: number
  NIFTY_TREND_SMA: number
  MAX_CONCURRENT_POSITIONS: number
  RISK_PER_TRADE_PCT: number
  MAX_POSITION_PCT: number
  EQUAL_WEIGHT: boolean
  MIN_AVG_TURNOVER_CR: number
  MIN_PRICE: number
  MIN_HISTORY_DAYS: number
  TRADING_DAYS_PER_YEAR: number
  RISK_FREE_RATE: number
}

export interface MRStockData {
  symbol: string
  name: string
  sector: string
  opens: number[]
  highs: number[]
  lows: number[]
  closes: number[]
  volumes: number[]
  avgDailyTurnoverCr?: number
  earningsDate?: string | null
}

export interface MRIndicatorSnapshot {
  open: number; high: number; low: number; close: number; volume: number; prevClose: number
  rsi2: number | null; rsi14: number | null; rsi2Array: (number | null)[]
  sma200: number | null; sma200Rising: boolean; sma5: number | null
  sma5Array: (number | null)[]; sma200Array: (number | null)[]
  atr14: number | null; atr14Array: (number | null)[]
  bbUpper: number | null; bbMiddle: number | null; bbLower: number | null
  bbBandwidth: number | null; bbPercentB: number | null
  consecutiveDownDays: number; cumulativeDecline: number
  aboveSma200: boolean; distanceFromSma200: number | null
  aboveSma5: boolean
  avgVolume20: number | null; volumeRatio: number | null
  volatility: number | null
  closesArray: number[]; highsArray: number[]; lowsArray: number[]
}

export interface MRCondition {
  name: string; met: boolean; detail: string; critical: boolean
}

export interface MRTradeParams {
  entryPrice: number; entryType: string
  stopLoss: number; stopMethod: string; stopDistancePct: string
  exitConditions: Record<string, string>
  expectedBounce: string; estimatedRiskReward: string
  bbMiddleTarget: number | null
}

export interface MRSignalResult {
  triggered: boolean; score: number; totalConditions: number
  conditions: MRCondition[]
  qualityScore: number; maxQualityScore: number; qualityFactors: string[]
  overallGrade: string | null
  indicators: Record<string, any>
  trade: MRTradeParams | null
}

export interface MRRegimeResult {
  regime: string; tradeable: boolean
  nifty?: number | null; sma200?: number | null
  distancePct?: string; niftyRsi14?: number | null
  reason?: string; warning?: string
  positionSizeMultiplier?: number
}

export interface MRPositionSizing {
  shares: number; positionValue?: number; positionPct?: string
  riskPerShare?: number; totalRisk?: number; riskPctOfCapital?: string
  sizeConstraint?: string; error?: string
}

export interface MRScanResult {
  date: string | null; regime: MRRegimeResult
  totalScanned: number; totalFiltered: number; signalCount: number
  signals: any[]; filtered: any[]; watchlist: any[]
  positionSizeMultiplier: number
  signal?: string; message?: string; candidates?: any[]
  config: MeanReversionConfig
  performance: Record<string, string>
}

export interface MRClosedTrade {
  symbol: string; entryDate: string; exitDate: string
  entryPrice: number; exitPrice: number; shares: number
  pnl: number; pnlPct: string; holdingDays: number; exitReason: string
  entryRsi2?: number | null; entryConsecDown?: number; qualityGrade?: string | null
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const DEFAULT_MR_CONFIG: MeanReversionConfig = {
  RSI_SHORT: 2, RSI_LONG: 14,
  SMA_TREND: 200, SMA_EXIT: 5,
  ATR_PERIOD: 14, BB_PERIOD: 20, BB_STD_DEV: 2,
  RSI2_OVERSOLD: 10, MIN_CONSECUTIVE_DOWN: 2, EARNINGS_BLACKOUT_DAYS: 5,
  RSI2_OVERBOUGHT: 70, TIME_STOP_DAYS: 10, MAX_HOLDING_DAYS: 20,
  ATR_STOP_MULTIPLIER: 2, MAX_STOP_PCT: 0.07,
  NIFTY_TREND_SMA: 200,
  MAX_CONCURRENT_POSITIONS: 6, RISK_PER_TRADE_PCT: 0.02,
  MAX_POSITION_PCT: 0.20, EQUAL_WEIGHT: false,
  MIN_AVG_TURNOVER_CR: 10, MIN_PRICE: 50, MIN_HISTORY_DAYS: 220,
  TRADING_DAYS_PER_YEAR: 252, RISK_FREE_RATE: 0.065,
}

// ============================================================================
// UTILITY
// ============================================================================

function r2(n: number | null | undefined): number | null {
  return n !== null && n !== undefined && !isNaN(n) ? Math.round(n * 100) / 100 : null
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result[i] = sum / period
  }
  return result
}

function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += data[i]
  result[period - 1] = sum / period
  const k = 2 / (period + 1)
  for (let i = period; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]!) * k + result[i - 1]!
  }
  return result
}

export function calcRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return result
  const changes: number[] = []
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1])
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period; avgLoss /= period
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i + 1] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
  }
  return result
}

export function trueRange(high: number, low: number, prevClose: number): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
}

export function calcATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const len = closes.length
  const result: (number | null)[] = new Array(len).fill(null)
  if (len < period + 1) return result
  const tr = [0]
  for (let i = 1; i < len; i++) tr.push(trueRange(highs[i], lows[i], closes[i - 1]))
  let atrSum = 0
  for (let i = 1; i <= period; i++) atrSum += tr[i]
  let atr = atrSum / period
  result[period] = atr
  for (let i = period + 1; i < len; i++) {
    atr = (atr * (period - 1) + tr[i]) / period
    result[i] = atr
  }
  return result
}

export function calcBollingerBands(closes: number[], period: number = 20, numStdDev: number = 2) {
  const len = closes.length
  const middle: (number | null)[] = new Array(len).fill(null)
  const upper: (number | null)[] = new Array(len).fill(null)
  const lower: (number | null)[] = new Array(len).fill(null)
  const bandwidth: (number | null)[] = new Array(len).fill(null)
  const percentB: (number | null)[] = new Array(len).fill(null)
  if (len < period) return { middle, upper, lower, bandwidth, percentB }
  for (let i = period - 1; i < len; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    const sma = sum / period
    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) sqSum += (closes[j] - sma) ** 2
    const stdDev = Math.sqrt(sqSum / period)
    middle[i] = sma; upper[i] = sma + numStdDev * stdDev; lower[i] = sma - numStdDev * stdDev
    bandwidth[i] = middle[i] !== 0 ? (upper[i]! - lower[i]!) / middle[i]! : 0
    const bw = upper[i]! - lower[i]!
    percentB[i] = bw !== 0 ? (closes[i] - lower[i]!) / bw : 0.5
  }
  return { middle, upper, lower, bandwidth, percentB }
}

export function countConsecutiveDownCloses(closes: number[], atIndex: number | null = null): number {
  const idx = atIndex !== null ? atIndex : closes.length - 1
  let count = 0
  for (let i = idx; i >= 1; i--) {
    if (closes[i] < closes[i - 1]) count++
    else break
  }
  return count
}

export function cumulativeDecline(closes: number[], atIndex: number | null = null): number {
  const idx = atIndex !== null ? atIndex : closes.length - 1
  const downDays = countConsecutiveDownCloses(closes, idx)
  if (downDays === 0) return 0
  const startPrice = closes[idx - downDays]
  const endPrice = closes[idx]
  return (endPrice - startPrice) / startPrice
}

export function calcVolatility(closes: number[], window: number = 20, tradingDays: number = 252): number | null {
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
// FULL INDICATOR SNAPSHOT
// ============================================================================

export function computeIndicators(stock: MRStockData, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): MRIndicatorSnapshot | null {
  const { opens, highs, lows, closes, volumes } = stock
  const len = closes.length
  if (len < cfg.MIN_HISTORY_DAYS) return null
  const i = len - 1
  const rsi2 = calcRSI(closes, cfg.RSI_SHORT)
  const rsi14 = calcRSI(closes, cfg.RSI_LONG)
  const sma200 = calcSMA(closes, cfg.SMA_TREND)
  const sma5 = calcSMA(closes, cfg.SMA_EXIT)
  const atr14 = calcATR(highs, lows, closes, cfg.ATR_PERIOD)
  const bb = calcBollingerBands(closes, cfg.BB_PERIOD, cfg.BB_STD_DEV)
  const consecDown = countConsecutiveDownCloses(closes)
  const cumDecline = cumulativeDecline(closes)
  const volatility = calcVolatility(closes)
  const avgVol20 = volumes.length >= 20 ? volumes.slice(-20).reduce((s, v) => s + v, 0) / 20 : null
  const distFrom200 = sma200[i] !== null ? (closes[i] - sma200[i]!) / sma200[i]! : null
  const sma200Rising = sma200[i] !== null && i >= 20 && sma200[i - 20] !== null ? sma200[i]! > sma200[i - 20]! : false

  return {
    open: opens[i], high: highs[i], low: lows[i], close: closes[i], volume: volumes[i], prevClose: closes[i - 1],
    rsi2: rsi2[i], rsi14: rsi14[i], rsi2Array: rsi2,
    sma200: sma200[i], sma200Rising, sma5: sma5[i], sma5Array: sma5, sma200Array: sma200,
    atr14: atr14[i], atr14Array: atr14,
    bbUpper: bb.upper[i], bbMiddle: bb.middle[i], bbLower: bb.lower[i],
    bbBandwidth: bb.bandwidth[i], bbPercentB: bb.percentB[i],
    consecutiveDownDays: consecDown, cumulativeDecline: cumDecline,
    aboveSma200: sma200[i] !== null ? closes[i] > sma200[i]! : false,
    distanceFromSma200: distFrom200,
    aboveSma5: sma5[i] !== null ? closes[i] > sma5[i]! : false,
    avgVolume20: avgVol20,
    volumeRatio: avgVol20 && avgVol20 > 0 ? volumes[i] / avgVol20 : null,
    volatility,
    closesArray: closes, highsArray: highs, lowsArray: lows,
  }
}

// ============================================================================
// SIGNAL DETECTION
// ============================================================================

export function calculateTradeParameters(indicators: MRIndicatorSnapshot, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): MRTradeParams {
  const entryEstimate = indicators.close
  const atrStop = indicators.atr14 !== null ? entryEstimate - cfg.ATR_STOP_MULTIPLIER * indicators.atr14 : null
  const pctStop = entryEstimate * (1 - cfg.MAX_STOP_PCT)
  let stopLoss: number
  if (atrStop !== null) { stopLoss = Math.max(atrStop, pctStop) } else { stopLoss = pctStop }
  const stopDistancePct = (entryEstimate - stopLoss) / entryEstimate
  const exitConditions = {
    rsi2_overbought: `RSI(2) > ${cfg.RSI2_OVERBOUGHT}`,
    above_5sma: `Close > 5-day SMA (currently ₹${r2(indicators.sma5)})`,
    time_stop: `${cfg.TIME_STOP_DAYS} trading days with no bounce`,
  }
  const bbMiddle = indicators.bbMiddle || indicators.sma200
  const expectedBounce = bbMiddle ? (bbMiddle - entryEstimate) / entryEstimate : 0.04
  const reward = Math.abs(expectedBounce) * entryEstimate
  const risk = stopDistancePct * entryEstimate
  const riskReward = risk > 0 ? reward / risk : null
  return {
    entryPrice: r2(entryEstimate)!,
    entryType: 'Next day open',
    stopLoss: r2(stopLoss)!,
    stopMethod: atrStop !== null
      ? `Tighter of 2×ATR (₹${r2(atrStop)}) and 7% (₹${r2(pctStop)})`
      : `7% below entry (₹${r2(pctStop)})`,
    stopDistancePct: r2(stopDistancePct * 100) + '%',
    exitConditions,
    expectedBounce: r2(expectedBounce * 100) + '%',
    estimatedRiskReward: riskReward ? r2(riskReward) + ':1' : 'N/A',
    bbMiddleTarget: r2(bbMiddle),
  }
}

export function checkMeanReversionEntry(
  indicators: MRIndicatorSnapshot,
  stockMeta: any = {},
  currentDate: string | null = null,
  cfg: MeanReversionConfig = DEFAULT_MR_CONFIG,
): MRSignalResult {
  const conditions: MRCondition[] = []
  let score = 0
  const totalConditions = 4

  // CONDITION 1: Price > 200-SMA
  const inUptrend = indicators.aboveSma200
  if (inUptrend) {
    score++
    conditions.push({ name: 'UPTREND_FILTER', met: true, detail: `Price ₹${r2(indicators.close)} > 200-SMA ₹${r2(indicators.sma200)} (+${r2((indicators.distanceFromSma200 || 0) * 100)}%)`, critical: true })
  } else {
    conditions.push({ name: 'UPTREND_FILTER', met: false, detail: `Price ₹${r2(indicators.close)} BELOW 200-SMA ₹${r2(indicators.sma200)} — falling knife risk`, critical: true })
  }

  // CONDITION 2: RSI(2) < 10
  const rsi2Oversold = indicators.rsi2 !== null && indicators.rsi2 < cfg.RSI2_OVERSOLD
  if (rsi2Oversold) {
    score++
    conditions.push({ name: 'RSI2_OVERSOLD', met: true, detail: `RSI(2) = ${r2(indicators.rsi2)} < ${cfg.RSI2_OVERSOLD} (extremely oversold)`, critical: true })
  } else {
    conditions.push({ name: 'RSI2_OVERSOLD', met: false, detail: `RSI(2) = ${indicators.rsi2 !== null ? r2(indicators.rsi2) : 'N/A'} (need < ${cfg.RSI2_OVERSOLD})`, critical: true })
  }

  // CONDITION 3: 2+ consecutive down closes
  const enoughDownDays = indicators.consecutiveDownDays >= cfg.MIN_CONSECUTIVE_DOWN
  if (enoughDownDays) {
    score++
    conditions.push({ name: 'CONSECUTIVE_DOWN', met: true, detail: `${indicators.consecutiveDownDays} consecutive down closes (decline: ${r2(indicators.cumulativeDecline * 100)}%)`, critical: true })
  } else {
    conditions.push({ name: 'CONSECUTIVE_DOWN', met: false, detail: `Only ${indicators.consecutiveDownDays} down close(s), need ≥ ${cfg.MIN_CONSECUTIVE_DOWN}`, critical: true })
  }

  // CONDITION 4: Not within 5 days of earnings
  let earningsSafe = true
  if (stockMeta.earningsDate && currentDate) {
    const diffDays = Math.abs((new Date(stockMeta.earningsDate).getTime() - new Date(currentDate).getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= cfg.EARNINGS_BLACKOUT_DAYS) earningsSafe = false
  }
  if (earningsSafe) {
    score++
    conditions.push({ name: 'EARNINGS_CLEAR', met: true, detail: 'No earnings within blackout window', critical: true })
  } else {
    conditions.push({ name: 'EARNINGS_CLEAR', met: false, detail: `Earnings within ${cfg.EARNINGS_BLACKOUT_DAYS} days — event risk`, critical: true })
  }

  const triggered = score === totalConditions

  // QUALITY METRICS
  const qualityFactors: string[] = []
  let qualityScore = 0
  if (indicators.bbPercentB !== null && indicators.bbPercentB < 0) { qualityScore += 2; qualityFactors.push(`BB %B = ${r2(indicators.bbPercentB)} (below lower band)`) }
  else if (indicators.bbPercentB !== null && indicators.bbPercentB < 0.2) { qualityScore += 1; qualityFactors.push(`BB %B = ${r2(indicators.bbPercentB)} (near lower band)`) }
  if (indicators.rsi14 !== null && indicators.rsi14 >= 30 && indicators.rsi14 <= 50) { qualityScore += 2; qualityFactors.push(`RSI(14) = ${r2(indicators.rsi14)} (healthy pullback)`) }
  else if (indicators.rsi14 !== null && indicators.rsi14 < 30) { qualityFactors.push(`RSI(14) = ${r2(indicators.rsi14)} (deeply oversold — higher risk)`) }
  if (indicators.sma200Rising) { qualityScore += 1; qualityFactors.push('200-SMA slope rising') }
  if (indicators.volumeRatio !== null && indicators.volumeRatio > 1.5) { qualityScore += 1; qualityFactors.push(`Volume ${r2(indicators.volumeRatio)}x avg (capitulation)`) }
  if (indicators.consecutiveDownDays >= 4) { qualityScore += 2; qualityFactors.push(`${indicators.consecutiveDownDays} down days — extended`) }
  else if (indicators.consecutiveDownDays >= 3) { qualityScore += 1; qualityFactors.push(`${indicators.consecutiveDownDays} down days — solid`) }
  if (indicators.distanceFromSma200 !== null && indicators.distanceFromSma200 > 0 && indicators.distanceFromSma200 < 0.10) {
    qualityScore += 1; qualityFactors.push(`Close to 200-SMA (${r2(indicators.distanceFromSma200 * 100)}% above)`)
  }

  let trade: MRTradeParams | null = null
  if (triggered) trade = calculateTradeParameters(indicators, cfg)

  return {
    triggered, score, totalConditions, conditions,
    qualityScore, maxQualityScore: 9, qualityFactors,
    overallGrade: triggered ? (qualityScore >= 7 ? 'A' : qualityScore >= 5 ? 'B' : qualityScore >= 3 ? 'C' : 'D') : null,
    indicators: {
      close: r2(indicators.close), rsi2: r2(indicators.rsi2), rsi14: r2(indicators.rsi14),
      sma200: r2(indicators.sma200), sma5: r2(indicators.sma5), atr14: r2(indicators.atr14),
      bbLower: r2(indicators.bbLower), bbPercentB: r2(indicators.bbPercentB),
      consecutiveDown: indicators.consecutiveDownDays,
      cumulativeDecline: r2(indicators.cumulativeDecline * 100) + '%',
      volatility: indicators.volatility ? r2(indicators.volatility * 100) + '%' : null,
    },
    trade,
  }
}

// ============================================================================
// MARKET REGIME
// ============================================================================

export function checkMarketRegime(niftyCloses: number[], cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): MRRegimeResult {
  if (!niftyCloses || niftyCloses.length < cfg.NIFTY_TREND_SMA + 1) {
    return { regime: 'UNKNOWN', tradeable: false, reason: 'Insufficient Nifty data' }
  }
  const sma200 = calcSMA(niftyCloses, cfg.NIFTY_TREND_SMA)
  const currentNifty = niftyCloses[niftyCloses.length - 1]
  const currentSma = sma200[sma200.length - 1]
  if (currentSma === null) return { regime: 'UNKNOWN', tradeable: false, reason: 'SMA not yet computed' }
  const aboveSma = currentNifty > currentSma
  const distancePct = ((currentNifty - currentSma) / currentSma) * 100
  const niftyRsi = calcRSI(niftyCloses, 14)
  const currentNiftyRsi = niftyRsi[niftyRsi.length - 1]
  const marketPanic = currentNiftyRsi !== null && currentNiftyRsi < 25

  if (!aboveSma) {
    return { regime: 'BEAR', tradeable: false, nifty: r2(currentNifty), sma200: r2(currentSma), distancePct: r2(distancePct) + '%', niftyRsi14: r2(currentNiftyRsi), reason: 'Nifty below 200-SMA — avoid mean reversion longs' }
  }
  if (marketPanic) {
    return { regime: 'BULL_PANIC', tradeable: true, nifty: r2(currentNifty), sma200: r2(currentSma), distancePct: r2(distancePct) + '%', niftyRsi14: r2(currentNiftyRsi), warning: 'Nifty RSI < 25 — market-wide panic, reduce position sizes', positionSizeMultiplier: 0.5 }
  }
  return { regime: 'BULL', tradeable: true, nifty: r2(currentNifty), sma200: r2(currentSma), distancePct: r2(distancePct) + '%', niftyRsi14: r2(currentNiftyRsi), positionSizeMultiplier: 1.0 }
}

// ============================================================================
// UNIVERSE SCANNER
// ============================================================================

export function scanUniverse(universe: MRStockData[], niftyCloses: number[], currentDate: string | null = null, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): MRScanResult {
  const regime = checkMarketRegime(niftyCloses, cfg)
  if (!regime.tradeable) {
    return { date: currentDate, regime, signal: 'NO_TRADES', message: regime.reason, candidates: [], totalScanned: universe.length, totalFiltered: 0, signalCount: 0, signals: [], filtered: [], watchlist: [], positionSizeMultiplier: 1.0, config: cfg, performance: { expectedWinRate: '70-80%', avgGain: '3-5%', avgHoldingDays: '4-7 days', maxDrawdown: '10-15%' } }
  }
  const signals: any[] = []
  const filtered: any[] = []
  const notTriggered: any[] = []

  for (const stock of universe) {
    if (stock.avgDailyTurnoverCr && stock.avgDailyTurnoverCr < cfg.MIN_AVG_TURNOVER_CR) {
      filtered.push({ symbol: stock.symbol, name: stock.name, reason: `Turnover ₹${stock.avgDailyTurnoverCr.toFixed(1)}cr < ₹${cfg.MIN_AVG_TURNOVER_CR}cr` }); continue
    }
    if (stock.closes && stock.closes[stock.closes.length - 1] < cfg.MIN_PRICE) {
      filtered.push({ symbol: stock.symbol, name: stock.name, reason: `Price ₹${stock.closes[stock.closes.length - 1]} below ₹${cfg.MIN_PRICE}` }); continue
    }
    const indicators = computeIndicators(stock, cfg)
    if (!indicators) { filtered.push({ symbol: stock.symbol, name: stock.name, reason: 'Insufficient history' }); continue }
    const signal = checkMeanReversionEntry(indicators, stock, currentDate, cfg)
    if (signal.triggered) {
      signals.push({ symbol: stock.symbol, name: stock.name, sector: stock.sector, ...signal })
    } else {
      notTriggered.push({ symbol: stock.symbol, name: stock.name, score: signal.score, rsi2: signal.indicators.rsi2, consecutiveDown: signal.indicators.consecutiveDown, aboveSma200: signal.conditions.find(c => c.name === 'UPTREND_FILTER')?.met })
    }
  }
  signals.sort((a, b) => b.qualityScore - a.qualityScore)
  const watchlist = notTriggered.filter(s => s.score >= 3 && s.aboveSma200).sort((a, b) => { const rA = parseFloat(a.rsi2) || 100; const rB = parseFloat(b.rsi2) || 100; return rA - rB }).slice(0, 10)
  return { date: currentDate, regime, totalScanned: universe.length, totalFiltered: filtered.length, signalCount: signals.length, signals, filtered, watchlist, positionSizeMultiplier: regime.positionSizeMultiplier || 1.0, config: cfg, performance: { expectedWinRate: '70-80%', avgGain: '3-5%', avgHoldingDays: '4-7 days', maxDrawdown: '10-15%' } }
}

// ============================================================================
// POSITION SIZING
// ============================================================================

export function calcPositionSize(capital: number, entryPrice: number, stopLoss: number, sizeMultiplier: number = 1.0, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): MRPositionSizing {
  if (entryPrice <= 0 || stopLoss <= 0 || stopLoss >= entryPrice) return { shares: 0, error: 'Invalid entry/stop parameters' }
  const riskPerShare = entryPrice - stopLoss
  const maxRiskAmount = capital * cfg.RISK_PER_TRADE_PCT * sizeMultiplier
  const sharesFromRisk = Math.floor(maxRiskAmount / riskPerShare)
  const maxPositionValue = capital * cfg.MAX_POSITION_PCT
  const sharesFromMaxPos = Math.floor(maxPositionValue / entryPrice)
  const shares = Math.min(sharesFromRisk, sharesFromMaxPos)
  const positionValue = shares * entryPrice
  const actualRisk = shares * riskPerShare
  return { shares, positionValue: Math.round(positionValue), positionPct: r2((positionValue / capital) * 100) + '%', riskPerShare: r2(riskPerShare)!, totalRisk: Math.round(actualRisk), riskPctOfCapital: r2((actualRisk / capital) * 100) + '%', sizeConstraint: shares === sharesFromMaxPos ? 'MAX_POSITION_CAP' : 'RISK_BASED' }
}

// ============================================================================
// EXIT MONITORING
// ============================================================================

export function monitorPosition(position: any, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): any {
  const { entryPrice, stopLoss, daysSinceEntry, closesAfterEntry, lowsAfterEntry } = position
  const len = closesAfterEntry.length
  if (len === 0) return { action: 'HOLD', reason: 'No data yet' }
  const currentClose = closesAfterEntry[len - 1]
  const currentLow = lowsAfterEntry[len - 1]
  const pnlPct = (currentClose / entryPrice) - 1
  const allCloses = position.preEntryCloses ? [...position.preEntryCloses, ...closesAfterEntry] : closesAfterEntry
  const rsi2 = calcRSI(allCloses, cfg.RSI_SHORT)
  const currentRsi2 = rsi2[rsi2.length - 1]
  const sma5 = calcSMA(allCloses, cfg.SMA_EXIT)
  const currentSma5 = sma5[sma5.length - 1]

  if (currentLow <= stopLoss) return { action: 'EXIT', reason: 'STOP_LOSS_HIT', exitPrice: stopLoss, pnlPct: (stopLoss / entryPrice) - 1, daysSinceEntry, urgency: 'IMMEDIATE' }
  if (currentRsi2 !== null && currentRsi2 > cfg.RSI2_OVERBOUGHT) return { action: 'EXIT', reason: 'RSI2_OVERBOUGHT', exitPrice: currentClose, pnlPct, rsi2: r2(currentRsi2), daysSinceEntry, note: `RSI(2) = ${r2(currentRsi2)} > ${cfg.RSI2_OVERBOUGHT} — mean reversion complete` }
  if (currentSma5 !== null && currentClose > currentSma5) return { action: 'EXIT', reason: 'ABOVE_5SMA', exitPrice: currentClose, pnlPct, sma5: r2(currentSma5), daysSinceEntry, note: `Close ₹${r2(currentClose)} > 5-SMA ₹${r2(currentSma5)}` }
  if (daysSinceEntry >= cfg.TIME_STOP_DAYS) return { action: 'EXIT', reason: 'TIME_STOP', exitPrice: currentClose, pnlPct, daysSinceEntry, note: `${cfg.TIME_STOP_DAYS} days — no bounce` }
  if (daysSinceEntry >= cfg.MAX_HOLDING_DAYS) return { action: 'EXIT', reason: 'MAX_HOLDING_PERIOD', exitPrice: currentClose, pnlPct, daysSinceEntry }
  return { action: 'HOLD', daysSinceEntry, pnlPct, currentClose: r2(currentClose), rsi2: currentRsi2 !== null ? r2(currentRsi2) : null, sma5: currentSma5 !== null ? r2(currentSma5) : null, distanceToStop: r2(((currentClose - stopLoss) / currentClose) * 100) + '%', daysRemaining: cfg.TIME_STOP_DAYS - daysSinceEntry }
}

// ============================================================================
// ANALYTICS HELPERS
// ============================================================================

export function calcSharpeRatio(returns: number[], periodsPerYear: number, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1))
  if (std === 0) return null
  return (mean * periodsPerYear - cfg.RISK_FREE_RATE) / (std * Math.sqrt(periodsPerYear))
}

export function calcSortinoRatio(returns: number[], periodsPerYear: number, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const downside = returns.filter(r => r < 0)
  if (downside.length === 0) return Infinity
  const dsDev = Math.sqrt(downside.reduce((s, r) => s + r ** 2, 0) / downside.length)
  if (dsDev === 0) return Infinity
  return (mean * periodsPerYear - cfg.RISK_FREE_RATE) / (dsDev * Math.sqrt(periodsPerYear))
}

function calcStreaks(trades: MRClosedTrade[]) {
  let maxWin = 0, maxLose = 0, curWin = 0, curLose = 0
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLose = 0; maxWin = Math.max(maxWin, curWin) }
    else { curLose++; curWin = 0; maxLose = Math.max(maxLose, curLose) }
  }
  return { maxWinStreak: maxWin, maxLoseStreak: maxLose }
}

export function analyzeByExitReason(trades: MRClosedTrade[]) {
  const buckets: Record<string, { trades: MRClosedTrade[]; totalPnl: number; wins: number }> = {}
  for (const t of trades) {
    if (!buckets[t.exitReason]) buckets[t.exitReason] = { trades: [], totalPnl: 0, wins: 0 }
    buckets[t.exitReason].trades.push(t); buckets[t.exitReason].totalPnl += t.pnl
    if (t.pnl > 0) buckets[t.exitReason].wins++
  }
  const result: Record<string, any> = {}
  for (const [reason, data] of Object.entries(buckets)) {
    const n = data.trades.length
    result[reason] = { count: n, winRate: r2((data.wins / n) * 100) + '%', avgPnlPct: r2(data.trades.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / n) + '%', totalPnl: Math.round(data.totalPnl), avgHoldingDays: r2(data.trades.reduce((s, t) => s + t.holdingDays, 0) / n) }
  }
  return result
}

export function analyzeByGrade(trades: MRClosedTrade[]) {
  const grades: Record<string, MRClosedTrade[]> = { A: [], B: [], C: [], D: [] }
  for (const t of trades) { const g = t.qualityGrade || 'D'; if (!grades[g]) grades[g] = []; grades[g].push(t) }
  const result: Record<string, any> = {}
  for (const [grade, list] of Object.entries(grades)) {
    if (list.length === 0) continue
    const n = list.length; const wins = list.filter(t => t.pnl > 0).length
    result[`Grade ${grade}`] = { count: n, winRate: r2((wins / n) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / n) + '%', totalPnl: Math.round(list.reduce((s, t) => s + t.pnl, 0)) }
  }
  return result
}

export function analyzeByConsecDown(trades: MRClosedTrade[]) {
  const buckets: Record<string, MRClosedTrade[]> = {}
  for (const t of trades) { const key = `${t.entryConsecDown || '?'} days`; if (!buckets[key]) buckets[key] = []; buckets[key].push(t) }
  const result: Record<string, any> = {}
  for (const [bucket, list] of Object.entries(buckets)) {
    const n = list.length; const wins = list.filter(t => t.pnl > 0).length
    result[bucket] = { count: n, winRate: r2((wins / n) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / n) + '%' }
  }
  return result
}

export function analyzeByRsi2Level(trades: MRClosedTrade[]) {
  const buckets: Record<string, MRClosedTrade[]> = { 'RSI2 < 2': [], 'RSI2 2-5': [], 'RSI2 5-10': [] }
  for (const t of trades) {
    const rsi = parseFloat(String(t.entryRsi2 || ''))
    if (isNaN(rsi)) continue
    if (rsi < 2) buckets['RSI2 < 2'].push(t)
    else if (rsi < 5) buckets['RSI2 2-5'].push(t)
    else buckets['RSI2 5-10'].push(t)
  }
  const result: Record<string, any> = {}
  for (const [bucket, list] of Object.entries(buckets)) {
    if (list.length === 0) continue
    const n = list.length; const wins = list.filter(t => t.pnl > 0).length
    result[bucket] = { count: n, winRate: r2((wins / n) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / n) + '%', avgHoldingDays: r2(list.reduce((s, t) => s + t.holdingDays, 0) / n) }
  }
  return result
}

export function calcMonthlyReturns(equityCurve: any[]) {
  if (equityCurve.length < 2) return []
  const monthlyEquity: Record<string, number> = {}
  for (const point of equityCurve) { monthlyEquity[point.date.substring(0, 7)] = point.totalEquity }
  const months = Object.keys(monthlyEquity).sort()
  const returns: any[] = []
  for (let i = 1; i < months.length; i++) {
    const ret = (monthlyEquity[months[i]] / monthlyEquity[months[i - 1]]) - 1
    returns.push({ month: months[i], return: r2(ret * 100) + '%', equity: monthlyEquity[months[i]] })
  }
  return returns
}

export function analyzeDrawdowns(equityCurve: any[]) {
  const drawdowns: any[] = []
  let peak = equityCurve[0]?.totalEquity || 0
  let ddStart: number | null = null; let maxDDInPeriod = 0; let ddStartDate: string | null = null
  for (let i = 0; i < equityCurve.length; i++) {
    const eq = equityCurve[i].totalEquity
    if (eq >= peak) {
      if (ddStart !== null && maxDDInPeriod > 0.01) drawdowns.push({ start: ddStartDate, trough: equityCurve[i - 1]?.date || ddStartDate, recovery: equityCurve[i].date, maxDrawdown: r2(maxDDInPeriod * 100) + '%', durationDays: i - ddStart })
      peak = eq; ddStart = null; maxDDInPeriod = 0
    } else {
      if (ddStart === null) { ddStart = i; ddStartDate = equityCurve[i].date }
      const dd = (peak - eq) / peak; if (dd > maxDDInPeriod) maxDDInPeriod = dd
    }
  }
  if (ddStart !== null && maxDDInPeriod > 0.01) drawdowns.push({ start: ddStartDate, trough: equityCurve[equityCurve.length - 1]?.date, recovery: 'ONGOING', maxDrawdown: r2(maxDDInPeriod * 100) + '%', durationDays: equityCurve.length - ddStart })
  return drawdowns.sort((a, b) => parseFloat(b.maxDrawdown) - parseFloat(a.maxDrawdown))
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

export function runBacktest(data: { stocks: Record<string, any>; niftyCloses: number[]; dates: string[] }, capitalBase: number = 10000000, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG) {
  const { stocks, niftyCloses, dates } = data
  const symbols = Object.keys(stocks)
  let capital = capitalBase
  const openPositions: any[] = []; const closedTrades: MRClosedTrade[] = []; const equityCurve: any[] = []
  let peakEquity = capitalBase; let maxDrawdown = 0
  const startIdx = cfg.MIN_HISTORY_DAYS
  for (let day = startIdx; day < dates.length; day++) {
    const currentDate = dates[day]; const positionsToClose: number[] = []
    for (let p = 0; p < openPositions.length; p++) {
      const pos = openPositions[p]; const stockData = stocks[pos.symbol]; if (!stockData) continue
      pos.daysSinceEntry++; pos.closesAfterEntry.push(stockData.closes[day]); pos.highsAfterEntry.push(stockData.highs[day]); pos.lowsAfterEntry.push(stockData.lows[day])
      const exitCheck = monitorPosition(pos, cfg)
      if (exitCheck.action === 'EXIT') {
        const exitPrice = exitCheck.exitPrice; const pnl = (exitPrice - pos.entryPrice) * pos.shares
        closedTrades.push({ symbol: pos.symbol, entryDate: dates[pos.entryIdx], exitDate: currentDate, entryPrice: r2(pos.entryPrice)!, exitPrice: r2(exitPrice)!, shares: pos.shares, pnl: Math.round(pnl), pnlPct: r2(((exitPrice / pos.entryPrice) - 1) * 100) + '%', holdingDays: pos.daysSinceEntry, exitReason: exitCheck.reason, entryRsi2: r2(pos.entryRsi2), entryConsecDown: pos.entryConsecDown, qualityGrade: pos.qualityGrade })
        capital += pos.shares * exitPrice; positionsToClose.push(p)
      }
    }
    for (let i = positionsToClose.length - 1; i >= 0; i--) openPositions.splice(positionsToClose[i], 1)
    if (openPositions.length < cfg.MAX_CONCURRENT_POSITIONS) {
      const niftySlice = niftyCloses.slice(0, day + 1); const regime = checkMarketRegime(niftySlice, cfg)
      if (regime.tradeable) {
        const slotsAvailable = cfg.MAX_CONCURRENT_POSITIONS - openPositions.length; const currentSymbols = new Set(openPositions.map((p: any) => p.symbol)); const candidates: any[] = []
        for (const sym of symbols) {
          if (currentSymbols.has(sym)) continue; const stockData = stocks[sym]
          const stockSlice = { symbol: sym, name: sym, sector: '', opens: stockData.opens.slice(0, day + 1), highs: stockData.highs.slice(0, day + 1), lows: stockData.lows.slice(0, day + 1), closes: stockData.closes.slice(0, day + 1), volumes: stockData.volumes.slice(0, day + 1), avgDailyTurnoverCr: stockData.avgDailyTurnoverCr, earningsDate: stockData.earningsDate }
          if (stockSlice.closes.length < cfg.MIN_HISTORY_DAYS) continue
          const indicators = computeIndicators(stockSlice, cfg); if (!indicators) continue
          const signal = checkMeanReversionEntry(indicators, stockSlice, currentDate, cfg)
          if (signal.triggered) candidates.push({ symbol: sym, signal, indicators })
        }
        candidates.sort((a, b) => b.signal.qualityScore - a.signal.qualityScore)
        for (const cand of candidates.slice(0, slotsAvailable)) {
          const trade = cand.signal.trade; if (!trade) continue
          const sizing = calcPositionSize(capital, cand.indicators.close, trade.stopLoss, regime.positionSizeMultiplier || 1.0, cfg)
          if (sizing.shares <= 0) continue
          capital -= sizing.positionValue!
          openPositions.push({ symbol: cand.symbol, entryPrice: cand.indicators.close, entryIdx: day, stopLoss: trade.stopLoss, shares: sizing.shares, daysSinceEntry: 0, closesAfterEntry: [], highsAfterEntry: [], lowsAfterEntry: [], preEntryCloses: cand.indicators.closesArray.slice(-50), entryRsi2: cand.indicators.rsi2, entryConsecDown: cand.indicators.consecutiveDownDays, qualityGrade: cand.signal.overallGrade })
        }
      }
    }
    let openValue = 0; for (const pos of openPositions) { const sd = stocks[pos.symbol]; if (sd && day < sd.closes.length) openValue += sd.closes[day] * pos.shares }
    const totalEquity = capital + openValue; if (totalEquity > peakEquity) peakEquity = totalEquity
    const dd = peakEquity > 0 ? (peakEquity - totalEquity) / peakEquity : 0; if (dd > maxDrawdown) maxDrawdown = dd
    equityCurve.push({ date: currentDate, cash: Math.round(capital), invested: Math.round(openValue), totalEquity: Math.round(totalEquity), positions: openPositions.length, drawdown: r2(dd * 100) + '%' })
  }
  for (const pos of openPositions) {
    const sd = stocks[pos.symbol]; const exitPrice = sd.closes[sd.closes.length - 1]; const pnl = (exitPrice - pos.entryPrice) * pos.shares
    closedTrades.push({ symbol: pos.symbol, entryDate: dates[pos.entryIdx], exitDate: dates[dates.length - 1], entryPrice: r2(pos.entryPrice)!, exitPrice: r2(exitPrice)!, shares: pos.shares, pnl: Math.round(pnl), pnlPct: r2(((exitPrice / pos.entryPrice) - 1) * 100) + '%', holdingDays: pos.daysSinceEntry, exitReason: 'BACKTEST_END', entryRsi2: r2(pos.entryRsi2), entryConsecDown: pos.entryConsecDown, qualityGrade: pos.qualityGrade })
    capital += exitPrice * pos.shares
  }
  return buildAnalytics(closedTrades, equityCurve, capitalBase, capital, maxDrawdown, cfg)
}

// ============================================================================
// ANALYTICS ENGINE
// ============================================================================

export function buildAnalytics(trades: MRClosedTrade[], equityCurve: any[], capitalBase: number, finalCapital: number, maxDrawdown: number, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG) {
  const totalTrades = trades.length; const winners = trades.filter(t => t.pnl > 0); const losers = trades.filter(t => t.pnl <= 0)
  const winRate = totalTrades > 0 ? winners.length / totalTrades : 0
  const avgWinPct = winners.length > 0 ? winners.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / winners.length : 0
  const avgLossPct = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / losers.length) : 0
  const avgHoldingDays = totalTrades > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / totalTrades : 0
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0); const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity
  const netProfit = grossProfit - grossLoss
  const expectancy = (winRate * avgWinPct) - ((1 - winRate) * avgLossPct)
  const totalReturn = (finalCapital / capitalBase) - 1

  // CAGR estimation
  const firstDate = equityCurve.length > 0 ? new Date(equityCurve[0].date) : null
  const lastDate = equityCurve.length > 0 ? new Date(equityCurve[equityCurve.length - 1].date) : null
  const years = firstDate && lastDate
    ? (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 1
  const cagr = years > 0 ? Math.pow(finalCapital / capitalBase, 1 / years) - 1 : 0

  const periodicReturns: number[] = []
  for (let i = 5; i < equityCurve.length; i += 5) { const prev = equityCurve[i - 5].totalEquity; const curr = equityCurve[i].totalEquity; if (prev > 0) periodicReturns.push((curr / prev) - 1) }
  const sharpe = calcSharpeRatio(periodicReturns, 52, cfg); const sortino = calcSortinoRatio(periodicReturns, 52, cfg)
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : null
  const { maxWinStreak, maxLoseStreak } = calcStreaks(trades)
  return {
    summary: { startingCapital: capitalBase, endingCapital: Math.round(finalCapital), netProfit: Math.round(netProfit), totalReturn: r2(totalReturn * 100) + '%', cagr: r2(cagr * 100) + '%', totalTrades, winners: winners.length, losers: losers.length, winRate: r2(winRate * 100) + '%', avgWinPct: r2(avgWinPct) + '%', avgLossPct: r2(avgLossPct) + '%', winLossRatio: avgLossPct > 0 ? r2(avgWinPct / avgLossPct) : 'N/A', profitFactor: profitFactor !== Infinity ? r2(profitFactor) : 'N/A', expectancyPerTrade: r2(expectancy) + '%', avgHoldingDays: r2(avgHoldingDays), maxDrawdown: r2(maxDrawdown * 100) + '%', sharpeRatio: sharpe !== null ? r2(sharpe) : 'N/A', sortinoRatio: sortino !== null ? r2(sortino) : 'N/A', calmarRatio: calmar !== null ? r2(calmar) : 'N/A', maxWinStreak, maxLoseStreak },
    byExitReason: analyzeByExitReason(trades), byQualityGrade: analyzeByGrade(trades), byConsecutiveDownDays: analyzeByConsecDown(trades), byRsi2Level: analyzeByRsi2Level(trades),
    monthlyReturns: calcMonthlyReturns(equityCurve), drawdownPeriods: analyzeDrawdowns(equityCurve),
    topWinners: [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(formatTrade),
    topLosers: [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(formatTrade),
    allTrades: trades, equityCurve,
  }
}

// ============================================================================
// SENSITIVITY ANALYSIS
// ============================================================================

export function sensitivityAnalysis(data: any, capitalBase: number = 10000000, cfg: MeanReversionConfig = DEFAULT_MR_CONFIG) {
  const results: any[] = []
  const variations: { param: string; key: keyof MeanReversionConfig; values: number[]; label: (v: number) => string }[] = [
    { param: 'RSI(2) Threshold', key: 'RSI2_OVERSOLD', values: [5, 8, 10, 15, 20], label: v => `< ${v}` },
    { param: 'Min Consecutive Down', key: 'MIN_CONSECUTIVE_DOWN', values: [1, 2, 3, 4, 5], label: v => `${v} days` },
    { param: 'Time Stop', key: 'TIME_STOP_DAYS', values: [5, 7, 10, 15, 20], label: v => `${v} days` },
    { param: 'ATR Stop Multiplier', key: 'ATR_STOP_MULTIPLIER', values: [1.5, 2.0, 2.5, 3.0], label: v => `${v}x ATR` },
    { param: 'RSI(2) Exit Threshold', key: 'RSI2_OVERBOUGHT', values: [50, 60, 70, 80, 90], label: v => `> ${v}` },
  ]
  for (const v of variations) {
    for (const val of v.values) {
      const testCfg = { ...cfg, [v.key]: val }
      const bt = runBacktest(data, capitalBase, testCfg)
      results.push({ parameter: v.param, value: v.label(val), trades: bt.summary.totalTrades, winRate: bt.summary.winRate, avgPnlPct: bt.summary.expectancyPerTrade, maxDD: bt.summary.maxDrawdown, totalReturn: bt.summary.totalReturn })
    }
  }
  return results
}

function formatTrade(t: MRClosedTrade) {
  return { symbol: t.symbol, entry: `${t.entryDate} @ ₹${t.entryPrice}`, exit: `${t.exitDate} @ ₹${t.exitPrice}`, pnlPct: t.pnlPct, holdingDays: t.holdingDays, exitReason: t.exitReason, grade: t.qualityGrade }
}
