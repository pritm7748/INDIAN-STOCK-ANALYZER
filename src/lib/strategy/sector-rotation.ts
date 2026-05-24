// src/lib/strategy/sector-rotation.ts
// Sector Rotation Strategy — Indian Markets (NSE)
// Relative strength ranking + economic cycle overlay + within-sector momentum

// ============================================================================
// TYPES
// ============================================================================

export interface SRConfig {
  RS_LOOKBACK_1M: number; RS_LOOKBACK_3M: number; RS_LOOKBACK_6M: number
  RS_WEIGHT_1M: number; RS_WEIGHT_3M: number
  TOP_SECTORS: number; STOCKS_PER_SECTOR: number; HOLDING_PERIOD_DAYS: number
  STOCK_MOM_1M_WEIGHT: number; STOCK_MOM_3M_WEIGHT: number; STOCK_MOM_6M_WEIGHT: number
  MIN_AVG_TURNOVER_CR: number; MIN_SECTOR_STOCKS: number; MIN_RS_RATIO_SLOPE_DAYS: number
  EARNINGS_BLACKOUT_DAYS: number
  RS_IMPROVING_THRESHOLD: number; RS_DETERIORATING_THRESHOLD: number
  NIFTY_SMA_PERIOD: number; NIFTY_TREND_SMA: number
  MAX_SECTOR_WEIGHT: number; MAX_STOCK_WEIGHT: number
  STOP_LOSS_PCT: number; STOCK_STOP_LOSS_PCT: number
  WEIGHTING_METHOD: string; CASH_RESERVE_PCT: number
  TRADING_DAYS_PER_YEAR: number; RISK_FREE_RATE: number
}

export interface SectorMeta { name: string; indexSymbol: string; cycleSensitivity: string; cyclePhases: string[]; description: string }
export interface CyclePhaseInfo { description: string; indicators: string[]; leadingSectors: string[]; laggingSectors: string[]; rbiStance: string }

// ============================================================================
// CONFIGURATION
// ============================================================================

export const DEFAULT_SR_CONFIG: SRConfig = {
  RS_LOOKBACK_1M: 22, RS_LOOKBACK_3M: 66, RS_LOOKBACK_6M: 132,
  RS_WEIGHT_1M: 0.50, RS_WEIGHT_3M: 0.50,
  TOP_SECTORS: 3, STOCKS_PER_SECTOR: 3, HOLDING_PERIOD_DAYS: 22,
  STOCK_MOM_1M_WEIGHT: 0.40, STOCK_MOM_3M_WEIGHT: 0.40, STOCK_MOM_6M_WEIGHT: 0.20,
  MIN_AVG_TURNOVER_CR: 5, MIN_SECTOR_STOCKS: 3, MIN_RS_RATIO_SLOPE_DAYS: 10,
  EARNINGS_BLACKOUT_DAYS: 5,
  RS_IMPROVING_THRESHOLD: 1.0, RS_DETERIORATING_THRESHOLD: 0.98,
  NIFTY_SMA_PERIOD: 50, NIFTY_TREND_SMA: 200,
  MAX_SECTOR_WEIGHT: 0.40, MAX_STOCK_WEIGHT: 0.15,
  STOP_LOSS_PCT: 0.10, STOCK_STOP_LOSS_PCT: 0.08,
  WEIGHTING_METHOD: 'RS_WEIGHTED', CASH_RESERVE_PCT: 0.05,
  TRADING_DAYS_PER_YEAR: 252, RISK_FREE_RATE: 0.065,
}

export const SECTORS: Record<string, SectorMeta> = {
  BANK: { name: 'Nifty Bank', indexSymbol: 'NIFTY_BANK', cycleSensitivity: 'HIGH', cyclePhases: ['EARLY_RECOVERY'], description: 'Private & PSU banks' },
  IT: { name: 'Nifty IT', indexSymbol: 'NIFTY_IT', cycleSensitivity: 'MODERATE', cyclePhases: ['LATE_EXPANSION', 'SLOWDOWN'], description: 'IT services — benefits from weak ₹' },
  PHARMA: { name: 'Nifty Pharma', indexSymbol: 'NIFTY_PHARMA', cycleSensitivity: 'LOW', cyclePhases: ['SLOWDOWN'], description: 'Defensive — pharma & healthcare' },
  FMCG: { name: 'Nifty FMCG', indexSymbol: 'NIFTY_FMCG', cycleSensitivity: 'LOW', cyclePhases: ['SLOWDOWN'], description: 'Defensive — consumer staples' },
  METAL: { name: 'Nifty Metal', indexSymbol: 'NIFTY_METAL', cycleSensitivity: 'HIGH', cyclePhases: ['MID_EXPANSION', 'LATE_EXPANSION'], description: 'Commodities — steel, aluminium, mining' },
  REALTY: { name: 'Nifty Realty', indexSymbol: 'NIFTY_REALTY', cycleSensitivity: 'VERY_HIGH', cyclePhases: ['EARLY_RECOVERY'], description: 'Real estate — very rate-sensitive' },
  AUTO: { name: 'Nifty Auto', indexSymbol: 'NIFTY_AUTO', cycleSensitivity: 'HIGH', cyclePhases: ['EARLY_RECOVERY'], description: 'Automobiles — consumer discretionary' },
  ENERGY: { name: 'Nifty Energy', indexSymbol: 'NIFTY_ENERGY', cycleSensitivity: 'MODERATE', cyclePhases: ['LATE_EXPANSION'], description: 'Oil, gas, power — commodity linked' },
  FINANCIAL: { name: 'Nifty Financial Services', indexSymbol: 'NIFTY_FIN', cycleSensitivity: 'HIGH', cyclePhases: ['EARLY_RECOVERY', 'MID_EXPANSION'], description: 'Banks + NBFCs + insurance' },
  PSU_BANK: { name: 'Nifty PSU Bank', indexSymbol: 'NIFTY_PSU_BANK', cycleSensitivity: 'VERY_HIGH', cyclePhases: ['EARLY_RECOVERY'], description: 'Government-owned banks — high beta' },
  MEDIA: { name: 'Nifty Media', indexSymbol: 'NIFTY_MEDIA', cycleSensitivity: 'MODERATE', cyclePhases: ['MID_EXPANSION'], description: 'Media & entertainment' },
  INFRA: { name: 'Nifty Infra', indexSymbol: 'NIFTY_INFRA', cycleSensitivity: 'HIGH', cyclePhases: ['MID_EXPANSION'], description: 'Infrastructure & capital goods' },
}

