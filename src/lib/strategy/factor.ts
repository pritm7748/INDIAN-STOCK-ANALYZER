// Factor-Based / Quantitative Stock Selection — Indian Markets (NSE)
// Multi-factor composite: Momentum + Value + Quality + Earnings Revision

// ============================== TYPES ==============================
export interface FactorConfig {
  WEIGHTS: { MOMENTUM: number; VALUE: number; QUALITY: number; EARNINGS_REVISION: number }
  MOMENTUM: {
    LOOKBACK_1M: number; LOOKBACK_3M: number; LOOKBACK_6M: number; LOOKBACK_12M: number
    WEIGHT_1M: number; WEIGHT_3M: number; WEIGHT_6M: number; WEIGHT_12M: number
    SKIP_RECENT_DAYS: number
  }
  VALUE: {
    METRICS: Record<string, { weight: number; direction: string; cap?: number | null; floor?: number }>
    EXCLUDE_NEGATIVE_EARNINGS: boolean
  }
  QUALITY: {
    METRICS: Record<string, { weight: number; direction: string; cap?: number; minThreshold?: number }>
    MIN_ROE: number; MAX_DEBT_TO_EQUITY: number; MIN_YEARS_POSITIVE_EARNINGS: number
  }
  EARNINGS_REVISION: {
    LOOKBACK_DAYS: number
    METRICS: Record<string, { weight: number }>
  }
  TOP_N_STOCKS: number; HOLDING_PERIOD_DAYS: number; WEIGHTING: string
  MIN_AVG_TURNOVER_CR: number; MIN_MARKET_CAP_CR: number; MIN_PRICE: number
  MIN_HISTORY_DAYS: number; EXCLUDE_SECTORS: string[]; MIN_FREE_FLOAT_PCT: number
  MAX_STOCK_WEIGHT: number; MAX_SECTOR_WEIGHT: number; STOP_LOSS_PCT: number; PORTFOLIO_STOP_PCT: number
  NIFTY_SMA_PERIOD: number; NIFTY_TREND_SMA: number; REDUCE_EXPOSURE_IN_BEAR: boolean
  TRADING_DAYS_PER_YEAR: number; RISK_FREE_RATE: number
}

// ============================== CONFIGURATION ==============================
export const CONFIG: FactorConfig = {
  WEIGHTS: { MOMENTUM: 0.35, VALUE: 0.25, QUALITY: 0.20, EARNINGS_REVISION: 0.20 },

  MOMENTUM: {
    LOOKBACK_1M: 22, LOOKBACK_3M: 66, LOOKBACK_6M: 132, LOOKBACK_12M: 252,
    WEIGHT_1M: 0.20, WEIGHT_3M: 0.45, WEIGHT_6M: 0.25, WEIGHT_12M: 0.10,
    SKIP_RECENT_DAYS: 5,
  },

  VALUE: {
    METRICS: {
      EV_EBITDA: { weight: 0.35, direction: 'LOWER_BETTER', cap: 100, floor: 0 },
      PE_RATIO: { weight: 0.25, direction: 'LOWER_BETTER', cap: 200, floor: 0 },
      PB_RATIO: { weight: 0.20, direction: 'LOWER_BETTER', cap: 50, floor: 0 },
      EARNINGS_YIELD: { weight: 0.20, direction: 'HIGHER_BETTER', cap: null, floor: 0 },
    },
    EXCLUDE_NEGATIVE_EARNINGS: true,
  },

  QUALITY: {
    METRICS: {
      ROE: { weight: 0.30, direction: 'HIGHER_BETTER', minThreshold: 0 },
      ROIC: { weight: 0.20, direction: 'HIGHER_BETTER', minThreshold: 0 },
      DEBT_TO_EQUITY: { weight: 0.20, direction: 'LOWER_BETTER', cap: 5 },
      EARNINGS_STABILITY: { weight: 0.15, direction: 'HIGHER_BETTER' },
      EARNINGS_GROWTH_3Y: { weight: 0.15, direction: 'HIGHER_BETTER' },
    },
    MIN_ROE: 0,
    MAX_DEBT_TO_EQUITY: 5,
    MIN_YEARS_POSITIVE_EARNINGS: 3,
  },

  EARNINGS_REVISION: {
    LOOKBACK_DAYS: 30,
    METRICS: {
      EPS_REVISION_1M: { weight: 0.50 },
      REVENUE_REVISION_1M: { weight: 0.25 },
      NUM_UPGRADES_VS_DOWNGRADES: { weight: 0.25 },
    },
  },

  TOP_N_STOCKS: 15,
  HOLDING_PERIOD_DAYS: 22,
  WEIGHTING: 'EQUAL',

  MIN_AVG_TURNOVER_CR: 2,
  MIN_MARKET_CAP_CR: 500,
  MIN_PRICE: 20,
  MIN_HISTORY_DAYS: 132,
  EXCLUDE_SECTORS: [],
  MIN_FREE_FLOAT_PCT: 15,

  MAX_STOCK_WEIGHT: 0.10,
  MAX_SECTOR_WEIGHT: 0.30,
  STOP_LOSS_PCT: 0.12,
  PORTFOLIO_STOP_PCT: 0.08,

  NIFTY_SMA_PERIOD: 50,
  NIFTY_TREND_SMA: 200,
  REDUCE_EXPOSURE_IN_BEAR: true,

  TRADING_DAYS_PER_YEAR: 252,
  RISK_FREE_RATE: 0.065,
}

// ============================== TECHNICAL CALCULATIONS ==============================
export function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result[i] = sum / period
  }
  return result
}

export function calcReturn(prices: number[], lookback: number, skipRecent = 0): number | null {
  if (!prices || prices.length < lookback + 1 + skipRecent) return null
  const endIdx = prices.length - 1 - skipRecent
  const startIdx = endIdx - lookback
  if (startIdx < 0 || prices[startIdx] === 0) return null
  return (prices[endIdx] / prices[startIdx]) - 1
}

