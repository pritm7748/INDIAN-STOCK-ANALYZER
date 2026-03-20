// Breakout Trading — Darvas Box / VCP (Volatility Contraction Pattern)
// Adapted for Indian Markets (NSE) — Mid-cap focus, delivery % filters

// ============================== TYPES ==============================
export interface BreakoutConfig {
  MIN_PRIOR_GAIN_3M: number; SMA_FAST: number; SMA_MID: number; SMA_SLOW: number; SMA_SLOPE_LOOKBACK: number
  MIN_BASE_DAYS: number; MAX_BASE_DAYS: number; BASE_DETECTION_WINDOW: number; TIGHTENING_THRESHOLD: number
  MAX_BASE_RANGE_PCT: number; VOLUME_DECLINE_IN_BASE: boolean; VOLUME_DECLINE_RATIO: number
  BB_PERIOD: number; BB_STD_DEV: number; BB_SQUEEZE_PERCENTILE: number; BB_LOOKBACK_DAYS: number
  BREAKOUT_VOLUME_MULTIPLIER: number; VOLUME_AVG_PERIOD: number; MIN_CANDLE_BODY_RATIO: number; CLOSE_NEAR_HIGH_RATIO: number
  STOP_BELOW_BASE_LOW: boolean; MAX_STOP_PCT: number; TRAILING_ACTIVATION_PCT: number; TRAILING_EMA: number; MAX_HOLDING_DAYS: number
  MEASURED_MOVE: boolean; PARTIAL_EXIT_AT_1R: number; PARTIAL_EXIT_AT_TARGET: number
  MIN_DELIVERY_PCT: number; PREFER_DELIVERY_PCT: number; MIN_AVG_TURNOVER_CR: number; PREFER_MIDCAP: boolean; MIN_PRICE: number; MAX_PRICE: number
  MAX_CONCURRENT_POSITIONS: number; RISK_PER_TRADE_PCT: number; MAX_POSITION_PCT: number
  SECTOR_BREAKOUT_BONUS: number
  TRADING_DAYS_PER_YEAR: number; RISK_FREE_RATE: number
}

// ============================== CONFIG ==============================
export const DEFAULT_BREAKOUT_CONFIG: BreakoutConfig = {
  MIN_PRIOR_GAIN_3M: 0.20, SMA_FAST: 50, SMA_MID: 150, SMA_SLOW: 200, SMA_SLOPE_LOOKBACK: 20,
  MIN_BASE_DAYS: 15, MAX_BASE_DAYS: 30, BASE_DETECTION_WINDOW: 40, TIGHTENING_THRESHOLD: 0.6,
  MAX_BASE_RANGE_PCT: 0.15, VOLUME_DECLINE_IN_BASE: true, VOLUME_DECLINE_RATIO: 0.7,
  BB_PERIOD: 20, BB_STD_DEV: 2, BB_SQUEEZE_PERCENTILE: 20, BB_LOOKBACK_DAYS: 132,
  BREAKOUT_VOLUME_MULTIPLIER: 2.0, VOLUME_AVG_PERIOD: 20, MIN_CANDLE_BODY_RATIO: 0.50, CLOSE_NEAR_HIGH_RATIO: 0.70,
  STOP_BELOW_BASE_LOW: true, MAX_STOP_PCT: 0.07, TRAILING_ACTIVATION_PCT: 0.10, TRAILING_EMA: 10, MAX_HOLDING_DAYS: 20,
  MEASURED_MOVE: true, PARTIAL_EXIT_AT_1R: 0.30, PARTIAL_EXIT_AT_TARGET: 0.40,
  MIN_DELIVERY_PCT: 35, PREFER_DELIVERY_PCT: 45, MIN_AVG_TURNOVER_CR: 3, PREFER_MIDCAP: true, MIN_PRICE: 50, MAX_PRICE: 50000,
  MAX_CONCURRENT_POSITIONS: 8, RISK_PER_TRADE_PCT: 0.015, MAX_POSITION_PCT: 0.12,
  SECTOR_BREAKOUT_BONUS: 0.15,
  TRADING_DAYS_PER_YEAR: 252, RISK_FREE_RATE: 0.065,
}

const CONFIG = DEFAULT_BREAKOUT_CONFIG

// ============================== UTILITY ==============================
export function r2(n: number | null | undefined): any { return n !== null && n !== undefined && !isNaN(n) ? Math.round(n * 100) / 100 : null }

// ============================== TECHNICAL INDICATORS ==============================
export function calcSMA(data: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += (data[j] as number)
    result[i] = sum / period
  }
  return result
}

export function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += data[i]
  result[period - 1] = sum / period
  const k = 2 / (period + 1)
  for (let i = period; i < data.length; i++) {
    result[i] = (data[i] - (result[i - 1] as number)) * k + (result[i - 1] as number)
  }
  return result
}

export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const len = closes.length
  const result: (number | null)[] = new Array(len).fill(null)
  if (len < period + 1) return result
  const tr = [0]
  for (let i = 1; i < len; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  let atr = 0
  for (let i = 1; i <= period; i++) atr += tr[i]
  atr /= period; result[period] = atr
  for (let i = period + 1; i < len; i++) { atr = (atr * (period - 1) + tr[i]) / period; result[i] = atr }
  return result
}

export function calcBollingerBands(closes: number[], period = 20, numStdDev = 2): any {
  const len = closes.length
  const middle: (number | null)[] = new Array(len).fill(null)
  const upper: (number | null)[] = new Array(len).fill(null)
  const lower: (number | null)[] = new Array(len).fill(null)
  const bandwidth: (number | null)[] = new Array(len).fill(null)

  if (len < period) return { middle, upper, lower, bandwidth }

  for (let i = period - 1; i < len; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]
    const sma = sum / period
    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) sqSum += (closes[j] - sma) ** 2
    const stdDev = Math.sqrt(sqSum / period)
    middle[i] = sma
    upper[i] = sma + numStdDev * stdDev
    lower[i] = sma - numStdDev * stdDev
    bandwidth[i] = sma !== 0 ? ((upper[i] as number) - (lower[i] as number)) / sma : 0
  }
  return { middle, upper, lower, bandwidth }
}

export function calcBandwidthPercentile(bandwidthArray: (number | null)[], lookback: number): number | null {
  const valid = bandwidthArray.filter((b): b is number => b !== null)
  if (valid.length < lookback) return null
  const recent = valid.slice(-lookback)
  const current = recent[recent.length - 1]
  const sorted = [...recent].sort((a, b) => a - b)
  const rank = sorted.findIndex(v => v >= current)
  return (rank / sorted.length) * 100
}