export const ECONOMIC_CYCLE: Record<string, CyclePhaseInfo> = {
  EARLY_RECOVERY: { description: 'RBI cutting rates, liquidity flush, credit growth resuming', indicators: ['RBI rate cuts', 'Rising liquidity', 'Improving credit growth'], leadingSectors: ['BANK', 'AUTO', 'REALTY', 'FINANCIAL', 'PSU_BANK'], laggingSectors: ['IT', 'PHARMA'], rbiStance: 'DOVISH' },
  MID_EXPANSION: { description: 'GDP rising, corporate earnings growing, capex cycle picking up', indicators: ['GDP acceleration', 'Earnings upgrades', 'Rising IIP'], leadingSectors: ['INFRA', 'METAL', 'MEDIA', 'FINANCIAL'], laggingSectors: ['FMCG'], rbiStance: 'NEUTRAL' },
  LATE_EXPANSION: { description: 'Inflation rising, RBI may hike, commodity prices elevated', indicators: ['Rising CPI/WPI', 'RBI hawkish commentary', 'High commodity prices'], leadingSectors: ['ENERGY', 'METAL', 'IT'], laggingSectors: ['REALTY', 'AUTO'], rbiStance: 'HAWKISH' },
  SLOWDOWN: { description: 'RBI tightening, global slowdown concerns, flight to safety', indicators: ['Rate hikes', 'Slowing GDP', 'FII outflows'], leadingSectors: ['PHARMA', 'FMCG', 'IT'], laggingSectors: ['BANK', 'REALTY', 'METAL', 'PSU_BANK'], rbiStance: 'HAWKISH' },
}

// ============================================================================
// UTILITY
// ============================================================================

function r2(n: number | null | undefined): number | null {
  return n !== null && n !== undefined && !isNaN(n) ? Math.round(n * 100) / 100 : null
}

function formatTrade(t: any) {
  return { symbol: t.symbol, sector: t.sector, entry: `${t.entryDate} @ ₹${t.entryPrice}`, exit: `${t.exitDate} @ ₹${t.exitPrice}`, pnlPct: t.pnlPct, holdingDays: t.holdingDays, exitReason: t.exitReason }
}

function calcStreaks(trades: any[]) {
  let maxWin = 0, maxLose = 0, curWin = 0, curLose = 0
  for (const t of trades) {
    if (t.pnl > 0) { curWin++; curLose = 0; maxWin = Math.max(maxWin, curWin) }
    else { curLose++; curWin = 0; maxLose = Math.max(maxLose, curLose) }
  }
  return { maxWin, maxLose }
}

function calcRatio(returns: number[], periodsPerYear: number, type: string, cfg: SRConfig = DEFAULT_SR_CONFIG): number | null {
  if (!returns || returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const annReturn = mean * periodsPerYear
  if (type === 'sharpe') {
    const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1))
    if (std === 0) return null
    return (annReturn - cfg.RISK_FREE_RATE) / (std * Math.sqrt(periodsPerYear))
  } else {
    const down = returns.filter(r => r < 0)
    if (down.length === 0) return Infinity
    const dsDev = Math.sqrt(down.reduce((s, r) => s + r ** 2, 0) / down.length)
    if (dsDev === 0) return Infinity
    return (annReturn - cfg.RISK_FREE_RATE) / (dsDev * Math.sqrt(periodsPerYear))
  }
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

export function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0; for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result[i] = sum / period
  }
  return result
}

export function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length < period) return result
  let sum = 0; for (let i = 0; i < period; i++) sum += data[i]
  result[period - 1] = sum / period
  const k = 2 / (period + 1)
  for (let i = period; i < data.length; i++) result[i] = (data[i] - result[i - 1]!) * k + result[i - 1]!
  return result
}

export function calcVolatility(prices: number[], window: number = 20, tradingDays: number = 252): number | null {
  if (prices.length < window + 1) return null
  const rets: number[] = []
  for (let i = prices.length - window; i < prices.length; i++) {
    if (prices[i - 1] === 0) return null
    rets.push(Math.log(prices[i] / prices[i - 1]))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  return Math.sqrt(variance) * Math.sqrt(tradingDays)
}

export function calcReturn(prices: number[], lookback: number): number | null {
  if (!prices || prices.length < lookback + 1) return null
  const curr = prices[prices.length - 1]; const prev = prices[prices.length - 1 - lookback]
  if (!prev || prev === 0) return null
  return (curr / prev) - 1
}

export function calcSlope(data: (number | null)[], period: number): number | null {
  const validData = data.filter(v => v !== null) as number[]
  if (validData.length < period) return null
  const slice = validData.slice(-period); const n = slice.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) { sumX += i; sumY += slice[i]; sumXY += i * slice[i]; sumX2 += i * i }
  const denom = (n * sumX2) - (sumX * sumX)
  if (denom === 0) return 0
  return ((n * sumXY) - (sumX * sumY)) / denom
}

// ============================================================================
// RELATIVE STRENGTH ENGINE
// ============================================================================

export function calcRSRatio(sectorPrices: number[], benchmarkPrices: number[]): (number | null)[] {
  const len = Math.min(sectorPrices.length, benchmarkPrices.length)
  const rsRatio: (number | null)[] = new Array(len).fill(null)
  for (let i = 0; i < len; i++) {
    if (benchmarkPrices[i] && benchmarkPrices[i] !== 0) rsRatio[i] = sectorPrices[i] / benchmarkPrices[i]
  }
  return rsRatio
}

export function calcRSMomentum(rsRatio: (number | null)[], lookback: number): number | null {
  const len = rsRatio.length
  if (len < lookback + 1) return null
  const current = rsRatio[len - 1]; const past = rsRatio[len - 1 - lookback]
  if (current === null || past === null || past === 0) return null
  return current / past
}