export function calcVolatility(prices: number[], window = 252): number | null {
  const effectiveWindow = Math.min(window, prices.length - 1)
  if (effectiveWindow < 20) return null
  const rets: number[] = []
  for (let i = prices.length - effectiveWindow; i < prices.length; i++) {
    if (prices[i - 1] === 0) return null
    rets.push(Math.log(prices[i] / prices[i - 1]))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  return Math.sqrt(variance) * Math.sqrt(CONFIG.TRADING_DAYS_PER_YEAR)
}

export function calcDrawdown(prices: number[]): number {
  let peak = prices[0]
  let maxDD = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = (peak - p) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

export function calcBeta(stockReturns: number[], benchmarkReturns: number[]): number | null {
  if (stockReturns.length !== benchmarkReturns.length || stockReturns.length < 20) return null
  const n = stockReturns.length
  const meanS = stockReturns.reduce((s, r) => s + r, 0) / n
  const meanB = benchmarkReturns.reduce((s, r) => s + r, 0) / n
  let cov = 0, varB = 0
  for (let i = 0; i < n; i++) {
    cov += (stockReturns[i] - meanS) * (benchmarkReturns[i] - meanB)
    varB += (benchmarkReturns[i] - meanB) ** 2
  }
  return varB !== 0 ? cov / varB : null
}

// ============================== FACTOR SCORING ENGINE ==============================

/** Percentile rank within an array. Returns 0–100 (100 = best). */
export function percentileRank(value: number | null, allValues: (number | null)[], higherIsBetter = true): number | null {
  if (allValues.length === 0 || value === null || value === undefined) return null
  const sorted = (allValues as number[]).filter(v => v !== null && v !== undefined && !isNaN(v))
  if (sorted.length === 0) return null
  sorted.sort((a, b) => a - b)
  const rank = sorted.filter(v => v < value).length
  const percentile = (rank / sorted.length) * 100
  return higherIsBetter ? percentile : (100 - percentile)
}

// ── MOMENTUM FACTOR ──
export function calcMomentumFactor(prices: number[]): any {
  if (!prices || prices.length < CONFIG.MOMENTUM.LOOKBACK_6M + CONFIG.MOMENTUM.SKIP_RECENT_DAYS + 1) return null
  const skip = CONFIG.MOMENTUM.SKIP_RECENT_DAYS
  const ret1m = calcReturn(prices, CONFIG.MOMENTUM.LOOKBACK_1M, skip)
  const ret3m = calcReturn(prices, CONFIG.MOMENTUM.LOOKBACK_3M, skip)
  const ret6m = calcReturn(prices, CONFIG.MOMENTUM.LOOKBACK_6M, skip)
  const ret12m = prices.length >= CONFIG.MOMENTUM.LOOKBACK_12M + skip + 1
    ? calcReturn(prices, CONFIG.MOMENTUM.LOOKBACK_12M, skip) : null
  if (ret3m === null) return null

  let weights = CONFIG.MOMENTUM.WEIGHT_1M + CONFIG.MOMENTUM.WEIGHT_3M + CONFIG.MOMENTUM.WEIGHT_6M
  let rawScore =
    (ret1m !== null ? CONFIG.MOMENTUM.WEIGHT_1M * ret1m : 0) +
    CONFIG.MOMENTUM.WEIGHT_3M * ret3m +
    (ret6m !== null ? CONFIG.MOMENTUM.WEIGHT_6M * ret6m : 0)
  if (ret12m !== null) { rawScore += CONFIG.MOMENTUM.WEIGHT_12M * ret12m; weights += CONFIG.MOMENTUM.WEIGHT_12M }
  rawScore /= weights

  return { rawScore, ret1m, ret3m, ret6m, ret12m }
}

// ── VALUE FACTOR ──
export function calcValueFactor(fundamentals: any): any {
  const { evEbitda, peRatio, pbRatio, earningsYield, eps } = fundamentals
  if (CONFIG.VALUE.EXCLUDE_NEGATIVE_EARNINGS && eps !== undefined && eps <= 0) return null

  const metrics: any = {}
  const mc = CONFIG.VALUE.METRICS
  if (evEbitda !== null && evEbitda !== undefined) {
    let val = evEbitda
    if (mc.EV_EBITDA.cap) val = Math.min(val, mc.EV_EBITDA.cap)
    if (mc.EV_EBITDA.floor !== undefined) val = Math.max(val, mc.EV_EBITDA.floor!)
    metrics.evEbitda = val
  }
  if (peRatio !== null && peRatio !== undefined && peRatio > 0) {
    let val = peRatio
    if (mc.PE_RATIO.cap) val = Math.min(val, mc.PE_RATIO.cap)
    metrics.peRatio = val
  }
  if (pbRatio !== null && pbRatio !== undefined && pbRatio > 0) {
    let val = pbRatio
    if (mc.PB_RATIO.cap) val = Math.min(val, mc.PB_RATIO.cap)
    metrics.pbRatio = val
  }
  if (earningsYield !== null && earningsYield !== undefined) {
    metrics.earningsYield = earningsYield
  } else if (peRatio && peRatio > 0) {
    metrics.earningsYield = 1 / peRatio
  }
  return { metrics, rawValues: { evEbitda, peRatio, pbRatio, earningsYield } }
}

// ── QUALITY FACTOR ──
export function calcQualityFactor(fundamentals: any): any {
  const { roe, roic, debtToEquity, earningsStability, earningsGrowth3Y, yearsPositiveEarnings } = fundamentals
  if (debtToEquity !== undefined && debtToEquity > CONFIG.QUALITY.MAX_DEBT_TO_EQUITY) return null
  if (yearsPositiveEarnings !== undefined && yearsPositiveEarnings < CONFIG.QUALITY.MIN_YEARS_POSITIVE_EARNINGS) return null

  const metrics: any = {}
  if (roe !== null && roe !== undefined) metrics.roe = roe
  if (roic !== null && roic !== undefined) metrics.roic = roic
  if (debtToEquity !== null && debtToEquity !== undefined) metrics.debtToEquity = Math.min(debtToEquity, CONFIG.QUALITY.METRICS.DEBT_TO_EQUITY.cap || 5)
  if (earningsStability !== null && earningsStability !== undefined) metrics.earningsStability = earningsStability
  if (earningsGrowth3Y !== null && earningsGrowth3Y !== undefined) metrics.earningsGrowth3Y = earningsGrowth3Y
  return { metrics }
}

/** Earnings stability as coefficient of variation. Lower CV = more stable. Returns 0-1 score. */
export function calcEarningsStability(epsHistory: number[]): number | null {
  if (!epsHistory || epsHistory.length < 3) return null
  const positiveEps = epsHistory.filter(e => e > 0)
  if (positiveEps.length < 3) return 0
  const mean = positiveEps.reduce((s, e) => s + e, 0) / positiveEps.length
  if (mean === 0) return 0
  const stdDev = Math.sqrt(positiveEps.reduce((s, e) => s + (e - mean) ** 2, 0) / positiveEps.length)
  const cv = stdDev / Math.abs(mean)
  return Math.max(0, Math.min(1, 1 - cv))
}

// ── EARNINGS REVISION FACTOR ──
export function calcEarningsRevisionFactor(revisionData: any): any {
  if (!revisionData) return null
  const { currentFYEPS, previousFYEPS, currentFYRevenue, previousFYRevenue, numUpgrades, numDowngrades, numTotal } = revisionData
  const metrics: any = {}
  if (currentFYEPS !== null && previousFYEPS !== null && previousFYEPS !== 0)
    metrics.epsRevision1M = (currentFYEPS - previousFYEPS) / Math.abs(previousFYEPS)
  if (currentFYRevenue !== null && previousFYRevenue !== null && previousFYRevenue !== 0)
    metrics.revenueRevision1M = (currentFYRevenue - previousFYRevenue) / Math.abs(previousFYRevenue)
  if (numTotal !== undefined && numTotal > 0)
    metrics.netUpgradeRatio = ((numUpgrades || 0) - (numDowngrades || 0)) / numTotal
  if (Object.keys(metrics).length === 0) return null
  return { metrics }
}

// ============================== UNIVERSE FILTERS ==============================
export function applyUniverseFilters(stock: any): { pass: boolean; reason?: string } {
  if (stock.avgDailyTurnoverCr && stock.avgDailyTurnoverCr < CONFIG.MIN_AVG_TURNOVER_CR)
    return { pass: false, reason: `Turnover ₹${stock.avgDailyTurnoverCr}cr < ₹${CONFIG.MIN_AVG_TURNOVER_CR}cr` }
  if (stock.marketCapCr && stock.marketCapCr < CONFIG.MIN_MARKET_CAP_CR)
    return { pass: false, reason: `Market cap ₹${stock.marketCapCr}cr < ₹${CONFIG.MIN_MARKET_CAP_CR}cr` }
  if (stock.prices && stock.prices.length > 0) {
    const price = stock.prices[stock.prices.length - 1]
    if (price < CONFIG.MIN_PRICE) return { pass: false, reason: `Price ₹${r2(price)} < ₹${CONFIG.MIN_PRICE}` }
  }
  if (stock.prices && stock.prices.length < CONFIG.MIN_HISTORY_DAYS)
    return { pass: false, reason: `Only ${stock.prices.length} days history (need ${CONFIG.MIN_HISTORY_DAYS})` }
  if (stock.freeFloatPct !== undefined && stock.freeFloatPct < CONFIG.MIN_FREE_FLOAT_PCT)
    return { pass: false, reason: `Free float ${stock.freeFloatPct}% < ${CONFIG.MIN_FREE_FLOAT_PCT}%` }
  if (CONFIG.EXCLUDE_SECTORS.length > 0 && CONFIG.EXCLUDE_SECTORS.includes(stock.sector))
    return { pass: false, reason: `Sector ${stock.sector} excluded` }
  return { pass: true }
}

// ============================== CROSS-SECTIONAL RANKING ENGINE ==============================
export function rankUniverse(universe: any[]): any {
  // Step 0: Apply universe filters
  const filtered: any[] = []
  const qualifying: any[] = []
  for (const stock of universe) {
    const filterResult = applyUniverseFilters(stock)
    if (!filterResult.pass) { filtered.push({ symbol: stock.symbol, reason: filterResult.reason }); continue }
    qualifying.push(stock)
  }

  // Step 1: Compute raw factor scores
  const factorData: any[] = []
  for (const stock of qualifying) {
    const momentum = calcMomentumFactor(stock.prices)
    const value = calcValueFactor(stock.fundamentals || {})
    const quality = calcQualityFactor(stock.fundamentals || {})
    const revision = calcEarningsRevisionFactor(stock.revisionData)
    if (!momentum) continue
    factorData.push({
      symbol: stock.symbol, sector: stock.sector, marketCapCr: stock.marketCapCr,
      currentPrice: stock.prices[stock.prices.length - 1],
      momentum, value, quality, revision,
      volatility: calcVolatility(stock.prices),
      avgDailyTurnoverCr: stock.avgDailyTurnoverCr,
      rawStock: stock,
    })
  }
  if (factorData.length === 0) return { ranked: [], filtered, qualifying: 0, message: 'No stocks passed filters' }

  // Step 2: Percentile rank each factor

  // Momentum
  const allMomScores = factorData.map(d => d.momentum.rawScore)
  for (const d of factorData) d.momentumPercentile = percentileRank(d.momentum.rawScore, allMomScores, true)

  // Value (sub-metric weighted)
  const valueKeyMap: Record<string, string> = { EV_EBITDA: 'evEbitda', PE_RATIO: 'peRatio', PB_RATIO: 'pbRatio', EARNINGS_YIELD: 'earningsYield' }
  const valueMetricNames = Object.keys(CONFIG.VALUE.METRICS)
  for (const d of factorData) {
    if (!d.value) { d.valuePercentile = null; continue }
    let wSum = 0, tWeight = 0
    for (const mn of valueMetricNames) {
      const mc = CONFIG.VALUE.METRICS[mn]
      const key = valueKeyMap[mn]
      const val = d.value.metrics[key]
      if (val === undefined || val === null) continue
      const allVals = factorData.filter(dd => dd.value && dd.value.metrics[key] !== undefined).map(dd => dd.value.metrics[key])
      const pctile = percentileRank(val, allVals, mc.direction === 'HIGHER_BETTER')
      if (pctile !== null) { wSum += mc.weight * pctile; tWeight += mc.weight }
    }
    d.valuePercentile = tWeight > 0 ? wSum / tWeight : null
  }

  // Quality (sub-metric weighted)
  const qualityKeyMap: Record<string, string> = { ROE: 'roe', ROIC: 'roic', DEBT_TO_EQUITY: 'debtToEquity', EARNINGS_STABILITY: 'earningsStability', EARNINGS_GROWTH_3Y: 'earningsGrowth3Y' }
  const qualityMetricNames = Object.keys(CONFIG.QUALITY.METRICS)
  for (const d of factorData) {
    if (!d.quality) { d.qualityPercentile = null; continue }
    let wSum = 0, tWeight = 0
    for (const mn of qualityMetricNames) {
      const mc = CONFIG.QUALITY.METRICS[mn]
      const key = qualityKeyMap[mn]
      const val = d.quality.metrics[key]
      if (val === undefined || val === null) continue
      const allVals = factorData.filter(dd => dd.quality && dd.quality.metrics[key] !== undefined).map(dd => dd.quality.metrics[key])
      const pctile = percentileRank(val, allVals, mc.direction === 'HIGHER_BETTER')
      if (pctile !== null) { wSum += mc.weight * pctile; tWeight += mc.weight }
    }
    d.qualityPercentile = tWeight > 0 ? wSum / tWeight : null
  }

  // Earnings revision (sub-metric weighted)
  const revKeyMap: Record<string, string> = { EPS_REVISION_1M: 'epsRevision1M', REVENUE_REVISION_1M: 'revenueRevision1M', NUM_UPGRADES_VS_DOWNGRADES: 'netUpgradeRatio' }
  const revMetricNames = Object.keys(CONFIG.EARNINGS_REVISION.METRICS)
  for (const d of factorData) {
    if (!d.revision) { d.revisionPercentile = null; continue }
    let wSum = 0, tWeight = 0
    for (const mn of revMetricNames) {
      const mc = CONFIG.EARNINGS_REVISION.METRICS[mn]
      const key = revKeyMap[mn]
      const val = d.revision.metrics[key]
      if (val === undefined || val === null) continue
      const allVals = factorData.filter(dd => dd.revision && dd.revision.metrics[key] !== undefined).map(dd => dd.revision.metrics[key])
      const pctile = percentileRank(val, allVals, true)
      if (pctile !== null) { wSum += mc.weight * pctile; tWeight += mc.weight }
    }
    d.revisionPercentile = tWeight > 0 ? wSum / tWeight : null
  }

  // Step 3: Compute composite score
  for (const d of factorData) {
    let composite = 0, activeWeight = 0
    if (d.momentumPercentile !== null) { composite += CONFIG.WEIGHTS.MOMENTUM * d.momentumPercentile; activeWeight += CONFIG.WEIGHTS.MOMENTUM }
    if (d.valuePercentile !== null) { composite += CONFIG.WEIGHTS.VALUE * d.valuePercentile; activeWeight += CONFIG.WEIGHTS.VALUE }
    if (d.qualityPercentile !== null) { composite += CONFIG.WEIGHTS.QUALITY * d.qualityPercentile; activeWeight += CONFIG.WEIGHTS.QUALITY }
    if (d.revisionPercentile !== null) { composite += CONFIG.WEIGHTS.EARNINGS_REVISION * d.revisionPercentile; activeWeight += CONFIG.WEIGHTS.EARNINGS_REVISION }
    d.compositeScore = activeWeight > 0 ? composite / activeWeight : 0
    d.factorsAvailable = {
      momentum: d.momentumPercentile !== null, value: d.valuePercentile !== null,
      quality: d.qualityPercentile !== null, revision: d.revisionPercentile !== null,
    }
    d.factorCount = Object.values(d.factorsAvailable).filter(Boolean).length
  }

  // Step 4: Sort by composite
  factorData.sort((a, b) => b.compositeScore - a.compositeScore)
  factorData.forEach((d, i) => { d.rank = i + 1 })

  return {
    ranked: factorData,
    totalUniverse: universe.length,
    filtered: filtered.length,
    qualifying: factorData.length,
    filteredDetails: filtered.slice(0, 20),
  }
}

// ============================== PORTFOLIO CONSTRUCTION ==============================
function formatHolding(stock: any): any {
  return {
    symbol: stock.symbol, sector: stock.sector, rank: stock.rank,
    currentPrice: r2(stock.currentPrice), compositeScore: r2(stock.compositeScore),
    factorCount: stock.factorCount,
    momentumPctile: r2(stock.momentumPercentile), valuePctile: r2(stock.valuePercentile),
    qualityPctile: r2(stock.qualityPercentile), revisionPctile: r2(stock.revisionPercentile),
    ret3m: stock.momentum ? r2(stock.momentum.ret3m * 100) + '%' : null,
    roe: stock.quality ? r2(stock.quality.metrics.roe) + '%' : null,
    evEbitda: stock.value ? r2(stock.value.rawValues.evEbitda) : null,
    volatility: stock.volatility ? r2(stock.volatility * 100) + '%' : null,
    marketCapCr: stock.marketCapCr,
  }
}

export function calcWeights(stocks: any[], totalCapital: number, regime: any): any[] {
  if (stocks.length === 0) return []
  const regimeMultiplier = regime.regime === 'CAUTIOUS_BULL' ? 0.7 : 1.0
  const investable = totalCapital * regimeMultiplier
  let holdings: any[]

  if (CONFIG.WEIGHTING === 'EQUAL') {
    const weight = 1 / stocks.length
    holdings = stocks.map(s => ({ ...formatHolding(s), weight: Math.min(weight, CONFIG.MAX_STOCK_WEIGHT) }))
  } else if (CONFIG.WEIGHTING === 'COMPOSITE_WEIGHTED') {
    const totalScore = stocks.reduce((sum, s) => sum + s.compositeScore, 0)
    holdings = stocks.map(s => ({
      ...formatHolding(s),
      weight: Math.min(totalScore > 0 ? s.compositeScore / totalScore : 1 / stocks.length, CONFIG.MAX_STOCK_WEIGHT),
    }))
  } else if (CONFIG.WEIGHTING === 'INV_VOL') {
    const totalInvVol = stocks.reduce((sum, s) => sum + (s.volatility && s.volatility > 0 ? 1 / s.volatility : 1), 0)
    holdings = stocks.map(s => {
      const invVol = s.volatility && s.volatility > 0 ? 1 / s.volatility : 1
      return { ...formatHolding(s), weight: Math.min(invVol / totalInvVol, CONFIG.MAX_STOCK_WEIGHT) }
    })
  } else {
    const weight = 1 / stocks.length
    holdings = stocks.map(s => ({ ...formatHolding(s), weight: Math.min(weight, CONFIG.MAX_STOCK_WEIGHT) }))
  }

  // Normalize
  let totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0)
  if (totalWeight > 0) holdings.forEach(h => { h.weight = h.weight / totalWeight })

  // Sector cap
  const sectorWeights: Record<string, number> = {}
  for (const h of holdings) { const s = h.sector || 'Unknown'; sectorWeights[s] = (sectorWeights[s] || 0) + h.weight }
  for (const [sector, totalSW] of Object.entries(sectorWeights)) {
    if (totalSW > CONFIG.MAX_SECTOR_WEIGHT) {
      const sectorH = holdings.filter(h => (h.sector || 'Unknown') === sector)
      const scale = CONFIG.MAX_SECTOR_WEIGHT / totalSW
      sectorH.forEach(h => { h.weight *= scale })
    }
  }

  // Re-normalize
  const finalTotal = holdings.reduce((sum, h) => sum + h.weight, 0)
  if (finalTotal > 0 && finalTotal < 0.99) holdings.forEach(h => { h.weight = h.weight / finalTotal })

  // Allocations
  for (const h of holdings) {
    h.allocatedCapital = Math.round(h.weight * investable)
    h.shares = h.currentPrice > 0 ? Math.floor(h.allocatedCapital / h.currentPrice) : 0
    h.stopLoss = r2(h.currentPrice * (1 - CONFIG.STOP_LOSS_PCT))
    h.weight = r2(h.weight)
  }
  return holdings
}

export function buildPortfolio(universe: any[], niftyPrices: number[], totalCapital: number, currentDate: string | null = null): any {
  const regime = checkMarketRegime(niftyPrices)
  if (!regime.tradeable && CONFIG.REDUCE_EXPOSURE_IN_BEAR)
    return { date: currentDate, regime, signal: 'CASH', message: 'Bear market — reduce or eliminate equity exposure', holdings: [] }

  const ranking = rankUniverse(universe)
  if (ranking.qualifying === 0)
    return { date: currentDate, regime, signal: 'NO_STOCKS', message: 'No stocks passed filters', holdings: [] }

  const topStocks = ranking.ranked.slice(0, CONFIG.TOP_N_STOCKS)
  const selected: any[] = []
  for (const stock of topStocks) selected.push(stock)

  const holdings = calcWeights(selected, totalCapital, regime)
  const factorExposure = analyzeFactorExposure(holdings)

  return {
    date: currentDate, regime, signal: 'INVEST', holdings,
    portfolioStats: calcPortfolioStats(holdings, totalCapital),
    factorExposure,
    rankingSummary: { totalUniverse: ranking.totalUniverse, filtered: ranking.filtered, qualifying: ranking.qualifying, selected: holdings.length },
    topDecile: ranking.ranked.slice(0, Math.ceil(ranking.qualifying * 0.1)).map((d: any) => ({
      symbol: d.symbol, composite: r2(d.compositeScore), momentum: r2(d.momentumPercentile),
      value: r2(d.valuePercentile), quality: r2(d.qualityPercentile), revision: r2(d.revisionPercentile),
    })),
    bottomDecile: ranking.ranked.slice(-Math.ceil(ranking.qualifying * 0.1)).map((d: any) => ({ symbol: d.symbol, composite: r2(d.compositeScore) })),
    holdingPeriod: `${CONFIG.HOLDING_PERIOD_DAYS} trading days`,
    nextRebalance: `After ${CONFIG.HOLDING_PERIOD_DAYS} trading days`,
  }
}

// ============================== HELPER UTILITIES ==============================
export function r2(n: number | null | undefined): number | null {
  return n !== null && n !== undefined && !isNaN(n) ? Math.round(n * 100) / 100 : null
}

function avg(arr: (number | null)[]): number | null {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v as number)) as number[]
  return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : null
}

