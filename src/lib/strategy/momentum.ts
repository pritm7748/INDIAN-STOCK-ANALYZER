// src/lib/strategy/momentum.ts
// Momentum Trading Strategy Engine — Jegadeesh & Titman methodology for NSE
// 1-Month Holding Period — FULL IMPLEMENTATION

// ============================================================================
// TYPES
// ============================================================================

export interface MomentumConfig {
  LOOKBACK_1M: number
  LOOKBACK_3M: number
  LOOKBACK_6M: number
  WEIGHT_1M: number
  WEIGHT_3M: number
  WEIGHT_6M: number
  TOP_N_STOCKS: number
  HOLDING_PERIOD: number
  MIN_AVG_TURNOVER_CR: number
  VOLUME_DECLINE_THRESHOLD: number
  MAX_ANNUALIZED_VOLATILITY: number
  STOP_LOSS_PCT: number
  TRAILING_STOP_ACTIVATION: number
  TRAILING_STOP_LOOKBACK: number
  NIFTY_SMA_PERIOD: number
  TRADING_DAYS_PER_YEAR: number
  RISK_FREE_RATE: number
  EARNINGS_BLACKOUT_DAYS: number
  MAX_SECTOR_CONCENTRATION: number
}

export interface StockData {
  symbol: string
  name: string
  sector: string
  prices: number[]
  volumes: number[]
  avgDailyTurnoverCr: number
  earningsDate?: string | null  // ISO date string of next earnings
  beta?: number | null
}

export interface MomentumScore {
  symbol: string
  name: string
  sector: string
  composite: number
  ret1m: number
  ret3m: number
  ret6m: number
  volatility: number
  currentPrice: number
  avgDailyTurnoverCr: number
  beta: number | null
}

export interface PortfolioHolding extends MomentumScore {
  rank: number
  weightInvVol: number
  weightEqual: number
  stopLoss: number
  trailingStopLevel: number | null // 10-day low (active only if up 10%+)
  trailingStopActive: boolean
  entrySignal: string // e.g. "Buy at next day's open"
  daysSinceRecentHigh: number
  priceVs52wHigh: number | null
}

export interface FilterResult {
  pass: boolean
  reason?: string
}

export interface MomentumPortfolio {
  date: string
  regime: 'BULL' | 'BEAR'
  signal: 'INVEST' | 'CASH'
  message?: string
  niftyPrice: number
  niftySMA: number
  totalCandidates: number
  passedFilters: number
  filteredOut: { symbol: string; name: string; reason: string }[]
  holdings: PortfolioHolding[]
  allScored: MomentumScore[]
  holdingPeriod: string
  config: MomentumConfig
  performance: PerformanceMetrics
  rebalance: RebalanceInfo
  entryGuidance: EntryGuidance
}

export interface PerformanceMetrics {
  expectedCAGR: string
  expectedWinRate: string
  avgWinnerLoserRatio: string
  maxDrawdownRange: string
  sharpeEstimate: string
  methodology: string
}

export interface RebalanceInfo {
  scanDate: string
  entryDate: string // next trading day
  exitDate: string // ~22 trading days later
  holdingDays: number
  nextScanDate: string
}