export function analyzeSectorRS(sectorPrices: number[], niftyPrices: number[], sectorKey: string, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const rsRatio = calcRSRatio(sectorPrices, niftyPrices)
  const rs1M = calcRSMomentum(rsRatio, cfg.RS_LOOKBACK_1M)
  const rs3M = calcRSMomentum(rsRatio, cfg.RS_LOOKBACK_3M)
  const rs6M = calcRSMomentum(rsRatio, cfg.RS_LOOKBACK_6M)
  let compositeScore: number | null = null
  if (rs1M !== null && rs3M !== null) compositeScore = cfg.RS_WEIGHT_1M * rs1M + cfg.RS_WEIGHT_3M * rs3M
  const rsSlope = calcSlope(rsRatio, cfg.MIN_RS_RATIO_SLOPE_DAYS)
  const sectorReturn1M = calcReturn(sectorPrices, cfg.RS_LOOKBACK_1M)
  const sectorReturn3M = calcReturn(sectorPrices, cfg.RS_LOOKBACK_3M)
  const sectorVol = calcVolatility(sectorPrices)
  let rsTrend = 'NEUTRAL'
  if (rs1M !== null) {
    if (rs1M > 1.02 && rsSlope !== null && rsSlope > 0) rsTrend = 'STRONG_IMPROVING'
    else if (rs1M > 1.0) rsTrend = 'IMPROVING'
    else if (rs1M > 0.98) rsTrend = 'NEUTRAL'
    else if (rs1M > 0.95) rsTrend = 'WEAKENING'
    else rsTrend = 'STRONG_WEAKENING'
  }
  const currentRSRatio = rsRatio[rsRatio.length - 1]
  const rsRatioSMA = calcSMA(rsRatio.filter(v => v !== null) as number[], 10)
  const normalizedRSRatio = currentRSRatio && rsRatioSMA.length > 0 ? currentRSRatio / rsRatioSMA[rsRatioSMA.length - 1]! : null
  let rrgQuadrant = 'UNKNOWN'
  if (normalizedRSRatio !== null && rs1M !== null) {
    if (normalizedRSRatio > 1.0 && rs1M > 1.0) rrgQuadrant = 'LEADING'
    else if (normalizedRSRatio > 1.0 && rs1M <= 1.0) rrgQuadrant = 'WEAKENING'
    else if (normalizedRSRatio <= 1.0 && rs1M <= 1.0) rrgQuadrant = 'LAGGING'
    else rrgQuadrant = 'IMPROVING'
  }
  const sectorMeta = SECTORS[sectorKey] || {} as any
  return {
    sector: sectorKey, sectorName: sectorMeta.name || sectorKey, cycleSensitivity: sectorMeta.cycleSensitivity || 'UNKNOWN',
    rsRatio: r2(currentRSRatio), rs1M: r2(rs1M), rs3M: r2(rs3M), rs6M: r2(rs6M),
    compositeScore: r2(compositeScore), rsSlope: rsSlope !== null ? r2(rsSlope * 10000) : null, rsTrend, rrgQuadrant,
    return1M: sectorReturn1M !== null ? r2(sectorReturn1M * 100) + '%' : null,
    return3M: sectorReturn3M !== null ? r2(sectorReturn3M * 100) + '%' : null,
    volatility: sectorVol !== null ? r2(sectorVol * 100) + '%' : null,
    rsRatioArray: rsRatio, pricesArray: sectorPrices,
  }
}

// ============================================================================
// ECONOMIC CYCLE DETECTION
// ============================================================================

export function detectEconomicPhase(sectorAnalyses: any, macroData: any = null) {
  if (macroData && macroData.rbiStance) return detectFromMacro(macroData)
  return detectFromSectorRS(sectorAnalyses)
}

function detectFromMacro(macroData: any) {
  const { rbiStance, gdpTrend, inflationTrend, creditGrowth } = macroData
  const scores: Record<string, number> = { EARLY_RECOVERY: 0, MID_EXPANSION: 0, LATE_EXPANSION: 0, SLOWDOWN: 0 }
  if (rbiStance === 'DOVISH' || rbiStance === 'ACCOMMODATIVE') scores.EARLY_RECOVERY += 3
  else if (rbiStance === 'NEUTRAL') { scores.MID_EXPANSION += 2; scores.EARLY_RECOVERY += 1 }
  else if (rbiStance === 'HAWKISH' || rbiStance === 'TIGHTENING') { scores.LATE_EXPANSION += 2; scores.SLOWDOWN += 2 }
  if (gdpTrend === 'ACCELERATING') scores.MID_EXPANSION += 3
  else if (gdpTrend === 'STABLE_HIGH') scores.LATE_EXPANSION += 2
  else if (gdpTrend === 'DECELERATING') scores.SLOWDOWN += 3
  else if (gdpTrend === 'RECOVERING') scores.EARLY_RECOVERY += 3
  if (inflationTrend === 'RISING') scores.LATE_EXPANSION += 3
  else if (inflationTrend === 'HIGH') scores.SLOWDOWN += 2
  else if (inflationTrend === 'FALLING') scores.EARLY_RECOVERY += 2
  else if (inflationTrend === 'LOW') { scores.EARLY_RECOVERY += 1; scores.MID_EXPANSION += 1 }
  if (creditGrowth === 'ACCELERATING') { scores.EARLY_RECOVERY += 2; scores.MID_EXPANSION += 2 }
  else if (creditGrowth === 'SLOWING') scores.SLOWDOWN += 2
  let bestPhase = 'MID_EXPANSION', bestScore = 0
  for (const [phase, score] of Object.entries(scores)) { if (score > bestScore) { bestScore = score; bestPhase = phase } }
  const confidence = Math.min(bestScore / 11, 1.0)
  return { phase: bestPhase, phaseInfo: ECONOMIC_CYCLE[bestPhase], confidence: r2(confidence * 100) + '%', scores, source: 'MACRO_DATA', inputs: macroData }
}

function detectFromSectorRS(sectorAnalyses: any) {
  const scores: Record<string, number> = { EARLY_RECOVERY: 0, MID_EXPANSION: 0, LATE_EXPANSION: 0, SLOWDOWN: 0 }
  for (const [sectorKey, analysis] of Object.entries(sectorAnalyses) as [string, any][]) {
    const meta = SECTORS[sectorKey]; if (!meta || !meta.cyclePhases) continue
    let multiplier = 0
    if (analysis.rrgQuadrant === 'LEADING') multiplier = 3
    else if (analysis.rrgQuadrant === 'IMPROVING') multiplier = 2
    else if (analysis.rrgQuadrant === 'WEAKENING') multiplier = -1
    else if (analysis.rrgQuadrant === 'LAGGING') multiplier = -2
    for (const phase of meta.cyclePhases) scores[phase] = (scores[phase] || 0) + multiplier
  }
  let bestPhase = 'MID_EXPANSION', bestScore = -Infinity
  for (const [phase, score] of Object.entries(scores)) { if (score > bestScore) { bestScore = score; bestPhase = phase } }
  const allScores = Object.values(scores)
  const maxPossible = Math.max(...allScores) - Math.min(...allScores)
  const confidence = maxPossible > 0 ? Math.min((bestScore - Math.min(...allScores)) / maxPossible, 1.0) : 0.5
  return { phase: bestPhase, phaseInfo: ECONOMIC_CYCLE[bestPhase], confidence: r2(confidence * 100) + '%', scores, source: 'SECTOR_RS_INFERENCE', note: 'Inferred from sector relative strength patterns — provide macro data for higher accuracy' }
}

// ============================================================================
// SECTOR RANKING ENGINE
// ============================================================================