export function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null
  const n = x.length
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let cov = 0, vx = 0, vy = 0
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my)
    vx += (x[i] - mx) ** 2
    vy += (y[i] - my) ** 2
  }
  const denom = Math.sqrt(vx * vy)
  return denom !== 0 ? cov / denom : 0
}

function groupAnalyze(trades: any[], field: string): any {
  const groups: Record<string, any[]> = {}
  for (const t of trades) { const key = String(t[field] || 'Unknown'); if (!groups[key]) groups[key] = []; groups[key].push(t) }
  const result: any = {}
  for (const [key, list] of Object.entries(groups)) {
    const wins = list.filter(t => t.pnl > 0)
    result[key] = {
      count: list.length,
      winRate: r2((wins.length / list.length) * 100) + '%',
      avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / list.length) + '%',
      totalPnl: Math.round(list.reduce((s, t) => s + t.pnl, 0)),
    }
  }
  return result
}

function formatTrade(t: any): any {
  return {
    symbol: t.symbol, sector: t.sector, pnlPct: t.pnlPct,
    rank: t.rank, composite: t.compositeScore,
    mom: t.momentumPctile, val: t.valuePctile,
    qual: t.qualityPctile, rev: t.revisionPctile,
    exitReason: t.exitReason,
  }
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

// ============================== FACTOR EXPOSURE ANALYSIS ==============================
export function analyzeFactorExposure(holdings: any[]): any {
  if (holdings.length === 0) return {}
  const avgMom = avg(holdings.map(h => h.momentumPctile).filter((v: any) => v !== null))
  const avgVal = avg(holdings.map(h => h.valuePctile).filter((v: any) => v !== null))
  const avgQual = avg(holdings.map(h => h.qualityPctile).filter((v: any) => v !== null))
  const avgRev = avg(holdings.map(h => h.revisionPctile).filter((v: any) => v !== null))

  const interpret = (v: number | null, label: string) =>
    v !== null && v > 70 ? `Strong ${label} tilt` : v !== null && v > 55 ? `Moderate ${label} tilt` : `Weak/neutral ${label}`

  return {
    momentum: { avgPercentile: r2(avgMom), tilt: avgMom !== null ? r2(avgMom - 50) : null, interpretation: interpret(avgMom, 'momentum') },
    value: { avgPercentile: r2(avgVal), tilt: avgVal !== null ? r2(avgVal - 50) : null, interpretation: interpret(avgVal, 'value') },
    quality: { avgPercentile: r2(avgQual), tilt: avgQual !== null ? r2(avgQual - 50) : null, interpretation: interpret(avgQual, 'quality') },
    earningsRevision: { avgPercentile: r2(avgRev), tilt: avgRev !== null ? r2(avgRev - 50) : null, interpretation: interpret(avgRev, 'revision') },
    compositeAvg: r2(avg(holdings.map(h => h.compositeScore).filter((v: any) => v !== null))),
    dominantFactor: determineDominantFactor(avgMom, avgVal, avgQual, avgRev),
  }
}

function determineDominantFactor(mom: number | null, val: number | null, qual: number | null, rev: number | null): string {
  const factors = [
    { name: 'Momentum', score: mom || 0 }, { name: 'Value', score: val || 0 },
    { name: 'Quality', score: qual || 0 }, { name: 'Earnings Revision', score: rev || 0 },
  ]
  factors.sort((a, b) => b.score - a.score)
  return factors[0].name
}

// ============================== PORTFOLIO STATISTICS ==============================
export function calcPortfolioStats(holdings: any[], totalCapital: number): any {
  if (holdings.length === 0) return {}
  const totalInvested = holdings.reduce((s, h) => s + (h.allocatedCapital || 0), 0)
  const sectors: Record<string, number> = {}
  for (const h of holdings) { const s = h.sector || 'Unknown'; sectors[s] = (sectors[s] || 0) + (h.weight || 0) }
  const hhi = holdings.reduce((sum, h) => sum + ((h.weight || 0) * 100) ** 2, 0)
  const vols = holdings.filter(h => h.volatility)
  const wVol = vols.length > 0
    ? Math.sqrt(vols.reduce((sum, h) => { const w = parseFloat(h.weight) || 0; const v = parseFloat(h.volatility) / 100 || 0.2; return sum + (w * v) ** 2 }, 0))
    : null

  return {
    holdingsCount: holdings.length,
    totalInvested: Math.round(totalInvested),
    cashReserve: Math.round(totalCapital - totalInvested),
    investedPct: r2((totalInvested / totalCapital) * 100) + '%',
    avgCompositeScore: r2(avg(holdings.map(h => h.compositeScore))),
    avgFactorCount: r2(avg(holdings.map(h => h.factorCount))),
    sectorBreakdown: Object.entries(sectors).map(([s, w]) => ({ sector: s, weight: r2(w * 100) + '%' })).sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight)),
    maxStockWeight: r2(Math.max(...holdings.map(h => parseFloat(h.weight) || 0)) * 100) + '%',
    hhiIndex: Math.round(hhi),
    diversification: hhi > 1500 ? 'CONCENTRATED' : hhi > 800 ? 'MODERATE' : 'DIVERSIFIED',
    portfolioVolatility: wVol ? r2(wVol * 100) + '%' : null,
  }
}

