// src/lib/strategy/ema-macd.ts
// Consolidated EMA Crossover + MACD Strategy Engine
// Two systems: A. 9/20 EMA Crossover   B. Triple EMA (5/13/26)
// Both use MACD (5,13,4) confirmation and VWAP alignment

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: CONFIGURATION & ENUMS
// ═══════════════════════════════════════════════════════════════════

export const EMA_SYSTEM = { DUAL_9_20: 'DUAL_9_20', TRIPLE_5_13_26: 'TRIPLE_5_13_26' } as const
export const DIRECTION = { LONG: 'LONG', SHORT: 'SHORT', NONE: 'NONE' } as const
export const ENTRY_METHOD = { CROSSOVER_CLOSE: 'CROSSOVER_CLOSE', PULLBACK_TO_FAST: 'PULLBACK_TO_FAST' } as const
export const EXIT_METHOD = { FIXED_RR: 'FIXED_RR', TRAIL_FAST_EMA: 'TRAIL_FAST_EMA', VWAP_BAND: 'VWAP_BAND' } as const
export const EXIT_REASON = {
  TARGET_FIXED_RR: 'TARGET_FIXED_RR', TRAIL_EMA_CLOSE: 'TRAIL_EMA_CLOSE',
  VWAP_BAND_TARGET: 'VWAP_BAND_TARGET', STOP_LOSS: 'STOP_LOSS',
  REVERSE_CROSSOVER: 'REVERSE_CROSSOVER', TIME_STOP_EOD: 'TIME_STOP_EOD',
  TIME_STOP_AFTERNOON: 'TIME_STOP_AFTERNOON', MACD_DIVERGENCE: 'MACD_DIVERGENCE',
} as const
export const ALIGNMENT = { BULLISH: 'BULLISH', BEARISH: 'BEARISH', TANGLED: 'TANGLED' } as const

export const EMA_CONFIG = {
  // Market Timings (IST)
  MARKET_OPEN_H: 9, MARKET_OPEN_M: 15,
  MARKET_CLOSE_H: 15, MARKET_CLOSE_M: 30,
  MIS_EXIT_H: 15, MIS_EXIT_M: 15,
  CANDLE_INTERVAL_MIN: 5,

  // Trading Window
  TRADE_WINDOW_START_H: 9, TRADE_WINDOW_START_M: 30,
  TRADE_WINDOW_END_H: 13, TRADE_WINDOW_END_M: 0,
  LAST_ENTRY_H: 14, LAST_ENTRY_M: 0,

  // System A: 9/20 EMA
  DUAL_FAST_PERIOD: 9, DUAL_SLOW_PERIOD: 20,
  // System B: Triple EMA
  TRIPLE_FAST_PERIOD: 5, TRIPLE_MID_PERIOD: 13, TRIPLE_SLOW_PERIOD: 26,

  // MACD (intraday-tuned)
  MACD_FAST: 5, MACD_SLOW: 13, MACD_SIGNAL: 4,

  // VWAP
  VWAP_ALIGNMENT_REQUIRED: true, VWAP_SD_MULTIPLIER: 1.0,

  // Volume Filter
  VOLUME_CROSSOVER_MULTIPLE: 1.0, VOLUME_AVG_LOOKBACK: 20,

  // EMA Slope Filter
  SLOPE_MIN_THRESHOLD: 0.0001, SLOPE_LOOKBACK_CANDLES: 5, SLOPE_FILTER_ENABLED: true,

  // Tangling Detection
  TANGLE_MAX_DISTANCE_PCT: 0.0005, TANGLE_LOOKBACK_CANDLES: 8, TANGLE_MIN_CROSSOVERS: 3,

  // Entry
  DEFAULT_ENTRY_METHOD: 'CROSSOVER_CLOSE' as string,
  PULLBACK_MAX_CANDLES: 6, PULLBACK_TOUCH_TOLERANCE: 0.001,

  // Exit
  DEFAULT_EXIT_METHOD: 'TRAIL_FAST_EMA' as string,
  FIXED_RR_RATIO: 1.5,

  // Stop-Loss
  SL_METHOD_DUAL: 'BELOW_SLOW_EMA', SL_METHOD_TRIPLE: 'BELOW_SLOWEST',
  SL_FIXED_PCT: 0.005, SL_EMA_BUFFER_PCT: 0.001, MAX_SL_PCT: 0.010,

  // Position sizing
  TARGET_1_QTY_PCT: 0.50, TRAIL_QTY_PCT: 0.50,

  // Risk
  DEFAULT_RISK_PER_TRADE: 0.01, SLIPPAGE_PER_SIDE: 0.0003,
  COMMISSION_PER_SIDE: 20, DEFAULT_CAPITAL: 100_000,

  // Max trades per day
  MAX_TRADES_PER_DAY_DUAL: 6, MAX_TRADES_PER_DAY_TRIPLE: 3,

  // Stock screening
  MIN_AVG_DAILY_VOLUME: 5_000_000, MIN_ATR_PCT: 0.015,
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: INDICATOR COMPUTATIONS
// ═══════════════════════════════════════════════════════════════════

interface Candle {
  time: Date | string; open: number; high: number; low: number
  close: number; volume: number
  [key: string]: any
}

/** Generic EMA computation on close prices */
function computeEMA(candles: Candle[], period: number, fieldName: string) {
  if (candles.length === 0) return
  const k = 2 / (period + 1)
  let seed = 0
  const seedEnd = Math.min(period, candles.length)
  for (let i = 0; i < seedEnd; i++) seed += candles[i].close
  seed /= seedEnd
  candles[0][fieldName] = candles[0].close
  for (let i = 1; i < seedEnd; i++) {
    candles[i][fieldName] = candles[i].close * k + candles[i - 1][fieldName] * (1 - k)
  }
  if (seedEnd > 1) candles[seedEnd - 1][fieldName] = seed
  for (let i = seedEnd; i < candles.length; i++) {
    candles[i][fieldName] = candles[i].close * k + candles[i - 1][fieldName] * (1 - k)
  }
}

/** EMA on arbitrary field (for MACD signal line) */
function computeEMAOnField(candles: Candle[], period: number, sourceField: string, targetField: string) {
  if (candles.length === 0) return
  const k = 2 / (period + 1)
  candles[0][targetField] = candles[0][sourceField] ?? 0
  for (let i = 1; i < candles.length; i++) {
    const val = candles[i][sourceField] ?? 0
    const prevEma = candles[i - 1][targetField] ?? 0
    candles[i][targetField] = val * k + prevEma * (1 - k)
  }
}

function computeDualEMAs(candles: Candle[]) {
  computeEMA(candles, EMA_CONFIG.DUAL_FAST_PERIOD, 'ema9')
  computeEMA(candles, EMA_CONFIG.DUAL_SLOW_PERIOD, 'ema20')
}

function computeTripleEMAs(candles: Candle[]) {
  computeEMA(candles, EMA_CONFIG.TRIPLE_FAST_PERIOD, 'ema5')
  computeEMA(candles, EMA_CONFIG.TRIPLE_MID_PERIOD, 'ema13')
  computeEMA(candles, EMA_CONFIG.TRIPLE_SLOW_PERIOD, 'ema26')
}

/** MACD with custom intraday periods (5,13,4) */
function computeMACD(candles: Candle[]) {
  const fastField = '_macd_fast_ema'
  const slowField = '_macd_slow_ema'
  computeEMA(candles, EMA_CONFIG.MACD_FAST, fastField)
  computeEMA(candles, EMA_CONFIG.MACD_SLOW, slowField)
  for (const c of candles) {
    c.macdLine = (c[fastField] ?? c.close) - (c[slowField] ?? c.close)
  }
  computeEMAOnField(candles, EMA_CONFIG.MACD_SIGNAL, 'macdLine', 'macdSignal')
  for (const c of candles) {
    c.macdHist = (c.macdLine ?? 0) - (c.macdSignal ?? 0)
  }
  for (const c of candles) { delete c[fastField]; delete c[slowField] }
}

/** VWAP with ±1 SD bands */
function computeVWAPWithBands(candles: Candle[]) {
  let cumTPV = 0, cumVol = 0, cumTP2V = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    cumTPV += tp * c.volume; cumVol += c.volume; cumTP2V += tp * tp * c.volume
    if (cumVol === 0) { c.vwap = c.close; c.vwapUpper1 = c.close; c.vwapLower1 = c.close; continue }
    const vwap = cumTPV / cumVol
    const variance = (cumTP2V / cumVol) - (vwap * vwap)
    const sd = Math.sqrt(Math.max(0, variance))
    c.vwap = vwap
    c.vwapUpper1 = vwap + EMA_CONFIG.VWAP_SD_MULTIPLIER * sd
    c.vwapLower1 = vwap - EMA_CONFIG.VWAP_SD_MULTIPLIER * sd
  }
}