export function rankSectors(sectorData: Record<string, { prices: number[] }>, niftyPrices: number[], macroData: any = null, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const analyses: Record<string, any> = {}; const ranked: any[] = []
  for (const [sectorKey, data] of Object.entries(sectorData)) {
    if (!data.prices || data.prices.length < cfg.RS_LOOKBACK_3M + 10) continue
    const analysis = analyzeSectorRS(data.prices, niftyPrices, sectorKey, cfg)
    analyses[sectorKey] = analysis
    if (analysis.compositeScore !== null) {
      ranked.push({ sector: sectorKey, sectorName: analysis.sectorName, compositeScore: analysis.compositeScore, rs1M: analysis.rs1M, rs3M: analysis.rs3M, rsTrend: analysis.rsTrend, rrgQuadrant: analysis.rrgQuadrant, return1M: analysis.return1M, return3M: analysis.return3M, volatility: analysis.volatility, cycleSensitivity: analysis.cycleSensitivity })
    }
  }
  ranked.sort((a, b) => b.compositeScore - a.compositeScore)
  ranked.forEach((s, i) => { s.rank = i + 1 })
  const economicPhase = detectEconomicPhase(analyses, macroData)
  const cycleAdjusted = ranked.map(s => {
    let cycleBonus = 0; const phaseInfo = ECONOMIC_CYCLE[economicPhase.phase]
    if (phaseInfo) {
      if (phaseInfo.leadingSectors.includes(s.sector)) cycleBonus = 0.02
      if (phaseInfo.laggingSectors.includes(s.sector)) cycleBonus = -0.02
    }
    return { ...s, cycleBonus: r2(cycleBonus), adjustedScore: r2(s.compositeScore + cycleBonus), cycleAlignment: cycleBonus > 0 ? 'FAVORABLE' : cycleBonus < 0 ? 'UNFAVORABLE' : 'NEUTRAL' }
  })
  cycleAdjusted.sort((a, b) => b.adjustedScore - a.adjustedScore)
  cycleAdjusted.forEach((s, i) => { s.adjustedRank = i + 1 })
  const topSectors = cycleAdjusted.slice(0, cfg.TOP_SECTORS)
  const bottomSectors = cycleAdjusted.slice(-cfg.TOP_SECTORS)
  return { allSectors: cycleAdjusted, topSectors, bottomSectors, economicPhase, sectorCount: ranked.length, analyses }
}

// ============================================================================
// STOCK SELECTION
// ============================================================================

export function calcStockMomentum(prices: number[], cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const ret1m = calcReturn(prices, cfg.RS_LOOKBACK_1M)
  const ret3m = calcReturn(prices, cfg.RS_LOOKBACK_3M)
  const ret6m = calcReturn(prices, cfg.RS_LOOKBACK_6M)
  if (ret1m === null || ret3m === null) return null
  const r6m = ret6m !== null ? ret6m : 0
  const w6m = ret6m !== null ? cfg.STOCK_MOM_6M_WEIGHT : 0
  const totalWeight = cfg.STOCK_MOM_1M_WEIGHT + cfg.STOCK_MOM_3M_WEIGHT + w6m
  const composite = (cfg.STOCK_MOM_1M_WEIGHT * ret1m + cfg.STOCK_MOM_3M_WEIGHT * ret3m + w6m * r6m) / totalWeight
  return { composite, ret1m, ret3m, ret6m }
}

export function selectStocksInSector(sectorStocks: any[], count: number = DEFAULT_SR_CONFIG.STOCKS_PER_SECTOR, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const scored: any[] = []
  for (const stock of sectorStocks) {
    if (stock.avgDailyTurnoverCr == null || stock.avgDailyTurnoverCr < cfg.MIN_AVG_TURNOVER_CR) continue
    if (!stock.prices || stock.prices.length < cfg.RS_LOOKBACK_3M + 10) continue
    const momentum = calcStockMomentum(stock.prices, cfg); if (!momentum) continue
    const vol = calcVolatility(stock.prices)
    let volumeHealthy = true
    if (stock.volumes && stock.volumes.length >= 50) {
      const avg20 = stock.volumes.slice(-20).reduce((s: number, v: number) => s + v, 0) / 20
      const avg50 = stock.volumes.slice(-50).reduce((s: number, v: number) => s + v, 0) / 50
      if (avg50 > 0 && avg20 / avg50 < 0.5) volumeHealthy = false
    }
    scored.push({ symbol: stock.symbol, name: stock.name, momentumScore: momentum.composite, ret1m: momentum.ret1m, ret3m: momentum.ret3m, ret6m: momentum.ret6m, volatility: vol, currentPrice: stock.prices[stock.prices.length - 1], volumeHealthy, avgDailyTurnoverCr: stock.avgDailyTurnoverCr || 0 })
  }
  const healthy = scored.filter(s => s.volumeHealthy)
  const pool = healthy.length >= count ? healthy : scored
  pool.sort((a, b) => b.momentumScore - a.momentumScore)
  return pool.slice(0, count)
}

// ============================================================================
// MARKET REGIME
// ============================================================================

export function checkMarketRegime(niftyPrices: number[], cfg: SRConfig = DEFAULT_SR_CONFIG) {
  if (!niftyPrices || niftyPrices.length < cfg.NIFTY_TREND_SMA + 1) return { regime: 'UNKNOWN', tradeable: false, reason: 'Insufficient Nifty data' }
  const sma50 = calcSMA(niftyPrices, cfg.NIFTY_SMA_PERIOD); const sma200 = calcSMA(niftyPrices, cfg.NIFTY_TREND_SMA)
  const currentNifty = niftyPrices[niftyPrices.length - 1]
  const curr50 = sma50[sma50.length - 1]; const curr200 = sma200[sma200.length - 1]
  if (curr200 === null) return { regime: 'UNKNOWN', tradeable: false, reason: '200-SMA not available' }
  const above50 = curr50 !== null && currentNifty > curr50
  const above200 = currentNifty > curr200
  const sma50Above200 = curr50 !== null && curr50 > curr200
  let regime: string, tradeable: boolean
  if (above200 && above50 && sma50Above200) { regime = 'STRONG_BULL'; tradeable = true }
  else if (above200 && above50) { regime = 'BULL'; tradeable = true }
  else if (above200) { regime = 'CAUTIOUS_BULL'; tradeable = true }
  else { regime = 'BEAR'; tradeable = false }
  return { regime, tradeable, nifty: r2(currentNifty), sma50: r2(curr50), sma200: r2(curr200), reason: tradeable ? null : 'Nifty below 200-SMA — stay in cash or reduce exposure' }
}

// ============================================================================
// PORTFOLIO CONSTRUCTION
// ============================================================================