// ============================== MARKET REGIME ==============================
export function checkMarketRegime(niftyPrices: number[]): any {
  if (!niftyPrices || niftyPrices.length < CONFIG.NIFTY_TREND_SMA + 1)
    return { regime: 'UNKNOWN', tradeable: true, reason: 'Insufficient Nifty data' }

  const sma50 = calcSMA(niftyPrices, CONFIG.NIFTY_SMA_PERIOD)
  const sma200 = calcSMA(niftyPrices, CONFIG.NIFTY_TREND_SMA)
  const curr = niftyPrices[niftyPrices.length - 1]
  const s50 = sma50[sma50.length - 1]
  const s200 = sma200[sma200.length - 1]
  if (s200 === null) return { regime: 'UNKNOWN', tradeable: true }

  const above50 = s50 !== null && curr > s50
  const above200 = curr > s200
  if (above200 && above50) return { regime: 'BULL', tradeable: true, nifty: r2(curr), sma50: r2(s50), sma200: r2(s200) }
  if (above200) return { regime: 'CAUTIOUS_BULL', tradeable: true, nifty: r2(curr), sma50: r2(s50), sma200: r2(s200) }
  return { regime: 'BEAR', tradeable: false, nifty: r2(curr), sma50: r2(s50), sma200: r2(s200), reason: 'Nifty below 200-SMA' }
}