export function calcChannelHighLow(highs: number[], lows: number[], period: number): any {
  const len = highs.length
  const channelHigh: (number | null)[] = new Array(len).fill(null)
  const channelLow: (number | null)[] = new Array(len).fill(null)
  if (len < period) return { channelHigh, channelLow }
  for (let i = period - 1; i < len; i++) {
    let maxH = -Infinity, minL = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > maxH) maxH = highs[j]
      if (lows[j] < minL) minL = lows[j]
    }
    channelHigh[i] = maxH; channelLow[i] = minL
  }
  return { channelHigh, channelLow }
}

export function calcVolatility(closes: number[], window = 20): number | null {
  if (closes.length < window + 1) return null
  const rets: number[] = []
  for (let i = closes.length - window; i < closes.length; i++) {
    if (closes[i - 1] === 0) return null
    rets.push(Math.log(closes[i] / closes[i - 1]))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  return Math.sqrt(variance) * Math.sqrt(CONFIG.TRADING_DAYS_PER_YEAR)
}

export function calcReturn(prices: number[] | null | undefined, lookback: number): number | null {
  if (!prices || prices.length < lookback + 1) return null
  const curr = prices[prices.length - 1]; const prev = prices[prices.length - 1 - lookback]
  return prev && prev !== 0 ? (curr / prev) - 1 : null
}

export function calcAvgVolume(volumes: number[] | null | undefined, period: number): number | null {
  if (!volumes || volumes.length < period) return null
  return volumes.slice(-period).reduce((s, v) => s + v, 0) / period
}

// ============================== SWING POINT DETECTION ==============================
export function findSwingPoints(highs: number[], lows: number[], startIdx: number, endIdx: number, order = 3): any {
  const swingHighs: any[] = []
  const swingLows: any[] = []
  for (let i = startIdx + order; i <= endIdx - order; i++) {
    let isHigh = true, isLow = true
    for (let j = 1; j <= order; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) isHigh = false
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) isLow = false
    }
    if (isHigh) swingHighs.push({ index: i, price: highs[i] })
    if (isLow) swingLows.push({ index: i, price: lows[i] })
  }
  return { highs: swingHighs, lows: swingLows }
}

// ============================== CONSOLIDATION BASE DETECTION ==============================
export function detectConsolidationBase(highs: number[], lows: number[], closes: number[], volumes: number[], atIndex: number | null = null): any {
  const idx = atIndex !== null ? atIndex : closes.length - 1
  if (idx < CONFIG.BASE_DETECTION_WINDOW + 10) return null

  let bestBase: any = null; let bestScore = 0

  for (let baseLen = CONFIG.MIN_BASE_DAYS; baseLen <= CONFIG.MAX_BASE_DAYS; baseLen++) {
    const startIdx = idx - baseLen + 1
    if (startIdx < 0) continue

    let baseHigh = -Infinity, baseLow = Infinity
    for (let j = startIdx; j <= idx; j++) {
      if (highs[j] > baseHigh) baseHigh = highs[j]
      if (lows[j] < baseLow) baseLow = lows[j]
    }
    const baseRange = baseHigh - baseLow
    const baseRangePct = baseRange / baseLow
    if (baseRangePct > CONFIG.MAX_BASE_RANGE_PCT) continue

    // Tightening check
    const halfPoint = startIdx + Math.floor(baseLen / 2)
    let firstHalfHigh = -Infinity, firstHalfLow = Infinity
    let secondHalfHigh = -Infinity, secondHalfLow = Infinity
    for (let j = startIdx; j < halfPoint; j++) {
      if (highs[j] > firstHalfHigh) firstHalfHigh = highs[j]
      if (lows[j] < firstHalfLow) firstHalfLow = lows[j]
    }
    for (let j = halfPoint; j <= idx; j++) {
      if (highs[j] > secondHalfHigh) secondHalfHigh = highs[j]
      if (lows[j] < secondHalfLow) secondHalfLow = lows[j]
    }
    const firstHalfRange = firstHalfHigh - firstHalfLow
    const secondHalfRange = secondHalfHigh - secondHalfLow
    const isTightening = firstHalfRange > 0 ? (secondHalfRange / firstHalfRange) <= CONFIG.TIGHTENING_THRESHOLD : false

    // Volume decline
    let volumeDeclining = false
    if (CONFIG.VOLUME_DECLINE_IN_BASE && volumes) {
      const firstHalfVol = volumes.slice(startIdx, halfPoint)
      const secondHalfVol = volumes.slice(halfPoint, idx + 1)
      if (firstHalfVol.length > 0 && secondHalfVol.length > 0) {
        const avgFirst = firstHalfVol.reduce((s, v) => s + v, 0) / firstHalfVol.length
        const avgSecond = secondHalfVol.reduce((s, v) => s + v, 0) / secondHalfVol.length
        volumeDeclining = avgFirst > 0 && (avgSecond / avgFirst) <= CONFIG.VOLUME_DECLINE_RATIO
      }
    }

    // Score
    let score = 0
    if (baseRangePct < 0.05) score += 3
    else if (baseRangePct < 0.08) score += 2
    else if (baseRangePct < 0.12) score += 1
    if (isTightening) score += 3
    if (volumeDeclining) score += 2
    if (baseLen >= 18 && baseLen <= 25) score += 2
    else if (baseLen >= 15 && baseLen <= 30) score += 1

    // Lower highs pattern
    let lowerHighs = 0
    const chunk = Math.floor(baseLen / 3)
    if (chunk >= 3) {
      const h1 = Math.max(...highs.slice(startIdx, startIdx + chunk))
      const h2 = Math.max(...highs.slice(startIdx + chunk, startIdx + 2 * chunk))
      const h3 = Math.max(...highs.slice(startIdx + 2 * chunk, idx + 1))
      if (h2 < h1) lowerHighs++
      if (h3 < h2) lowerHighs++
      score += lowerHighs
    }

    if (score > bestScore) {
      bestScore = score
      bestBase = {
        startIndex: startIdx, endIndex: idx, baseDays: baseLen, baseHigh, baseLow,
        baseRange: r2(baseRange), baseRangePct: r2(baseRangePct * 100) + '%',
        isTightening, tighteningRatio: firstHalfRange > 0 ? r2(secondHalfRange / firstHalfRange) : null,
        volumeDeclining, lowerHighs, score, maxScore: 11,
      }
    }
  }
  return bestBase
}