export function buildPortfolio(sectorData: Record<string, { prices: number[] }>, stockBySector: Record<string, any[]>, niftyPrices: number[], totalCapital: number, macroData: any = null, currentDate: string | null = null, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const regime = checkMarketRegime(niftyPrices, cfg)
  if (!regime.tradeable) return { date: currentDate, regime, signal: 'CASH', message: regime.reason, holdings: [] }
  const sectorRanking = rankSectors(sectorData, niftyPrices, macroData, cfg)
  const allHoldings: any[] = []; const sectorAllocations: any[] = []
  for (const topSector of sectorRanking.topSectors) {
    const sectorStocks = stockBySector[topSector.sector] || []
    if (sectorStocks.length < cfg.MIN_SECTOR_STOCKS) {
      sectorAllocations.push({ sector: topSector.sector, sectorName: topSector.sectorName, skipped: true, reason: `Only ${sectorStocks.length} stocks (need ${cfg.MIN_SECTOR_STOCKS})` }); continue
    }
    const selectedStocks = selectStocksInSector(sectorStocks, cfg.STOCKS_PER_SECTOR, cfg)
    sectorAllocations.push({ sector: topSector.sector, sectorName: topSector.sectorName, rank: topSector.adjustedRank, compositeScore: topSector.adjustedScore, rsTrend: topSector.rsTrend, rrgQuadrant: topSector.rrgQuadrant, cycleAlignment: topSector.cycleAlignment, stocksSelected: selectedStocks.length })
    for (const stock of selectedStocks) allHoldings.push({ ...stock, sector: topSector.sector, sectorName: topSector.sectorName, sectorRank: topSector.adjustedRank, sectorScore: topSector.adjustedScore })
  }
  const weighted = calcPortfolioWeights(allHoldings, sectorRanking, totalCapital, cfg)
  return { date: currentDate, regime, signal: 'INVEST', economicPhase: sectorRanking.economicPhase, sectorRanking: sectorRanking.allSectors, topSectors: sectorAllocations, bottomSectors: sectorRanking.bottomSectors.map((s: any) => ({ sector: s.sector, sectorName: s.sectorName, adjustedScore: s.adjustedScore, rsTrend: s.rsTrend })), holdings: weighted, portfolioStats: calcPortfolioStats(weighted, totalCapital, cfg), nextRebalance: `${cfg.HOLDING_PERIOD_DAYS} trading days` }
}

export function calcPortfolioWeights(holdings: any[], sectorRanking: any, totalCapital: number, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  if (holdings.length === 0) return []
  const investableCapital = totalCapital * (1 - cfg.CASH_RESERVE_PCT)
  if (cfg.WEIGHTING_METHOD === 'EQUAL') return calcEqualWeights(holdings, investableCapital, cfg)
  else if (cfg.WEIGHTING_METHOD === 'INV_VOL') return calcInvVolWeights(holdings, investableCapital, cfg)
  else return calcRSWeights(holdings, sectorRanking, investableCapital, cfg)
}

function calcEqualWeights(holdings: any[], capital: number, cfg: SRConfig) {
  const weight = 1 / holdings.length
  return holdings.map(h => ({ ...h, weight: r2(weight), allocatedCapital: Math.round(weight * capital), shares: Math.floor((weight * capital) / h.currentPrice), stopLoss: r2(h.currentPrice * (1 - cfg.STOCK_STOP_LOSS_PCT)) }))
}

function calcInvVolWeights(holdings: any[], capital: number, cfg: SRConfig) {
  const totalInvVol = holdings.reduce((sum: number, h: any) => sum + (h.volatility && h.volatility > 0 ? 1 / h.volatility : 1), 0)
  return holdings.map(h => {
    const invVol = h.volatility && h.volatility > 0 ? 1 / h.volatility : 1
    let weight = Math.min(invVol / totalInvVol, cfg.MAX_STOCK_WEIGHT)
    return { ...h, weight: r2(weight), allocatedCapital: Math.round(weight * capital), shares: Math.floor((weight * capital) / h.currentPrice), stopLoss: r2(h.currentPrice * (1 - cfg.STOCK_STOP_LOSS_PCT)) }
  })
}

function calcRSWeights(holdings: any[], sectorRanking: any, capital: number, cfg: SRConfig) {
  const sectorScores: Record<string, number> = {}
  for (const s of sectorRanking.topSectors) sectorScores[s.sector] = Math.max(s.adjustedScore, 0.001)
  const totalSectorScore = Object.values(sectorScores).reduce((s, v) => s + v, 0)
  const bySector: Record<string, any[]> = {}
  for (const h of holdings) { if (!bySector[h.sector]) bySector[h.sector] = []; bySector[h.sector].push(h) }
  const result: any[] = []
  for (const [sector, stocks] of Object.entries(bySector)) {
    let sectorWeight = Math.min((sectorScores[sector] || 0) / totalSectorScore, cfg.MAX_SECTOR_WEIGHT)
    const perStockWeight = sectorWeight / stocks.length
    for (const stock of stocks) {
      const weight = Math.min(perStockWeight, cfg.MAX_STOCK_WEIGHT)
      result.push({ ...stock, sectorWeight: r2(sectorWeight), weight: r2(weight), allocatedCapital: Math.round(weight * capital), shares: Math.floor((weight * capital) / stock.currentPrice), stopLoss: r2(stock.currentPrice * (1 - cfg.STOCK_STOP_LOSS_PCT)) })
    }
  }
  return result
}

export function calcPortfolioStats(holdings: any[], totalCapital: number, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  if (holdings.length === 0) return {}
  const totalInvested = holdings.reduce((s: number, h: any) => s + (h.allocatedCapital || 0), 0)
  const sectorWeights: Record<string, number> = {}
  for (const h of holdings) sectorWeights[h.sectorName || h.sector] = (sectorWeights[h.sectorName || h.sector] || 0) + (h.weight || 0)
  const weightedVol = Math.sqrt(holdings.reduce((sum: number, h: any) => { const w = h.weight || 0; const v = h.volatility || 0.2; return sum + (w * v) ** 2 }, 0))
  const hhi = holdings.reduce((sum: number, h: any) => sum + ((h.weight || 0) * 100) ** 2, 0)
  return { totalHoldings: holdings.length, totalInvested: Math.round(totalInvested), cashReserve: Math.round(totalCapital - totalInvested), investedPct: r2((totalInvested / totalCapital) * 100) + '%', sectorConcentration: Object.entries(sectorWeights).map(([s, w]) => ({ sector: s, weight: r2(w * 100) + '%' })).sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight)), portfolioVolatility: r2(weightedVol * 100) + '%', hhiIndex: Math.round(hhi), diversification: hhi > 2000 ? 'CONCENTRATED' : hhi > 1200 ? 'MODERATE' : 'DIVERSIFIED', maxStockWeight: r2(Math.max(...holdings.map((h: any) => h.weight || 0)) * 100) + '%' }
}

// ============================================================================
// POSITION MONITORING
// ============================================================================

