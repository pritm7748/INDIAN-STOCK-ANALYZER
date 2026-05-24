// Event-Driven / Catalyst Trading Strategy — Indian Markets (NSE)
// Earnings Surprise (PEAD) + RBI Policy + Index Rebalancing + Bulk/Block Deals

// ============================== TYPES ==============================
export interface EDConfig {
  EARNINGS: { SURPRISE_THRESHOLD: number; VOLUME_MULTIPLIER: number; VOLUME_AVG_PERIOD: number; HOLDING_DAYS: number; STOP_LOSS_BELOW_LOW: number; MIN_GAP_UP_PCT: number; MIN_CANDLE_BODY_RATIO: number; EMA_FAST: number; SMA_SLOW: number; DRIFT_WINDOW_DAYS: number; CONSECUTIVE_BEAT_BONUS: boolean }
  RBI: { HOLDING_DAYS_MIN: number; HOLDING_DAYS_MAX: number; STOP_LOSS_PCT: number; RATE_SENSITIVE_SECTORS: string[]; DEFENSIVE_SECTORS: string[]; RATE_CHANGE_SURPRISE_BPS: number; STANCE_SURPRISE: boolean }
  INDEX: { ANNOUNCEMENT_TO_EFFECTIVE_DAYS: number; ENTRY_WITHIN_DAYS: number; EXIT_DAYS_AFTER_EFFECTIVE: number; STOP_LOSS_PCT: number; EXPECTED_RETURN_LOW: number; EXPECTED_RETURN_HIGH: number; TARGET_INDICES: string[]; INDEX_IMPACT_MULTIPLIER: Record<string, number> }
  BULK: { MIN_STAKE_PCT: number; ENTRY_WITHIN_DAYS: number; HOLDING_DAYS: number; STOP_LOSS_BELOW_DEAL_PRICE: number; BUYER_TIERS: Record<string, { weight: number; label: string }>; MIN_BUYER_WEIGHT: number }
  MAX_CONCURRENT_POSITIONS: number; RISK_PER_TRADE_PCT: number; MAX_POSITION_PCT: number; MIN_AVG_TURNOVER_CR: number; MIN_PRICE: number
  TRADING_DAYS_PER_YEAR: number; RISK_FREE_RATE: number
}

// ============================== CONFIG ==============================
export const DEFAULT_ED_CONFIG: EDConfig = {
  EARNINGS: {
    SURPRISE_THRESHOLD: 0.10, VOLUME_MULTIPLIER: 3.0, VOLUME_AVG_PERIOD: 20,
    HOLDING_DAYS: 20, STOP_LOSS_BELOW_LOW: 0.05, MIN_GAP_UP_PCT: 0.0,
    MIN_CANDLE_BODY_RATIO: 0.5, EMA_FAST: 20, SMA_SLOW: 50,
    DRIFT_WINDOW_DAYS: 45, CONSECUTIVE_BEAT_BONUS: true,
  },
  RBI: {
    HOLDING_DAYS_MIN: 10, HOLDING_DAYS_MAX: 20, STOP_LOSS_PCT: 0.05,
    RATE_SENSITIVE_SECTORS: ['BANK', 'FINANCIAL', 'PSU_BANK', 'REALTY', 'AUTO', 'NBFC'],
    DEFENSIVE_SECTORS: ['PHARMA', 'IT', 'FMCG'],
    RATE_CHANGE_SURPRISE_BPS: 25, STANCE_SURPRISE: true,
  },
  INDEX: {
    ANNOUNCEMENT_TO_EFFECTIVE_DAYS: 20, ENTRY_WITHIN_DAYS: 2,
    EXIT_DAYS_AFTER_EFFECTIVE: 1, STOP_LOSS_PCT: 0.08,
    EXPECTED_RETURN_LOW: 0.03, EXPECTED_RETURN_HIGH: 0.08,
    TARGET_INDICES: ['NIFTY50', 'NIFTY_NEXT50', 'MSCI_INDIA', 'NIFTY200'],
    INDEX_IMPACT_MULTIPLIER: { NIFTY50: 1.5, NIFTY_NEXT50: 1.2, MSCI_INDIA: 1.3, NIFTY200: 0.8 },
  },
  BULK: {
    MIN_STAKE_PCT: 0.5, ENTRY_WITHIN_DAYS: 2, HOLDING_DAYS: 20,
    STOP_LOSS_BELOW_DEAL_PRICE: 0.03, MIN_BUYER_WEIGHT: 1.5,
    BUYER_TIERS: {
      PROMOTER: { weight: 3, label: 'Promoter stake increase' },
      FII: { weight: 2.5, label: 'Foreign Institutional Investor' },
      MF: { weight: 2, label: 'Domestic Mutual Fund' },
      PE: { weight: 2, label: 'Private Equity / VC' },
      DII: { weight: 1.5, label: 'Domestic Institutional' },
      HNI: { weight: 1, label: 'High Net Worth Individual' },
      UNKNOWN: { weight: 0.5, label: 'Unknown / Retail' },
    },
  },
  MAX_CONCURRENT_POSITIONS: 10, RISK_PER_TRADE_PCT: 0.02, MAX_POSITION_PCT: 0.15,
  MIN_AVG_TURNOVER_CR: 5, MIN_PRICE: 50,
  TRADING_DAYS_PER_YEAR: 252, RISK_FREE_RATE: 0.065,
}

const CONFIG = DEFAULT_ED_CONFIG

// ============================== UTILITY ==============================
export function r2(n: number | null | undefined): any { return n !== null && n !== undefined && !isNaN(n) ? Math.round(n * 100) / 100 : null }

// ============================== SHARED INDICATORS ==============================
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