// ============================== VCP PATTERN DETECTION ==============================
export function detectVCP(highs: number[], lows: number[], closes: number[], lookback = 60): any {
  const len = closes.length
  if (len < lookback + 20) return null
  const startIdx = len - lookback
  const swings = findSwingPoints(highs, lows, startIdx, len - 1)
  if (swings.highs.length < 2 || swings.lows.length < 2) return null

  const contractions: any[] = []
  for (let i = 0; i < swings.highs.length - 1; i++) {
    const pivotHigh = swings.highs[i]
    const nextLow = swings.lows.find((l: any) => l.index > pivotHigh.index)
    if (!nextLow) continue
    const range = pivotHigh.price - nextLow.price
    const rangePct = range / pivotHigh.price
    contractions.push({ highIdx: pivotHigh.index, lowIdx: nextLow.index, highPrice: pivotHigh.price, lowPrice: nextLow.price, range, rangePct: r2(rangePct * 100) })
  }

  if (contractions.length < 2) return null

  let isVCP = true
  for (let i = 1; i < contractions.length; i++) {
    if (contractions[i].range >= contractions[i - 1].range) { isVCP = false; break }
  }

  const tighteningRatio = contractions[0].range > 0 ? contractions[contractions.length - 1].range / contractions[0].range : null

  return {
    detected: isVCP && contractions.length >= 2,
    contractions: contractions.length,
    contractionsDetail: contractions.map((c, i) => ({ number: `T${i + 1}`, range: r2(c.range), rangePct: c.rangePct + '%' })),
    tighteningRatio: tighteningRatio !== null ? r2(tighteningRatio) : null,
    finalContractionPct: contractions[contractions.length - 1].rangePct + '%',
    pivotHigh: contractions[contractions.length - 1].highPrice,
    pivotLow: contractions[contractions.length - 1].lowPrice,
  }
}

// ============================== SECTOR BREAKOUT DETECTION ==============================
export function detectSectorBreakout(sectorPrices: number[]): boolean {
  if (!sectorPrices || sectorPrices.length < 30) return false
  const len = sectorPrices.length
  const high20 = Math.max(...sectorPrices.slice(-21, -1))
  const current = sectorPrices[len - 1]
  return current > high20
}