export function monitorPortfolio(holdings: any[], currentStockPrices: Record<string, number>, daysSinceRebalance: number, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const actions: any[] = []; let portfolioLevelStop = false; let totalPnl = 0; let totalAllocated = 0
  for (const h of holdings) {
    const currentPrice = currentStockPrices[h.symbol]; if (currentPrice === undefined) continue
    const pnlPct = (currentPrice / h.currentPrice) - 1; const pnl = (currentPrice - h.currentPrice) * (h.shares || 0)
    totalPnl += pnl; totalAllocated += h.allocatedCapital || 0
    if (currentPrice <= h.stopLoss) {
      actions.push({ symbol: h.symbol, sector: h.sector, action: 'EXIT', reason: 'STOCK_STOP_LOSS', entryPrice: h.currentPrice, currentPrice: r2(currentPrice), pnlPct: r2(pnlPct * 100) + '%', urgency: 'IMMEDIATE' })
    } else {
      actions.push({ symbol: h.symbol, sector: h.sector, action: 'HOLD', entryPrice: h.currentPrice, currentPrice: r2(currentPrice), pnlPct: r2(pnlPct * 100) + '%', distanceToStop: r2(((currentPrice - h.stopLoss) / currentPrice) * 100) + '%' })
    }
  }
  const portfolioPnlPct = totalAllocated > 0 ? totalPnl / totalAllocated : 0
  if (portfolioPnlPct <= -cfg.STOP_LOSS_PCT) portfolioLevelStop = true
  const rebalanceDue = daysSinceRebalance >= cfg.HOLDING_PERIOD_DAYS
  return { daysSinceRebalance, portfolioPnlPct: r2(portfolioPnlPct * 100) + '%', portfolioStopTriggered: portfolioLevelStop, rebalanceDue, stockActions: actions, exitCount: actions.filter(a => a.action === 'EXIT').length, recommendation: portfolioLevelStop ? 'EXIT ALL — portfolio stop-loss breached' : rebalanceDue ? 'REBALANCE — re-run sector ranking and rebuild portfolio' : 'HOLD — continue monitoring' }
}

// ============================================================================
// ROTATION HEATMAP
// ============================================================================

