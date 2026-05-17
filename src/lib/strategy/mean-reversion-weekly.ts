// src/lib/strategy/mean-reversion-weekly.ts
// Strategy 9: Short-Term Mean Reversion (1-Week Hold)
// 3 sub-strategies: RSI(2), Bollinger Band, Oversold+Pattern
// Enhanced with decline typing, multi-TF, prior bounce, MA-proximity,
// gap filter, signal freshness — from meanrev.txt reference (2013 lines)

// ═══════════════════════════════════════════════════════════
// SECTION 1: TYPES & CONFIG
// ═══════════════════════════════════════════════════════════

interface DCandle { date: string; open: number; high: number; low: number; close: number; volume: number }

export const MRW_CONFIG = {
  // Strategy A: RSI(2) Connors
  A_RSI2_MAX: 5,          // ultra-strict ≤5
  A_MIN_DOWN_DAYS: 3,     // 3+ consecutive
  A_DIST_5SMA_PCT: -3,    // 3% below 5-SMA
  A_MAX_VIX: 22,
  A_STOP_PCT: 4,
  A_RSI2_EXIT: 65,
  // Strategy B: Bollinger
  B_BB_PERIOD: 20,
  B_BB_STD: 2,
  B_MIN_BW: 10,           // bandwidth > 10%
  B_MAX_VOL_RATIO: 2.5,   // no panic volume
  B_STOP_PCT: 3,
  // Strategy C: RSI(14) + Pattern
  C_RSI14_MAX: 30,
  C_MIN_PATTERN_SCORE: 40,
  C_MIN_VOL_MULTI: 1.2,
  C_RSI14_EXIT: 50,
  // Common
  SMA_TREND: 200,
  SMA_EXIT: 5,
  MAX_HOLD_DAYS: 5,
  MAX_GAP_DOWN: -3,
  MAX_GAP_UP: 3,
  MAX_POSITIONS: 3,
  MIN_HISTORY: 210,
  MAX_SL_PCT: 5,
  MIN_AVG_VOLUME: 500000,
}

// ═══════════════════════════════════════════════════════════
// SECTION 2: INDICATORS
// ═══════════════════════════════════════════════════════════

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null
  let ag = 0, al = 0
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) ag += d; else al -= d }
  ag /= period; al /= period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]; ag = (ag * (period - 1) + Math.max(d, 0)) / period; al = (al * (period - 1) + Math.max(-d, 0)) / period
  }
  return al === 0 ? 100 : r2(100 - 100 / (1 + ag / al))
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  return r2(values.slice(-period).reduce((a, b) => a + b, 0) / period)
}

function atr(candles: DCandle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)))
  let v = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) v = (v * (period - 1) + trs[i]) / period
  return r2(v)
}

function avgVolume(candles: DCandle[], period = 20): number | null {
  if (candles.length < period) return null
  return Math.round(candles.slice(-period).reduce((s, c) => s + c.volume, 0) / period)
}

function bollingerBands(closes: number[], period = 20, mult = 2) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const stdDev = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / (period - 1))
  const upper = mean + mult * stdDev, lower = mean - mult * stdDev
  const close = closes[closes.length - 1]
  const bw = mean > 0 ? ((upper - lower) / mean) * 100 : 0
  const pctB = (upper - lower) > 0 ? (close - lower) / (upper - lower) : 0.5
  return {
    upper: r2(upper), middle: r2(mean), lower: r2(lower),
    bandwidth: r2(bw), percentB: r2(pctB),
    belowLower: close < lower, aboveMiddle: close > mean,
    distBelowLower: close < lower ? r2(((lower - close) / lower) * 100) : 0,
    bandsWideEnough: bw > MRW_CONFIG.B_MIN_BW,
  }
}

function consecutiveDown(closes: number[]): number {
  let c = 0; for (let i = closes.length - 1; i >= 1; i--) { if (closes[i] < closes[i - 1]) c++; else break }; return c
}