// ============================== FULL BREAKOUT SIGNAL ANALYSIS ==============================
export function analyzeBreakout(stock: any, currentDate: string | null = null): any {
  const { opens, highs, lows, closes, volumes } = stock
  const len = closes.length
  if (len < CONFIG.SMA_SLOW + 20) return { triggered: false, reason: 'Insufficient history' }

  const idx = len - 1
  const conditions: any[] = []; let score = 0; const totalConditions = 7

  // CONDITION 1: Prior uptrend — up ≥ 20% in 3 months
  const gain3m = calcReturn(closes.slice(0, idx - CONFIG.MIN_BASE_DAYS + 1), 66)
  const hasPriorUptrend = gain3m !== null && gain3m >= CONFIG.MIN_PRIOR_GAIN_3M
  if (hasPriorUptrend) {
    score++
    conditions.push({ name: 'PRIOR_UPTREND', met: true, detail: `3-month gain before base: ${r2(gain3m * 100)}% (need ≥ ${CONFIG.MIN_PRIOR_GAIN_3M * 100}%)` })
  } else {
    conditions.push({ name: 'PRIOR_UPTREND', met: false, detail: `3-month gain: ${gain3m !== null ? r2(gain3m * 100) + '%' : 'N/A'} (need ≥ ${CONFIG.MIN_PRIOR_GAIN_3M * 100}%)` })
  }

  // CONDITION 2: SMA alignment (50 > 150 > 200, all above price, 200 rising)
  const sma50 = calcSMA(closes, CONFIG.SMA_FAST)
  const sma150 = calcSMA(closes, CONFIG.SMA_MID)
  const sma200 = calcSMA(closes, CONFIG.SMA_SLOW)
  const s50 = sma50[idx], s150 = sma150[idx], s200 = sma200[idx]
  const smasAligned = s50 !== null && s150 !== null && s200 !== null && closes[idx] > s50 && s50 > s150 && s150 > s200
  const sma200Rising = s200 !== null && idx >= CONFIG.SMA_SLOPE_LOOKBACK && sma200[idx - CONFIG.SMA_SLOPE_LOOKBACK] !== null && s200 > (sma200[idx - CONFIG.SMA_SLOPE_LOOKBACK] as number)

  if (smasAligned && sma200Rising) {
    score++
    conditions.push({ name: 'SMA_ALIGNMENT', met: true, detail: `Price (₹${r2(closes[idx])}) > 50-SMA (₹${r2(s50)}) > 150-SMA (₹${r2(s150)}) > 200-SMA (₹${r2(s200)}), 200-SMA rising` })
  } else {
    const issues: string[] = []
    if (!smasAligned) issues.push('SMAs not properly aligned')
    if (!sma200Rising) issues.push('200-SMA not rising')
    conditions.push({ name: 'SMA_ALIGNMENT', met: false, detail: issues.join('; ') + ` | 50:${r2(s50)} 150:${r2(s150)} 200:${r2(s200)}` })
  }

  // CONDITION 3: Consolidation base detected
  const base = detectConsolidationBase(highs, lows, closes, volumes, idx)
  if (base && base.score >= 5) {
    score++
    conditions.push({ name: 'CONSOLIDATION_BASE', met: true, detail: `${base.baseDays}-day base: ₹${r2(base.baseLow)}–₹${r2(base.baseHigh)} (range ${base.baseRangePct}), tightening: ${base.isTightening ? 'YES' : 'NO'}, vol declining: ${base.volumeDeclining ? 'YES' : 'NO'}, score: ${base.score}/${base.maxScore}` })
  } else {
    conditions.push({ name: 'CONSOLIDATION_BASE', met: false, detail: base ? `Base found but weak (score ${base.score}/${base.maxScore}): ${base.baseDays} days, range ${base.baseRangePct}` : 'No valid consolidation base detected' })
  }

  // CONDITION 4: Bollinger Bandwidth squeeze
  const bb = calcBollingerBands(closes, CONFIG.BB_PERIOD, CONFIG.BB_STD_DEV)
  const bwPercentile = calcBandwidthPercentile(bb.bandwidth, CONFIG.BB_LOOKBACK_DAYS)
  const currentBW = bb.bandwidth[idx]
  const isSqueezed = bwPercentile !== null && bwPercentile <= CONFIG.BB_SQUEEZE_PERCENTILE

  if (isSqueezed) {
    score++
    conditions.push({ name: 'BB_SQUEEZE', met: true, detail: `Bandwidth percentile: ${r2(bwPercentile)}% (need ≤ ${CONFIG.BB_SQUEEZE_PERCENTILE}%), BW: ${r2(currentBW)}` })
  } else {
    conditions.push({ name: 'BB_SQUEEZE', met: false, detail: `Bandwidth percentile: ${bwPercentile !== null ? r2(bwPercentile) + '%' : 'N/A'} (not squeezed enough)` })
  }

  // CONDITION 5: Price breaks above base high
  const breakoutLevel = base ? base.baseHigh : null
  const priceBreaksOut = breakoutLevel !== null && closes[idx] > breakoutLevel
  if (priceBreaksOut) {
    score++
    conditions.push({ name: 'PRICE_BREAKOUT', met: true, detail: `Close ₹${r2(closes[idx])} > base high ₹${r2(breakoutLevel)} (breakout by ${r2(((closes[idx] / breakoutLevel) - 1) * 100)}%)` })
  } else {
    conditions.push({ name: 'PRICE_BREAKOUT', met: false, detail: breakoutLevel !== null ? `Close ₹${r2(closes[idx])} still below base high ₹${r2(breakoutLevel)}` : 'No base high established' })
  }

  // CONDITION 6: Volume surge on breakout day
  const avgVol = calcAvgVolume(volumes.slice(0, idx), CONFIG.VOLUME_AVG_PERIOD)
  const breakoutVolume = volumes[idx]
  const volumeRatio = avgVol && avgVol > 0 ? breakoutVolume / avgVol : null
  const hasVolumeSurge = volumeRatio !== null && volumeRatio >= CONFIG.BREAKOUT_VOLUME_MULTIPLIER

  if (hasVolumeSurge) {
    score++
    conditions.push({ name: 'VOLUME_SURGE', met: true, detail: `Volume ${r2(volumeRatio)}× average (${breakoutVolume.toLocaleString()} vs avg ${Math.round(avgVol!).toLocaleString()})` })
  } else {
    conditions.push({ name: 'VOLUME_SURGE', met: false, detail: `Volume only ${r2(volumeRatio)}× average (need ≥ ${CONFIG.BREAKOUT_VOLUME_MULTIPLIER}×)` })
  }

  // CONDITION 7: Strong bullish candle
  const candleRange = highs[idx] - lows[idx]
  const candleBody = Math.abs(closes[idx] - opens[idx])
  const bodyRatio = candleRange > 0 ? candleBody / candleRange : 0
  const closeNearHigh = candleRange > 0 ? (closes[idx] - lows[idx]) / candleRange : 0
  const isBullish = closes[idx] > opens[idx]
  const strongCandle = isBullish && bodyRatio >= CONFIG.MIN_CANDLE_BODY_RATIO && closeNearHigh >= CONFIG.CLOSE_NEAR_HIGH_RATIO

  if (strongCandle) {
    score++
    conditions.push({ name: 'STRONG_CANDLE', met: true, detail: `Bullish candle: body ratio ${r2(bodyRatio)}, close near high ${r2(closeNearHigh)}` })
  } else {
    const issues: string[] = []
    if (!isBullish) issues.push('bearish')
    if (bodyRatio < CONFIG.MIN_CANDLE_BODY_RATIO) issues.push(`weak body (${r2(bodyRatio)})`)
    if (closeNearHigh < CONFIG.CLOSE_NEAR_HIGH_RATIO) issues.push(`close not near high (${r2(closeNearHigh)})`)
    conditions.push({ name: 'STRONG_CANDLE', met: false, detail: issues.join(', ') })
  }

  // OVERALL: 5/7 with PRICE_BREAKOUT and VOLUME_SURGE mandatory
  const triggered = score >= 5 && priceBreaksOut && hasVolumeSurge

  // VCP supplementary analysis
  const vcp = detectVCP(highs, lows, closes)

  // QUALITY SCORING (12-point)
  let qualityScore = 0; const qualityFactors: string[] = []
  if (base && base.score >= 8) { qualityScore += 3; qualityFactors.push(`Excellent base quality (${base.score}/${base.maxScore})`) }
  else if (base && base.score >= 6) { qualityScore += 2; qualityFactors.push(`Good base quality (${base.score}/${base.maxScore})`) }
  else if (base && base.score >= 4) { qualityScore += 1; qualityFactors.push(`Adequate base (${base.score}/${base.maxScore})`) }

  if (vcp && vcp.detected) { qualityScore += 2; qualityFactors.push(`VCP confirmed: ${vcp.contractions} contractions, tightening ratio ${vcp.tighteningRatio}`) }
  if (volumeRatio !== null && volumeRatio > 3) { qualityScore += 2; qualityFactors.push(`Exceptional volume: ${r2(volumeRatio)}× average`) }
  else if (volumeRatio !== null && volumeRatio > 2.5) { qualityScore += 1; qualityFactors.push(`Strong volume: ${r2(volumeRatio)}× average`) }
  if (bwPercentile !== null && bwPercentile < 10) { qualityScore += 1; qualityFactors.push(`Extreme squeeze: bandwidth at ${r2(bwPercentile)} percentile`) }

  if (stock.deliveryPct !== undefined && stock.deliveryPct !== null) {
    if (stock.deliveryPct >= CONFIG.PREFER_DELIVERY_PCT) { qualityScore += 1; qualityFactors.push(`Strong delivery: ${stock.deliveryPct}% (genuine buying)`) }
    else if (stock.deliveryPct < CONFIG.MIN_DELIVERY_PCT) { qualityScore -= 1; qualityFactors.push(`⚠ Low delivery: ${stock.deliveryPct}% — breakout may be speculative`) }
  }
  if (stock.sectorIndex) {
    const sectorBreaking = detectSectorBreakout(stock.sectorIndex)
    if (sectorBreaking) { qualityScore += 2; qualityFactors.push('Sector index also breaking out — amplified signal') }
  }
  if (gain3m !== null && gain3m > 0.40) { qualityScore += 1; qualityFactors.push(`Strong prior trend: ${r2(gain3m * 100)}% in 3 months`) }

  // TRADE PARAMETERS
  let trade: any = null
  if (triggered && base) {
    const entryPrice = closes[idx]
    const baseLowStop = base.baseLow * 0.998
    const pctStop = entryPrice * (1 - CONFIG.MAX_STOP_PCT)
    const stopLoss = Math.max(baseLowStop, pctStop)
    const risk = entryPrice - stopLoss; const riskPct = risk / entryPrice
    const measuredMoveTarget = entryPrice + base.baseRange
    const atr = calcATR(highs, lows, closes, 14)
    const latestATR = atr[idx]

    trade = {
      entryPrice: r2(entryPrice), entryType: 'Breakout close or next day open',
      stopLoss: r2(stopLoss), stopMethod: `Below base low ₹${r2(base.baseLow)} or ${CONFIG.MAX_STOP_PCT * 100}% — tighter of the two`,
      riskPct: r2(riskPct * 100) + '%', riskPerShare: r2(risk),
      measuredMoveTarget: r2(measuredMoveTarget), measuredMoveReturn: r2(((measuredMoveTarget - entryPrice) / entryPrice) * 100) + '%',
      riskReward: risk > 0 ? r2((measuredMoveTarget - entryPrice) / risk) + ':1' : 'N/A',
      trailingStop: `10-EMA after +${CONFIG.TRAILING_ACTIVATION_PCT * 100}% gain`,
      maxHoldingDays: CONFIG.MAX_HOLDING_DAYS,
      partialExits: {
        at1R: `Book ${CONFIG.PARTIAL_EXIT_AT_1R * 100}% at ₹${r2(entryPrice + risk)} (+${r2((risk / entryPrice) * 100)}%)`,
        atTarget: `Book ${CONFIG.PARTIAL_EXIT_AT_TARGET * 100}% at ₹${r2(measuredMoveTarget)}`,
        remainder: 'Trail with 10-EMA',
      },
      atr14: r2(latestATR),
    }
  }

  return {
    strategy: 'BREAKOUT_VCP', symbol: stock.symbol, date: currentDate, triggered, score, totalConditions, conditions,
    baseAnalysis: base, vcpAnalysis: vcp,
    bbSqueezePercentile: bwPercentile !== null ? r2(bwPercentile) + '%' : null,
    qualityScore, maxQualityScore: 12,
    qualityGrade: triggered ? qualityScore >= 9 ? 'A+' : qualityScore >= 7 ? 'A' : qualityScore >= 5 ? 'B' : 'C' : null,
    qualityFactors,
    indicators: { close: r2(closes[idx]), sma50: r2(s50), sma150: r2(s150), sma200: r2(s200), bbBandwidth: r2(currentBW), volumeRatio: r2(volumeRatio), volatility: calcVolatility(closes) ? r2(calcVolatility(closes)! * 100) + '%' : null },
    trade,
  }
}