/** Rolling average volume */
function computeAvgVolume(candles: Candle[], lookback = EMA_CONFIG.VOLUME_AVG_LOOKBACK) {
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - lookback)
    let sum = 0
    for (let j = start; j <= i; j++) sum += candles[j].volume
    candles[i].avgVolume = sum / (i - start + 1)
  }
}

/** EMA slope (normalised per candle) */
function computeEMASlope(candles: Candle[], emaField: string, lookback: number, currentIdx: number): number {
  const i = currentIdx
  const startIdx = Math.max(0, i - lookback)
  const endVal = candles[i]?.[emaField]
  const startVal = candles[startIdx]?.[emaField]
  if (endVal == null || startVal == null) return 0
  const candleSpan = i - startIdx
  if (candleSpan === 0) return 0
  return (endVal - startVal) / (candleSpan * (candles[i].close || 1))
}

function computeAllSlopes(candles: Candle[], emaField: string, slopeField: string, lookback = EMA_CONFIG.SLOPE_LOOKBACK_CANDLES) {
  for (let i = 0; i < candles.length; i++) {
    candles[i][slopeField] = computeEMASlope(candles, emaField, lookback, i)
  }
}

/** Compute all indicators for a given system */
function computeAllIndicators(candles: Candle[], system: string) {
  computeVWAPWithBands(candles)
  computeMACD(candles)
  computeAvgVolume(candles)
  if (system === 'DUAL_9_20') {
    computeDualEMAs(candles); computeAllSlopes(candles, 'ema20', 'ema20Slope')
  } else if (system === 'TRIPLE_5_13_26') {
    computeTripleEMAs(candles)
    computeAllSlopes(candles, 'ema26', 'ema26Slope')
    computeAllSlopes(candles, 'ema13', 'ema13Slope')
  } else {
    computeDualEMAs(candles); computeTripleEMAs(candles)
    computeAllSlopes(candles, 'ema20', 'ema20Slope')
    computeAllSlopes(candles, 'ema26', 'ema26Slope')
    computeAllSlopes(candles, 'ema13', 'ema13Slope')
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: CROSSOVER & ALIGNMENT DETECTION
// ═══════════════════════════════════════════════════════════════════

function detectCrossovers(candles: Candle[], fastField: string, slowField: string) {
  const crossovers: any[] = []
  for (let i = 1; i < candles.length; i++) {
    const prevFast = candles[i - 1][fastField], prevSlow = candles[i - 1][slowField]
    const currFast = candles[i][fastField], currSlow = candles[i][slowField]
    if (prevFast == null || prevSlow == null || currFast == null || currSlow == null) continue
    if (prevFast <= prevSlow && currFast > currSlow) {
      crossovers.push({ index: i, time: candles[i].time, type: 'BULLISH', fastVal: currFast, slowVal: currSlow, price: candles[i].close, spread: currFast - currSlow, spreadPct: (currFast - currSlow) / candles[i].close })
    }
    if (prevFast >= prevSlow && currFast < currSlow) {
      crossovers.push({ index: i, time: candles[i].time, type: 'BEARISH', fastVal: currFast, slowVal: currSlow, price: candles[i].close, spread: currFast - currSlow, spreadPct: (currFast - currSlow) / candles[i].close })
    }
  }
  return crossovers
}

function getTripleAlignment(candle: Candle): string {
  const { ema5, ema13, ema26 } = candle
  if (ema5 == null || ema13 == null || ema26 == null) return 'TANGLED'
  if (ema5 > ema13 && ema13 > ema26) return 'BULLISH'
  if (ema5 < ema13 && ema13 < ema26) return 'BEARISH'
  return 'TANGLED'
}

function checkAlignmentWindow(candles: Candle[], endIdx: number, windowSize = 3) {
  const start = Math.max(0, endIdx - windowSize + 1)
  let alignment: string | null = null, consistent = true, duration = 0
  for (let i = endIdx; i >= start; i--) {
    const a = getTripleAlignment(candles[i])
    if (alignment === null) alignment = a
    if (a === alignment && a !== 'TANGLED') { duration++ }
    else if (a !== alignment) { consistent = false; break }
  }
  return { alignment: alignment || 'TANGLED', consistent, duration }
}

/** Detect tangled EMAs (range-bound, whipsaw zone) */
function detectTangling(candles: Candle[], fastField: string, slowField: string, currentIdx: number) {
  const lookback = EMA_CONFIG.TANGLE_LOOKBACK_CANDLES
  const start = Math.max(0, currentIdx - lookback)
  let crossoverCount = 0, totalDistancePct = 0, dataPoints = 0
  for (let i = start + 1; i <= currentIdx; i++) {
    const prevFast = candles[i - 1][fastField], prevSlow = candles[i - 1][slowField]
    const currFast = candles[i][fastField], currSlow = candles[i][slowField]
    if (prevFast == null || currFast == null) continue
    if ((prevFast <= prevSlow && currFast > currSlow) || (prevFast >= prevSlow && currFast < currSlow)) crossoverCount++
    totalDistancePct += Math.abs(currFast - currSlow) / candles[i].close
    dataPoints++
  }
  const avgDistance = dataPoints > 0 ? totalDistancePct / dataPoints : 0
  const isTangled = crossoverCount >= EMA_CONFIG.TANGLE_MIN_CROSSOVERS || avgDistance < EMA_CONFIG.TANGLE_MAX_DISTANCE_PCT
  return { isTangled, crossoverCount, avgDistance }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4: FILTERS
// ═══════════════════════════════════════════════════════════════════

function toMinutes(h: number, m: number) { return h * 60 + m }

function candleTime(candle: Candle) {
  const d = candle.time instanceof Date ? candle.time : new Date(candle.time as string)
  return toMinutes(d.getHours(), d.getMinutes())
}

function isInEntryWindow(candle: Candle) {
  const t = candleTime(candle)
  return t >= toMinutes(EMA_CONFIG.TRADE_WINDOW_START_H, EMA_CONFIG.TRADE_WINDOW_START_M) &&
         t <= toMinutes(EMA_CONFIG.TRADE_WINDOW_END_H, EMA_CONFIG.TRADE_WINDOW_END_M)
}

function isPastMISExit(candle: Candle) {
  return candleTime(candle) >= toMinutes(EMA_CONFIG.MIS_EXIT_H, EMA_CONFIG.MIS_EXIT_M)
}

function filterSlope(candles: Candle[], slowEMAField: string, currentIdx: number, direction: string) {
  if (!EMA_CONFIG.SLOPE_FILTER_ENABLED) return { pass: true }
  const slope = computeEMASlope(candles, slowEMAField, EMA_CONFIG.SLOPE_LOOKBACK_CANDLES, currentIdx)
  const absSlope = Math.abs(slope)
  const isDirectional = absSlope >= EMA_CONFIG.SLOPE_MIN_THRESHOLD
  const slopeAligned = direction === 'LONG' ? slope > 0 : slope < 0
  const pass = isDirectional && slopeAligned
  return { pass, slope: Math.round(slope * 1e6) / 1e6, reason: pass ? null : `Slow EMA slope not aligned for ${direction}` }
}

function filterTangling(candles: Candle[], fastField: string, slowField: string, currentIdx: number) {
  const { isTangled, crossoverCount, avgDistance } = detectTangling(candles, fastField, slowField, currentIdx)
  return { pass: !isTangled, isTangled, crossoverCount, avgDistancePct: Math.round(avgDistance * 10000) / 10000, reason: isTangled ? `EMAs tangled: ${crossoverCount} crossovers` : null }
}

function filterMACD(candles: Candle[], crossoverIdx: number, direction: string, lookback = 3) {
  const startCheck = Math.max(0, crossoverIdx - lookback)
  const endCheck = Math.min(candles.length - 1, crossoverIdx + lookback)
  let macdConfirmed = false, macdCrossIdx = -1, histogram = 0
  for (let i = startCheck + 1; i <= endCheck; i++) {
    const prevLine = candles[i - 1].macdLine, prevSig = candles[i - 1].macdSignal
    const currLine = candles[i].macdLine, currSig = candles[i].macdSignal
    if (prevLine == null || currLine == null) continue
    if (direction === 'LONG' && prevLine <= prevSig && currLine > currSig) { macdConfirmed = true; macdCrossIdx = i; histogram = candles[i].macdHist; break }
    if (direction === 'SHORT' && prevLine >= prevSig && currLine < currSig) { macdConfirmed = true; macdCrossIdx = i; histogram = candles[i].macdHist; break }
  }
  if (!macdConfirmed) {
    const hist = candles[crossoverIdx].macdHist
    if (direction === 'LONG' && hist > 0) { macdConfirmed = true; histogram = hist }
    if (direction === 'SHORT' && hist < 0) { macdConfirmed = true; histogram = hist }
  }
  return { pass: macdConfirmed, macdCrossIdx, histogram: Math.round(histogram * 10000) / 10000, reason: macdConfirmed ? null : `MACD not confirming ${direction}` }
}

function filterVWAP(candle: Candle, direction: string) {
  if (!EMA_CONFIG.VWAP_ALIGNMENT_REQUIRED) return { pass: true }
  const { close, vwap } = candle
  if (vwap == null) return { pass: true }
  const aligned = direction === 'LONG' ? close > vwap : close < vwap
  return { pass: aligned, price: close, vwap, reason: aligned ? null : `Price not ${direction === 'LONG' ? 'above' : 'below'} VWAP` }
}

function filterVolume(candle: Candle) {
  const { volume, avgVolume } = candle
  if (avgVolume == null || avgVolume === 0) return { pass: true }
  const ratio = volume / avgVolume
  const pass = ratio >= EMA_CONFIG.VOLUME_CROSSOVER_MULTIPLE
  return { pass, volume, avgVolume: Math.round(avgVolume), ratio: Math.round(ratio * 100) / 100, reason: pass ? null : `Volume below average` }
}

function filterTripleAlignment(candles: Candle[], currentIdx: number, direction: string, windowSize = 3) {
  const { alignment, consistent, duration } = checkAlignmentWindow(candles, currentIdx, windowSize)
  const expected = direction === 'LONG' ? 'BULLISH' : 'BEARISH'
  const pass = alignment === expected && consistent
  return { pass, alignment, consistent, duration, reason: pass ? null : `Triple EMA alignment: ${alignment} (need ${expected})` }
}

/** Composite filter: 9/20 EMA system */
function filterDualCrossover(candles: Candle[], crossoverIdx: number, direction: string) {
  const candle = candles[crossoverIdx]
  const results: any[] = []
  results.push({ name: 'TimeWindow', pass: isInEntryWindow(candle) })
  results.push({ name: 'Slope', ...filterSlope(candles, 'ema20', crossoverIdx, direction) })
  results.push({ name: 'NoTangle', ...filterTangling(candles, 'ema9', 'ema20', crossoverIdx) })
  results.push({ name: 'MACD', ...filterMACD(candles, crossoverIdx, direction) })
  results.push({ name: 'VWAP', ...filterVWAP(candle, direction) })
  results.push({ name: 'Volume', ...filterVolume(candle) })
  return { pass: results.every(r => r.pass), filters: results }
}

/** Composite filter: Triple EMA system */
function filterTriplePullback(candles: Candle[], signalIdx: number, direction: string) {
  const candle = candles[signalIdx]
  const results: any[] = []
  results.push({ name: 'TimeWindow', pass: isInEntryWindow(candle) })
  results.push({ name: 'TripleAlignment', ...filterTripleAlignment(candles, signalIdx, direction) })
  results.push({ name: 'Slope', ...filterSlope(candles, 'ema26', signalIdx, direction) })
  results.push({ name: 'NoTangle', ...filterTangling(candles, 'ema5', 'ema13', signalIdx) })
  results.push({ name: 'MACD', ...filterMACD(candles, signalIdx, direction) })
  results.push({ name: 'VWAP', ...filterVWAP(candle, direction) })
  results.push({ name: 'Volume', ...filterVolume(candle) })
  return { pass: results.every(r => r.pass), filters: results }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 5: SIGNAL DETECTION
// ═══════════════════════════════════════════════════════════════════

/** Find pullback to fast EMA after crossover (entry refinement) */
function findPullbackToEMA(candles: Candle[], crossoverIdx: number, fastField: string, direction: string) {
  const maxWait = EMA_CONFIG.PULLBACK_MAX_CANDLES
  const tolerance = EMA_CONFIG.PULLBACK_TOUCH_TOLERANCE
  for (let i = crossoverIdx + 1; i < Math.min(candles.length, crossoverIdx + maxWait + 1); i++) {
    const c = candles[i], ema = c[fastField]
    if (ema == null) continue
    if (direction === 'LONG') {
      if (c.low <= ema * (1 + tolerance) && c.close > ema) return { index: i, price: c.close }
    } else {
      if (c.high >= ema * (1 - tolerance) && c.close < ema) return { index: i, price: c.close }
    }
  }
  return null
}

/** System A: 9/20 EMA Crossover signal detection */
function detectDualCrossoverSignals(candles: Candle[], opts: any = {}) {
  const entryMethod = opts.entryMethod || EMA_CONFIG.DEFAULT_ENTRY_METHOD
  const crossovers = detectCrossovers(candles, 'ema9', 'ema20')
  const signals: any[] = []
  for (const xo of crossovers) {
    const direction = xo.type === 'BULLISH' ? 'LONG' : 'SHORT'
    const filterResult = filterDualCrossover(candles, xo.index, direction)
    if (!filterResult.pass) continue
    let entryIdx = xo.index, entryPrice = candles[xo.index].close
    if (entryMethod === 'PULLBACK_TO_FAST') {
      const pullback = findPullbackToEMA(candles, xo.index, 'ema9', direction)
      if (pullback) { entryIdx = pullback.index; entryPrice = pullback.price }
      else continue
    }
    const { sl, targets } = computeDualSLTargets(candles, entryIdx, entryPrice, direction, opts)
    signals.push({
      system: 'DUAL_9_20', direction, entryPrice, entryTime: candles[entryIdx].time,
      entryIndex: entryIdx, crossoverIndex: xo.index, crossoverTime: xo.time,
      sl, targets, exitMethod: opts.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD,
      ema9AtEntry: candles[entryIdx].ema9, ema20AtEntry: candles[entryIdx].ema20,
      macdHistAtEntry: candles[entryIdx].macdHist, vwapAtEntry: candles[entryIdx].vwap,
      filterResults: filterResult.filters, entryMethod,
    })
  }
  return signals
}

/** System B: Triple EMA pullback signal detection */
function detectTriplePullbackSignals(candles: Candle[], opts: any = {}) {
  const signals: any[] = []
  let alignmentStart = -1, currentAlignment = 'TANGLED'
  for (let i = EMA_CONFIG.TRIPLE_SLOW_PERIOD + 1; i < candles.length; i++) {
    const c = candles[i]
    const alignment = getTripleAlignment(c)
    if (alignment !== currentAlignment) { currentAlignment = alignment; alignmentStart = i }
    if (alignment === 'TANGLED' || i - alignmentStart < 3) continue
    const direction = alignment === 'BULLISH' ? 'LONG' : 'SHORT'
    const ema13 = c.ema13
    if (ema13 == null) continue
    const isPullback = direction === 'LONG'
      ? c.low <= ema13 * (1 + EMA_CONFIG.PULLBACK_TOUCH_TOLERANCE) && c.close > ema13
      : c.high >= ema13 * (1 - EMA_CONFIG.PULLBACK_TOUCH_TOLERANCE) && c.close < ema13
    if (!isPullback) continue
    const filterResult = filterTriplePullback(candles, i, direction)
    if (!filterResult.pass) continue
    const entryPrice = c.close
    const { sl, targets } = computeTripleSLTargets(candles, i, entryPrice, direction, opts)
    signals.push({
      system: 'TRIPLE_5_13_26', direction, entryPrice, entryTime: c.time,
      entryIndex: i, sl, targets, exitMethod: opts.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD,
      ema5AtEntry: c.ema5, ema13AtEntry: c.ema13, ema26AtEntry: c.ema26,
      alignment, alignmentDuration: i - alignmentStart,
      macdHistAtEntry: c.macdHist, vwapAtEntry: c.vwap, filterResults: filterResult.filters,
    })
    i += 3 // skip cooldown
  }
  return signals
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6: STOP-LOSS & TARGET COMPUTATION
// ═══════════════════════════════════════════════════════════════════

function computeDualSLTargets(candles: Candle[], entryIdx: number, entryPrice: number, direction: string, opts: any = {}) {
  const exitMethod = opts.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD
  const isLong = direction === 'LONG'
  const candle = candles[entryIdx]
  let sl: number
  if (EMA_CONFIG.SL_METHOD_DUAL === 'BELOW_SLOW_EMA') {
    const ema20 = candle.ema20 || entryPrice
    const buffer = ema20 * EMA_CONFIG.SL_EMA_BUFFER_PCT
    sl = isLong ? ema20 - buffer : ema20 + buffer
  } else { sl = isLong ? entryPrice * (1 - EMA_CONFIG.SL_FIXED_PCT) : entryPrice * (1 + EMA_CONFIG.SL_FIXED_PCT) }
  const slPct = Math.abs(entryPrice - sl) / entryPrice
  if (slPct > EMA_CONFIG.MAX_SL_PCT) { sl = isLong ? entryPrice * (1 - EMA_CONFIG.MAX_SL_PCT) : entryPrice * (1 + EMA_CONFIG.MAX_SL_PCT) }
  const slDistance = Math.abs(entryPrice - sl)
  const targets: any[] = []
  if (exitMethod === 'FIXED_RR') {
    targets.push({ price: isLong ? entryPrice + slDistance * EMA_CONFIG.FIXED_RR_RATIO : entryPrice - slDistance * EMA_CONFIG.FIXED_RR_RATIO, qtyPct: 1.0, label: 'FIXED_RR_TARGET' })
  } else if (exitMethod === 'TRAIL_FAST_EMA') {
    targets.push({ price: isLong ? entryPrice + slDistance : entryPrice - slDistance, qtyPct: EMA_CONFIG.TARGET_1_QTY_PCT, label: 'T1' })
    targets.push({ price: null, qtyPct: EMA_CONFIG.TRAIL_QTY_PCT, label: 'TRAIL_EMA9' })
  } else if (exitMethod === 'VWAP_BAND') {
    targets.push({ price: isLong ? candle.vwapUpper1 || entryPrice * 1.01 : candle.vwapLower1 || entryPrice * 0.99, qtyPct: 1.0, label: 'VWAP_1SD' })
  }
  return { sl, targets, exitMethod }
}

function computeTripleSLTargets(candles: Candle[], entryIdx: number, entryPrice: number, direction: string, opts: any = {}) {
  const exitMethod = opts.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD
  const isLong = direction === 'LONG'
  const candle = candles[entryIdx]
  const ema26 = candle.ema26 || entryPrice
  const buffer = ema26 * EMA_CONFIG.SL_EMA_BUFFER_PCT
  let sl = isLong ? ema26 - buffer : ema26 + buffer
  const slPct = Math.abs(entryPrice - sl) / entryPrice
  if (slPct > EMA_CONFIG.MAX_SL_PCT) { sl = isLong ? entryPrice * (1 - EMA_CONFIG.MAX_SL_PCT) : entryPrice * (1 + EMA_CONFIG.MAX_SL_PCT) }
  const slDistance = Math.abs(entryPrice - sl)
  const targets: any[] = []
  targets.push({ price: isLong ? entryPrice + slDistance : entryPrice - slDistance, qtyPct: EMA_CONFIG.TARGET_1_QTY_PCT, label: 'T1' })
  targets.push({ price: null, qtyPct: EMA_CONFIG.TRAIL_QTY_PCT, label: 'TRAIL_EMA13' })
  return { sl, targets, exitMethod }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 7: TRADE SIMULATION
// ═══════════════════════════════════════════════════════════════════

function simulateTrade(candles: Candle[], signal: any) {
  const { direction, entryPrice, entryIndex, sl, targets, system } = signal
  const exitMethod = signal.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD
  const isLong = direction === 'LONG'
  let remainingQty = 1.0, currentSL = sl
  const partialExits: any[] = []
  let t1Hit = false, trailActive = false
  const trailEMAField = system === 'TRIPLE_5_13_26' ? 'ema13' : 'ema9'
  const fastEMAField = system === 'TRIPLE_5_13_26' ? 'ema5' : 'ema9'
  const slowEMAField = system === 'TRIPLE_5_13_26' ? 'ema13' : 'ema20'

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const c = candles[i]
    if (remainingQty <= 0) break

    // EOD forced exit
    if (isPastMISExit(c)) {
      partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: 'TIME_STOP_EOD' })
      remainingQty = 0; break
    }

    // Stop-loss
    const hitSL = isLong ? c.low <= currentSL : c.high >= currentSL
    if (hitSL) {
      partialExits.push({ time: c.time, price: currentSL, qtyPct: remainingQty, reason: trailActive ? 'TRAIL_EMA_CLOSE' : 'STOP_LOSS' })
      remainingQty = 0; break
    }

    // Reverse crossover exit (after trail active)
    if (trailActive) {
      const fastEMA = c[fastEMAField], slowEMA = c[slowEMAField]
      const prevFast = candles[i - 1]?.[fastEMAField], prevSlow = candles[i - 1]?.[slowEMAField]
      if (fastEMA != null && slowEMA != null && prevFast != null && prevSlow != null) {
        const reverseCross = isLong ? (prevFast >= prevSlow && fastEMA < slowEMA) : (prevFast <= prevSlow && fastEMA > slowEMA)
        if (reverseCross) { partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: 'REVERSE_CROSSOVER' }); remainingQty = 0; break }
      }
    }

    // MACD divergence exit (after trail active)
    if (trailActive && c.macdHist != null) {
      const prevHist = candles[i - 1]?.macdHist ?? 0
      const macdFlipped = isLong ? (prevHist > 0 && c.macdHist < 0) : (prevHist < 0 && c.macdHist > 0)
      if (macdFlipped) { partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: 'MACD_DIVERGENCE' }); remainingQty = 0; break }
    }

    // Fixed R:R exit
    if (exitMethod === 'FIXED_RR' && targets[0]?.price != null) {
      const hitTarget = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitTarget) { partialExits.push({ time: c.time, price: targets[0].price, qtyPct: remainingQty, reason: 'TARGET_FIXED_RR' }); remainingQty = 0; break }
    }

    // VWAP Band exit
    if (exitMethod === 'VWAP_BAND' && targets[0]?.price != null) {
      const hitBand = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitBand) { partialExits.push({ time: c.time, price: targets[0].price, qtyPct: remainingQty, reason: 'VWAP_BAND_TARGET' }); remainingQty = 0; break }
    }

    // T1 for trail method
    if (exitMethod === 'TRAIL_FAST_EMA' && !t1Hit && targets[0]?.price != null) {
      const hitT1 = isLong ? c.high >= targets[0].price : c.low <= targets[0].price
      if (hitT1) {
        t1Hit = true
        const exitQty = Math.min(targets[0].qtyPct, remainingQty)
        partialExits.push({ time: c.time, price: targets[0].price, qtyPct: exitQty, reason: 'TARGET_FIXED_RR' })
        remainingQty -= exitQty; trailActive = true; currentSL = entryPrice
      }
    }

    // EMA trailing
    if (trailActive && remainingQty > 0) {
      const trailEMA = candles[i - 1]?.[trailEMAField]
      if (trailEMA != null) {
        if (isLong) { const newSL = trailEMA - trailEMA * EMA_CONFIG.SL_EMA_BUFFER_PCT; if (newSL > currentSL) currentSL = newSL }
        else { const newSL = trailEMA + trailEMA * EMA_CONFIG.SL_EMA_BUFFER_PCT; if (newSL < currentSL) currentSL = newSL }
      }
      const trailEMACurrent = c[trailEMAField]
      if (trailEMACurrent != null) {
        const closedWrongSide = isLong ? c.close < trailEMACurrent : c.close > trailEMACurrent
        if (closedWrongSide) { partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: 'TRAIL_EMA_CLOSE' }); remainingQty = 0; break }
      }
    }

    // Time stop: afternoon (no T1 hit)
    if (!t1Hit) {
      const t = candleTime(c)
      if (t >= toMinutes(EMA_CONFIG.LAST_ENTRY_H, EMA_CONFIG.LAST_ENTRY_M)) {
        partialExits.push({ time: c.time, price: c.close, qtyPct: remainingQty, reason: 'TIME_STOP_AFTERNOON' })
        remainingQty = 0; break
      }
    }
  }
  return buildTradeRecord(signal, partialExits)
}