function distFromMeans(closes: number[]) {
  if (closes.length < 200) return null
  const c = closes[closes.length - 1]
  const s5 = sma(closes, 5), s20 = sma(closes, 20), s50 = sma(closes, 50)
  const s100 = sma(closes, 100), s200 = sma(closes, 200)
  const dist = (v: number | null) => v ? r2(((c - v) / v) * 100) : null
  return {
    sma5: s5, sma20: s20, sma50: s50, sma100: s100, sma200: s200,
    dist5: dist(s5), dist20: dist(s20), dist200: dist(s200),
    above200: s200 ? c > s200 : false, above100: s100 ? c > s100 : false,
    below5: s5 ? c < s5 : false, below5by3pct: dist(s5) !== null && dist(s5)! <= -3,
    close: r2(c),
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 3: DECLINE CHARACTER TYPING
// ═══════════════════════════════════════════════════════════

function classifyDecline(candles: DCandle[]) {
  if (candles.length < 20) return null
  const recent = candles.slice(-10), today = recent[recent.length - 1]
  const av = avgVolume(candles.slice(-30), 20)
  let downDays = 0, totalDecl = 0, maxDrop = 0, hasGap = false, gapFilled = false, worstV = 0
  for (let i = recent.length - 1; i > 0; i--) {
    const c = recent[i], p = recent[i - 1]
    if (c.close < p.close) {
      downDays++; const dr = ((p.close - c.close) / p.close) * 100; totalDecl += dr
      if (dr > maxDrop) { maxDrop = dr; worstV = c.volume }
      if (c.open < p.low) { hasGap = true; gapFilled = c.high >= p.low }
    } else break
  }
  const downVols = candles.slice(-(downDays || 1)).map(c => c.volume)
  const vSlope = linSlope(downVols)
  const volAcc = vSlope > 0 && downVols.length >= 3
  const volDec = vSlope < 0
  const todayVR = av && av > 0 ? today.volume / av : 1
  const maxVR = av && av > 0 ? Math.max(...downVols) / av : 1
  const range = today.high - today.low
  const lowerWick = Math.min(today.open, today.close) - today.low
  const isClimax = todayVR > 2 && range > 0 && lowerWick / range > 0.4 && downDays >= 3
  const h20 = Math.max(...candles.slice(-20).map(c => c.high))
  const dd20 = ((h20 - today.close) / h20) * 100
  let drops: number[] = []
  const dc = candles.slice(-downDays)
  for (let i = 1; i < dc.length; i++) drops.push(Math.abs((dc[i].close - dc[i - 1].close) / dc[i - 1].close) * 100)
  const accel = drops.length >= 2 && drops[drops.length - 1] > drops[0] * 1.3

  let type: string, prob: number, score: number
  if (dd20 > 15 || (accel && totalDecl > 10)) { type = 'WATERFALL'; prob = 0.25; score = 10 }
  else if (hasGap && !gapFilled && maxDrop > 4) { type = 'NEWS_GAP'; prob = 0.45; score = 35 }
  else if (isClimax) { type = 'CAPITULATION'; prob = 0.70; score = 75 }
  else if (downDays >= 6 && !volAcc && dd20 > 8) { type = 'MEAN_DRIFT'; prob = 0.40; score = 30 }
  else if (downDays >= 3 && maxDrop < 3 && (volDec || maxVR < 2)) { type = 'ORDERLY'; prob = 0.80; score = 85 }
  else { type = 'MIXED'; prob = 0.55; score = 50 }

  return {
    type, mrProbability: prob, score, downDays, totalDecline: r2(totalDecl),
    maxSingleDrop: r2(maxDrop), drawdown20: r2(dd20), hasGapDown: hasGap,
    isClimaxCandle: isClimax, accelerating: accel,
    safe: type === 'ORDERLY' || type === 'CAPITULATION',
    dangerous: type === 'WATERFALL',
    todayVolRatio: r2(todayVR),
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 4: MULTI-TF OVERSOLD & PRIOR BOUNCE & MA PROXIMITY
// ═══════════════════════════════════════════════════════════

function multiTFOversold(candles: DCandle[]) {
  if (candles.length < 100) return null
  const closes = candles.map(c => c.close)
  const r2d = rsi(closes, 2), r14d = rsi(closes, 14)
  const wc: number[] = []
  for (let i = candles.length; i >= 5; i -= 5) wc.unshift(candles[i - 1].close)
  const r2w = wc.length >= 4 ? rsi(wc, 2) : null
  const r14w = wc.length >= 15 ? rsi(wc, 14) : null
  const dOversold = (r2d !== null && r2d <= 10) || (r14d !== null && r14d < 30)
  const wOversold = (r2w !== null && r2w <= 15) || (r14w !== null && r14w < 35)
  const both = dOversold && wOversold
  return { dailyOversold: dOversold, weeklyOversold: wOversold, bothOversold: both, score: clamp((dOversold ? 40 : 0) + (wOversold ? 40 : 0) + (both ? 20 : 0)) }
}

function priorBounce(candles: DCandle[], price: number, tol = 0.03) {
  if (candles.length < 100) return null
  const bounces: { level: number; maxBounce: number; bounced: boolean }[] = []
  for (let i = 2; i < candles.length - 5; i++) {
    const c = candles[i]
    if (c.low <= candles[i - 1].low && c.low <= candles[i - 2].low && c.low <= candles[i + 1].low && c.low <= candles[i + 2].low) {
      if (Math.abs((c.low - price) / price) > tol) continue
      let mb = 0; for (let j = i + 1; j < Math.min(i + 15, candles.length); j++) mb = Math.max(mb, ((candles[j].high - c.low) / c.low) * 100)
      bounces.push({ level: r2(c.low), maxBounce: r2(mb), bounced: mb > 2 })
    }
  }
  const ok = bounces.filter(b => b.bounced)
  return { total: bounces.length, successful: ok.length, isProvenSupport: ok.length >= 2, score: clamp(ok.length >= 3 ? 95 : ok.length >= 2 ? 80 : ok.length >= 1 ? 55 : bounces.length > 0 ? 20 : 0) }
}

function patternAtMA(today: DCandle, dist: any) {
  if (!dist) return null
  const mas = [
    { name: 'SMA200', value: dist.sma200, imp: 100 },
    { name: 'SMA100', value: dist.sma100, imp: 85 },
    { name: 'SMA50', value: dist.sma50, imp: 70 },
  ]
  const hits: { ma: string; imp: number; isPerfect: boolean }[] = []
  for (const m of mas) {
    if (!m.value) continue
    const touched = today.low <= m.value * 1.005
    const closedAbove = today.close >= m.value * 0.995
    const wick = today.low < m.value && today.close > m.value
    const near = Math.abs((today.close - m.value) / m.value) * 100 < 1.5
    if (touched || near) hits.push({ ma: m.name, imp: m.imp, isPerfect: wick && closedAbove })
  }
  const best = hits.sort((a, b) => b.imp - a.imp)[0] || null
  return { atKeyMA: hits.length > 0, nearest: best, score: best ? clamp(best.imp * (best.isPerfect ? 1 : best.imp ? 0.8 : 0.5)) : 0 }
}

// ═══════════════════════════════════════════════════════════
// SECTION 5: CANDLE PATTERN DETECTION
// ═══════════════════════════════════════════════════════════

function detectReversalCandle(today: DCandle, yesterday: DCandle | null) {
  const range = today.high - today.low
  if (range === 0) return { type: 'DOJI', score: 0, trigger: today.high, stop: today.low, isHammer: false, isEngulfing: false }
  const body = Math.abs(today.close - today.open), bull = today.close >= today.open
  const uw = bull ? today.high - today.close : today.high - today.open
  const lw = bull ? today.open - today.low : today.close - today.low
  const br = body / range, lr = lw / range, ur = uw / range
  let type = 'NONE', score = 0, isH = false, isE = false

  // Hammer
  if (lw >= body * 2 && ur < 0.15 && br < 0.35) {
    isH = true; type = 'HAMMER'; score = 50
    if (lw >= body * 3) score += 15; if (bull) score += 15; if (ur < 0.05) score += 10
  }
  // Engulfing
  if (yesterday && yesterday.close < yesterday.open && today.close > today.open && today.open <= yesterday.close && today.close >= yesterday.open) {
    isE = true; type = isH ? 'HAMMER_ENGULFING' : 'ENGULFING'; let s = 55
    const er = (yesterday.open - yesterday.close) > 0 ? (today.close - today.open) / (yesterday.open - yesterday.close) : 1
    if (er > 2) s += 20; else if (er > 1.5) s += 12; if (today.close > yesterday.high) s += 10
    score = Math.max(score, clamp(s))
  }
  // Pin bar
  if (lr > 0.66 && br < 0.25 && ur < 0.15 && score < 70) { type = 'PIN_BAR'; score = 70 }
  // Dragonfly
  if (br < 0.05 && lr > 0.70 && ur < 0.10 && score < 65) { type = 'DRAGONFLY'; score = 65 }

  return { type, score: clamp(score), trigger: r2(today.high * 1.001), stop: r2(Math.min(today.low, yesterday?.low ?? today.low) * 0.998), isHammer: isH, isEngulfing: isE }
}

// ═══════════════════════════════════════════════════════════
// SECTION 6: REGIME & GAP FILTER
// ═══════════════════════════════════════════════════════════

function mrRegime(candles: DCandle[], niftyCandles: DCandle[] | null, vix: number | null) {
  if (candles.length < 60) return null
  const closes = candles.slice(-60).map(c => c.close)
  const s50 = sma(closes, 50), c = closes[closes.length - 1], above50 = s50 ? c > s50 : true
  const h20 = Math.max(...closes.slice(-20)), dd = ((h20 - c) / h20) * 100
  let nOk = true
  if (niftyCandles && niftyCandles.length >= 200) {
    const nc = niftyCandles.map(c => c.close), n200 = sma(nc, 200)
    nOk = n200 ? nc[nc.length - 1] > n200 : true
  }
  let vOk = true, vLev = 'NORMAL'
  if (vix != null) { if (vix > 25) { vOk = false; vLev = 'CRISIS' } else if (vix > 22) { vOk = false; vLev = 'ELEVATED' } else if (vix > 18) vLev = 'CAUTIOUS' }
  let regime: string
  if (dd > 15 || !vOk) regime = 'AVOID'
  else if (dd > 10 && !above50) regime = 'DANGEROUS'
  else if (above50 && nOk) regime = 'IDEAL'
  else if (above50) regime = 'GOOD'
  else if (nOk) regime = 'ACCEPTABLE'
  else regime = 'RISKY'
  const scores: any = { IDEAL: 95, GOOD: 75, ACCEPTABLE: 55, RISKY: 30, DANGEROUS: 10, AVOID: 0 }
  return { regime, score: scores[regime] ?? 50, above50, drawdown20: r2(dd), vix, vixLevel: vLev, isSafe: regime === 'IDEAL' || regime === 'GOOD' }
}

function gapFilter(prevClose: number, todayOpen: number, stopLoss: number) {
  const gap = ((todayOpen - prevClose) / prevClose) * 100
  const distStop = stopLoss > 0 ? ((todayOpen - stopLoss) / todayOpen) * 100 : 999
  const tooLarge = gap < MRW_CONFIG.MAX_GAP_DOWN, bounced = gap > MRW_CONFIG.MAX_GAP_UP, stopClose = distStop < 1
  return { gapPct: r2(gap), canEnter: !tooLarge && !bounced && !stopClose, reason: tooLarge ? 'GAP_DOWN_TOO_LARGE' : bounced ? 'ALREADY_BOUNCED' : stopClose ? 'STOP_TOO_CLOSE' : 'OK' }
}

function bounceHistory(candles: DCandle[], lookback = 252) {
  if (candles.length < lookback) return null
  const cc = candles.slice(-lookback), closes = cc.map(c => c.close)
  const bounces: { won: boolean; ret: number }[] = []
  // Build RSI(2) series manually
  if (closes.length < 4) return null
  let ag = 0, al = 0
  for (let i = 1; i <= 2; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) ag += d; else al -= d }
  ag /= 2; al /= 2
  const rsi2s: (number | null)[] = [null, null, al === 0 ? 100 : r2(100 - 100 / (1 + ag / al))]
  for (let i = 3; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]; ag = (ag * 1 + Math.max(d, 0)) / 2; al = (al * 1 + Math.max(-d, 0)) / 2
    rsi2s.push(al === 0 ? 100 : r2(100 - 100 / (1 + ag / al)))
  }
  for (let i = 10; i < rsi2s.length - 6; i++) {
    if (rsi2s[i] === null || rsi2s[i]! > 10) continue
    const entry = i + 1 < cc.length ? cc[i + 1].open : null; if (!entry) continue
    let ret = 0; for (let d = 1; d <= 5 && i + 1 + d < closes.length; d++) ret = ((closes[i + 1 + d] - entry) / entry) * 100
    bounces.push({ won: ret > 0, ret: r2(ret) })
  }
  if (!bounces.length) return { instances: 0, winRate: 50, avgReturn: 0, score: 50 }
  const wr = (bounces.filter(b => b.won).length / bounces.length) * 100
  return { instances: bounces.length, winRate: r2(wr), avgReturn: r2(bounces.reduce((s, b) => s + b.ret, 0) / bounces.length), isReliable: wr > 65 && bounces.length >= 3, isPoor: wr < 45 && bounces.length >= 3, score: clamp(mapRange(wr, 40, 85, 15, 100)) }
}

// ═══════════════════════════════════════════════════════════
// SECTION 7: 3-STRATEGY SCANNER
// ═══════════════════════════════════════════════════════════

export function scanMRWeekly(
  stocks: { symbol: string; dailyCandles: DCandle[] }[],
  niftyCandles: DCandle[],
  vix: number | null
): { strategyA: any[]; strategyB: any[]; strategyC: any[]; confluence: any[]; regime: any; meta: any } {
  const nClose = niftyCandles.map(c => c.close)
  const globalRegime = mrRegime(niftyCandles, null, vix)

  const stratA: any[] = [], stratB: any[] = [], stratC: any[] = [], confluence: any[] = []
  let scanned = 0, blocked = 0

  for (const stock of stocks) {
    scanned++
    const dc = stock.dailyCandles
    if (dc.length < MRW_CONFIG.MIN_HISTORY) { blocked++; continue }
    const avgV = avgVolume(dc, 20)
    if (avgV !== null && avgV < MRW_CONFIG.MIN_AVG_VOLUME) { blocked++; continue }
    const closes = dc.map(c => c.close)
    const today = dc[dc.length - 1], yesterday = dc[dc.length - 2]

    const r2v = rsi(closes, 2), r14v = rsi(closes, 14)
    const bb = bollingerBands(closes, MRW_CONFIG.B_BB_PERIOD, MRW_CONFIG.B_BB_STD)
    const dist = distFromMeans(closes)
    const atrV = atr(dc, 14)
    const volR = avgV && avgV > 0 ? today.volume / avgV : 1
    const decline = classifyDecline(dc)
    const mtf = multiTFOversold(dc)
    const pattern = detectReversalCandle(today, yesterday)
    const pb = priorBounce(dc, today.close, 0.03)
    const maP = patternAtMA(today, dist)
    const bHist = bounceHistory(dc, 252)
    const regime = mrRegime(dc, niftyCandles, vix)
    const downD = consecutiveDown(closes)

    if (decline?.dangerous || regime?.regime === 'AVOID') { blocked++; continue }

    // ── Strategy A: RSI(2) ≤ 5 ──
    const aPass = dist?.above200 && r2v !== null && r2v <= MRW_CONFIG.A_RSI2_MAX && downD >= MRW_CONFIG.A_MIN_DOWN_DAYS && dist?.below5by3pct && (vix == null || vix < MRW_CONFIG.A_MAX_VIX)
    let aScore = 0
    if (aPass) {
      aScore += clamp(mapRange(r2v!, 0, 5, 100, 50)) * 0.30
      aScore += clamp(mapRange(downD, 3, 7, 50, 100)) * 0.20
      aScore += clamp(mapRange(Math.abs(dist!.dist5 || 3), 3, 8, 50, 100)) * 0.20
      aScore += (regime?.score || 50) * 0.15
      aScore += (vix != null ? clamp(mapRange(vix, 10, 22, 100, 40)) : 70) * 0.15
    }
    // ── Strategy B: Bollinger ──
    const bPass = bb?.belowLower && dist?.above200 && bb?.bandsWideEnough && volR < MRW_CONFIG.B_MAX_VOL_RATIO
    let bScore = 0
    if (bPass) {
      bScore += clamp(mapRange(bb!.distBelowLower || 0, 0, 4, 40, 100)) * 0.25
      bScore += clamp(mapRange(bb!.bandwidth || 10, 10, 25, 40, 90)) * 0.15
      bScore += (decline?.score || 50) * 0.20
      bScore += (regime?.score || 50) * 0.20
      bScore += clamp(mapRange(bb!.percentB || 0, -0.2, 0, 100, 50)) * 0.20
    }
    // ── Strategy C: Pattern + RSI(14) < 30 ──
    const hasPattern = pattern.isHammer || pattern.isEngulfing || pattern.type === 'PIN_BAR' || pattern.type === 'DRAGONFLY'
    const cPass = r14v !== null && r14v < MRW_CONFIG.C_RSI14_MAX && hasPattern && pattern.score >= MRW_CONFIG.C_MIN_PATTERN_SCORE && dist?.above100 && volR >= MRW_CONFIG.C_MIN_VOL_MULTI
    let cScore = 0
    if (cPass) {
      cScore += pattern.score * 0.30
      cScore += clamp(mapRange(r14v!, 15, 30, 100, 50)) * 0.25
      cScore += clamp(mapRange(volR, 1.2, 3, 50, 100)) * 0.20
      cScore += (regime?.score || 50) * 0.15
      cScore += (dist?.above200 ? 80 : dist?.above100 ? 60 : 30) * 0.10
    }

    if (!aPass && !bPass && !cPass) continue

    // ── Composite with enhancements ──
    const bestScore = Math.max(aPass ? aScore : 0, bPass ? bScore : 0, cPass ? cScore : 0)
    let bonus = 0
    bonus += (decline?.score || 50) * 0.12
    if (mtf?.bothOversold) bonus += 8
    if (pb?.isProvenSupport) bonus += 10; else if (pb && pb.successful >= 1) bonus += 5
    if (maP?.atKeyMA) bonus += (maP.score / 100) * 8
    if (bHist?.isReliable) bonus += 6
    if (decline?.isClimaxCandle) bonus += 5
    if (decline?.dangerous) bonus -= 15
    if (bHist?.isPoor) bonus -= 8
    const compositeScore = r2(clamp(bestScore + bonus))

    // ── Entry plan ──
    const strategies: string[] = []
    if (aPass) strategies.push('RSI2')
    if (bPass) strategies.push('BOLLINGER')
    if (cPass) strategies.push('PATTERN')
    const primary = strategies.length >= 2 ? 'CONFLUENCE' : strategies[0]
    const isConf = strategies.length >= 2
    const entryType = strategies.includes('PATTERN') && pattern.trigger ? 'STOP_BUY' : 'MARKET_OPEN'
    const triggerPrice = entryType === 'STOP_BUY' ? pattern.trigger : null
    let sl: number
    if (primary === 'PATTERN' && pattern.stop) sl = pattern.stop
    else if (primary === 'BOLLINGER') sl = r2(today.close * (1 - MRW_CONFIG.B_STOP_PCT / 100))
    else sl = r2(today.close * (1 - MRW_CONFIG.A_STOP_PCT / 100))
    // P0: ATR stop should TIGHTEN (raise for longs), not widen — use > not <
    if (atrV) { const atrSl = r2(today.close - atrV * 1.5); if (atrSl > sl) sl = atrSl }
    // P1: Enforce max SL cap
    const maxSlFloor = r2(today.close * (1 - MRW_CONFIG.MAX_SL_PCT / 100))
    if (sl < maxSlFloor) sl = maxSlFloor

    // P1: Targets — floor at entry+1% to prevent negative R:R
    const entryEst = entryType === 'STOP_BUY' && triggerPrice ? triggerPrice : today.close
    let t1 = primary === 'BOLLINGER' ? bb?.middle : dist?.sma5
    let t2 = dist?.sma20
    if (t1 && t1 <= entryEst) t1 = r2(entryEst * 1.015)
    if (t2 && t2 <= entryEst) t2 = r2(entryEst * 1.03)

    // Strategy-specific exit rules
    const exitRules = primary === 'RSI2' || primary === 'CONFLUENCE'
      ? { rsiExit: `RSI(2) ≥ ${MRW_CONFIG.A_RSI2_EXIT}`, smaExit: 'Close above 5-SMA', maxHold: `${MRW_CONFIG.MAX_HOLD_DAYS} days`, stopPct: `${MRW_CONFIG.A_STOP_PCT}%` }
      : primary === 'BOLLINGER'
      ? { bbExit: 'Close above BB middle band', maxHold: `${MRW_CONFIG.MAX_HOLD_DAYS} days`, stopPct: `${MRW_CONFIG.B_STOP_PCT}%` }
      : { rsiExit: `RSI(14) > ${MRW_CONFIG.C_RSI14_EXIT}`, maxHold: `${MRW_CONFIG.MAX_HOLD_DAYS} days`, stopPct: `${MRW_CONFIG.A_STOP_PCT}%` }

    // P2: Gap risk warning
    const gapRisk = `Skip if next open gaps down >${Math.abs(MRW_CONFIG.MAX_GAP_DOWN)}% or up >${MRW_CONFIG.MAX_GAP_UP}%`

    const entry = {
      symbol: stock.symbol, compositeScore, primary, strategies, isConfluence: isConf,
      entryType, triggerPrice,
      scanClose: r2(today.close), stopLoss: sl, target1: t1, target2: t2,
      indicators: { rsi2: r2v, rsi14: r14v, atr14: atrV, close: r2(today.close), volRatio: r2(volR), downDays: downD, avgVolume: avgV },
      bb: bPass ? { lower: bb!.lower, middle: bb!.middle, bw: bb!.bandwidth, pctB: bb!.percentB } : null,
      dist200: dist?.dist200, above200: dist?.above200,
      decline, multiTF: mtf, priorBounce: pb, maPattern: maP, bounceHistory: bHist, regime,
      patternType: pattern.type, patternScore: pattern.score,
      exitRules, gapRisk,
    }

    if (aPass) stratA.push(entry)
    if (bPass) stratB.push(entry)
    if (cPass) stratC.push(entry)
    if (isConf) confluence.push(entry)
  }

  for (const arr of [stratA, stratB, stratC, confluence]) arr.sort((a, b) => b.compositeScore - a.compositeScore)

  return {
    strategyA: stratA, strategyB: stratB, strategyC: stratC, confluence,
    regime: globalRegime,
    meta: { scanned, blocked, a: stratA.length, b: stratB.length, c: stratC.length, conf: confluence.length },
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 8: BACKTESTER
// ═══════════════════════════════════════════════════════════

export function runMRWBacktest(
  stockCandles: Record<string, DCandle[]>, niftyDaily: DCandle[],
  opts: { maxPositions?: number; vix?: number } = {}
): { trades: any[]; summary: any; analysis: any; strategyComparison: any } {
  const maxPos = opts.maxPositions || MRW_CONFIG.MAX_POSITIONS
  const nDates = niftyDaily.map(c => c.date)
  const startIdx = MRW_CONFIG.MIN_HISTORY
  const endIdx = nDates.length - 7
  const trades: any[] = []

  for (let i = startIdx; i < endIdx; i++) {
    const scanDate = nDates[i], entryDate = nDates[i + 1]
    if (!entryDate) continue
    const nPrior = niftyDaily.slice(0, i + 1)
    const stocks: { symbol: string; dailyCandles: DCandle[] }[] = []
    for (const [sym, candles] of Object.entries(stockCandles)) {
      const idx = candles.findIndex(c => c.date === scanDate)
      if (idx < MRW_CONFIG.MIN_HISTORY) continue
      stocks.push({ symbol: sym, dailyCandles: candles.slice(idx - MRW_CONFIG.MIN_HISTORY, idx + 1) })
    }

    const scan = scanMRWeekly(stocks, nPrior, opts.vix ?? 14)
    const seen = new Set<string>()
    const cands: any[] = []
    for (const list of [scan.confluence, scan.strategyA, scan.strategyB, scan.strategyC]) {
      for (const c of list) { if (!seen.has(c.symbol)) { seen.add(c.symbol); cands.push(c) } }
    }
    cands.sort((a, b) => b.compositeScore - a.compositeScore)

    let taken = 0
    for (const cand of cands) {
      if (taken >= maxPos) break
      const candles = stockCandles[cand.symbol]
      if (!candles) continue
      const scanIdx = candles.findIndex(c => c.date === scanDate)
      const entIdx = candles.findIndex(c => c.date === entryDate)
      if (scanIdx < 0 || entIdx < 0 || entIdx + 6 >= candles.length) continue
      const entryCandle = candles[entIdx]
      const gapPct = ((entryCandle.open - cand.scanClose) / cand.scanClose) * 100
      if (gapPct < MRW_CONFIG.MAX_GAP_DOWN || gapPct > MRW_CONFIG.MAX_GAP_UP) continue

      let entryPrice: number
      if (cand.entryType === 'STOP_BUY' && cand.triggerPrice) {
        if (entryCandle.high < cand.triggerPrice) continue
        entryPrice = cand.triggerPrice
      } else { entryPrice = entryCandle.open }

      let sl = cand.primary === 'PATTERN' && cand.stopLoss ? cand.stopLoss : entryPrice * (1 - (cand.primary === 'BOLLINGER' ? MRW_CONFIG.B_STOP_PCT : MRW_CONFIG.A_STOP_PCT) / 100)
      const exit = simulateHoldMR(candles, entIdx, entryPrice, sl, cand)
      const pnl = ((exit.exitPrice - entryPrice) / entryPrice) * 100

      trades.push({
        scanDate, entryDate: candles[entIdx]?.date, exitDate: exit.exitDate,
        symbol: cand.symbol, strategy: cand.primary, strategies: cand.strategies,
        isConfluence: cand.isConfluence, entryType: cand.entryType,
        entryPrice: r2(entryPrice), gapAtEntry: r2(gapPct), stopLoss: r2(sl),
        exitPrice: r2(exit.exitPrice), exitReason: exit.reason, pnlPct: r2(pnl),
        result: pnl > 0.1 ? 'WIN' : pnl < -0.1 ? 'LOSS' : 'FLAT',
        holdDays: exit.holdDays, compositeScore: cand.compositeScore,
        declineType: cand.decline?.type, rsi2AtScan: cand.indicators.rsi2,
        multiTFOversold: cand.multiTF?.bothOversold, priorBounceSupport: cand.priorBounce?.isProvenSupport,
        patternAtMA: cand.maPattern?.atKeyMA, patternType: cand.patternType,
      })
      taken++
    }
  }

  return { trades, summary: buildSummary(trades), analysis: buildAnalysis(trades), strategyComparison: compareStrategies(trades) }
}

function simulateHoldMR(candles: DCandle[], entryIdx: number, entry: number, sl: number, cand: any) {
  const maxD = MRW_CONFIG.MAX_HOLD_DAYS
  let curStop = sl
  for (let d = 1; d <= maxD && entryIdx + d < candles.length; d++) {
    const day = candles[entryIdx + d]
    if (day.low <= curStop) return { exitPrice: curStop, exitDate: day.date, reason: 'STOP_LOSS', holdDays: d }
    const allC = candles.slice(0, entryIdx + d + 1).map(c => c.close)
    const primary = cand.primary
    if (primary === 'RSI2' || primary === 'CONFLUENCE') {
      const r2v = rsi(allC, 2); if (r2v !== null && r2v >= MRW_CONFIG.A_RSI2_EXIT) return { exitPrice: day.close, exitDate: day.date, reason: 'RSI2_EXIT', holdDays: d }
      const s5 = sma(allC, 5); if (s5 && day.close > s5) return { exitPrice: day.close, exitDate: day.date, reason: 'ABOVE_5SMA', holdDays: d }
    }
    if (primary === 'BOLLINGER' || primary === 'CONFLUENCE') {
      const bb = bollingerBands(allC, 20, 2); if (bb && day.close > bb.middle) return { exitPrice: day.close, exitDate: day.date, reason: 'ABOVE_MIDDLE_BB', holdDays: d }
    }
    if (primary === 'PATTERN' || primary === 'CONFLUENCE') {
      const r14 = rsi(allC, 14); if (r14 !== null && r14 > MRW_CONFIG.C_RSI14_EXIT) return { exitPrice: day.close, exitDate: day.date, reason: 'RSI14_RECOVERED', holdDays: d }
    }
    const profit = ((day.close - entry) / entry) * 100
    if (profit >= 5 && curStop < entry) curStop = r2(entry * 1.01)
    if (d === maxD) return { exitPrice: day.close, exitDate: day.date, reason: 'TIME_EXIT', holdDays: d }
  }
  const last = candles[Math.min(entryIdx + maxD, candles.length - 1)]
  return { exitPrice: last.close, exitDate: last.date, reason: 'TIME_EXIT', holdDays: maxD }
}

// ═══════════════════════════════════════════════════════════
// SECTION 9: ANALYTICS
// ═══════════════════════════════════════════════════════════

function buildSummary(trades: any[]) {
  if (!trades.length) return { totalTrades: 0 }
  const w = trades.filter(t => t.result === 'WIN'), l = trades.filter(t => t.result === 'LOSS')
  const pnls = trades.map(t => t.pnlPct), tot = pnls.reduce((s, p) => s + p, 0)
  const gp = w.reduce((s, t) => s + t.pnlPct, 0), gl = Math.abs(l.reduce((s, t) => s + t.pnlPct, 0))
  let maxS = 0, s = 0; for (const t of trades) { if (t.result === 'LOSS') { s++; maxS = Math.max(maxS, s) } else s = 0 }
  return {
    totalTrades: trades.length, wins: w.length, losses: l.length,
    winRate: r2((w.length / trades.length) * 100), totalPnl: r2(tot),
    avgPnl: r2(tot / trades.length), avgWin: w.length ? r2(gp / w.length) : 0,
    avgLoss: l.length ? r2(-gl / l.length) : 0, profitFactor: gl > 0 ? r2(gp / gl) : gp > 0 ? Infinity : 0,
    avgHold: r2(mean(trades.map(t => t.holdDays))), best: r2(Math.max(...pnls)), worst: r2(Math.min(...pnls)),
    maxConsecLoss: maxS,
  }
}

function compareStrategies(trades: any[]) {
  const groups: Record<string, any[]> = {}
  for (const t of trades) { const k = t.strategy; if (!groups[k]) groups[k] = []; groups[k].push(t) }
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(groups)) result[k] = buildSummary(v)
  const conf = trades.filter(t => t.isConfluence), nc = trades.filter(t => !t.isConfluence)
  result.confluenceEdge = {
    confluence: buildSummary(conf), individual: buildSummary(nc),
    edge: conf.length >= 5 && nc.length >= 5 ? r2(mean(conf.map(t => t.pnlPct)) - mean(nc.map(t => t.pnlPct))) : null,
  }
  return result
}

function buildAnalysis(trades: any[]) {
  if (trades.length < 5) return null
  const avg = (a: any[]) => a.length ? r2(mean(a.map(t => t.pnlPct))) : 0
  const wr = (a: any[]) => a.length ? r2((a.filter(t => t.result === 'WIN').length / a.length) * 100) : 0
  const byDecline: Record<string, any[]> = {}
  for (const t of trades) { const d = t.declineType || 'UNKNOWN'; if (!byDecline[d]) byDecline[d] = []; byDecline[d].push(t) }
  const mktO = trades.filter(t => t.entryType !== 'STOP_BUY'), stpB = trades.filter(t => t.entryType === 'STOP_BUY')
  const gapD = trades.filter(t => t.gapAtEntry < -0.5), gapU = trades.filter(t => t.gapAtEntry > 0.5), flat = trades.filter(t => Math.abs(t.gapAtEntry) <= 0.5)
  const mtfY = trades.filter(t => t.multiTFOversold), mtfN = trades.filter(t => !t.multiTFOversold)
  const pbY = trades.filter(t => t.priorBounceSupport), pbN = trades.filter(t => !t.priorBounceSupport)
  const maY = trades.filter(t => t.patternAtMA), maN = trades.filter(t => !t.patternAtMA)
  const byExit: Record<string, any[]> = {}; for (const t of trades) { if (!byExit[t.exitReason]) byExit[t.exitReason] = []; byExit[t.exitReason].push(t) }
  let cum = 0, peak = 0, maxDD = 0; for (const t of trades) { cum += t.pnlPct; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum) }
  return {
    byDeclineType: Object.fromEntries(Object.entries(byDecline).map(([k, v]) => [k, { count: v.length, avgPnl: avg(v), winRate: wr(v) }])),
    byEntryType: { marketOrder: { count: mktO.length, avgPnl: avg(mktO), winRate: wr(mktO) }, stopBuy: { count: stpB.length, avgPnl: avg(stpB), winRate: wr(stpB) } },
    byGap: { gapDown: { count: gapD.length, avgPnl: avg(gapD), winRate: wr(gapD) }, flat: { count: flat.length, avgPnl: avg(flat), winRate: wr(flat) }, gapUp: { count: gapU.length, avgPnl: avg(gapU), winRate: wr(gapU) } },
    multiTF: { both: { count: mtfY.length, avgPnl: avg(mtfY), winRate: wr(mtfY) }, daily: { count: mtfN.length, avgPnl: avg(mtfN), winRate: wr(mtfN) }, edge: mtfY.length >= 3 ? r2((avg(mtfY) as number) - (avg(mtfN) as number)) : null },
    priorBounce: { withSupport: { count: pbY.length, avgPnl: avg(pbY), winRate: wr(pbY) }, without: { count: pbN.length, avgPnl: avg(pbN), winRate: wr(pbN) }, edge: pbY.length >= 3 ? r2((avg(pbY) as number) - (avg(pbN) as number)) : null },
    patternAtMA: { atMA: { count: maY.length, avgPnl: avg(maY), winRate: wr(maY) }, notAtMA: { count: maN.length, avgPnl: avg(maN), winRate: wr(maN) }, edge: maY.length >= 3 ? r2((avg(maY) as number) - (avg(maN) as number)) : null },
    byExitReason: Object.entries(byExit).map(([k, v]) => ({ reason: k, count: v.length, avgPnl: avg(v), winRate: wr(v) })),
    maxDrawdown: r2(maxDD), finalCumPnl: r2(cum),
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 10: RISK GATE
// ═══════════════════════════════════════════════════════════

export function preMRGate(market: { indiaVix: number | null }): { allowed: boolean; blocks: any[]; warnings: any[] } {
  const blocks: any[] = [], warnings: any[] = []
  if (market.indiaVix !== null) {
    if (market.indiaVix > 25) blocks.push({ rule: 'VIX', msg: `VIX ${market.indiaVix} > 25 (crisis)` })
    else if (market.indiaVix > 22) blocks.push({ rule: 'VIX', msg: `VIX ${market.indiaVix} > 22 (elevated)` })
    else if (market.indiaVix > 18) warnings.push({ rule: 'VIX', msg: `VIX ${market.indiaVix} cautious` })
  }
  return { allowed: blocks.length === 0, blocks, warnings }
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function mean(arr: number[]) { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function r2(n: number | null | undefined): number { return n != null && !isNaN(n) ? Math.round(n * 100) / 100 : 0 }
function clamp(v: number, min = 0, max = 100) { return Math.min(max, Math.max(min, v)) }
function mapRange(v: number, i1: number, i2: number, o1: number, o2: number) { return ((v - i1) / (i2 - i1)) * (o2 - o1) + o1 }
function linSlope(vals: number[]) {
  const n = vals.length; if (n < 2) return 0
  let sx = 0, sy = 0, sxy = 0, sx2 = 0
  for (let i = 0; i < n; i++) { sx += i; sy += vals[i]; sxy += i * vals[i]; sx2 += i * i }
  const d = n * sx2 - sx * sx; return d !== 0 ? (n * sxy - sx * sy) / d : 0
}