// ============================== INDIAN MARKET FILTERS ==============================
export function applyIndianFilters(stock: any): any {
  const warnings: string[] = []
  if (stock.avgDailyTurnoverCr && stock.avgDailyTurnoverCr < CONFIG.MIN_AVG_TURNOVER_CR) {
    return { pass: false, reason: `Turnover ₹${stock.avgDailyTurnoverCr}cr < ₹${CONFIG.MIN_AVG_TURNOVER_CR}cr` }
  }
  const price = stock.closes ? stock.closes[stock.closes.length - 1] : 0
  if (price < CONFIG.MIN_PRICE) return { pass: false, reason: `Price ₹${r2(price)} below minimum ₹${CONFIG.MIN_PRICE}` }
  if (stock.deliveryPct !== undefined && stock.deliveryPct < CONFIG.MIN_DELIVERY_PCT) {
    warnings.push(`Low delivery: ${stock.deliveryPct}% (breakout may be speculative/F&O driven)`)
  }
  if (CONFIG.PREFER_MIDCAP && stock.marketCap && stock.marketCap > 500000) {
    warnings.push('Large-cap — breakouts may be less explosive')
  }
  return { pass: true, warnings }
}

// ============================== UNIVERSE SCANNER ==============================
export function scanUniverse(universe: any[], currentDate: string | null = null): any {
  const signals: any[] = []; const nearBreakout: any[] = []; const filtered: any[] = []

  for (const stock of universe) {
    const filterResult = applyIndianFilters(stock)
    if (!filterResult.pass) { filtered.push({ symbol: stock.symbol, reason: filterResult.reason }); continue }

    const analysis = analyzeBreakout(stock, currentDate)
    if (analysis.triggered) {
      signals.push({ ...analysis, warnings: filterResult.warnings || [] })
    } else if (analysis.score >= 4) {
      nearBreakout.push({
        symbol: stock.symbol, score: `${analysis.score}/${analysis.totalConditions}`,
        missingConditions: analysis.conditions.filter((c: any) => !c.met).map((c: any) => c.name),
        bbSqueeze: analysis.bbSqueezePercentile, baseDetected: !!analysis.baseAnalysis,
      })
    }
  }
  signals.sort((a, b) => b.qualityScore - a.qualityScore)

  return {
    date: currentDate, totalScanned: universe.length, totalFiltered: filtered.length,
    breakoutSignals: signals.length, signals, watchlist: nearBreakout.slice(0, 15), filtered: filtered.slice(0, 10),
  }
}

// ============================== POSITION SIZING ==============================
export function calcPositionSize(capital: number, entryPrice: number, stopLoss: number): any {
  if (entryPrice <= 0 || stopLoss <= 0 || stopLoss >= entryPrice) return { shares: 0, error: 'Invalid parameters' }
  const riskPerShare = entryPrice - stopLoss
  const maxRisk = capital * CONFIG.RISK_PER_TRADE_PCT
  const sharesFromRisk = Math.floor(maxRisk / riskPerShare)
  const maxShares = Math.floor((capital * CONFIG.MAX_POSITION_PCT) / entryPrice)
  const shares = Math.min(sharesFromRisk, maxShares)
  return {
    shares, positionValue: Math.round(shares * entryPrice), riskPerShare: r2(riskPerShare),
    totalRisk: Math.round(shares * riskPerShare),
    riskPct: r2((shares * riskPerShare / capital) * 100) + '%',
    positionPct: r2((shares * entryPrice / capital) * 100) + '%',
    constraint: shares === maxShares ? 'MAX_POSITION_CAP' : 'RISK_BASED',
  }
}