function buildTradeRecord(signal: any, partialExits: any[]) {
  const { direction, entryPrice, system } = signal
  const isLong = direction === 'LONG'
  let weightedExit = 0, totalQty = 0
  for (const e of partialExits) { weightedExit += e.price * e.qtyPct; totalQty += e.qtyPct }
  const avgExitPrice = totalQty > 0 ? weightedExit / totalQty : entryPrice
  const grossPnlPct = isLong ? (avgExitPrice - entryPrice) / entryPrice : (entryPrice - avgExitPrice) / entryPrice
  const netPnlPct = grossPnlPct - (EMA_CONFIG.SLIPPAGE_PER_SIDE * 2)
  const reasonMap: Record<string, number> = {}
  for (const e of partialExits) { reasonMap[e.reason] = (reasonMap[e.reason] || 0) + e.qtyPct }
  let primaryReason = 'NONE', maxQty = 0
  for (const [r, q] of Object.entries(reasonMap)) { if (q > maxQty) { maxQty = q; primaryReason = r } }
  return {
    system, direction, entryPrice, avgExitPrice,
    entryTime: signal.entryTime, exitTime: partialExits[partialExits.length - 1]?.time ?? null,
    grossPnlPct, netPnlPct, isWinner: netPnlPct > 0, partialExits,
    primaryExitReason: primaryReason,
    entryMethod: signal.entryMethod || null, exitMethod: signal.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD,
    ema9AtEntry: signal.ema9AtEntry ?? null, ema20AtEntry: signal.ema20AtEntry ?? null,
    ema5AtEntry: signal.ema5AtEntry ?? null, ema13AtEntry: signal.ema13AtEntry ?? null,
    ema26AtEntry: signal.ema26AtEntry ?? null, macdHistAtEntry: signal.macdHistAtEntry ?? null,
    vwapAtEntry: signal.vwapAtEntry ?? null, alignment: signal.alignment ?? null,
    alignmentDuration: signal.alignmentDuration ?? null, crossoverIndex: signal.crossoverIndex ?? null, sl: signal.sl,
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 8: DAY ORCHESTRATOR & MULTI-DAY RUNNER
// ═══════════════════════════════════════════════════════════════════

/** Group candles by IST day */
export function groupByDay(candles: Candle[]) {
  const days = new Map<string, Candle[]>()
  for (const c of candles) {
    const d = c.time instanceof Date ? c.time : new Date(c.time as string)
    const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000))
    const key = ist.toISOString().slice(0, 10)
    if (!days.has(key)) days.set(key, [])
    days.get(key)!.push(c)
  }
  return days
}