// ============================== POSITION MONITORING ==============================
export function monitorPortfolio(holdings: any[], currentPrices: Record<string, number>, daysSinceRebalance: number): any {
  const actions: any[] = []
  let portfolioPnl = 0, totalAllocated = 0

  for (const h of holdings) {
    const currentPrice = currentPrices[h.symbol]
    if (currentPrice === undefined) continue
    const entryPrice = parseFloat(h.currentPrice)
    const pnlPct = (currentPrice / entryPrice) - 1
    const pnl = (currentPrice - entryPrice) * (h.shares || 0)
    portfolioPnl += pnl
    totalAllocated += h.allocatedCapital || 0
    const stopLoss = parseFloat(h.stopLoss)

    if (currentPrice <= stopLoss) {
      actions.push({ symbol: h.symbol, action: 'EXIT', reason: 'STOP_LOSS', pnlPct: r2(pnlPct * 100) + '%', urgency: 'IMMEDIATE' })
    } else {
      actions.push({ symbol: h.symbol, action: 'HOLD', pnlPct: r2(pnlPct * 100) + '%', distanceToStop: r2(((currentPrice - stopLoss) / currentPrice) * 100) + '%' })
    }
  }

  const portfolioPnlPct = totalAllocated > 0 ? portfolioPnl / totalAllocated : 0
  const portfolioStop = portfolioPnlPct <= -CONFIG.PORTFOLIO_STOP_PCT
  const rebalanceDue = daysSinceRebalance >= CONFIG.HOLDING_PERIOD_DAYS

  return {
    daysSinceRebalance,
    portfolioPnlPct: r2(portfolioPnlPct * 100) + '%',
    portfolioStopTriggered: portfolioStop,
    rebalanceDue,
    stockActions: actions,
    recommendation: portfolioStop ? 'EXIT ALL — portfolio stop triggered' : rebalanceDue ? 'REBALANCE — re-rank and rebuild' : 'HOLD',
  }
}