// ============================== POSITION MONITORING ==============================
export function monitorPosition(position: any): any {
  const { entryPrice, stopLoss, measuredMoveTarget, daysSinceEntry, initialShares, partialExits, closesAfterEntry, highsAfterEntry, lowsAfterEntry } = position
  const len = closesAfterEntry.length
  if (len === 0) return { action: 'HOLD', reason: 'No data yet' }

  const currentClose = closesAfterEntry[len - 1]
  const currentLow = lowsAfterEntry[len - 1]
  const currentHigh = highsAfterEntry[len - 1]
  const pnlPct = (currentClose / entryPrice) - 1
  const risk = entryPrice - stopLoss

  // 1. STOP-LOSS HIT
  if (currentLow <= stopLoss) {
    return { action: 'EXIT_ALL', reason: 'STOP_LOSS_HIT', exitPrice: stopLoss, pnlPct: (stopLoss / entryPrice) - 1, daysSinceEntry, urgency: 'IMMEDIATE' }
  }

  // 2. PARTIAL EXIT AT 1R (book 30%)
  if (!partialExits.at1R && risk > 0) {
    const target1R = entryPrice + risk
    if (currentHigh >= target1R) {
      return {
        action: 'PARTIAL_EXIT', reason: 'TARGET_1R', exitPrice: r2(target1R), exitQtyPct: CONFIG.PARTIAL_EXIT_AT_1R,
        pnlPct: (target1R / entryPrice) - 1,
        note: `Book ${CONFIG.PARTIAL_EXIT_AT_1R * 100}% at 1R (₹${r2(target1R)}). Move stop to breakeven for remainder.`,
        newStopLoss: entryPrice,
      }
    }
  }

  // 3. PARTIAL EXIT AT MEASURED MOVE TARGET (book 40%)
  if (!partialExits.atTarget && measuredMoveTarget && partialExits.at1R) {
    if (currentHigh >= measuredMoveTarget) {
      return {
        action: 'PARTIAL_EXIT', reason: 'MEASURED_MOVE_TARGET', exitPrice: r2(measuredMoveTarget), exitQtyPct: CONFIG.PARTIAL_EXIT_AT_TARGET,
        pnlPct: (measuredMoveTarget / entryPrice) - 1,
        note: `Book ${CONFIG.PARTIAL_EXIT_AT_TARGET * 100}% at measured move target (₹${r2(measuredMoveTarget)}). Trail remainder with 10-EMA.`,
      }
    }
  }

  // 4. TRAILING STOP (10-EMA) after 10%+ gain
  if (pnlPct >= CONFIG.TRAILING_ACTIVATION_PCT && partialExits.at1R) {
    const ema10 = calcEMA(closesAfterEntry, CONFIG.TRAILING_EMA)
    const currentEma10 = ema10[ema10.length - 1]
    if (currentEma10 !== null && currentClose < currentEma10) {
      return { action: 'EXIT_ALL', reason: 'TRAILING_10EMA', exitPrice: currentClose, pnlPct, daysSinceEntry, note: `Close ₹${r2(currentClose)} below 10-EMA ₹${r2(currentEma10)}` }
    }
  }

  // 5. TIME STOP
  if (daysSinceEntry >= CONFIG.MAX_HOLDING_DAYS) {
    return { action: 'EXIT_ALL', reason: 'MAX_HOLDING_PERIOD', exitPrice: currentClose, pnlPct, daysSinceEntry }
  }

  // 6. FAILED BREAKOUT DETECTION
  if (daysSinceEntry <= 3 && position.breakoutLevel) {
    if (currentClose < position.breakoutLevel * 0.98) {
      return { action: 'EXIT_ALL', reason: 'FAILED_BREAKOUT', exitPrice: currentClose, pnlPct, daysSinceEntry, note: 'Price fell back below breakout level — false breakout', urgency: 'HIGH' }
    }
  }

  // HOLD
  const ema10 = calcEMA(closesAfterEntry, Math.min(CONFIG.TRAILING_EMA, len))
  const currentEma10 = ema10[ema10.length - 1]

  return {
    action: 'HOLD', daysSinceEntry, pnlPct, currentPrice: r2(currentClose),
    highSinceEntry: r2(Math.max(...highsAfterEntry)),
    stopLoss: r2(stopLoss), ema10: currentEma10 ? r2(currentEma10) : null,
    distanceToStop: r2(((currentClose - stopLoss) / currentClose) * 100) + '%',
    distanceToTarget: measuredMoveTarget ? r2(((measuredMoveTarget - currentClose) / currentClose) * 100) + '%' : 'trailing',
    daysRemaining: CONFIG.MAX_HOLDING_DAYS - daysSinceEntry,
    partialExitsDone: { at1R: partialExits.at1R, atTarget: partialExits.atTarget },
  }
}