/** Run EMA strategy on a single day's candles */
export function runEMAForDay(dayCandlesRaw: Candle[], opts: any = {}) {
  const system = opts.system || 'DUAL_9_20'
  const entryMethod = opts.entryMethod || EMA_CONFIG.DEFAULT_ENTRY_METHOD
  const exitMethod = opts.exitMethod || EMA_CONFIG.DEFAULT_EXIT_METHOD
  const maxTrades = opts.maxTradesPerDay ?? (system === 'DUAL_9_20' ? EMA_CONFIG.MAX_TRADES_PER_DAY_DUAL : EMA_CONFIG.MAX_TRADES_PER_DAY_TRIPLE)
  const candles = dayCandlesRaw.map(c => ({ ...c, time: c.time instanceof Date ? c.time : new Date(c.time as string) }))
  if (candles.length < EMA_CONFIG.TRIPLE_SLOW_PERIOD + 5) return []
  computeAllIndicators(candles, system)
  let allSignals: any[] = []
  if (system === 'DUAL_9_20') { allSignals = detectDualCrossoverSignals(candles, { entryMethod, exitMethod }) }
  else { allSignals = detectTriplePullbackSignals(candles, { exitMethod }) }
  allSignals.sort((a, b) => a.entryIndex - b.entryIndex)
  const trades: any[] = []
  let lastExitIndex = -1
  for (const signal of allSignals) {
    if (trades.length >= maxTrades) break
    if (signal.entryIndex <= lastExitIndex) continue
    const trade = simulateTrade(candles, signal)
    trades.push(trade)
    const lastPartial = trade.partialExits[trade.partialExits.length - 1]
    if (lastPartial) {
      const exitTime = lastPartial.time instanceof Date ? lastPartial.time : new Date(lastPartial.time)
      for (let j = signal.entryIndex; j < candles.length; j++) {
        const ct = candles[j].time instanceof Date ? candles[j].time : new Date(String(candles[j].time))
        if (ct >= exitTime) { lastExitIndex = j; break }
      }
    }
  }
  return trades
}