export interface EntryGuidance {
  action: string
  timing: string
  sizing: string
  stopLossRule: string
  trailingStopRule: string
  exitRule: string
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_CONFIG: MomentumConfig = {
  LOOKBACK_1M: 22,
  LOOKBACK_3M: 66,
  LOOKBACK_6M: 132,
  WEIGHT_1M: 0.35,
  WEIGHT_3M: 0.40,
  WEIGHT_6M: 0.25,
  TOP_N_STOCKS: 15,
  HOLDING_PERIOD: 22,
  MIN_AVG_TURNOVER_CR: 5,
  VOLUME_DECLINE_THRESHOLD: 0.5,
  MAX_ANNUALIZED_VOLATILITY: 0.50,
  STOP_LOSS_PCT: 0.08,
  TRAILING_STOP_ACTIVATION: 0.10,
  TRAILING_STOP_LOOKBACK: 10,
  NIFTY_SMA_PERIOD: 50,
  TRADING_DAYS_PER_YEAR: 252,
  RISK_FREE_RATE: 0.065,
  EARNINGS_BLACKOUT_DAYS: 5,
  MAX_SECTOR_CONCENTRATION: 3,  // max stocks from one sector
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

function calcReturn(prices: number[], lookback: number): number | null {
  if (!prices || prices.length < lookback + 1) return null
  const current = prices[prices.length - 1]
  const past = prices[prices.length - 1 - lookback]
  if (!past || past === 0) return null
  return (current / past) - 1
}

function calcMomentumScore(prices: number[], cfg: MomentumConfig) {
  const ret1m = calcReturn(prices, cfg.LOOKBACK_1M)
  const ret3m = calcReturn(prices, cfg.LOOKBACK_3M)
  const ret6m = calcReturn(prices, cfg.LOOKBACK_6M)

  if (ret1m === null || ret3m === null || ret6m === null) return null

  const composite =
    cfg.WEIGHT_1M * ret1m +
    cfg.WEIGHT_3M * ret3m +
    cfg.WEIGHT_6M * ret6m

  return { composite, ret1m, ret3m, ret6m }
}

function calcRealizedVolatility(prices: number[], window = 20, tradingDaysPerYear = 252): number | null {
  if (!prices || prices.length < window + 1) return null

  const returns: number[] = []
  for (let i = prices.length - window; i < prices.length; i++) {
    if (prices[i - 1] === 0) return null
    returns.push(Math.log(prices[i] / prices[i - 1]))
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  const dailyVol = Math.sqrt(variance)

  return dailyVol * Math.sqrt(tradingDaysPerYear)
}

function calcAvgVolume(volumes: number[], period: number): number | null {
  if (!volumes || volumes.length < period) return null
  const slice = volumes.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / slice.length
}

/**
 * Calculate 10-day trailing low (for trailing stop)
 */
function calcTrailingStopLevel(prices: number[], lookback: number): number | null {
  if (!prices || prices.length < lookback) return null
  return Math.min(...prices.slice(-lookback))
}

/**
 * Days since the most recent 52-week high
 */
function daysSinceHigh(prices: number[], window = 252): number {
  if (!prices || prices.length < 2) return 0
  const lookback = Math.min(window, prices.length)
  const slice = prices.slice(-lookback)
  const maxPrice = Math.max(...slice)
  const lastIdx = slice.lastIndexOf(maxPrice)
  return slice.length - 1 - lastIdx
}

/**
 * Price vs 52-week high
 */
function priceVs52wHigh(prices: number[]): number | null {
  if (!prices || prices.length < 20) return null
  const window = Math.min(252, prices.length)
  const high = Math.max(...prices.slice(-window))
  if (high === 0) return null
  return prices[prices.length - 1] / high - 1
}

// ============================================================================
// MARKET REGIME
// ============================================================================

export function checkMarketRegime(niftyPrices: number[], smaPeriod: number) {
  if (!niftyPrices || niftyPrices.length < smaPeriod) {
    return { isBull: false, currentPrice: 0, sma: 0 }
  }

  const smaSlice = niftyPrices.slice(-smaPeriod)
  const sma = smaSlice.reduce((s, p) => s + p, 0) / smaPeriod
  const currentPrice = niftyPrices[niftyPrices.length - 1]

  return { isBull: currentPrice > sma, currentPrice, sma }
}

// ============================================================================
// FILTERS
// ============================================================================

function applyFilters(stock: StockData, cfg: MomentumConfig): FilterResult {
  // 1. Liquidity: minimum turnover
  if (stock.avgDailyTurnoverCr < cfg.MIN_AVG_TURNOVER_CR) {
    return { pass: false, reason: `Turnover ₹${stock.avgDailyTurnoverCr.toFixed(1)}cr < ₹${cfg.MIN_AVG_TURNOVER_CR}cr minimum` }
  }

  // 2. Volume participation decline
  const avg20vol = calcAvgVolume(stock.volumes, 20)
  const avg50vol = calcAvgVolume(stock.volumes, 50)
  if (avg20vol !== null && avg50vol !== null && avg50vol > 0) {
    if (avg20vol / avg50vol < cfg.VOLUME_DECLINE_THRESHOLD) {
      return { pass: false, reason: 'Volume declining (20d avg < 50% of 50d avg)' }
    }
  }

  // 3. Volatility cap
  const vol = calcRealizedVolatility(stock.prices, 20, cfg.TRADING_DAYS_PER_YEAR)
  if (vol !== null && vol > cfg.MAX_ANNUALIZED_VOLATILITY) {
    return { pass: false, reason: `Volatility ${(vol * 100).toFixed(1)}% exceeds ${(cfg.MAX_ANNUALIZED_VOLATILITY * 100).toFixed(0)}% cap` }
  }

  // 4. Sufficient price history
  if (!stock.prices || stock.prices.length < cfg.LOOKBACK_6M + 1) {
    return { pass: false, reason: 'Insufficient price history' }
  }

  // 5. Earnings blackout — skip if within N days of earnings
  if (stock.earningsDate) {
    const now = new Date()
    const earnings = new Date(stock.earningsDate)
    const diffMs = earnings.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    // If earnings is between -BLACKOUT and +BLACKOUT days from now, skip
    if (Math.abs(diffDays) <= cfg.EARNINGS_BLACKOUT_DAYS) {
      const dStr = diffDays > 0 ? `in ${Math.ceil(diffDays)}d` : `${Math.abs(Math.floor(diffDays))}d ago`
      return { pass: false, reason: `Earnings blackout (earnings ${dStr}, within ${cfg.EARNINGS_BLACKOUT_DAYS}d window)` }
    }
  }

  return { pass: true }
}

// ============================================================================
// REBALANCE & ENTRY CALCULATIONS
// ============================================================================

function calcRebalanceInfo(holdingPeriod: number): RebalanceInfo {
  const now = new Date()
  const scanDate = now.toISOString().split('T')[0]

  // Next trading day (skip weekends)
  const entry = new Date(now)
  entry.setDate(entry.getDate() + 1)
  while (entry.getDay() === 0 || entry.getDay() === 6) {
    entry.setDate(entry.getDate() + 1)
  }

  // Exit date: ~holdingPeriod trading days from entry
  const exit = new Date(entry)
  let tradingDaysAdded = 0
  while (tradingDaysAdded < holdingPeriod) {
    exit.setDate(exit.getDate() + 1)
    if (exit.getDay() !== 0 && exit.getDay() !== 6) {
      tradingDaysAdded++
    }
  }

  // Next scan date = exit date (re-run the screen)
  return {
    scanDate,
    entryDate: entry.toISOString().split('T')[0],
    exitDate: exit.toISOString().split('T')[0],
    holdingDays: holdingPeriod,
    nextScanDate: exit.toISOString().split('T')[0],
  }
}

function getEntryGuidance(cfg: MomentumConfig): EntryGuidance {
  return {
    action: 'Buy at next day\'s open after signal generation',
    timing: `Enter positions on ${calcRebalanceInfo(cfg.HOLDING_PERIOD).entryDate} at market open`,
    sizing: 'Inverse-volatility weighting — allocate more capital to less volatile picks',
    stopLossRule: `Hard stop-loss at ${(cfg.STOP_LOSS_PCT * 100).toFixed(0)}% below entry price. Exit immediately if breached.`,
    trailingStopRule: `Once a stock is up ${(cfg.TRAILING_STOP_ACTIVATION * 100).toFixed(0)}%+, trail the stop at the ${cfg.TRAILING_STOP_LOOKBACK}-day low. The active stop becomes whichever is higher: hard SL or trailing stop.`,
    exitRule: `Time-based exit after ${cfg.HOLDING_PERIOD} trading days (~1 month). Re-run the scan and rebalance.`,
  }
}

// ============================================================================
// PORTFOLIO CONSTRUCTION
// ============================================================================

export function generateMomentumPortfolio(
  universe: StockData[],
  niftyPrices: number[],
  cfg: MomentumConfig = DEFAULT_CONFIG,
): MomentumPortfolio {
  const now = new Date().toISOString().split('T')[0]
  const rebalance = calcRebalanceInfo(cfg.HOLDING_PERIOD)
  const entryGuidance = getEntryGuidance(cfg)

  // Step 0: Market regime
  const regime = checkMarketRegime(niftyPrices, cfg.NIFTY_SMA_PERIOD)

  const performanceMetrics: PerformanceMetrics = {
    expectedCAGR: '18-28% (academic benchmark)',
    expectedWinRate: '55-62% (academic benchmark)',
    avgWinnerLoserRatio: '1.8 : 1 (academic benchmark)',
    maxDrawdownRange: '20-35% (academic benchmark)',
    sharpeEstimate: '0.8-1.2 (academic benchmark)',
    methodology: 'Jegadeesh & Titman (1993) — Multi-period momentum. Metrics are academic benchmarks, not backtested on this universe.',
  }

  if (!regime.isBull) {
    return {
      date: now,
      regime: 'BEAR',
      signal: 'CASH',
      message: `Nifty ₹${regime.currentPrice.toFixed(0)} is below its ${cfg.NIFTY_SMA_PERIOD}-day SMA of ₹${regime.sma.toFixed(0)} — market regime filter says stay in cash`,
      niftyPrice: regime.currentPrice,
      niftySMA: regime.sma,
      totalCandidates: universe.length,
      passedFilters: 0,
      filteredOut: [],
      holdings: [],
      allScored: [],
      holdingPeriod: `${cfg.HOLDING_PERIOD} trading days (~1 month)`,
      config: cfg,
      performance: performanceMetrics,
      rebalance,
      entryGuidance,
    }
  }

  // Step 1: Score all stocks
  const scored: MomentumScore[] = []
  const filteredOut: { symbol: string; name: string; reason: string }[] = []

  for (const stock of universe) {
    const filterResult = applyFilters(stock, cfg)
    if (!filterResult.pass) {
      filteredOut.push({ symbol: stock.symbol, name: stock.name, reason: filterResult.reason! })
      continue
    }

    const momentum = calcMomentumScore(stock.prices, cfg)
    if (momentum === null) {
      filteredOut.push({ symbol: stock.symbol, name: stock.name, reason: 'Unable to compute momentum (insufficient data)' })
      continue
    }

    const volatility = calcRealizedVolatility(stock.prices, 20, cfg.TRADING_DAYS_PER_YEAR) || 0

    // P1: Risk-adjust composite — divide by volatility for ranking
    const riskAdjustedComposite = volatility > 0
      ? momentum.composite / volatility
      : momentum.composite

    scored.push({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      ...momentum,
      composite: riskAdjustedComposite,
      volatility,
      currentPrice: stock.prices[stock.prices.length - 1],
      avgDailyTurnoverCr: stock.avgDailyTurnoverCr,
      beta: stock.beta || null,
    })
  }

  // P0: Filter out negative-momentum stocks
  const positiveOnly = scored.filter(s => s.composite > 0)

  // Step 2: Rank by risk-adjusted composite score
  positiveOnly.sort((a, b) => b.composite - a.composite)

  // Step 3: Pick top N with sector concentration cap
  const topStocks: typeof positiveOnly = []
  const sectorCount: Record<string, number> = {}
  for (const s of positiveOnly) {
    if (topStocks.length >= cfg.TOP_N_STOCKS) break
    const sec = s.sector || 'Unknown'
    const count = sectorCount[sec] || 0
    if (count >= cfg.MAX_SECTOR_CONCENTRATION) {
      filteredOut.push({ symbol: s.symbol, name: s.name, reason: `Sector cap: ${sec} already has ${cfg.MAX_SECTOR_CONCENTRATION} picks` })
      continue
    }
    topStocks.push(s)
    sectorCount[sec] = count + 1
  }

  // Step 4: Calculate weights (inverse-volatility)
  const totalInvVol = topStocks.reduce((sum, s) => {
    return sum + (s.volatility > 0 ? 1 / s.volatility : 1)
  }, 0)

  const holdings: PortfolioHolding[] = topStocks.map((s, idx) => {
    const invVol = s.volatility > 0 ? 1 / s.volatility : 1
    const weight = invVol / totalInvVol
    const hardStopLoss = s.currentPrice * (1 - cfg.STOP_LOSS_PCT)

    // Find matching stock data for trailing stop calc
    const stockData = universe.find(u => u.symbol === s.symbol)
    const trailingLevel = stockData ? calcTrailingStopLevel(stockData.prices, cfg.TRAILING_STOP_LOOKBACK) : null

    // P0: Trailing stop is NEVER active for new (un-entered) positions.
    // It activates only after entry when position gains >= TRAILING_STOP_ACTIVATION.
    const trailingActive = false

    const dsh = stockData ? daysSinceHigh(stockData.prices) : 0
    const vs52w = stockData ? priceVs52wHigh(stockData.prices) : null

    return {
      ...s,
      rank: idx + 1,
      weightInvVol: weight,
      weightEqual: 1 / topStocks.length,
      stopLoss: hardStopLoss,
      trailingStopLevel: trailingLevel,
      trailingStopActive: trailingActive,
      entrySignal: `Buy at open on ${rebalance.entryDate}`,
      daysSinceRecentHigh: dsh,
      priceVs52wHigh: vs52w,
    }
  })

  return {
    date: now,
    regime: 'BULL',
    signal: 'INVEST',
    niftyPrice: regime.currentPrice,
    niftySMA: regime.sma,
    totalCandidates: universe.length,
    passedFilters: scored.length,
    filteredOut,
    holdings,
    allScored: scored,
    holdingPeriod: `${cfg.HOLDING_PERIOD} trading days (~1 month)`,
    config: cfg,
    performance: performanceMetrics,
    rebalance,
    entryGuidance,
  }
}