// ============================== BACKTEST ENGINE ==============================
export function runBacktest(dailySnapshots: any[], capitalBase = 10000000): any {
  let capital = capitalBase; const openPositions: any[] = []; const closedTrades: any[] = []; const equityCurve: any[] = []
  let peakEquity = capitalBase; let maxDrawdown = 0

  for (let dayIdx = 0; dayIdx < dailySnapshots.length; dayIdx++) {
    const { date, stocks } = dailySnapshots[dayIdx]

    // Monitor existing positions
    const toClose: number[] = []
    for (let p = 0; p < openPositions.length; p++) {
      const pos = openPositions[p]; pos.daysSinceEntry++
      const stockData = stocks.find((s: any) => s.symbol === pos.symbol)
      if (!stockData) continue
      const sLen = stockData.closes.length
      const currentClose = stockData.closes[sLen - 1]; const currentHigh = stockData.highs[sLen - 1]; const currentLow = stockData.lows[sLen - 1]
      pos.closesAfterEntry.push(currentClose); pos.highsAfterEntry.push(currentHigh); pos.lowsAfterEntry.push(currentLow)

      const action = monitorPosition(pos)
      if (action.action === 'EXIT_ALL') {
        const exitPrice = typeof action.exitPrice === 'number' ? action.exitPrice : currentClose
        const pnl = (exitPrice - pos.entryPrice) * pos.sharesRemaining
        capital += exitPrice * pos.sharesRemaining
        const totalPnl = (pos.realizedPnl || 0) + pnl
        closedTrades.push({ symbol: pos.symbol, entryDate: pos.entryDate, exitDate: date, entryPrice: r2(pos.entryPrice), exitPrice: r2(exitPrice), pnl: Math.round(totalPnl), pnlPct: r2(((exitPrice / pos.entryPrice) - 1) * 100) + '%', holdingDays: pos.daysSinceEntry, exitReason: action.reason, qualityGrade: pos.qualityGrade, baseScore: pos.baseScore, vcpDetected: pos.vcpDetected })
        toClose.push(p)
      } else if (action.action === 'PARTIAL_EXIT') {
        const exitPrice = typeof action.exitPrice === 'number' ? action.exitPrice : parseFloat(action.exitPrice)
        const exitShares = Math.floor(pos.initialShares * action.exitQtyPct)
        const partialPnl = (exitPrice - pos.entryPrice) * exitShares
        capital += exitPrice * exitShares; pos.sharesRemaining -= exitShares; pos.realizedPnl = (pos.realizedPnl || 0) + partialPnl
        if (action.reason === 'TARGET_1R') { pos.partialExits.at1R = true; if (action.newStopLoss) pos.stopLoss = action.newStopLoss }
        else if (action.reason === 'MEASURED_MOVE_TARGET') { pos.partialExits.atTarget = true }
      }
    }
    for (let i = toClose.length - 1; i >= 0; i--) openPositions.splice(toClose[i], 1)

    // Scan for new entries (weekly)
    if (dayIdx % 5 === 0 && openPositions.length < CONFIG.MAX_CONCURRENT_POSITIONS) {
      const scanResult = scanUniverse(stocks, date)
      const currentSymbols = new Set(openPositions.map((p: any) => p.symbol))
      const slotsAvail = CONFIG.MAX_CONCURRENT_POSITIONS - openPositions.length

      for (const signal of scanResult.signals.slice(0, slotsAvail)) {
        if (currentSymbols.has(signal.symbol) || !signal.trade) continue
        const ep = parseFloat(signal.trade.entryPrice); const sl = parseFloat(signal.trade.stopLoss)
        if (isNaN(ep) || isNaN(sl) || ep <= 0) continue
        const sizing = calcPositionSize(capital, ep, sl)
        if (sizing.shares <= 0) continue
        capital -= sizing.positionValue
        openPositions.push({
          symbol: signal.symbol, entryDate: date, entryPrice: ep, stopLoss: sl,
          breakoutLevel: signal.baseAnalysis ? signal.baseAnalysis.baseHigh : ep,
          measuredMoveTarget: signal.trade.measuredMoveTarget ? parseFloat(signal.trade.measuredMoveTarget) : null,
          initialShares: sizing.shares, sharesRemaining: sizing.shares, daysSinceEntry: 0,
          partialExits: { at1R: false, atTarget: false }, realizedPnl: 0,
          closesAfterEntry: [], highsAfterEntry: [], lowsAfterEntry: [],
          qualityGrade: signal.qualityGrade, baseScore: signal.baseAnalysis ? signal.baseAnalysis.score : null,
          vcpDetected: signal.vcpAnalysis ? signal.vcpAnalysis.detected : false,
        })
      }
    }

    // Equity curve
    let openValue = 0
    for (const pos of openPositions) {
      if (pos.closesAfterEntry.length > 0) openValue += pos.closesAfterEntry[pos.closesAfterEntry.length - 1] * pos.sharesRemaining
    }
    const totalEquity = capital + openValue
    if (totalEquity > peakEquity) peakEquity = totalEquity
    const dd = peakEquity > 0 ? (peakEquity - totalEquity) / peakEquity : 0
    if (dd > maxDrawdown) maxDrawdown = dd
    equityCurve.push({ date, totalEquity: Math.round(totalEquity), positions: openPositions.length, drawdown: r2(dd * 100) + '%' })
  }

  // Force-close remaining
  for (const pos of openPositions) {
    const exitPrice = pos.closesAfterEntry.length > 0 ? pos.closesAfterEntry[pos.closesAfterEntry.length - 1] : pos.entryPrice
    const pnl = (exitPrice - pos.entryPrice) * pos.sharesRemaining + (pos.realizedPnl || 0)
    capital += exitPrice * pos.sharesRemaining
    closedTrades.push({ symbol: pos.symbol, entryDate: pos.entryDate, exitDate: 'FORCED', entryPrice: r2(pos.entryPrice), exitPrice: r2(exitPrice), pnl: Math.round(pnl), pnlPct: r2(((exitPrice / pos.entryPrice) - 1) * 100) + '%', holdingDays: pos.daysSinceEntry, exitReason: 'BACKTEST_END', qualityGrade: pos.qualityGrade })
  }
  return buildAnalytics(closedTrades, equityCurve, capitalBase, capital, maxDrawdown)
}