/** Full multi-day backtest */
export function runFullEMABacktest(allCandles: Candle[], opts: any = {}) {
  const system = opts.system || 'DUAL_9_20'
  const capital = opts.capital || EMA_CONFIG.DEFAULT_CAPITAL
  const dayGroups = groupByDay(allCandles)
  const sortedDates = [...dayGroups.keys()].sort()
  const allTrades: any[] = []
  for (const dateKey of sortedDates) {
    const dayCandles = dayGroups.get(dateKey)!
    if (dayCandles.length < 30) continue
    const dayTrades = runEMAForDay(dayCandles, opts)
    for (const t of dayTrades) { t.date = dateKey; allTrades.push(t) }
  }
  const report = allTrades.length > 0 ? analyzePerformance(allTrades, capital) : null
  return { trades: allTrades, report, totalDays: sortedDates.length, tradedDays: new Set(allTrades.map(t => t.date)).size, config: { system } }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 9: ANALYZER
// ═══════════════════════════════════════════════════════════════════

function safeMean(arr: number[]) { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function r2(n: number) { return Math.round(n * 100) / 100 }
function r4(n: number) { return Math.round(n * 10000) / 10000 }

export function analyzePerformance(trades: any[], capital = EMA_CONFIG.DEFAULT_CAPITAL) {
  if (trades.length === 0) return null
  const winners = trades.filter(t => t.isWinner)
  const losers = trades.filter(t => !t.isWinner)
  const pnls = trades.map(t => t.netPnlPct)
  const totalTrades = trades.length
  const winRate = winners.length / totalTrades
  const avgWin = safeMean(winners.map(t => t.netPnlPct))
  const avgLoss = safeMean(losers.map(t => t.netPnlPct))
  const avgWLR = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : Infinity
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)
  const equity = buildEquityCurve(trades, capital)
  const totalReturn = ((equity[equity.length - 1].equity - capital) / capital) * 100
  const maxDD = computeMaxDrawdown(equity)
  const streaks = computeStreaks(trades)
  // Sharpe
  const avg = safeMean(pnls)
  const std = pnls.length < 2 ? 0 : Math.sqrt(pnls.reduce((s, p) => s + (p - avg) ** 2, 0) / (pnls.length - 1))
  const sharpe = std === 0 ? 0 : (avg / std) * Math.sqrt(250)
  // Profit factor
  let gp = 0, gl = 0
  for (const t of trades) { if (t.netPnlPct > 0) gp += t.netPnlPct; else gl += Math.abs(t.netPnlPct) }
  const pf = gl > 0 ? gp / gl : Infinity

  return {
    totalTrades, winners: winners.length, losers: losers.length,
    winRatePct: r2(winRate * 100), avgWinPct: r4(avgWin * 100), avgLossPct: r4(avgLoss * 100),
    avgWinLossRatio: r2(avgWLR), expectancyPct: r4(expectancy * 100),
    totalReturnPct: r2(totalReturn), totalReturnAbs: r2(equity[equity.length - 1].equity - capital),
    maxDrawdownPct: r2(maxDD.pct), sharpeRatio: r2(sharpe), profitFactor: r2(pf),
    maxWinStreak: streaks.maxWinStreak, maxLossStreak: streaks.maxLossStreak,
  }
}

/** System breakdown: 9/20 vs Triple */
export function systemBreakdown(trades: any[]) {
  const bySystem: Record<string, any[]> = {}
  for (const t of trades) { const key = t.system || 'UNKNOWN'; if (!bySystem[key]) bySystem[key] = []; bySystem[key].push(t) }
  const result: Record<string, any> = {}
  for (const [sys, sTrades] of Object.entries(bySystem)) {
    if (sTrades.length === 0) { result[sys] = { count: 0 }; continue }
    const wins = sTrades.filter(t => t.isWinner).length
    const aw = safeMean(sTrades.filter(t => t.isWinner).map(t => t.netPnlPct))
    const al = safeMean(sTrades.filter(t => !t.isWinner).map(t => t.netPnlPct))
    result[sys] = { count: sTrades.length, winRatePct: r2((wins / sTrades.length) * 100), avgPnlPct: r4(safeMean(sTrades.map(t => t.netPnlPct)) * 100), winLossRatio: Math.abs(al) > 0 ? r2(aw / Math.abs(al)) : 'INF' }
  }
  return result
}

/** Exit reason breakdown */
export function exitReasonBreakdown(trades: any[]) {
  const reasons: Record<string, any> = {}
  for (const t of trades) {
    const r = t.primaryExitReason || 'UNKNOWN'
    if (!reasons[r]) reasons[r] = { count: 0, totalPnl: 0, wins: 0 }
    reasons[r].count++; reasons[r].totalPnl += t.netPnlPct; if (t.isWinner) reasons[r].wins++
  }
  for (const r of Object.keys(reasons)) { const d = reasons[r]; d.winRatePct = r2((d.wins / d.count) * 100); d.avgPnlPct = r4((d.totalPnl / d.count) * 100) }
  return reasons
}

/** Direction-based breakdown */
export function directionBreakdown(trades: any[]) {
  const result: Record<string, any> = {}
  for (const dir of ['LONG', 'SHORT']) {
    const dTrades = trades.filter(t => t.direction === dir)
    if (dTrades.length === 0) { result[dir] = { count: 0 }; continue }
    const wins = dTrades.filter(t => t.isWinner).length
    result[dir] = { count: dTrades.length, winRatePct: r2((wins / dTrades.length) * 100), avgPnlPct: r4(safeMean(dTrades.map(t => t.netPnlPct)) * 100) }
  }
  return result
}

/** MACD histogram strength analysis */
export function macdStrengthAnalysis(trades: any[]) {
  const buckets: Record<string, any[]> = { 'Weak': [], 'Moderate': [], 'Strong': [] }
  for (const t of trades) {
    const absHist = Math.abs(t.macdHistAtEntry || 0)
    const histPct = absHist / (t.entryPrice || 1) * 100
    if (histPct < 0.01) buckets['Weak'].push(t)
    else if (histPct < 0.05) buckets['Moderate'].push(t)
    else buckets['Strong'].push(t)
  }
  const result: Record<string, any> = {}
  for (const [bucket, bTrades] of Object.entries(buckets)) {
    if (bTrades.length === 0) { result[bucket] = { count: 0 }; continue }
    const wins = bTrades.filter(t => t.isWinner).length
    result[bucket] = { count: bTrades.length, winRatePct: r2((wins / bTrades.length) * 100), avgPnlPct: r4(safeMean(bTrades.map(t => t.netPnlPct)) * 100) }
  }
  return result
}

// ── Equity curve helpers ──

function buildEquityCurve(trades: any[], startCapital: number) {
  const curve = [{ tradeNum: 0, equity: startCapital }]
  let equity = startCapital
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    const riskAmt = equity * EMA_CONFIG.DEFAULT_RISK_PER_TRADE
    const slDist = Math.abs(t.entryPrice - t.sl) || t.entryPrice * 0.005
    const qty = Math.floor(riskAmt / slDist)
    const posVal = qty * t.entryPrice
    const pnl = posVal * t.netPnlPct
    equity += pnl - EMA_CONFIG.COMMISSION_PER_SIDE * 2
    curve.push({ tradeNum: i + 1, equity: r2(equity) })
  }
  return curve
}

function computeMaxDrawdown(curve: any[]) {
  let peak = curve[0].equity, maxDD = 0, ddStart = 0, maxDur = 0
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].equity > peak) { peak = curve[i].equity; ddStart = i }
    const dd = (peak - curve[i].equity) / peak
    if (dd > maxDD) { maxDD = dd; maxDur = i - ddStart }
  }
  return { pct: maxDD * 100, duration: maxDur }
}

function computeStreaks(trades: any[]) {
  let mw = 0, ml = 0, cw = 0, cl = 0
  for (const t of trades) {
    if (t.isWinner) { cw++; cl = 0; if (cw > mw) mw = cw }
    else { cl++; cw = 0; if (cl > ml) ml = cl }
  }
  return { maxWinStreak: mw, maxLossStreak: ml }
}