export function generateRotationHeatmap(sectorData: Record<string, { prices: number[] }>, niftyPrices: number[], lookbackPoints: number[] | null = null, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  if (!lookbackPoints) {
    lookbackPoints = []
    for (let offset = 0; offset <= 5; offset++) { const idx = niftyPrices.length - 1 - (offset * 22); if (idx > cfg.RS_LOOKBACK_3M) lookbackPoints.unshift(idx) }
  }
  const heatmap: Record<number, Record<string, any>> = {}; const sectorKeys = Object.keys(sectorData)
  for (const point of lookbackPoints) {
    const row: Record<string, any> = {}
    for (const sectorKey of sectorKeys) {
      const sectorPrices = sectorData[sectorKey].prices; if (!sectorPrices || sectorPrices.length <= point) continue
      const slicedSector = sectorPrices.slice(0, point + 1); const slicedNifty = niftyPrices.slice(0, point + 1)
      const rsRatio = calcRSRatio(slicedSector, slicedNifty); const rs1M = calcRSMomentum(rsRatio, cfg.RS_LOOKBACK_1M)
      let status: string
      if (rs1M === null) status = '—'
      else if (rs1M > 1.03) status = '▲▲'
      else if (rs1M > 1.01) status = '▲'
      else if (rs1M > 0.99) status = '●'
      else if (rs1M > 0.97) status = '▼'
      else status = '▼▼'
      row[sectorKey] = { rs1M: r2(rs1M), status, return1M: r2(calcReturn(slicedSector, Math.min(22, slicedSector.length - 1))! * 100) + '%' }
    }
    heatmap[point] = row
  }
  return { heatmap, lookbackPoints, sectors: sectorKeys }
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function findStockInSector(stocksBySector: Record<string, any[]>, symbol: string) {
  for (const stocks of Object.values(stocksBySector)) { const found = stocks.find((s: any) => s.symbol === symbol); if (found) return found }
  return null
}

export function runBacktest(data: { sectorIndices: Record<string, { prices: number[] }>; stocksBySector: Record<string, any[]>; niftyPrices: number[]; dates: string[]; macroHistory?: any[] }, capitalBase: number = 10000000, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const { sectorIndices, stocksBySector, niftyPrices, dates, macroHistory } = data
  let capital = capitalBase; const tradeLog: any[] = []; const equityCurve: any[] = []; const rotationLog: any[] = []
  let peakEquity = capitalBase, maxDrawdown = 0; let currentHoldings: any[] = []; let holdingEntryDay = 0
  const startDay = cfg.RS_LOOKBACK_6M + 10
  for (let day = startDay; day < dates.length; day++) {
    const currentDate = dates[day]; const daysSinceRebalance = day - holdingEntryDay
    const isRebalanceDay = daysSinceRebalance >= cfg.HOLDING_PERIOD_DAYS || currentHoldings.length === 0
    // Stop-losses
    const stoppedOut: number[] = []
    for (let h = 0; h < currentHoldings.length; h++) {
      const holding = currentHoldings[h]; const stockData = findStockInSector(stocksBySector, holding.symbol)
      if (!stockData || day >= stockData.prices.length) continue
      const currentPrice = stockData.prices[day]
      if (currentPrice <= holding.stopLoss) {
        const pnl = (currentPrice - holding.entryPrice) * holding.shares; capital += currentPrice * holding.shares
        tradeLog.push({ symbol: holding.symbol, sector: holding.sector, entryDate: dates[holding.entryDay], exitDate: currentDate, entryPrice: r2(holding.entryPrice), exitPrice: r2(currentPrice), shares: holding.shares, pnl: Math.round(pnl), pnlPct: r2(((currentPrice / holding.entryPrice) - 1) * 100) + '%', holdingDays: day - holding.entryDay, exitReason: 'STOP_LOSS', sectorRank: holding.sectorRank })
        stoppedOut.push(h)
      }
    }
    for (let i = stoppedOut.length - 1; i >= 0; i--) currentHoldings.splice(stoppedOut[i], 1)
    // Rebalance
    if (isRebalanceDay) {
      for (const holding of currentHoldings) {
        const stockData = findStockInSector(stocksBySector, holding.symbol); if (!stockData || day >= stockData.prices.length) continue
        const exitPrice = stockData.prices[day]; const pnl = (exitPrice - holding.entryPrice) * holding.shares; capital += exitPrice * holding.shares
        tradeLog.push({ symbol: holding.symbol, sector: holding.sector, entryDate: dates[holding.entryDay], exitDate: currentDate, entryPrice: r2(holding.entryPrice), exitPrice: r2(exitPrice), shares: holding.shares, pnl: Math.round(pnl), pnlPct: r2(((exitPrice / holding.entryPrice) - 1) * 100) + '%', holdingDays: day - holding.entryDay, exitReason: 'REBALANCE', sectorRank: holding.sectorRank })
      }
      currentHoldings = []
      const sectorDataSliced: Record<string, { prices: number[] }> = {}
      for (const [key, sd] of Object.entries(sectorIndices)) sectorDataSliced[key] = { prices: sd.prices.slice(0, day + 1) }
      const stocksBySectorSliced: Record<string, any[]> = {}
      for (const [sector, stocks] of Object.entries(stocksBySector)) stocksBySectorSliced[sector] = stocks.map((s: any) => ({ ...s, prices: s.prices.slice(0, day + 1), volumes: s.volumes ? s.volumes.slice(0, day + 1) : undefined }))
      const niftySliced = niftyPrices.slice(0, day + 1)
      let macroData = null; if (macroHistory) macroData = macroHistory.find((m: any) => m.date <= currentDate)
      const portfolio = buildPortfolio(sectorDataSliced, stocksBySectorSliced, niftySliced, capital, macroData, currentDate, cfg)
      rotationLog.push({ date: currentDate, regime: portfolio.regime?.regime, economicPhase: portfolio.economicPhase?.phase, topSectors: portfolio.topSectors?.map((s: any) => s.sector) || [], holdingsCount: portfolio.holdings?.length || 0, signal: portfolio.signal })
      if (portfolio.signal === 'INVEST' && portfolio.holdings.length > 0) {
        holdingEntryDay = day
        for (const h of portfolio.holdings) {
          const stockData = findStockInSector(stocksBySector, h.symbol); if (!stockData || day >= stockData.prices.length) continue
          const entryPrice = stockData.prices[day]; const allocatedCapital = Math.min(h.allocatedCapital, capital)
          const shares = Math.floor(allocatedCapital / entryPrice); if (shares <= 0) continue
          capital -= shares * entryPrice
          currentHoldings.push({ symbol: h.symbol, sector: h.sector, sectorRank: h.sectorRank, entryPrice, entryDay: day, shares, stopLoss: entryPrice * (1 - cfg.STOCK_STOP_LOSS_PCT), weight: h.weight })
        }
      }
    }
    let openValue = 0
    for (const h of currentHoldings) { const sd = findStockInSector(stocksBySector, h.symbol); if (sd && day < sd.prices.length) openValue += sd.prices[day] * h.shares }
    const totalEquity = capital + openValue; if (totalEquity > peakEquity) peakEquity = totalEquity
    const dd = peakEquity > 0 ? (peakEquity - totalEquity) / peakEquity : 0; if (dd > maxDrawdown) maxDrawdown = dd
    equityCurve.push({ date: currentDate, totalEquity: Math.round(totalEquity), cash: Math.round(capital), invested: Math.round(openValue), positions: currentHoldings.length, drawdown: r2(dd * 100) + '%' })
  }
  for (const h of currentHoldings) {
    const sd = findStockInSector(stocksBySector, h.symbol); if (!sd) continue
    const exitPrice = sd.prices[sd.prices.length - 1]; const pnl = (exitPrice - h.entryPrice) * h.shares; capital += exitPrice * h.shares
    tradeLog.push({ symbol: h.symbol, sector: h.sector, entryDate: dates[h.entryDay], exitDate: dates[dates.length - 1], entryPrice: r2(h.entryPrice), exitPrice: r2(exitPrice), shares: h.shares, pnl: Math.round(pnl), pnlPct: r2(((exitPrice / h.entryPrice) - 1) * 100) + '%', holdingDays: dates.length - 1 - h.entryDay, exitReason: 'BACKTEST_END', sectorRank: h.sectorRank })
  }
  return buildBacktestAnalytics(tradeLog, equityCurve, rotationLog, capitalBase, capital, maxDrawdown, cfg)
}

// ============================================================================
// ANALYTICS
// ============================================================================

function analyzeBySector(trades: any[]) {
  const buckets: Record<string, any[]> = {}; for (const t of trades) { if (!buckets[t.sector]) buckets[t.sector] = []; buckets[t.sector].push(t) }
  const result: Record<string, any> = {}
  for (const [sector, list] of Object.entries(buckets)) { const wins = list.filter(t => t.pnl > 0).length; result[sector] = { count: list.length, winRate: r2((wins / list.length) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / list.length) + '%', totalPnl: Math.round(list.reduce((s, t) => s + t.pnl, 0)) } }
  return result
}

function analyzeByField(trades: any[], field: string) {
  const buckets: Record<string, any[]> = {}; for (const t of trades) { const key = t[field] || 'UNKNOWN'; if (!buckets[key]) buckets[key] = []; buckets[key].push(t) }
  const result: Record<string, any> = {}
  for (const [key, list] of Object.entries(buckets)) { const wins = list.filter(t => t.pnl > 0).length; result[key] = { count: list.length, winRate: r2((wins / list.length) * 100) + '%', avgPnlPct: r2(list.reduce((s, t) => s + parseFloat(t.pnlPct), 0) / list.length) + '%', totalPnl: Math.round(list.reduce((s, t) => s + t.pnl, 0)) } }
  return result
}

function analyzeRotations(rotationLog: any[]) {
  if (rotationLog.length < 2) return { rotations: 0 }
  let leadershipChanges = 0; const sectorAppearances: Record<string, number> = {}
  for (let i = 1; i < rotationLog.length; i++) {
    const prev = new Set<string>(rotationLog[i - 1].topSectors || []); const curr = new Set<string>(rotationLog[i].topSectors || [])
    let newSectors = 0
    for (const s of curr) { if (!prev.has(s)) newSectors++; sectorAppearances[s] = (sectorAppearances[s] || 0) + 1 }
    if (newSectors > 0) leadershipChanges++
  }
  const sortedSectors = Object.entries(sectorAppearances).sort((a, b) => b[1] - a[1]).map(([sector, count]) => ({ sector, timesInTop: count, pctOfPeriods: r2((count / rotationLog.length) * 100) + '%' }))
  return { totalPeriods: rotationLog.length, periodsWithChange: leadershipChanges, turnoverRate: r2((leadershipChanges / (rotationLog.length - 1)) * 100) + '%', avgSectorsChanged: r2(leadershipChanges / Math.max(rotationLog.length - 1, 1)), sectorFrequency: sortedSectors, phasesObserved: [...new Set(rotationLog.map((r: any) => r.economicPhase).filter(Boolean))] }
}

function analyzeDrawdowns(equityCurve: any[]) {
  const drawdowns: any[] = []; let peak = equityCurve[0]?.totalEquity || 0; let ddStart: number | null = null; let maxDD = 0
  for (let i = 0; i < equityCurve.length; i++) {
    const eq = equityCurve[i].totalEquity
    if (eq >= peak) { if (ddStart !== null && maxDD > 0.02) drawdowns.push({ start: equityCurve[ddStart].date, recovery: equityCurve[i].date, maxDrawdown: r2(maxDD * 100) + '%', duration: i - ddStart }); peak = eq; ddStart = null; maxDD = 0 }
    else { if (ddStart === null) ddStart = i; const dd = (peak - eq) / peak; if (dd > maxDD) maxDD = dd }
  }
  if (ddStart !== null && maxDD > 0.02) drawdowns.push({ start: equityCurve[ddStart].date, recovery: 'ONGOING', maxDrawdown: r2(maxDD * 100) + '%', duration: equityCurve.length - ddStart })
  return drawdowns.sort((a, b) => parseFloat(b.maxDrawdown) - parseFloat(a.maxDrawdown))
}

function calcMonthlyReturns(equityCurve: any[]) {
  if (equityCurve.length < 2) return []
  const monthly: Record<string, number> = {}; for (const p of equityCurve) monthly[p.date.substring(0, 7)] = p.totalEquity
  const months = Object.keys(monthly).sort()
  return months.slice(1).map((m, i) => ({ month: m, return: r2(((monthly[m] / monthly[months[i]]) - 1) * 100) + '%' }))
}

function buildBacktestAnalytics(trades: any[], equityCurve: any[], rotationLog: any[], capitalBase: number, finalCapital: number, maxDrawdown: number, cfg: SRConfig) {
  const totalTrades = trades.length; const winners = trades.filter(t => t.pnl > 0); const losers = trades.filter(t => t.pnl <= 0)
  const winRate = totalTrades > 0 ? winners.length / totalTrades : 0
  const avgWinPct = winners.length > 0 ? winners.reduce((s: number, t: any) => s + parseFloat(t.pnlPct), 0) / winners.length : 0
  const avgLossPct = losers.length > 0 ? Math.abs(losers.reduce((s: number, t: any) => s + parseFloat(t.pnlPct), 0) / losers.length) : 0
  const avgHoldDays = totalTrades > 0 ? trades.reduce((s: number, t: any) => s + t.holdingDays, 0) / totalTrades : 0
  const grossProfit = winners.reduce((s: number, t: any) => s + t.pnl, 0); const grossLoss = Math.abs(losers.reduce((s: number, t: any) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity
  const totalReturn = (finalCapital / capitalBase) - 1
  const years = equityCurve.length / cfg.TRADING_DAYS_PER_YEAR
  const cagr = years > 0 ? Math.pow(finalCapital / capitalBase, 1 / years) - 1 : 0
  const weeklyReturns: number[] = []
  for (let i = 5; i < equityCurve.length; i += 5) { const prev = equityCurve[i - 5].totalEquity; const curr = equityCurve[i].totalEquity; if (prev > 0) weeklyReturns.push((curr / prev) - 1) }
  const sharpe = calcRatio(weeklyReturns, 52, 'sharpe', cfg); const sortino = calcRatio(weeklyReturns, 52, 'sortino', cfg)
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : null
  const bySector = analyzeBySector(trades); const byExitReason = analyzeByField(trades, 'exitReason'); const rotationAnalysis = analyzeRotations(rotationLog)
  const sectorHitRate: Record<string, any> = {}
  for (const [sector, data] of Object.entries(bySector)) sectorHitRate[sector] = { trades: data.count, winRate: data.winRate, avgPnlPct: data.avgPnlPct, contribution: data.totalPnl }
  const drawdowns = analyzeDrawdowns(equityCurve); const monthly = calcMonthlyReturns(equityCurve); const { maxWin, maxLose } = calcStreaks(trades)
  return {
    summary: { startingCapital: capitalBase, endingCapital: Math.round(finalCapital), totalReturn: r2(totalReturn * 100) + '%', cagr: r2(cagr * 100) + '%', totalTrades, winRate: r2(winRate * 100) + '%', avgWinPct: r2(avgWinPct) + '%', avgLossPct: r2(avgLossPct) + '%', winLossRatio: avgLossPct > 0 ? r2(avgWinPct / avgLossPct) : 'N/A', profitFactor: profitFactor !== Infinity ? r2(profitFactor) : 'N/A', maxDrawdown: r2(maxDrawdown * 100) + '%', avgHoldingDays: r2(avgHoldDays), sharpeRatio: sharpe !== null ? r2(sharpe) : 'N/A', sortinoRatio: sortino !== null ? r2(sortino) : 'N/A', calmarRatio: calmar !== null ? r2(calmar) : 'N/A', maxWinStreak: maxWin, maxLoseStreak: maxLose, totalRotations: rotationLog.length },
    bySector: sectorHitRate, byExitReason, rotationAnalysis, drawdownPeriods: drawdowns.slice(0, 5), monthlyReturns: monthly,
    topWinners: [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 10).map(formatTrade),
    topLosers: [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 10).map(formatTrade),
    rotationLog, trades, equityCurve,
  }
}

// ============================================================================
// SENSITIVITY ANALYSIS
// ============================================================================

export function sensitivityAnalysis(data: any, capitalBase: number = 10000000, cfg: SRConfig = DEFAULT_SR_CONFIG) {
  const results: any[] = []
  for (const n of [2, 3, 4, 5]) { const bt = runBacktest(data, capitalBase, { ...cfg, TOP_SECTORS: n }); results.push({ param: 'Top Sectors', value: n, return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown, winRate: bt.summary.winRate, trades: bt.summary.totalTrades }) }
  for (const n of [2, 3, 4, 5]) { const bt = runBacktest(data, capitalBase, { ...cfg, STOCKS_PER_SECTOR: n }); results.push({ param: 'Stocks/Sector', value: n, return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown, winRate: bt.summary.winRate, trades: bt.summary.totalTrades }) }
  const weightCombos = [{ w1: 0.7, w3: 0.3, label: 'Recent bias (70/30)' }, { w1: 0.5, w3: 0.5, label: 'Equal (50/50)' }, { w1: 0.3, w3: 0.7, label: 'Trend bias (30/70)' }, { w1: 1.0, w3: 0.0, label: 'Pure 1M RS' }, { w1: 0.0, w3: 1.0, label: 'Pure 3M RS' }]
  for (const combo of weightCombos) { const bt = runBacktest(data, capitalBase, { ...cfg, RS_WEIGHT_1M: combo.w1, RS_WEIGHT_3M: combo.w3 }); results.push({ param: 'RS Weights', value: combo.label, return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown, winRate: bt.summary.winRate, trades: bt.summary.totalTrades }) }
  for (const days of [15, 22, 33, 44, 66]) { const bt = runBacktest(data, capitalBase, { ...cfg, HOLDING_PERIOD_DAYS: days }); results.push({ param: 'Holding Period', value: `${days}d`, return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown, winRate: bt.summary.winRate, trades: bt.summary.totalTrades }) }
  for (const method of ['EQUAL', 'RS_WEIGHTED', 'INV_VOL']) { const bt = runBacktest(data, capitalBase, { ...cfg, WEIGHTING_METHOD: method }); results.push({ param: 'Weighting', value: method, return: bt.summary.totalReturn, maxDD: bt.summary.maxDrawdown, winRate: bt.summary.winRate, trades: bt.summary.totalTrades }) }
  return results
}