// ============================== ANALYTICS ==============================
function buildAnalytics(trades: any[], equityCurve: any[], capitalBase: number, finalCapital: number, maxDrawdown: number): any {
  const total = trades.length; const winners = trades.filter(t => t.pnl > 0); const losers = trades.filter(t => t.pnl <= 0)
  const winRate = total > 0 ? winners.length / total : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / losers.length) : 0
  const avgHold = total > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / total : 0
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss)
  const totalReturn = (finalCapital / capitalBase) - 1

  // Sharpe/Sortino from weekly returns
  const weeklyReturns: number[] = []
  for (let i = 5; i < equityCurve.length; i += 5) {
    const prev = equityCurve[i - 5].totalEquity; const curr = equityCurve[i].totalEquity
    if (prev > 0) weeklyReturns.push((curr / prev) - 1)
  }
  const sharpe = calcSharpeRatio(weeklyReturns, 52)
  const sortino = calcSortinoRatio(weeklyReturns, 52)

  // By exit reason
  const byExitReason = groupAnalyze(trades, 'exitReason')
  // By quality grade
  const byGrade = groupAnalyze(trades, 'qualityGrade')
  // By VCP detection
  const byVCP = { withVCP: analyzeSubset(trades.filter(t => t.vcpDetected)), withoutVCP: analyzeSubset(trades.filter(t => !t.vcpDetected)) }
  // By base score
  const byBaseScore = { strong: analyzeSubset(trades.filter(t => t.baseScore >= 7)), moderate: analyzeSubset(trades.filter(t => t.baseScore >= 4 && t.baseScore < 7)), weak: analyzeSubset(trades.filter(t => t.baseScore < 4 || t.baseScore === null)) }

  // P&L distribution (breakout fat-tails)
  const pnlDistribution = {
    bigWinners: trades.filter(t => parseFloat(t.pnlPct) > 15).length,
    moderateWinners: trades.filter(t => parseFloat(t.pnlPct) > 5 && parseFloat(t.pnlPct) <= 15).length,
    smallWinners: trades.filter(t => parseFloat(t.pnlPct) > 0 && parseFloat(t.pnlPct) <= 5).length,
    smallLosers: trades.filter(t => parseFloat(t.pnlPct) <= 0 && parseFloat(t.pnlPct) > -5).length,
    bigLosers: trades.filter(t => parseFloat(t.pnlPct) <= -5).length,
  }

  // Streaks
  let maxWin = 0, maxLose = 0, curWin = 0, curLose = 0
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLose = 0; maxWin = Math.max(maxWin, curWin) }
    else { curLose++; curWin = 0; maxLose = Math.max(maxLose, curLose) }
  }

  return {
    summary: {
      startingCapital: capitalBase, endingCapital: Math.round(finalCapital), totalReturn: r2(totalReturn * 100) + '%',
      totalTrades: total, winners: winners.length, losers: losers.length,
      winRate: r2(winRate * 100) + '%', avgWinPct: r2(avgWin) + '%', avgLossPct: r2(avgLoss) + '%',
      winLossRatio: avgLoss > 0 ? r2(avgWin / avgLoss) : 'N/A',
      profitFactor: profitFactor !== Infinity ? r2(profitFactor) : 'N/A',
      expectancy: r2(expectancy) + '%', maxDrawdown: r2(maxDrawdown * 100) + '%', avgHoldingDays: r2(avgHold),
      sharpeRatio: sharpe !== null ? r2(sharpe) : 'N/A', sortinoRatio: sortino !== null ? r2(sortino) : 'N/A',
      maxWinStreak: maxWin, maxLoseStreak: maxLose,
    },
    pnlDistribution, byExitReason, byQualityGrade: byGrade, byVCPDetection: byVCP, byBaseQuality: byBaseScore,
    topWinners: [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(formatTrade),
    topLosers: [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(formatTrade),
    trades, equityCurve,
  }
}

function groupAnalyze(trades: any[], field: string): any {
  const groups: Record<string, any[]> = {}
  for (const t of trades) { const key = t[field] || 'Unknown'; if (!groups[key]) groups[key] = []; groups[key].push(t) }
  const result: any = {}
  for (const [key, list] of Object.entries(groups)) { result[key] = analyzeSubset(list) }
  return result
}

function analyzeSubset(trades: any[]): any {
  if (!trades || trades.length === 0) return { count: 0 }
  const wins = trades.filter(t => t.pnl > 0)
  return {
    count: trades.length, winRate: r2((wins.length / trades.length) * 100) + '%',
    avgPnlPct: r2(trades.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / trades.length) + '%',
    totalPnl: Math.round(trades.reduce((s, t) => s + t.pnl, 0)),
    avgHoldDays: r2(trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length),
  }
}

function formatTrade(t: any): any {
  return { symbol: t.symbol, pnlPct: t.pnlPct, holdingDays: t.holdingDays, exitReason: t.exitReason, grade: t.qualityGrade, vcp: t.vcpDetected }
}

function calcSharpeRatio(returns: number[], periodsPerYear: number): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1))
  if (std === 0) return null
  return (mean * periodsPerYear - CONFIG.RISK_FREE_RATE) / (std * Math.sqrt(periodsPerYear))
}

function calcSortinoRatio(returns: number[], periodsPerYear: number): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const down = returns.filter(r => r < 0)
  if (down.length === 0) return Infinity
  const dsDev = Math.sqrt(down.reduce((s, r) => s + r ** 2, 0) / down.length)
  if (dsDev === 0) return Infinity
  return (mean * periodsPerYear - CONFIG.RISK_FREE_RATE) / (dsDev * Math.sqrt(periodsPerYear))
}

// ============================== SENSITIVITY ANALYSIS ==============================
export function sensitivityAnalysis(dailySnapshots: any[], capitalBase = 10000000): any[] {
  const results: any[] = []

  for (const vm of [1.5, 2.0, 2.5, 3.0]) {
    const orig = CONFIG.BREAKOUT_VOLUME_MULTIPLIER
    ;(CONFIG as any).BREAKOUT_VOLUME_MULTIPLIER = vm
    const bt = runBacktest(dailySnapshots, capitalBase)
    results.push({ param: 'Volume Multiplier', value: `${vm}×`, trades: bt.summary.totalTrades, winRate: bt.summary.winRate, avgWin: bt.summary.avgWinPct, return: bt.summary.totalReturn })
    ;(CONFIG as any).BREAKOUT_VOLUME_MULTIPLIER = orig
  }

  for (const gain of [0.10, 0.15, 0.20, 0.30, 0.40]) {
    const orig = CONFIG.MIN_PRIOR_GAIN_3M
    ;(CONFIG as any).MIN_PRIOR_GAIN_3M = gain
    const bt = runBacktest(dailySnapshots, capitalBase)
    results.push({ param: 'Min Prior Gain', value: `${gain * 100}%`, trades: bt.summary.totalTrades, winRate: bt.summary.winRate, avgWin: bt.summary.avgWinPct, return: bt.summary.totalReturn })
    ;(CONFIG as any).MIN_PRIOR_GAIN_3M = orig
  }

  for (const sl of [0.05, 0.07, 0.10, 0.12]) {
    const orig = CONFIG.MAX_STOP_PCT
    ;(CONFIG as any).MAX_STOP_PCT = sl
    const bt = runBacktest(dailySnapshots, capitalBase)
    results.push({ param: 'Max Stop %', value: `${sl * 100}%`, trades: bt.summary.totalTrades, winRate: bt.summary.winRate, avgWin: bt.summary.avgWinPct, return: bt.summary.totalReturn })
    ;(CONFIG as any).MAX_STOP_PCT = orig
  }

  for (const pct of [10, 15, 20, 30, 40]) {
    const orig = CONFIG.BB_SQUEEZE_PERCENTILE
    ;(CONFIG as any).BB_SQUEEZE_PERCENTILE = pct
    const bt = runBacktest(dailySnapshots, capitalBase)
    results.push({ param: 'BB Squeeze %ile', value: `≤${pct}%`, trades: bt.summary.totalTrades, winRate: bt.summary.winRate, avgWin: bt.summary.avgWinPct, return: bt.summary.totalReturn })
    ;(CONFIG as any).BB_SQUEEZE_PERCENTILE = orig
  }

  return results
}