// ============================== BACKTEST ENGINE ==============================
export function runBacktest(universeSnapshots: any[], capitalBase = 10000000): any {
  let capital = capitalBase
  const closedTrades: any[] = []
  const equityCurve: any[] = []
  let peakEquity = capitalBase, maxDrawdown = 0

  for (let period = 0; period < universeSnapshots.length; period++) {
    const { date, stocks, niftyPrices } = universeSnapshots[period]
    const portfolio = buildPortfolio(stocks, niftyPrices, capital, date)

    if (portfolio.signal !== 'INVEST' || portfolio.holdings.length === 0) {
      equityCurve.push({ date, totalEquity: Math.round(capital), positions: 0, drawdown: '0%' })
      continue
    }

    const nextPeriod = period + 1 < universeSnapshots.length ? universeSnapshots[period + 1] : null

    for (const h of portfolio.holdings) {
      const entryPrice = parseFloat(h.currentPrice)
      let exitPrice = entryPrice, exitReason = 'REBALANCE'

      if (nextPeriod) {
        const nextStock = nextPeriod.stocks.find((s: any) => s.symbol === h.symbol)
        if (nextStock && nextStock.prices && nextStock.prices.length > 0) exitPrice = nextStock.prices[nextStock.prices.length - 1]
      }

      const stopLoss = parseFloat(h.stopLoss)
      if (exitPrice < stopLoss) { exitPrice = stopLoss; exitReason = 'STOP_LOSS' }

      const pnl = (exitPrice - entryPrice) * (h.shares || 0)
      capital += pnl

      closedTrades.push({
        symbol: h.symbol, sector: h.sector, entryDate: date,
        exitDate: nextPeriod ? nextPeriod.date : 'END',
        entryPrice: r2(entryPrice), exitPrice: r2(exitPrice),
        pnl: Math.round(pnl), pnlPct: r2(((exitPrice / entryPrice) - 1) * 100) + '%',
        exitReason, rank: h.rank, compositeScore: h.compositeScore,
        momentumPctile: h.momentumPctile, valuePctile: h.valuePctile,
        qualityPctile: h.qualityPctile, revisionPctile: h.revisionPctile,
        factorCount: h.factorCount,
      })
    }

    if (capital > peakEquity) peakEquity = capital
    const dd = (peakEquity - capital) / peakEquity
    if (dd > maxDrawdown) maxDrawdown = dd
    equityCurve.push({ date, totalEquity: Math.round(capital), positions: portfolio.holdings.length, drawdown: r2(dd * 100) + '%' })
  }

  return buildBacktestAnalytics(closedTrades, equityCurve, capitalBase, capital, maxDrawdown)
}