export function calcAvgVolume(volumes: number[] | null | undefined, period: number): number | null {
  if (!volumes || volumes.length < period) return null
  const slice = volumes.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / slice.length
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

export function calcReturn(prices: number[] | null | undefined, lookback: number): number | null {
  if (!prices || prices.length < lookback + 1) return null
  const curr = prices[prices.length - 1]; const prev = prices[prices.length - 1 - lookback]
  return prev && prev !== 0 ? (curr / prev) - 1 : null
}

// ============================== STRATEGY A: EARNINGS SURPRISE (PEAD) ==============================
export function analyzeEarningsSurprise(earningsData: any, priceData: any): any {
  const { symbol, actualEPS, consensusEPS, previousEPS, consecutiveBeats, revenueActual, revenueEstimate } = earningsData
  const { opens, highs, lows, closes, volumes, earningsDayIndex } = priceData
  const idx = earningsDayIndex

  if (idx === undefined || idx === null || idx >= closes.length || idx < 1) {
    return { triggered: false, reason: 'Invalid earnings day index' }
  }

  const conditions: any[] = []; let score = 0; const totalConditions = 4

  // CONDITION 1: Earnings beat > 10%
  let surprisePct: number | null = null
  if (consensusEPS && consensusEPS !== 0) { surprisePct = (actualEPS - consensusEPS) / Math.abs(consensusEPS) }
  if (surprisePct !== null && surprisePct > CONFIG.EARNINGS.SURPRISE_THRESHOLD) {
    score++
    conditions.push({ name: 'EARNINGS_BEAT', met: true, detail: `Beat by ${r2(surprisePct * 100)}% (actual: ${actualEPS}, consensus: ${consensusEPS})` })
  } else {
    conditions.push({ name: 'EARNINGS_BEAT', met: false, detail: surprisePct !== null ? `Surprise only ${r2(surprisePct * 100)}% (need > ${CONFIG.EARNINGS.SURPRISE_THRESHOLD * 100}%)` : 'No consensus estimate available' })
  }

  // CONDITION 2: Strong candle on earnings day
  const earningsOpen = opens[idx]; const earningsHigh = highs[idx]; const earningsLow = lows[idx]; const earningsClose = closes[idx]; const prevClose = closes[idx - 1]
  const gapUpPct = (earningsOpen - prevClose) / prevClose
  const candleRange = earningsHigh - earningsLow; const candleBody = Math.abs(earningsClose - earningsOpen)
  const bodyRatio = candleRange > 0 ? candleBody / candleRange : 0
  const isBullishCandle = earningsClose > earningsOpen
  const closesNearHigh = candleRange > 0 ? (earningsClose - earningsLow) / candleRange : 0
  const strongCandle = isBullishCandle && bodyRatio >= CONFIG.EARNINGS.MIN_CANDLE_BODY_RATIO && closesNearHigh > 0.6

  if (strongCandle && gapUpPct >= CONFIG.EARNINGS.MIN_GAP_UP_PCT) {
    score++
    conditions.push({ name: 'STRONG_CANDLE', met: true, detail: `Bullish candle (body ratio: ${r2(bodyRatio)}, close near high: ${r2(closesNearHigh)}), gap: ${r2(gapUpPct * 100)}%` })
  } else {
    const reasons: string[] = []
    if (!isBullishCandle) reasons.push('bearish candle')
    if (bodyRatio < CONFIG.EARNINGS.MIN_CANDLE_BODY_RATIO) reasons.push(`weak body (${r2(bodyRatio)})`)
    if (gapUpPct < CONFIG.EARNINGS.MIN_GAP_UP_PCT) reasons.push(`gap down ${r2(gapUpPct * 100)}%`)
    conditions.push({ name: 'STRONG_CANDLE', met: false, detail: `Failed: ${reasons.join(', ')}` })
  }

  // CONDITION 3: Volume surge on earnings day
  const avgVol = calcAvgVolume(volumes.slice(0, idx), CONFIG.EARNINGS.VOLUME_AVG_PERIOD)
  const earningsVolume = volumes[idx]
  const volumeRatio = avgVol && avgVol > 0 ? earningsVolume / avgVol : null

  if (volumeRatio !== null && volumeRatio >= CONFIG.EARNINGS.VOLUME_MULTIPLIER) {
    score++
    conditions.push({ name: 'VOLUME_SURGE', met: true, detail: `Volume ${r2(volumeRatio)}× average (${earningsVolume.toLocaleString()} vs avg ${Math.round(avgVol!).toLocaleString()})` })
  } else {
    conditions.push({ name: 'VOLUME_SURGE', met: false, detail: `Volume only ${r2(volumeRatio)}× (need ≥ ${CONFIG.EARNINGS.VOLUME_MULTIPLIER}×)` })
  }

  // CONDITION 4: Pre-existing uptrend (20 EMA > 50 SMA)
  const ema20 = calcEMA(closes.slice(0, idx + 1), CONFIG.EARNINGS.EMA_FAST)
  const sma50 = calcSMA(closes.slice(0, idx + 1), CONFIG.EARNINGS.SMA_SLOW)
  const latestEma20 = ema20[ema20.length - 1]; const latestSma50 = sma50[sma50.length - 1]
  const inUptrend = latestEma20 !== null && latestSma50 !== null && latestEma20 > latestSma50

  if (inUptrend) {
    score++
    conditions.push({ name: 'UPTREND', met: true, detail: `20-EMA (₹${r2(latestEma20)}) > 50-SMA (₹${r2(latestSma50)})` })
  } else {
    conditions.push({ name: 'UPTREND', met: false, detail: `Not in uptrend: 20-EMA (₹${r2(latestEma20)}) vs 50-SMA (₹${r2(latestSma50)})` })
  }

  const triggered = score === totalConditions

  // QUALITY SCORING
  let qualityScore = 0; const qualityFactors: string[] = []
  if (surprisePct !== null) {
    if (surprisePct > 0.30) { qualityScore += 3; qualityFactors.push(`Massive beat: ${r2(surprisePct * 100)}%`) }
    else if (surprisePct > 0.20) { qualityScore += 2; qualityFactors.push(`Strong beat: ${r2(surprisePct * 100)}%`) }
    else if (surprisePct > 0.10) { qualityScore += 1; qualityFactors.push(`Moderate beat: ${r2(surprisePct * 100)}%`) }
  }
  if (consecutiveBeats && consecutiveBeats >= 3) { qualityScore += 2; qualityFactors.push(`${consecutiveBeats} consecutive quarterly beats — strong PEAD`) }
  else if (consecutiveBeats && consecutiveBeats >= 2) { qualityScore += 1; qualityFactors.push(`${consecutiveBeats} consecutive beats`) }
  if (revenueActual && revenueEstimate && revenueEstimate > 0) {
    const revSurprise = (revenueActual - revenueEstimate) / revenueEstimate
    if (revSurprise > 0.05) { qualityScore += 2; qualityFactors.push(`Revenue also beat by ${r2(revSurprise * 100)}% (double beat)`) }
  }
  if (volumeRatio !== null && volumeRatio > 5) { qualityScore += 1; qualityFactors.push(`Exceptional volume: ${r2(volumeRatio)}× average`) }
  if (previousEPS && previousEPS > 0 && actualEPS > 0) {
    const yoyGrowth = (actualEPS - previousEPS) / previousEPS
    if (yoyGrowth > 0.5) { qualityScore += 1; qualityFactors.push(`YoY EPS growth: ${r2(yoyGrowth * 100)}%`) }
  }

  // TRADE PARAMETERS
  let trade: any = null
  if (triggered) {
    const entryDayIdx = idx + 1
    const entryPrice = entryDayIdx < opens.length ? opens[entryDayIdx] : earningsClose
    const stopLoss = earningsLow * (1 - CONFIG.EARNINGS.STOP_LOSS_BELOW_LOW)
    const riskPerShare = entryPrice - stopLoss
    const targetEstimate = entryPrice * 1.08
    const riskReward = riskPerShare > 0 ? (targetEstimate - entryPrice) / riskPerShare : null
    trade = {
      entryPrice: r2(entryPrice), entryType: 'Next day open (day after earnings)',
      stopLoss: r2(stopLoss), stopMethod: `5% below earnings day low (₹${r2(earningsLow)})`,
      riskPerShare: r2(riskPerShare), holdingDays: CONFIG.EARNINGS.HOLDING_DAYS,
      riskReward: riskReward ? r2(riskReward) + ':1' : 'N/A',
      earningsDayData: { open: r2(earningsOpen), high: r2(earningsHigh), low: r2(earningsLow), close: r2(earningsClose), gapPct: r2(gapUpPct * 100) + '%', volumeRatio: r2(volumeRatio) },
    }
  }

  return {
    strategy: 'A_EARNINGS_SURPRISE', symbol, triggered, score, totalConditions, conditions,
    qualityScore, maxQualityScore: 9,
    qualityGrade: triggered ? qualityScore >= 7 ? 'A+' : qualityScore >= 5 ? 'A' : qualityScore >= 3 ? 'B' : 'C' : null,
    qualityFactors, surprisePct: surprisePct !== null ? r2(surprisePct * 100) + '%' : null, trade,
  }
}

// ============================== STRATEGY B: RBI POLICY EVENT ==============================
export function analyzeRBIEvent(rbiEvent: any, marketContext: any): any {
  const { date, rateDecisionBps, stanceActual, stanceExpected, rateExpectedBps, commentary, gdpProjection, inflationProjection } = rbiEvent
  const rateSurpriseBps = rateDecisionBps - (rateExpectedBps || 0)
  const stanceSurprise = stanceActual !== stanceExpected
  let surpriseDirection = 'NEUTRAL'; let surpriseMagnitude = 0

  if (rateSurpriseBps < -CONFIG.RBI.RATE_CHANGE_SURPRISE_BPS) { surpriseDirection = 'DOVISH_SURPRISE'; surpriseMagnitude += Math.abs(rateSurpriseBps) / 25 }
  else if (rateSurpriseBps > CONFIG.RBI.RATE_CHANGE_SURPRISE_BPS) { surpriseDirection = 'HAWKISH_SURPRISE'; surpriseMagnitude += Math.abs(rateSurpriseBps) / 25 }

  if (stanceSurprise) {
    surpriseMagnitude += 1
    const stanceMap: Record<string, number> = { DOVISH: -2, ACCOMMODATIVE: -1, NEUTRAL: 0, HAWKISH: 1, TIGHTENING: 2 }
    const actualVal = stanceMap[stanceActual] || 0; const expectedVal = stanceMap[stanceExpected] || 0
    if (actualVal < expectedVal) { surpriseDirection = surpriseDirection === 'NEUTRAL' ? 'DOVISH_SURPRISE' : surpriseDirection }
    else if (actualVal > expectedVal) { surpriseDirection = surpriseDirection === 'NEUTRAL' ? 'HAWKISH_SURPRISE' : surpriseDirection }
  }

  if (surpriseDirection === 'NEUTRAL' && rateDecisionBps === 0 && (rateExpectedBps || 0) < 0) { surpriseDirection = 'HAWKISH_SURPRISE'; surpriseMagnitude += 0.5 }
  else if (surpriseDirection === 'NEUTRAL' && rateDecisionBps === 0 && (rateExpectedBps || 0) > 0) { surpriseDirection = 'DOVISH_SURPRISE'; surpriseMagnitude += 0.5 }

  const isEvent = surpriseMagnitude > 0 || rateDecisionBps !== 0
  let targetSectors: string[] = []; let avoidSectors: string[] = []; let rationale = ''

  if (surpriseDirection === 'DOVISH_SURPRISE' || rateDecisionBps < 0) {
    targetSectors = CONFIG.RBI.RATE_SENSITIVE_SECTORS; avoidSectors = CONFIG.RBI.DEFENSIVE_SECTORS
    rationale = 'Dovish / rate cut → rate-sensitive sectors benefit (Banks, Auto, Realty)'
  } else if (surpriseDirection === 'HAWKISH_SURPRISE' || rateDecisionBps > 0) {
    targetSectors = CONFIG.RBI.DEFENSIVE_SECTORS; avoidSectors = CONFIG.RBI.RATE_SENSITIVE_SECTORS
    rationale = 'Hawkish / rate hike → defensive sectors (Pharma, IT, FMCG)'
  } else { rationale = 'Neutral RBI — continue with sector momentum' }

  const stockPicks: any[] = []
  if (marketContext && marketContext.currentStocksByCategory) {
    const categoryKey = surpriseDirection.includes('DOVISH') || rateDecisionBps < 0 ? 'rate_sensitive' : 'defensive'
    const candidates = marketContext.currentStocksByCategory[categoryKey] || []
    for (const stock of candidates) {
      if (!stock.prices || stock.prices.length < 50) continue
      const momentum = calcReturn(stock.prices, 22); const vol = calcVolatility(stock.prices)
      stockPicks.push({ symbol: stock.symbol, sector: stock.sector, momentum1M: momentum !== null ? r2(momentum * 100) + '%' : null, volatility: vol !== null ? r2(vol * 100) + '%' : null, currentPrice: r2(stock.prices[stock.prices.length - 1]) })
    }
    stockPicks.sort((a, b) => parseFloat(b.momentum1M) - parseFloat(a.momentum1M))
  }

  let confidence = 'LOW'
  if (surpriseMagnitude >= 2) confidence = 'HIGH'
  else if (surpriseMagnitude >= 1) confidence = 'MODERATE'
  else if (surpriseMagnitude > 0) confidence = 'LOW'
  else confidence = 'VERY_LOW'

  const holdingDays = confidence === 'HIGH' ? CONFIG.RBI.HOLDING_DAYS_MAX : CONFIG.RBI.HOLDING_DAYS_MIN

  return {
    strategy: 'B_RBI_POLICY', date, triggered: isEvent && targetSectors.length > 0,
    surpriseDirection, surpriseMagnitude: r2(surpriseMagnitude), confidence, rationale,
    eventDetails: {
      rateDecision: `${rateDecisionBps >= 0 ? '+' : ''}${rateDecisionBps}bps`, stance: stanceActual,
      stanceSurprise: stanceSurprise ? `Expected ${stanceExpected}, got ${stanceActual}` : 'As expected',
      rateSurprise: `${rateSurpriseBps >= 0 ? '+' : ''}${rateSurpriseBps}bps vs expectation`,
      gdpProjection, inflationProjection,
    },
    allocation: { targetSectors, avoidSectors, holdingDays, stopLossPct: CONFIG.RBI.STOP_LOSS_PCT * 100 + '%' },
    stockPicks: stockPicks.slice(0, 6),
  }
}

// ============================== STRATEGY C: INDEX REBALANCING ==============================
export function analyzeIndexRebalancing(rebalanceEvent: any, stockPriceData: any): any {
  const { announcementDate, effectiveDate, index, additions, deletions, estimatedPassiveFunds } = rebalanceEvent
  const announceDt = new Date(announcementDate); const effectiveDt = new Date(effectiveDate)
  const daysToEffective = Math.round((effectiveDt.getTime() - announceDt.getTime()) / (1000 * 60 * 60 * 24))
  const impactMultiplier = CONFIG.INDEX.INDEX_IMPACT_MULTIPLIER[index] || 1.0

  const additionSignals: any[] = []
  for (const addition of (additions || [])) {
    const stockData = stockPriceData[addition.symbol]
    if (!stockData || !stockData.prices || stockData.prices.length < 50) {
      additionSignals.push({ symbol: addition.symbol, triggered: false, reason: 'Insufficient price data' }); continue
    }
    const prices = stockData.prices; const volumes = stockData.volumes || []
    const currentPrice = prices[prices.length - 1]; const avgVol = calcAvgVolume(volumes, 20)
    const vol = calcVolatility(prices); const momentum1M = calcReturn(prices, 22)
    const atr = calcATR(stockData.highs || prices.map((p: number) => p * 1.01), stockData.lows || prices.map((p: number) => p * 0.99), prices, 14)
    const latestATR = atr.filter(a => a !== null).pop() || 0
    const estimatedDemand = estimatedPassiveFunds && addition.expectedWeight ? estimatedPassiveFunds * (addition.expectedWeight / 100) : null
    const avgTurnoverCr = stockData.avgDailyTurnoverCr || 10
    const daysOfDemand = estimatedDemand ? estimatedDemand / avgTurnoverCr : null

    let signalScore = 0; const factors: string[] = []
    if (impactMultiplier >= 1.3) { signalScore += 2; factors.push(`Major index (${index}) — high passive tracking`) }
    else { signalScore += 1; factors.push(`Index: ${index}`) }
    if (daysOfDemand !== null && daysOfDemand > 5) { signalScore += 3; factors.push(`Estimated demand = ${r2(daysOfDemand)} days of avg volume — massive buying pressure`) }
    else if (daysOfDemand !== null && daysOfDemand > 2) { signalScore += 2; factors.push(`Estimated demand = ${r2(daysOfDemand)} days of avg volume`) }
    if (momentum1M !== null && momentum1M > 0) { signalScore += 1; factors.push(`Already has positive momentum (${r2(momentum1M * 100)}% 1M)`) }
    if (daysToEffective >= 15 && daysToEffective <= 30) { signalScore += 1; factors.push(`${daysToEffective} days to effective — ideal window`) }

    const entryPrice = currentPrice; const stopLoss = entryPrice * (1 - CONFIG.INDEX.STOP_LOSS_PCT)
    additionSignals.push({
      symbol: addition.symbol, action: 'BUY', triggered: signalScore >= 3, signalScore, maxScore: 7, factors,
      trade: { entryPrice: r2(entryPrice), stopLoss: r2(stopLoss), stopPct: CONFIG.INDEX.STOP_LOSS_PCT * 100 + '%', targetExitDate: effectiveDate, exitDaysAfterEffective: CONFIG.INDEX.EXIT_DAYS_AFTER_EFFECTIVE, holdingDaysEstimate: daysToEffective + CONFIG.INDEX.EXIT_DAYS_AFTER_EFFECTIVE, expectedReturn: `${CONFIG.INDEX.EXPECTED_RETURN_LOW * 100}-${CONFIG.INDEX.EXPECTED_RETURN_HIGH * 100}%` },
      analysis: { expectedWeight: addition.expectedWeight, estimatedDemandCr: estimatedDemand ? r2(estimatedDemand) + ' cr' : 'N/A', daysOfDemand: daysOfDemand ? r2(daysOfDemand) : 'N/A', impactMultiplier, currentVolatility: vol ? r2(vol * 100) + '%' : null, atr: r2(latestATR as number) },
    })
  }

  const deletionSignals: any[] = []
  for (const deletion of (deletions || [])) {
    const stockData = stockPriceData[deletion.symbol]; if (!stockData) continue
    const prices = stockData.prices || []; const currentPrice = prices.length > 0 ? prices[prices.length - 1] : null
    deletionSignals.push({ symbol: deletion.symbol, action: 'AVOID', note: 'Being removed from index — passive selling pressure expected', currentPrice: r2(currentPrice) })
  }

  return {
    strategy: 'C_INDEX_REBALANCING', announcementDate, effectiveDate, index, daysToEffective,
    additionSignals: additionSignals.sort((a, b) => (b.signalScore || 0) - (a.signalScore || 0)), deletionSignals,
    totalAdditions: (additions || []).length, totalDeletions: (deletions || []).length,
    triggeredCount: additionSignals.filter(s => s.triggered).length,
  }
}

// ============================== STRATEGY D: BULK/BLOCK DEAL ==============================
export function analyzeBulkDeal(dealData: any, stockData: any): any {
  const { symbol, date, dealType, buyerName, buyerCategory, quantityShares, pricePerShare, stakePct, totalDealValueCr } = dealData
  const buyerTier = CONFIG.BULK.BUYER_TIERS[buyerCategory] || CONFIG.BULK.BUYER_TIERS.UNKNOWN

  const conditions: any[] = []; let score = 0; const totalConditions = 4

  // CONDITION 1: Stake >= 0.5%
  if (stakePct >= CONFIG.BULK.MIN_STAKE_PCT) {
    score++; conditions.push({ name: 'SIGNIFICANT_STAKE', met: true, detail: `Acquired ${r2(stakePct)}% of equity (${quantityShares.toLocaleString()} shares @ ₹${r2(pricePerShare)})` })
  } else { conditions.push({ name: 'SIGNIFICANT_STAKE', met: false, detail: `Only ${r2(stakePct)}% stake (need ≥ ${CONFIG.BULK.MIN_STAKE_PCT}%)` }) }

  // CONDITION 2: Buyer is institutional
  const isSmartMoney = buyerTier.weight >= CONFIG.BULK.MIN_BUYER_WEIGHT
  if (isSmartMoney) {
    score++; conditions.push({ name: 'SMART_MONEY_BUYER', met: true, detail: `${buyerTier.label}: ${buyerName} (tier weight: ${buyerTier.weight})` })
  } else { conditions.push({ name: 'SMART_MONEY_BUYER', met: false, detail: `${buyerTier.label}: ${buyerName} — not high-conviction institutional buyer` }) }

  // CONDITION 3: Deal price vs market
  let dealPriceVsMarket: number | null = null
  if (stockData.prices && stockData.prices.length > 0) {
    const currentPrice = stockData.prices[stockData.prices.length - 1]
    dealPriceVsMarket = (pricePerShare - currentPrice) / currentPrice
    if (dealPriceVsMarket >= -0.02) {
      score++; conditions.push({ name: 'PRICE_CONVICTION', met: true, detail: `Deal price ₹${r2(pricePerShare)} vs market ₹${r2(currentPrice)} (${r2(dealPriceVsMarket * 100)}%)` })
    } else { conditions.push({ name: 'PRICE_CONVICTION', met: false, detail: `Deal at ${r2(dealPriceVsMarket * 100)}% discount — possible distressed sale` }) }
  } else { conditions.push({ name: 'PRICE_CONVICTION', met: false, detail: 'No market price data available' }) }

  // CONDITION 4: Liquidity
  const isLiquid = stockData.avgDailyTurnoverCr != null && stockData.avgDailyTurnoverCr >= CONFIG.MIN_AVG_TURNOVER_CR
  if (isLiquid) {
    score++; conditions.push({ name: 'LIQUIDITY', met: true, detail: `Avg turnover ₹${stockData.avgDailyTurnoverCr}cr` })
  } else { conditions.push({ name: 'LIQUIDITY', met: false, detail: `Avg turnover ₹${stockData.avgDailyTurnoverCr || 0}cr < ₹${CONFIG.MIN_AVG_TURNOVER_CR}cr` }) }

  const triggered = score >= 3 && isSmartMoney

  // QUALITY SCORING
  let qualityScore = 0; const qualityFactors: string[] = []
  qualityScore += Math.min(buyerTier.weight, 3); qualityFactors.push(`Buyer tier: ${buyerTier.label} (${buyerTier.weight}/3)`)
  if (stakePct >= 5) { qualityScore += 3; qualityFactors.push(`Large stake: ${r2(stakePct)}% — very high conviction`) }
  else if (stakePct >= 2) { qualityScore += 2; qualityFactors.push(`Meaningful stake: ${r2(stakePct)}%`) }
  else if (stakePct >= 1) { qualityScore += 1; qualityFactors.push(`Moderate stake: ${r2(stakePct)}%`) }
  if (buyerCategory === 'PROMOTER') { qualityScore += 2; qualityFactors.push('Promoter buying — strongest insider signal') }
  if (totalDealValueCr && stockData.avgDailyTurnoverCr) {
    const dealToTurnover = totalDealValueCr / stockData.avgDailyTurnoverCr
    if (dealToTurnover > 3) { qualityScore += 1; qualityFactors.push(`Deal = ${r2(dealToTurnover)}× daily turnover — significant impact`) }
  }

  // TRADE PARAMETERS
  let trade: any = null
  if (triggered && stockData.prices && stockData.prices.length > 0) {
    const currentPrice = stockData.prices[stockData.prices.length - 1]
    const entryPrice = currentPrice; const stopLoss = pricePerShare * (1 - CONFIG.BULK.STOP_LOSS_BELOW_DEAL_PRICE)
    const riskPerShare = entryPrice - stopLoss; const riskReward = riskPerShare > 0 ? (entryPrice * 0.08) / riskPerShare : null
    trade = {
      entryPrice: r2(entryPrice), entryWindow: `Within ${CONFIG.BULK.ENTRY_WITHIN_DAYS} days of deal`,
      stopLoss: r2(stopLoss), stopMethod: `3% below bulk deal price (₹${r2(pricePerShare)})`,
      holdingDays: CONFIG.BULK.HOLDING_DAYS, riskReward: riskReward ? r2(riskReward) + ':1' : 'N/A', dealPrice: r2(pricePerShare),
    }
  }

  return {
    strategy: 'D_BULK_DEAL', symbol, dealDate: date, dealType, triggered, score, totalConditions, conditions,
    qualityScore, maxQualityScore: 9,
    qualityGrade: triggered ? qualityScore >= 7 ? 'A+' : qualityScore >= 5 ? 'A' : qualityScore >= 3 ? 'B' : 'C' : null,
    qualityFactors,
    dealDetails: { buyer: buyerName, buyerCategory, buyerTier: buyerTier.label, stakePct: r2(stakePct) + '%', quantity: quantityShares.toLocaleString(), pricePerShare: r2(pricePerShare), totalValueCr: r2(totalDealValueCr) + ' cr' },
    trade,
  }
}

// ============================== UNIFIED EVENT SCANNER ==============================
export function scanAllEvents(eventData: any, marketData: any, currentDate: string | null = null): any {
  const signals: any = { earnings: [], rbi: [], indexRebalancing: [], bulkDeals: [] }

  if (eventData.earnings) {
    for (const earnings of eventData.earnings) {
      const stockDataItem = marketData.stocks[earnings.symbol]; if (!stockDataItem) continue
      const signal = analyzeEarningsSurprise(earnings, stockDataItem)
      if (signal.triggered) signals.earnings.push(signal)
    }
    signals.earnings.sort((a: any, b: any) => b.qualityScore - a.qualityScore)
  }

  if (eventData.rbiEvents) {
    for (const rbiEvent of eventData.rbiEvents) {
      const signal = analyzeRBIEvent(rbiEvent, marketData)
      if (signal.triggered) signals.rbi.push(signal)
    }
  }

  if (eventData.indexRebalances) {
    for (const rebalEvent of eventData.indexRebalances) {
      const signal = analyzeIndexRebalancing(rebalEvent, marketData.stocks)
      if (signal.triggeredCount > 0) signals.indexRebalancing.push(signal)
    }
  }

  if (eventData.bulkDeals) {
    for (const deal of eventData.bulkDeals) {
      const stockDataItem = marketData.stocks[deal.symbol] || {}
      const signal = analyzeBulkDeal(deal, stockDataItem)
      if (signal.triggered) signals.bulkDeals.push(signal)
    }
    signals.bulkDeals.sort((a: any, b: any) => b.qualityScore - a.qualityScore)
  }

  const totalSignals = signals.earnings.length + signals.rbi.length + signals.indexRebalancing.reduce((s: number, r: any) => s + r.triggeredCount, 0) + signals.bulkDeals.length

  return {
    date: currentDate, totalSignals,
    summary: { earningsSignals: signals.earnings.length, rbiSignals: signals.rbi.length, indexSignals: signals.indexRebalancing.reduce((s: number, r: any) => s + r.triggeredCount, 0), bulkDealSignals: signals.bulkDeals.length },
    signals,
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
    riskPctOfCapital: r2((shares * riskPerShare / capital) * 100) + '%',
    positionPctOfCapital: r2((shares * entryPrice / capital) * 100) + '%',
  }
}

// ============================== EXIT MONITORING ==============================
export function monitorPosition(position: any): any {
  const { strategy, entryPrice, stopLoss, daysSinceEntry, maxHoldingDays, closesAfterEntry, lowsAfterEntry } = position
  if (!closesAfterEntry || closesAfterEntry.length === 0) return { action: 'HOLD', reason: 'No data yet' }

  const currentClose = closesAfterEntry[closesAfterEntry.length - 1]
  const currentLow = lowsAfterEntry[lowsAfterEntry.length - 1]
  const pnlPct = (currentClose / entryPrice) - 1

  // 1. STOP-LOSS
  if (currentLow <= stopLoss) {
    return { action: 'EXIT', reason: 'STOP_LOSS_HIT', exitPrice: stopLoss, pnlPct: (stopLoss / entryPrice) - 1, daysSinceEntry }
  }

  // 2. STRATEGY-SPECIFIC EXITS
  if (strategy === 'A' && daysSinceEntry >= CONFIG.EARNINGS.HOLDING_DAYS) {
    return { action: 'EXIT', reason: 'PEAD_HOLDING_COMPLETE', exitPrice: currentClose, pnlPct, daysSinceEntry, note: `${CONFIG.EARNINGS.HOLDING_DAYS}-day PEAD holding period complete` }
  }
  if (strategy === 'B' && daysSinceEntry >= (maxHoldingDays || CONFIG.RBI.HOLDING_DAYS_MAX)) {
    return { action: 'EXIT', reason: 'RBI_HOLDING_COMPLETE', exitPrice: currentClose, pnlPct, daysSinceEntry }
  }
  if (strategy === 'C' && position.effectiveDate) {
    const today = position.currentDate ? new Date(position.currentDate) : new Date()
    const effective = new Date(position.effectiveDate)
    const daysPast = Math.round((today.getTime() - effective.getTime()) / (1000 * 60 * 60 * 24))
    if (daysPast >= CONFIG.INDEX.EXIT_DAYS_AFTER_EFFECTIVE) {
      return { action: 'EXIT', reason: 'INDEX_EFFECTIVE_DATE_PASSED', exitPrice: currentClose, pnlPct, daysSinceEntry, note: `${daysPast} days past effective date — passive buying complete` }
    }
  }
  if (strategy === 'D' && daysSinceEntry >= CONFIG.BULK.HOLDING_DAYS) {
    return { action: 'EXIT', reason: 'BULK_DEAL_HOLDING_COMPLETE', exitPrice: currentClose, pnlPct, daysSinceEntry }
  }

  // 3. ABSOLUTE MAX HOLDING
  const absMax = maxHoldingDays || 25
  if (daysSinceEntry >= absMax) {
    return { action: 'EXIT', reason: 'MAX_HOLDING_PERIOD', exitPrice: currentClose, pnlPct, daysSinceEntry }
  }

  // 4. TRAILING PROFIT PROTECTION
  if (pnlPct > 0.10 && closesAfterEntry.length >= 3) {
    const highestClose = Math.max(...closesAfterEntry)
    const trailLevel = entryPrice + (highestClose - entryPrice) * 0.5
    if (currentClose < trailLevel) {
      return { action: 'EXIT', reason: 'TRAILING_PROFIT_PROTECTION', exitPrice: currentClose, pnlPct, daysSinceEntry, note: `Was up to ₹${r2(highestClose)}, protecting 50% of gains` }
    }
  }

  return {
    action: 'HOLD', daysSinceEntry, pnlPct, currentPrice: r2(currentClose), stopLoss: r2(stopLoss),
    distanceToStop: r2(((currentClose - stopLoss) / currentClose) * 100) + '%',
    daysRemaining: (maxHoldingDays || absMax) - daysSinceEntry,
  }
}

// ============================== BACKTEST ENGINE ==============================
export function runBacktest(historicalEvents: any, priceData: any, dates: string[], capitalBase = 10000000): any {
  let capital = capitalBase; const openPositions: any[] = []; const closedTrades: any[] = []; const equityCurve: any[] = []
  let peakEquity = capitalBase; let maxDrawdown = 0
  const dateIndex: Record<string, number> = {}; dates.forEach((d, i) => { dateIndex[d] = i })

  for (const event of historicalEvents.events) {
    const eventDateIdx = dateIndex[event.date]; if (eventDateIdx === undefined) continue

    // Check existing positions
    const toClose: number[] = []
    for (let p = 0; p < openPositions.length; p++) {
      const pos = openPositions[p]; pos.daysSinceEntry++
      const stockPrices = priceData[pos.symbol]
      if (!stockPrices || eventDateIdx >= stockPrices.closes.length) continue
      pos.closesAfterEntry.push(stockPrices.closes[eventDateIdx])
      pos.lowsAfterEntry.push(stockPrices.lows ? stockPrices.lows[eventDateIdx] : stockPrices.closes[eventDateIdx])
      const exitCheck = monitorPosition(pos)
      if (exitCheck.action === 'EXIT') {
        const exitPrice = exitCheck.exitPrice; const pnl = (exitPrice - pos.entryPrice) * pos.shares
        capital += exitPrice * pos.shares
        closedTrades.push({ symbol: pos.symbol, strategy: pos.strategy, eventType: pos.eventType, entryDate: pos.entryDate, exitDate: event.date, entryPrice: r2(pos.entryPrice), exitPrice: r2(exitPrice), shares: pos.shares, pnl: Math.round(pnl), pnlPct: r2(((exitPrice / pos.entryPrice) - 1) * 100) + '%', holdingDays: pos.daysSinceEntry, exitReason: exitCheck.reason, qualityGrade: pos.qualityGrade || null })
        toClose.push(p)
      }
    }
    for (let i = toClose.length - 1; i >= 0; i--) openPositions.splice(toClose[i], 1)

    if (openPositions.length >= CONFIG.MAX_CONCURRENT_POSITIONS) { updateEquity(); continue }

    let signal: any = null
    if (event.type === 'EARNINGS') {
      const stockPrices = priceData[event.symbol]
      if (stockPrices) {
        signal = analyzeEarningsSurprise(event, { ...stockPrices, earningsDayIndex: eventDateIdx })
        if (signal.triggered && signal.trade) { signal._entrySymbol = event.symbol; signal._strategy = 'A'; signal._eventType = 'EARNINGS'; signal._entryPrice = signal.trade.entryPrice; signal._stopLoss = signal.trade.stopLoss; signal._maxHold = CONFIG.EARNINGS.HOLDING_DAYS }
      }
    } else if (event.type === 'BULK') {
      const stockPrices = priceData[event.symbol] || {}
      signal = analyzeBulkDeal(event, stockPrices)
      if (signal.triggered && signal.trade) { signal._entrySymbol = event.symbol; signal._strategy = 'D'; signal._eventType = 'BULK_DEAL'; signal._entryPrice = signal.trade.entryPrice; signal._stopLoss = signal.trade.stopLoss; signal._maxHold = CONFIG.BULK.HOLDING_DAYS }
    } else if (event.type === 'INDEX') {
      const rebalSignal = analyzeIndexRebalancing(event, priceData)
      for (const addition of rebalSignal.additionSignals.filter((a: any) => a.triggered)) {
        if (openPositions.length >= CONFIG.MAX_CONCURRENT_POSITIONS) break
        if (openPositions.some((p: any) => p.symbol === addition.symbol)) continue
        const ep = addition.trade.entryPrice; const sl = addition.trade.stopLoss
        const sizing = calcPositionSize(capital, ep, sl)
        if (sizing.shares > 0) {
          capital -= sizing.positionValue
          openPositions.push({ symbol: addition.symbol, strategy: 'C', eventType: 'INDEX_REBALANCE', entryDate: event.date, entryPrice: ep, stopLoss: sl, shares: sizing.shares, daysSinceEntry: 0, maxHoldingDays: addition.trade.holdingDaysEstimate || 25, effectiveDate: event.effectiveDate, closesAfterEntry: [], lowsAfterEntry: [] })
        }
      }
      updateEquity(); continue
    }

    if (signal && signal.triggered && signal._entrySymbol) {
      const sym = signal._entrySymbol
      if (openPositions.some((p: any) => p.symbol === sym)) { updateEquity(); continue }
      const ep = parseFloat(signal._entryPrice); const sl = parseFloat(signal._stopLoss)
      if (isNaN(ep) || isNaN(sl) || ep <= 0) { updateEquity(); continue }
      const sizing = calcPositionSize(capital, ep, sl)
      if (sizing.shares <= 0) { updateEquity(); continue }
      capital -= sizing.positionValue
      openPositions.push({ symbol: sym, strategy: signal._strategy, eventType: signal._eventType, entryDate: event.date, entryPrice: ep, stopLoss: sl, shares: sizing.shares, daysSinceEntry: 0, maxHoldingDays: signal._maxHold, qualityGrade: signal.qualityGrade || null, closesAfterEntry: [], lowsAfterEntry: [] })
    }

    updateEquity()

    function updateEquity() {
      let openValue = 0
      for (const pos of openPositions) {
        const sp = priceData[pos.symbol]
        if (sp && eventDateIdx < sp.closes.length) openValue += sp.closes[eventDateIdx] * pos.shares
      }
      const totalEquity = capital + openValue
      if (totalEquity > peakEquity) peakEquity = totalEquity
      const dd = peakEquity > 0 ? (peakEquity - totalEquity) / peakEquity : 0
      if (dd > maxDrawdown) maxDrawdown = dd
      equityCurve.push({ date: event.date, totalEquity: Math.round(totalEquity), positions: openPositions.length, drawdown: r2(dd * 100) + '%' })
    }
  }

  // Force-close remaining
  for (const pos of openPositions) {
    const sp = priceData[pos.symbol]; const exitPrice = sp ? sp.closes[sp.closes.length - 1] : pos.entryPrice
    const pnl = (exitPrice - pos.entryPrice) * pos.shares; capital += exitPrice * pos.shares
    closedTrades.push({ symbol: pos.symbol, strategy: pos.strategy, eventType: pos.eventType, entryDate: pos.entryDate, exitDate: 'FORCED', entryPrice: r2(pos.entryPrice), exitPrice: r2(exitPrice), shares: pos.shares, pnl: Math.round(pnl), pnlPct: r2(((exitPrice / pos.entryPrice) - 1) * 100) + '%', holdingDays: pos.daysSinceEntry, exitReason: 'BACKTEST_END' })
  }

  return buildBacktestAnalytics(closedTrades, equityCurve, capitalBase, capital, maxDrawdown)
}

// ============================== ANALYTICS ==============================
function buildBacktestAnalytics(trades: any[], equityCurve: any[], capitalBase: number, finalCapital: number, maxDrawdown: number): any {
  const total = trades.length; const winners = trades.filter(t => t.pnl > 0); const losers = trades.filter(t => t.pnl <= 0)
  const winRate = total > 0 ? winners.length / total : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / losers.length) : 0
  const avgHold = total > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / total : 0
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity
  const totalReturn = (finalCapital / capitalBase) - 1
  const years = equityCurve.length > 1 ? (new Date(equityCurve[equityCurve.length - 1].date).getTime() - new Date(equityCurve[0].date).getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 1
  const cagr = years > 0 ? Math.pow(finalCapital / capitalBase, 1 / years) - 1 : 0
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss)

  // By strategy
  const byStrategy: any = {}
  const strategyNames: Record<string, string> = { A: 'Earnings PEAD', B: 'RBI Policy', C: 'Index Rebalance', D: 'Bulk Deal' }
  for (const strat of ['A', 'B', 'C', 'D']) {
    const subset = trades.filter(t => t.strategy === strat)
    if (subset.length === 0) { byStrategy[strategyNames[strat]] = { trades: 0 }; continue }
    const w = subset.filter(t => t.pnl > 0)
    byStrategy[strategyNames[strat]] = { trades: subset.length, winRate: r2((w.length / subset.length) * 100) + '%', avgPnlPct: r2(subset.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / subset.length) + '%', totalPnl: Math.round(subset.reduce((s, t) => s + t.pnl, 0)), avgHoldingDays: r2(subset.reduce((s, t) => s + t.holdingDays, 0) / subset.length) }
  }

  // By exit reason
  const byExitReason: any = {}; const exitGroups: Record<string, any[]> = {}
  for (const t of trades) { if (!exitGroups[t.exitReason]) exitGroups[t.exitReason] = []; exitGroups[t.exitReason].push(t) }
  for (const [reason, list] of Object.entries(exitGroups)) {
    const w = list.filter(t => t.pnl > 0)
    byExitReason[reason] = { count: list.length, winRate: r2((w.length / list.length) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / list.length) + '%' }
  }

  // By quality grade
  const gradeGroups: Record<string, any[]> = {}
  for (const t of trades) { const g = t.qualityGrade || 'Ungraded'; if (!gradeGroups[g]) gradeGroups[g] = []; gradeGroups[g].push(t) }
  const byQualityGrade: any = {}
  for (const [grade, list] of Object.entries(gradeGroups)) {
    const w = list.filter(t => t.pnl > 0)
    byQualityGrade[grade] = { count: list.length, winRate: r2((w.length / list.length) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / list.length) + '%' }
  }

  // Streaks
  let maxWin = 0, maxLose = 0, curWin = 0, curLose = 0
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLose = 0; maxWin = Math.max(maxWin, curWin) }
    else { curLose++; curWin = 0; maxLose = Math.max(maxLose, curLose) }
  }

  return {
    summary: { startingCapital: capitalBase, endingCapital: Math.round(finalCapital), totalReturn: r2(totalReturn * 100) + '%', cagr: r2(cagr * 100) + '%', totalTrades: total, winRate: r2(winRate * 100) + '%', avgWinPct: r2(avgWin) + '%', avgLossPct: r2(avgLoss) + '%', winLossRatio: avgLoss > 0 ? r2(avgWin / avgLoss) : 'N/A', profitFactor: profitFactor !== Infinity ? r2(profitFactor) : 'N/A', expectancyPerTrade: r2(expectancy) + '%', maxDrawdown: r2(maxDrawdown * 100) + '%', avgHoldingDays: r2(avgHold), maxWinStreak: maxWin, maxLoseStreak: maxLose },
    byStrategy, byExitReason, byQualityGrade,
    topWinners: [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(t => ({ symbol: t.symbol, strategy: t.strategy, pnlPct: t.pnlPct, holdingDays: t.holdingDays, exitReason: t.exitReason })),
    topLosers: [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(t => ({ symbol: t.symbol, strategy: t.strategy, pnlPct: t.pnlPct, holdingDays: t.holdingDays, exitReason: t.exitReason })),
    trades, equityCurve,
  }
}

// ============================== EVENT CALENDAR UTILITIES ==============================
export function generateRBICalendar(year: number): any[] {
  const months = [{ month: 2, label: 'February' }, { month: 4, label: 'April' }, { month: 6, label: 'June' }, { month: 8, label: 'August' }, { month: 10, label: 'October' }, { month: 12, label: 'December' }]
  return months.map(m => ({ date: `${year}-${String(m.month).padStart(2, '0')}-07`, label: `RBI MPC — ${m.label} ${year}`, type: 'RBI_MPC', prePolicyWindow: 3, postPolicyWindow: 20 }))
}

export function getEarningsSeasonDates(year: number): any[] {
  return [
    { quarter: 'Q3', startDate: `${year}-01-15`, endDate: `${year}-02-28`, label: `Q3 FY${year} Results` },
    { quarter: 'Q4', startDate: `${year}-04-15`, endDate: `${year}-05-31`, label: `Q4 FY${year} Results` },
    { quarter: 'Q1', startDate: `${year}-07-15`, endDate: `${year}-08-31`, label: `Q1 FY${year + 1} Results` },
    { quarter: 'Q2', startDate: `${year}-10-15`, endDate: `${year}-11-30`, label: `Q2 FY${year + 1} Results` },
  ]
}

export function getIndexRebalanceDates(year: number): any[] {
  return [
    { date: `${year}-03-15`, index: 'NIFTY50', label: 'Nifty Semi-Annual Rebalance', announcementOffset: -28 },
    { date: `${year}-09-15`, index: 'NIFTY50', label: 'Nifty Semi-Annual Rebalance', announcementOffset: -28 },
    { date: `${year}-02-28`, index: 'MSCI_INDIA', label: 'MSCI Quarterly Review', announcementOffset: -14 },
    { date: `${year}-05-31`, index: 'MSCI_INDIA', label: 'MSCI Quarterly Review', announcementOffset: -14 },
    { date: `${year}-08-31`, index: 'MSCI_INDIA', label: 'MSCI Quarterly Review', announcementOffset: -14 },
    { date: `${year}-11-30`, index: 'MSCI_INDIA', label: 'MSCI Quarterly Review', announcementOffset: -14 },
  ]
}