function buildBacktestAnalytics(trades: any[], equityCurve: any[], capitalBase: number, finalCapital: number, maxDrawdown: number): any {
  const total = trades.length
  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl <= 0)
  const winRate = total > 0 ? winners.length / total : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / losers.length) : 0
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss)
  const totalReturn = (finalCapital / capitalBase) - 1
  const years = equityCurve.length > 0 ? equityCurve.length * CONFIG.HOLDING_PERIOD_DAYS / CONFIG.TRADING_DAYS_PER_YEAR : 1
  const cagr = years > 0 ? Math.pow(finalCapital / capitalBase, 1 / years) - 1 : 0

  const monthlyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].totalEquity
    const curr = equityCurve[i].totalEquity
    if (prev > 0) monthlyReturns.push((curr / prev) - 1)
  }
  const periodsPerYear = CONFIG.TRADING_DAYS_PER_YEAR / CONFIG.HOLDING_PERIOD_DAYS
  const sharpe = calcSharpeRatio(monthlyReturns, periodsPerYear)
  const sortino = calcSortinoRatio(monthlyReturns, periodsPerYear)
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : null

  const factorContribution = analyzeFactorContribution(trades)
  const bySector = groupAnalyze(trades, 'sector')
  const byFactorCount = groupAnalyze(trades, 'factorCount')
  const byExitReason = groupAnalyze(trades, 'exitReason')
  const quintileAnalysis = analyzeQuintileReturns(trades)

  let maxWin = 0, maxLose = 0, curWin = 0, curLose = 0
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLose = 0; maxWin = Math.max(maxWin, curWin) }
    else { curLose++; curWin = 0; maxLose = Math.max(maxLose, curLose) }
  }

  return {
    summary: {
      startingCapital: capitalBase, endingCapital: Math.round(finalCapital),
      totalReturn: r2(totalReturn * 100) + '%', cagr: r2(cagr * 100) + '%',
      totalTrades: total, winRate: r2(winRate * 100) + '%',
      avgWinPct: r2(avgWin) + '%', avgLossPct: r2(avgLoss) + '%',
      winLossRatio: avgLoss > 0 ? r2(avgWin / avgLoss) : 'N/A',
      profitFactor: profitFactor !== Infinity ? r2(profitFactor) : 'N/A',
      expectancy: r2(expectancy) + '%', maxDrawdown: r2(maxDrawdown * 100) + '%',
      sharpeRatio: sharpe !== null ? r2(sharpe) : 'N/A',
      sortinoRatio: sortino !== null ? r2(sortino) : 'N/A',
      calmarRatio: calmar !== null ? r2(calmar) : 'N/A',
      maxWinStreak: maxWin, maxLoseStreak: maxLose,
    },
    factorContribution, quintileAnalysis, bySector, byFactorCount, byExitReason,
    topWinners: [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(formatTrade),
    topLosers: [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(formatTrade),
    monthlyReturns: equityCurve.map((e, i) => ({
      date: e.date,
      return: i > 0 ? r2(((e.totalEquity / equityCurve[i - 1].totalEquity) - 1) * 100) + '%' : '0%',
    })),
    trades, equityCurve,
  }
}

// ============================== FACTOR CONTRIBUTION ANALYSIS ==============================
export function analyzeFactorContribution(trades: any[]): any {
  const factors = ['momentumPctile', 'valuePctile', 'qualityPctile', 'revisionPctile']
  const result: any = {}

  for (const factor of factors) {
    const pairs = trades.filter(t => t[factor] !== null && t[factor] !== undefined).map(t => ({ score: t[factor], pnl: parseFloat(t.pnlPct) }))
    if (pairs.length < 10) { result[factor] = { ic: null, hitRate: null, count: pairs.length }; continue }

    const sortedByScore = [...pairs].sort((a, b) => b.score - a.score)
    const topHalf = sortedByScore.slice(0, Math.floor(pairs.length / 2))
    const bottomHalf = sortedByScore.slice(Math.floor(pairs.length / 2))
    const topAvgPnl = avg(topHalf.map(p => p.pnl))
    const bottomAvgPnl = avg(bottomHalf.map(p => p.pnl))
    const topWins = topHalf.filter(p => p.pnl > 0).length
    const hitRate = topHalf.length > 0 ? topWins / topHalf.length : 0
    const spread = (topAvgPnl || 0) - (bottomAvgPnl || 0)
    const ic = pearsonCorrelation(pairs.map(p => p.score), pairs.map(p => p.pnl))

    result[factor.replace('Pctile', '')] = {
      informationCoefficient: r2(ic),
      topHalfAvgReturn: r2(topAvgPnl) + '%', bottomHalfAvgReturn: r2(bottomAvgPnl) + '%',
      spread: r2(spread) + '%', hitRate: r2(hitRate * 100) + '%', count: pairs.length,
      verdict: ic !== null && ic > 0.05 ? 'PREDICTIVE' : ic !== null && ic > 0 ? 'WEAK' : 'NOT_PREDICTIVE',
    }
  }
  return result
}

// ============================== QUINTILE RETURNS ANALYSIS ==============================
export function analyzeQuintileReturns(trades: any[]): any {
  const factors = ['compositeScore', 'momentumPctile', 'valuePctile', 'qualityPctile']
  const result: any = {}

  for (const factor of factors) {
    const valid = trades.filter(t => t[factor] !== null && t[factor] !== undefined)
    if (valid.length < 10) continue

    const sorted = [...valid].sort((a, b) => a[factor] - b[factor])
    const quintileSize = Math.floor(sorted.length / 5)
    const quintiles: any = {}

    for (let q = 1; q <= 5; q++) {
      const start = (q - 1) * quintileSize
      const end = q === 5 ? sorted.length : q * quintileSize
      const bucket = sorted.slice(start, end)
      const avgRet = avg(bucket.map(t => parseFloat(t.pnlPct)))
      const wins = bucket.filter(t => t.pnl > 0).length
      quintiles[`Q${q}`] = {
        avgReturn: r2(avgRet) + '%', winRate: r2((wins / bucket.length) * 100) + '%',
        count: bucket.length, avgFactorScore: r2(avg(bucket.map(t => t[factor]))),
      }
    }

    const qReturns = [1, 2, 3, 4, 5].map(q => parseFloat(quintiles[`Q${q}`].avgReturn))
    let monotonic = true
    for (let i = 1; i < qReturns.length; i++) { if (qReturns[i] < qReturns[i - 1]) { monotonic = false; break } }

    const factorName = factor.replace('Pctile', '').replace('Score', '')
    result[factorName] = {
      quintiles, monotonic,
      q5MinusQ1Spread: r2(qReturns[4] - qReturns[0]) + '%',
      verdict: monotonic ? 'STRONG_FACTOR' : 'WEAK/NONLINEAR',
    }
  }
  return result
}

// ============================== SENSITIVITY ANALYSIS ==============================
export function sensitivityAnalysis(universeSnapshots: any[], capitalBase = 10000000): any[] {
  const results: any[] = []

  // Factor weight variations
  const weightSets = [
    { label: 'Default (35/25/20/20)', m: 0.35, v: 0.25, q: 0.20, e: 0.20 },
    { label: 'Momentum-heavy (50/20/15/15)', m: 0.50, v: 0.20, q: 0.15, e: 0.15 },
    { label: 'Value-heavy (20/40/20/20)', m: 0.20, v: 0.40, q: 0.20, e: 0.20 },
    { label: 'Quality-heavy (20/20/40/20)', m: 0.20, v: 0.20, q: 0.40, e: 0.20 },
    { label: 'Equal (25/25/25/25)', m: 0.25, v: 0.25, q: 0.25, e: 0.25 },
    { label: 'Mom+Quality (40/0/40/20)', m: 0.40, v: 0.00, q: 0.40, e: 0.20 },
    { label: 'Mom+Value (40/40/10/10)', m: 0.40, v: 0.40, q: 0.10, e: 0.10 },
    { label: 'Pure Momentum (100/0/0/0)', m: 1.00, v: 0.00, q: 0.00, e: 0.00 },
    { label: 'Pure Value (0/100/0/0)', m: 0.00, v: 1.00, q: 0.00, e: 0.00 },
    { label: 'Pure Quality (0/0/100/0)', m: 0.00, v: 0.00, q: 1.00, e: 0.00 },
  ]

  for (const ws of weightSets) {
    const origWeights = { ...CONFIG.WEIGHTS }
    CONFIG.WEIGHTS.MOMENTUM = ws.m; CONFIG.WEIGHTS.VALUE = ws.v
    CONFIG.WEIGHTS.QUALITY = ws.q; CONFIG.WEIGHTS.EARNINGS_REVISION = ws.e
    const bt = runBacktest(universeSnapshots, capitalBase)
    results.push({
      param: 'Factor Weights', value: ws.label,
      return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown,
      sharpe: bt.summary.sharpeRatio, winRate: bt.summary.winRate, trades: bt.summary.totalTrades,
    })
    Object.assign(CONFIG.WEIGHTS, origWeights)
  }

  // Portfolio size
  for (const n of [10, 15, 20, 25, 30, 50]) {
    const orig = CONFIG.TOP_N_STOCKS
    CONFIG.TOP_N_STOCKS = n
    const bt = runBacktest(universeSnapshots, capitalBase)
    results.push({
      param: 'Portfolio Size', value: `Top ${n}`,
      return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown,
      sharpe: bt.summary.sharpeRatio, winRate: bt.summary.winRate, trades: bt.summary.totalTrades,
    })
    CONFIG.TOP_N_STOCKS = orig
  }

  // Weighting method
  for (const method of ['EQUAL', 'COMPOSITE_WEIGHTED', 'INV_VOL']) {
    const orig = CONFIG.WEIGHTING
    CONFIG.WEIGHTING = method
    const bt = runBacktest(universeSnapshots, capitalBase)
    results.push({
      param: 'Weighting', value: method,
      return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown,
      sharpe: bt.summary.sharpeRatio, winRate: bt.summary.winRate, trades: bt.summary.totalTrades,
    })
    CONFIG.WEIGHTING = orig
  }

  return results
}
