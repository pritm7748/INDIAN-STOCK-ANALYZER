// src/lib/strategy/weekly-breakout.ts
// Weekly Breakout / Breakdown Strategy Engine
// Consolidated from weekly.txt reference (2682 lines)

// ═══════════════════════════════════════════════════════════
// SECTION 1: CONFIG & TYPES
// ═══════════════════════════════════════════════════════════

export const WB_CONFIG = {
  MAX_PW_RANGE_PCT: 5.0,
  MIN_WEEKLY_VOL_MULTI: 1.0,
  SMA_PERIOD: 20,
  MIN_BASE_WEEKS: 2,
  MAX_FALSE_BO_RATE: 65,
  MIN_RS_SCORE: 30,
  MIN_DAILY_VOL_MULTI: 1.3,
  RSI_LONG_MIN: 45, RSI_LONG_MAX: 75,
  RSI_SHORT_MIN: 25, RSI_SHORT_MAX: 55,
  MAX_POSITIONS: 4,
  MAX_HOLD_DAYS: 5,
  TRAIL_ACTIVATION: 3.0,
  TRAIL_PROTECTION: 0.6,
  FAILED_BO_DAYS: 2,
  MAX_SL_PCT: 7,
  VIX_BLOCK: 25, VIX_WARN: 20,
}

export const FNO_SET = new Set([
  'RELIANCE', 'SBIN', 'ICICIBANK', 'HDFCBANK', 'KOTAKBANK', 'AXISBANK',
  'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TATAMOTORS', 'M&M', 'MARUTI',
  'TATASTEEL', 'HINDALCO', 'JSWSTEEL', 'BAJFINANCE', 'BHARTIARTL', 'ADANIENT',
  'LT', 'SUNPHARMA', 'ITC', 'TATAPOWER', 'DLF', 'BANKBARODA', 'PNB',
  'INDUSINDBK', 'TECHM', 'POWERGRID', 'NTPC', 'BAJAJFINSV', 'ONGC',
  'COALINDIA', 'VEDL', 'SAIL', 'TATACONSUM', 'CIPLA', 'DRREDDY',
  'APOLLOHOSP', 'SBILIFE', 'BPCL', 'GAIL', 'HEROMOTOCO', 'EICHERMOT',
  'DIVISLAB', 'ULTRACEMCO', 'TITAN', 'NESTLEIND', 'SHRIRAMFIN',
])

interface DCandle { date: string; open: number; high: number; low: number; close: number; volume: number }

interface WCandle {
  weekStart: string; weekEnd: string
  open: number; high: number; low: number; close: number; volume: number
  tradingDays: number; isShortWeek: boolean
  range: number; rangePct: number; body: number; bodyPct: number
  isBullish: boolean; closePos: number; candleType: string
  dailyCandles: DCandle[]
}

// ═══════════════════════════════════════════════════════════
// SECTION 2: WEEKLY CANDLE CONSTRUCTION
// ═══════════════════════════════════════════════════════════

export function buildWeeklyCandles(daily: DCandle[]): WCandle[] {
  if (!daily?.length) return []
  const weeks: WCandle[] = []
  let cur: any = null

  for (const d of daily) {
    const dow = new Date(d.date).getDay()
    const needsNew = !cur || dow === 1 || dayGap(cur.weekEnd, d.date) > 3
    if (needsNew && cur) { finalizeWeek(cur); weeks.push(cur); cur = null }
    if (!cur) {
      cur = { weekStart: d.date, weekEnd: d.date, open: d.open, high: d.high, low: d.low, close: d.close, volume: 0, tradingDays: 0, dailyCandles: [] }
    }
    cur.high = Math.max(cur.high, d.high)
    cur.low = Math.min(cur.low, d.low)
    cur.close = d.close; cur.weekEnd = d.date; cur.volume += d.volume; cur.tradingDays++
    cur.dailyCandles.push(d)
  }
  if (cur?.tradingDays > 0) { finalizeWeek(cur); weeks.push(cur) }
  return weeks
}

function finalizeWeek(w: any) {
  w.isShortWeek = w.tradingDays < 4
  w.range = w.high - w.low
  w.rangePct = w.close > 0 ? r2((w.range / w.close) * 100) : 0
  w.body = Math.abs(w.close - w.open)
  w.bodyPct = w.range > 0 ? r2((w.body / w.range) * 100) : 0
  w.isBullish = w.close > w.open
  w.closePos = w.range > 0 ? r4((w.close - w.low) / w.range) : 0.5
  w.candleType = classifyWeeklyCandle(w)
}

function classifyWeeklyCandle(w: any): string {
  const br = w.range > 0 ? w.body / w.range : 0
  const uw = w.isBullish ? w.high - w.close : w.high - w.open
  const lw = w.isBullish ? w.open - w.low : w.close - w.low
  const uwr = w.range > 0 ? uw / w.range : 0
  const lwr = w.range > 0 ? lw / w.range : 0
  if (br > 0.75 && w.isBullish) return 'BULLISH_MARUBOZU'
  if (br > 0.75 && !w.isBullish) return 'BEARISH_MARUBOZU'
  if (br < 0.10) return 'DOJI'
  if (w.isBullish && lwr > 0.60 && uwr < 0.10) return 'HAMMER'
  if (!w.isBullish && uwr > 0.60 && lwr < 0.10) return 'SHOOTING_STAR'
  if (w.isBullish && br > 0.50) return 'BULLISH'
  if (!w.isBullish && br > 0.50) return 'BEARISH'
  if (uwr > 0.35 && lwr > 0.35) return 'SPINNING_TOP'
  return w.isBullish ? 'BULLISH_WEAK' : 'BEARISH_WEAK'
}

function candleFollowThroughBias(ct: string, dir: string): number {
  const b: any = {
    BULLISH_MARUBOZU: { LONG: 0.72, SHORT: 0.28 }, BEARISH_MARUBOZU: { LONG: 0.30, SHORT: 0.70 },
    BULLISH: { LONG: 0.62, SHORT: 0.38 }, BEARISH: { LONG: 0.38, SHORT: 0.62 },
    BULLISH_WEAK: { LONG: 0.55, SHORT: 0.45 }, BEARISH_WEAK: { LONG: 0.45, SHORT: 0.55 },
    DOJI: { LONG: 0.50, SHORT: 0.50 }, HAMMER: { LONG: 0.65, SHORT: 0.35 },
    SHOOTING_STAR: { LONG: 0.35, SHORT: 0.65 }, SPINNING_TOP: { LONG: 0.50, SHORT: 0.50 },
  }
  return (b[ct] || b.DOJI)[dir] || 0.5
}

// ═══════════════════════════════════════════════════════════
// SECTION 3: INDICATORS
// ═══════════════════════════════════════════════════════════

function prevWeekRange(wc: WCandle[]) {
  if (wc.length < 2) return null
  const pw = wc[wc.length - 2]
  return {
    pwHigh: r2(pw.high), pwLow: r2(pw.low), pwRange: r2(pw.range),
    pwMid: r2((pw.high + pw.low) / 2), pwClose: r2(pw.close), pwOpen: r2(pw.open),
    pwRangePct: pw.rangePct, pwClosePos: pw.closePos, pwBullish: pw.isBullish,
    pwCandleType: pw.candleType, closedNearHigh: pw.closePos > 0.80,
    closedNearLow: pw.closePos < 0.20, closedMidRange: pw.closePos >= 0.35 && pw.closePos <= 0.65,
    pwVolume: pw.volume, pwTradingDays: pw.tradingDays, isShortWeek: pw.isShortWeek,
  }
}

function detectBase(wc: WCandle[]) {
  if (wc.length < 6) return null
  const recent = wc.slice(-13)
  if (recent.length < 4) return null
  const last = recent[recent.length - 1]
  let bH = last.high, bL = last.low, bW = 1
  const bVols: number[] = [last.volume]
  for (let i = recent.length - 2; i >= 0; i--) {
    const w = recent[i], cH = Math.max(bH, w.high), cL = Math.min(bL, w.low)
    if (((cH - cL) / cL) * 100 < 8) { bH = cH; bL = cL; bW++; bVols.push(w.volume) } else break
  }
  let volDecl = false
  if (bVols.length >= 3) {
    const h1 = bVols.slice(0, Math.floor(bVols.length / 2)), h2 = bVols.slice(Math.floor(bVols.length / 2))
    volDecl = mean(h2) < mean(h1) * 0.85
  }
  const ranges = recent.slice(-8).map(w => w.range), cr = last.range
  const isNR4 = ranges.length >= 4 && cr <= Math.min(...ranges.slice(-4))
  const isNR7 = ranges.length >= 7 && cr <= Math.min(...ranges.slice(-7))
  const prev = recent[recent.length - 2]
  const isInside = last.high < prev.high && last.low > prev.low
  const brp = ((bH - bL) / bL) * 100
  const valid = bW >= 3, strong = bW >= 4 && brp < 6
  const coiled = strong && (volDecl || isNR4), perfect = coiled && isInside
  let sc = 0
  if (bW >= 6) sc += 25; else if (bW >= 4) sc += 20; else if (bW >= 3) sc += 12; else sc += 5
  if (brp < 4) sc += 20; else if (brp < 6) sc += 14; else if (brp < 8) sc += 8
  if (volDecl) sc += 20; if (isNR7) sc += 15; else if (isNR4) sc += 10
  if (isInside) sc += 12
  return {
    exists: valid, baseWeeks: bW, baseHighest: r2(bH), baseLowest: r2(bL),
    baseRangePct: r2(brp), volumeDeclining: volDecl, isNR4, isNR7, isInsideWeek: isInside,
    isStrongBase: strong, isCoiledSpring: coiled, isPerfectSetup: perfect,
    baseScore: r2(clamp(sc)),
    classification: perfect ? 'PERFECT_COIL' : coiled ? 'COILED_SPRING' : strong ? 'STRONG_BASE' : valid ? 'VALID_BASE' : 'NO_BASE',
  }
}

function relativeStrength(stockW: WCandle[], niftyW: WCandle[], period = 12) {
  const len = Math.min(stockW.length, niftyW.length)
  if (len < period + 1) return null
  const sc = stockW.slice(-len).map(w => w.close), nc = niftyW.slice(-len).map(w => w.close)
  const rsLine = sc.map((s, i) => nc[i] > 0 ? s / nc[i] : 0)
  const curRS = rsLine[rsLine.length - 1], pastRS = rsLine[rsLine.length - 1 - period]
  const rsChange = pastRS > 0 ? ((curRS - pastRS) / pastRS) * 100 : 0
  const r4w = rsLine.slice(-4); let rising = 0
  for (let i = 1; i < r4w.length; i++) if (r4w[i] > r4w[i - 1]) rising++
  const rsRising = rising >= 2
  const sRet = ((sc[sc.length - 1] - sc[sc.length - 1 - period]) / sc[sc.length - 1 - period]) * 100
  const nRet = ((nc[nc.length - 1] - nc[nc.length - 1 - period]) / nc[nc.length - 1 - period]) * 100
  const excess = sRet - nRet
  let rank = 'NEUTRAL'
  if (rsChange > 10 && rsRising) rank = 'VERY_STRONG'
  else if (rsChange > 5 || (rsChange > 0 && rsRising)) rank = 'STRONG'
  else if (rsChange < -10) rank = 'VERY_WEAK'
  else if (rsChange < -5) rank = 'WEAK'
  return { rsChange: r2(rsChange), rsRising, excessReturn: r2(excess), rsRank: rank, outperforming: excess > 0, rsScore: r2(clamp(mapRange(rsChange, -15, 20, 10, 100))) }
}

function preBreakoutVolPattern(wc: WCandle[], basePeriod = 6) {
  if (wc.length < basePeriod + 2) return null
  const recent = wc.slice(-(basePeriod + 1)), consol = recent.slice(0, -1), cur = recent[recent.length - 1]
  const vols = consol.map(w => w.volume), slope = linSlope(vols)
  const avgV = mean(vols), isDec = slope < 0, boRatio = avgV > 0 ? cur.volume / avgV : 1
  let upV = 0, downV = 0
  for (const w of consol) { if (w.isBullish) upV += w.volume; else downV += w.volume }
  const udRatio = downV > 0 ? upV / downV : 999
  let sc = 0; if (isDec) sc += 30
  if (boRatio > 2) sc += 25; else if (boRatio > 1.5) sc += 18; else if (boRatio > 1.2) sc += 10
  if (udRatio > 1.3) sc += 20; else if (udRatio > 1) sc += 10
  if (isDec && boRatio > 1.5) sc += 15
  const ideal = isDec && boRatio > 1.5
  return {
    isDeclining: isDec, breakoutVolRatio: r2(boRatio), upDownRatio: r2(udRatio),
    idealPattern: ideal, accumScore: r2(clamp(sc)),
    pattern: ideal ? 'IDEAL_ACCUMULATION' : isDec && boRatio > 1.2 ? 'GOOD_ACCUMULATION' : isDec ? 'DECLINING_NO_SPIKE' : 'WEAK',
  }
}

function fiftyTwoWeekContext(wc: WCandle[]) {
  if (wc.length < 40) return null
  const l52 = wc.slice(-52)
  const h52 = Math.max(...l52.map(w => w.high)), lo52 = Math.min(...l52.map(w => w.low))
  const cc = l52[l52.length - 1].close, rng = h52 - lo52
  const pos = rng > 0 ? (cc - lo52) / rng : 0.5
  const dfh = ((h52 - cc) / h52) * 100
  return {
    high52: r2(h52), low52: r2(lo52), position: r2(pos),
    distFromHigh: r2(dfh), nearHighZone: dfh < 5,
    contextScore: r2(clamp(dfh < 5 ? 85 : pos > 0.7 ? 70 : pos > 0.5 ? 55 : pos > 0.3 ? 40 : 25)),
  }
}

function falseBreakoutHistory(wc: WCandle[], lookback = 20) {
  if (wc.length < lookback + 2) return null
  const start = Math.max(1, wc.length - lookback)
  let fb = 0, tb = 0, consF = 0, maxF = 0
  for (let i = start; i < wc.length - 1; i++) {
    const prev = wc[i - 1], cur = wc[i], next = wc[i + 1]
    if (cur.high > prev.high && cur.close > prev.high) {
      if (next.close > prev.high) { tb++; consF = 0 }
      else { fb++; consF++; maxF = Math.max(maxF, consF) }
    }
  }
  const total = fb + tb, rate = total > 0 ? (fb / total) * 100 : 0
  let pen = 0; if (rate > 60) pen = 40; else if (rate > 40) pen = 25; else if (rate > 20) pen = 10
  if (maxF >= 3) pen += 20; else if (maxF >= 2) pen += 10
  return { falseRate: r2(rate), maxConsecFalse: maxF, reliabilityScore: r2(clamp(100 - pen)), isSerialFalseBreaker: rate > 50 && total >= 3 }
}

export function marketRegime(niftyW: WCandle[], lookback = 12) {
  if (niftyW.length < lookback + 4) return null
  const recent = niftyW.slice(-lookback), closes = recent.map(w => w.close)
  const totalMove = Math.abs(closes[closes.length - 1] - closes[0])
  const totalPath = recent.reduce((s, w) => s + w.range, 0)
  const eff = totalPath > 0 ? totalMove / totalPath : 0
  const rets: number[] = []; for (let i = 1; i < closes.length; i++) rets.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100)
  let maxTr = 0, ct = 0
  for (let i = 1; i < rets.length; i++) { if ((rets[i] > 0) === (rets[i - 1] > 0)) { ct++; maxTr = Math.max(maxTr, ct) } else ct = 0 }
  const regime = eff > 0.6 && maxTr >= 4 ? 'STRONG_TREND' : eff > 0.4 || maxTr >= 3 ? 'TRENDING' : eff < 0.2 && maxTr <= 1 ? 'CHOPPY' : 'MIXED'
  const edge: any = { STRONG_TREND: 0.65, TRENDING: 0.58, MIXED: 0.50, CHOPPY: 0.38 }
  return { regime, efficiency: r2(eff), maxTrendWeeks: maxTr, estimatedSuccessRate: edge[regime], regimeScore: r2(clamp(mapRange(eff, 0.15, 0.65, 20, 100))) }
}

function weeklyTrend(wc: WCandle[], period = 20) {
  if (wc.length < period + 4) return null
  const sma = mean(wc.slice(-period).map(w => w.close))
  const sma4 = mean(wc.slice(-period - 4, -4).map(w => w.close))
  const c = wc[wc.length - 1].close, above = c > sma
  const slope = sma4 > 0 ? ((sma - sma4) / sma4) * 100 : 0
  const trend = above && slope > 0.5 ? 'STRONG_UPTREND' : above ? 'UPTREND' : !above && slope < -0.5 ? 'STRONG_DOWNTREND' : 'DOWNTREND'
  return { trend, sma20: r2(sma), aboveSMA: above, smaSlope: r2(slope) }
}

function dailyRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let ag = 0, al = 0
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) ag += d; else al -= d }
  ag /= period; al /= period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]; ag = (ag * (period - 1) + Math.max(d, 0)) / period; al = (al * (period - 1) + Math.max(-d, 0)) / period
  }
  return al === 0 ? 100 : r2(100 - 100 / (1 + ag / al))
}

function dailyATR(candles: DCandle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)))
  let v = mean(trs.slice(0, period))
  for (let i = period; i < trs.length; i++) v = (v * (period - 1) + trs[i]) / period
  return r2(v)
}

function avgDailyRange(dc: DCandle[], period = 20) {
  if (dc.length < period) return null
  const adr = mean(dc.slice(-period).map(c => c.high - c.low))
  return { adr: r2(adr), adrPct: r2((adr / dc[dc.length - 1].close) * 100) }
}

function avgDailyVol(dc: DCandle[], period = 50) {
  if (dc.length < period) return null
  return Math.round(mean(dc.slice(-period).map(c => c.volume)))
}

function avgWeeklyVol(wc: WCandle[], period = 10) {
  if (wc.length < period) return null
  return Math.round(mean(wc.slice(-period).map(w => w.volume)))
}

// ═══════════════════════════════════════════════════════════
// SECTION 4: BREAKOUT / BREAKDOWN DETECTION
// ═══════════════════════════════════════════════════════════

function detectBreakout(today: DCandle, pw: any, avgVol: number | null) {
  if (!today || !pw) return null
  const vr = avgVol && avgVol > 0 ? today.volume / avgVol : 0
  const rng = today.high - today.low
  const cs = rng > 0 ? (today.close - today.low) / rng : 0
  const cnl = rng > 0 ? (today.high - today.close) / rng : 0
  return {
    breakout: {
      occurred: today.close > pw.pwHigh, intradayTouch: today.high > pw.pwHigh && today.close <= pw.pwHigh,
      margin: r2(((today.close - pw.pwHigh) / pw.pwHigh) * 100), volumeRatio: r2(vr),
      volumeConfirm: vr >= WB_CONFIG.MIN_DAILY_VOL_MULTI, closeNearHigh: r2(cs),
      isBullishCandle: today.close > today.open,
      isCleanBreakout: today.close > pw.pwHigh && today.close > today.open && cs > 0.70 && vr >= 1.3,
    },
    breakdown: {
      occurred: today.close < pw.pwLow, intradayTouch: today.low < pw.pwLow && today.close >= pw.pwLow,
      margin: r2(((pw.pwLow - today.close) / pw.pwLow) * 100), volumeRatio: r2(vr),
      volumeConfirm: vr >= WB_CONFIG.MIN_DAILY_VOL_MULTI, closeNearLow: r2(cnl),
      isBearishCandle: today.close < today.open,
      isCleanBreakdown: today.close < pw.pwLow && today.close < today.open && cnl > 0.70 && vr >= 1.3,
    },
  }
}

function detectMondayGap(mon: DCandle, pw: any, friClose: number) {
  if (!mon || !pw) return null
  if (new Date(mon.date).getDay() !== 1) return { isMonday: false }
  const gap = ((mon.open - friClose) / friClose) * 100
  const gapAbovePWH = mon.open > pw.pwHigh, gapBelowPWL = mon.open < pw.pwLow
  const ghU = gapAbovePWH && mon.low >= pw.pwHigh, ghD = gapBelowPWL && mon.high <= pw.pwLow
  return {
    isMonday: true, gapPct: r2(gap), gapUpBO: gapAbovePWH && gap > 0.3, gapDownBD: gapBelowPWL && gap < -0.3,
    gapHeld: ghU || ghD, isPowerBreakout: gapAbovePWH && ghU && mon.close > mon.open,
    isPowerBreakdown: gapBelowPWL && ghD && mon.close < mon.open,
  }
}

function detectRetest(bDay: DCandle, rDay: DCandle, level: number, dir: string) {
  if (!bDay || !rDay) return null
  const isLong = dir === 'LONG'
  const touched = isLong ? rDay.low <= level * 1.005 : rDay.high >= level * 0.995
  const stayed = isLong ? rDay.low >= level * 0.99 : rDay.high <= level * 1.01
  const closedAbove = isLong ? rDay.close > level : rDay.close < level
  const isBullish = isLong ? touched && stayed && closedAbove && rDay.close > rDay.open : touched && stayed && closedAbove && rDay.close < rDay.open
  return { isValidRetest: touched && stayed && closedAbove, isPerfectRetest: isBullish, retestEntry: isLong ? r2(level * 1.002) : r2(level * 0.998), retestStop: isLong ? r2(level * 0.985) : r2(level * 1.015) }
}

// ═══════════════════════════════════════════════════════════
// SECTION 5: WEEKEND SCANNER
// ═══════════════════════════════════════════════════════════

export function weekendScan(
  stocks: { symbol: string; dailyCandles: DCandle[]; sector?: string }[],
  niftyDaily: DCandle[]
): { breakoutWatch: any[]; breakdownWatch: any[]; regime: any; niftyTrend: any; meta: any } {
  const niftyW = buildWeeklyCandles(niftyDaily)
  const regime = marketRegime(niftyW, 12)
  const nTrend = weeklyTrend(niftyW, WB_CONFIG.SMA_PERIOD)
  const nSMA50 = niftyDaily.length >= 50 ? mean(niftyDaily.slice(-50).map(c => c.close)) : null
  const nLast = niftyDaily.length > 0 ? niftyDaily[niftyDaily.length - 1].close : null
  const nAbove50 = nSMA50 && nLast ? nLast > nSMA50 : true

  const boWatch: any[] = [], bdWatch: any[] = []

  for (const stock of stocks) {
    const dc = stock.dailyCandles
    if (dc.length < 120) continue
    const wc = buildWeeklyCandles(dc)
    if (wc.length < 24) continue
    const isFnO = FNO_SET.has(stock.symbol)
    const pw = prevWeekRange(wc)
    if (!pw) continue

    const trend = weeklyTrend(wc, WB_CONFIG.SMA_PERIOD)
    const base = detectBase(wc)
    const rs = relativeStrength(wc, niftyW, 12)
    const volP = preBreakoutVolPattern(wc, Math.min(base?.baseWeeks || 6, 8))
    const falseBo = falseBreakoutHistory(wc, 20)
    const w52 = fiftyTwoWeekContext(wc)
    const closes = dc.map(c => c.close)
    const rsi14 = dailyRSI(closes, 14), atr14 = dailyATR(dc, 14)
    const adr = avgDailyRange(dc, 20), adv = avgDailyVol(dc, 50), awv = avgWeeklyVol(wc, 10)
    const wvr = awv && awv > 0 ? pw.pwVolume / awv : 0
    const candleBias = candleFollowThroughBias(pw.pwCandleType, 'LONG')
    const lastClose = dc[dc.length - 1].close
    const sector = stock.sector || 'UNKNOWN'

    // Filters (P0: isFnO removed for LONG; P1: !nAbove50 removed for BD; P1: tightened PW close)
    const tight = pw.pwRangePct < WB_CONFIG.MAX_PW_RANGE_PCT
    const notShort = !pw.isShortWeek
    const vol = wvr >= WB_CONFIG.MIN_WEEKLY_VOL_MULTI
    const rsiLong = rsi14 != null && rsi14 > WB_CONFIG.RSI_LONG_MIN && rsi14 < WB_CONFIG.RSI_LONG_MAX
    const rsiShort = rsi14 != null && rsi14 > WB_CONFIG.RSI_SHORT_MIN && rsi14 < WB_CONFIG.RSI_SHORT_MAX
    const reliab = !falseBo || falseBo.falseRate <= WB_CONFIG.MAX_FALSE_BO_RATE
    const rsOk = !rs || rs.rsScore >= WB_CONFIG.MIN_RS_SCORE
    const closedUpper = pw.pwClosePos > 0.50

    // P0: Any stock can break out (isFnO is bonus, not gate). Shorts still require isFnO (can't short non-F&O)
    // P1: Breakdowns allowed even in bull Nifty (penalty in score instead)
    // P1: PW close tightened from closedMidRange (>0.35) to closedUpper (>0.50)
    const isBO = tight && notShort && vol && trend?.aboveSMA && rsiLong && reliab && rsOk && (pw.closedNearHigh || closedUpper)
    const isBD = tight && notShort && isFnO && vol && trend && !trend.aboveSMA && rsiShort && reliab && pw.closedNearLow

    if (!isBO && !isBD) continue

    const dir = isBO ? 'LONG' : 'SHORT'
    let sc = 0
    if (base) sc += (safeNum(base.baseScore) / 100) * 25
    if (trend) { sc += (dir === 'LONG' && trend.trend === 'STRONG_UPTREND' ? 15 : dir === 'LONG' && trend.trend === 'UPTREND' ? 10 : 3) }
    if (rs) sc += ((dir === 'LONG' ? safeNum(rs.rsScore) : 100 - safeNum(rs.rsScore)) / 100) * 12
    if (volP) sc += (safeNum(volP.accumScore) / 100) * 12
    sc += (dir === 'LONG' ? pw.pwClosePos : 1 - pw.pwClosePos) * 8
    if (falseBo) sc += (safeNum(falseBo.reliabilityScore) / 100) * 8
    if (w52) sc += (safeNum(w52.contextScore) / 100) * 7
    if (regime) sc += (safeNum(regime.regimeScore) / 100) * 5
    sc += candleBias * 4
    if (rsi14 != null) { if (dir === 'LONG' && rsi14 >= 55 && rsi14 <= 68) sc += 4; else if (dir === 'LONG' && rsi14 >= 48) sc += 2 }
    // P0: F&O bonus for longs (more liquid, tradeable via futures)
    if (isFnO && dir === 'LONG') sc += 4
    // P1: Penalty for shorting when Nifty is in uptrend (instead of hard block)
    if (dir === 'SHORT' && nAbove50) sc -= 6

    // P3: Shorts use 2× ADR target (downside moves are faster in Indian markets)
    const tgtLong = adr ? r2(pw.pwHigh + adr.adr * 3) : r2(pw.pwHigh + pw.pwRange)
    const tgtShort = adr ? r2(pw.pwLow - adr.adr * 2) : r2(pw.pwLow - pw.pwRange * 0.8)

    // P1: Enforce MAX_SL_PCT cap in live signals (was only in backtest before)
    let slLong = base?.exists ? base.baseLowest : pw.pwLow
    let slShort = base?.exists ? base.baseHighest : pw.pwHigh
    const maxSlLong = pw.pwHigh * (1 - WB_CONFIG.MAX_SL_PCT / 100)
    const maxSlShort = pw.pwLow * (1 + WB_CONFIG.MAX_SL_PCT / 100)
    if (slLong < maxSlLong) slLong = maxSlLong
    if (slShort > maxSlShort) slShort = maxSlShort

    const entry = {
      symbol: stock.symbol, direction: dir, weekendScore: r2(clamp(sc)), isFnO, sector, pw,
      base, trend, relativeStrength: rs, volumePattern: volP, falseBreakoutHistory: falseBo,
      fiftyTwoWeek: w52, regime, pwCandleBias: candleBias,
      levels: {
        breakoutTrigger: pw.pwHigh, breakdownTrigger: pw.pwLow,
        stopLossLong: r2(slLong), stopLossShort: r2(slShort),
        targetLong: tgtLong, targetShort: tgtShort,
      },
      indicators: { rsi14, atr14, adr, avgDailyVolume: adv, avgWeeklyVolume: awv, lastClose },
      exitRules: {
        fridayExit: true,
        trailingStop: `+${WB_CONFIG.TRAIL_ACTIVATION}% activates, locks ${WB_CONFIG.TRAIL_PROTECTION * 100}% of peak`,
        failedBO: `Exit if inside PW range for ${WB_CONFIG.FAILED_BO_DAYS} consecutive days`,
        maxSL: `${WB_CONFIG.MAX_SL_PCT}% max risk`,
      },
    }

    if (isBO) boWatch.push(entry); else bdWatch.push(entry)
  }

  boWatch.sort((a, b) => b.weekendScore - a.weekendScore)
  bdWatch.sort((a, b) => b.weekendScore - a.weekendScore)

  return {
    breakoutWatch: boWatch, breakdownWatch: bdWatch, regime, niftyTrend: nTrend,
    meta: { scanned: stocks.length, breakoutCandidates: boWatch.length, breakdownCandidates: bdWatch.length, marketRegime: regime?.regime, successEstimate: regime?.estimatedSuccessRate },
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 6: BACKTESTER
// ═══════════════════════════════════════════════════════════

export function runWeeklyBacktest(
  stockCandles: Record<string, DCandle[]>, niftyDaily: DCandle[],
  opts: { maxPositions?: number } = {}
): { trades: any[]; summary: any; analysis: any } {
  const maxPos = opts.maxPositions || WB_CONFIG.MAX_POSITIONS
  const niftyW = buildWeeklyCandles(niftyDaily)
  const allWeekStarts = niftyW.map(w => w.weekStart)
  const startIdx = 26, endIdx = allWeekStarts.length
  const trades: any[] = []

  for (let wi = startIdx; wi < endIdx; wi++) {
    const weekStart = allWeekStarts[wi]
    const niftyToHere = niftyDaily.filter(c => c.date < weekStart)
    const stocks: { symbol: string; dailyCandles: DCandle[] }[] = []
    for (const [sym, candles] of Object.entries(stockCandles)) {
      const prior = candles.filter(c => c.date < weekStart)
      if (prior.length < 130) continue
      stocks.push({ symbol: sym, dailyCandles: prior.slice(-160) })
    }

    const { breakoutWatch, breakdownWatch } = weekendScan(stocks, niftyToHere)
    const watchlist = [...breakoutWatch.slice(0, 6), ...breakdownWatch.slice(0, 3)]

    const nextWS = wi + 1 < allWeekStarts.length ? allWeekStarts[wi + 1] : '9999-12-31'
    const weekDays: Record<string, DCandle[]> = {}
    for (const [sym, candles] of Object.entries(stockCandles)) {
      const wd = candles.filter(c => c.date >= weekStart && c.date < nextWS)
      if (wd.length > 0) weekDays[sym] = wd
    }

    let taken = 0
    for (const cand of watchlist) {
      if (taken >= maxPos) break
      const wd = weekDays[cand.symbol]
      if (!wd || wd.length < 2) continue
      const isLong = cand.direction === 'LONG', pw = cand.pw, adv = cand.indicators.avgDailyVolume

      let entryDay: DCandle | null = null, entryIdx = -1, entryType = 'BREAKOUT'
      for (let d = 0; d < Math.min(3, wd.length); d++) {
        const det = detectBreakout(wd[d], pw, adv)
        if (!det) continue
        if (isLong && det.breakout.occurred) { entryDay = wd[d]; entryIdx = d; break }
        if (!isLong && det.breakdown.occurred) { entryDay = wd[d]; entryIdx = d; break }
        if (d > 0) {
          const prevDet = detectBreakout(wd[d - 1], pw, adv)
          if (prevDet) {
            const prevBroke = isLong ? prevDet.breakout.occurred : prevDet.breakdown.occurred
            if (prevBroke) {
              const rt = detectRetest(wd[d - 1], wd[d], isLong ? pw.pwHigh : pw.pwLow, cand.direction)
              if (rt?.isValidRetest) { entryDay = wd[d]; entryIdx = d; entryType = 'RETEST'; break }
            }
          }
        }
      }
      if (!entryDay) continue

      // P2: Use breakout level + slippage instead of close for more realistic backtest
      const boLevel = isLong ? pw.pwHigh * 1.002 : pw.pwLow * 0.998
      const ePrice = entryType === 'RETEST' ? (detectRetest(wd[entryIdx - 1], entryDay, isLong ? pw.pwHigh : pw.pwLow, cand.direction)?.retestEntry || entryDay.close) : r2(boLevel)
      let sl = cand.base?.exists ? (isLong ? cand.base.baseLowest : cand.base.baseHighest) : (isLong ? pw.pwLow : pw.pwHigh)
      if (Math.abs((ePrice - sl) / ePrice) > 0.07) sl = isLong ? ePrice * 0.93 : ePrice * 1.07

      const remaining = wd.slice(entryIdx + 1)
      const exit = simulateHold(ePrice, sl, remaining, isLong, pw)
      const pnl = isLong ? ((exit.exitPrice - ePrice) / ePrice) * 100 : ((ePrice - exit.exitPrice) / ePrice) * 100

      trades.push({
        weekStart, entryDate: entryDay.date, exitDate: exit.exitDate, symbol: cand.symbol,
        direction: cand.direction, entryType, entryPrice: r2(ePrice), stopLoss: r2(sl),
        exitPrice: r2(exit.exitPrice), exitReason: exit.reason, pnlPct: r2(pnl),
        result: pnl > 0.1 ? 'WIN' : pnl < -0.1 ? 'LOSS' : 'FLAT',
        holdDays: exit.holdDays, peakProfit: r2(exit.peakProfit),
        isMondayEntry: new Date(entryDay.date).getDay() === 1,
        weekendScore: cand.weekendScore,
        baseClass: cand.base?.classification || 'NONE',
        rsRank: cand.relativeStrength?.rsRank || 'UNKNOWN',
      })
      taken++
    }
  }

  return { trades, summary: buildSummary(trades), analysis: buildAnalysis(trades) }
}

function simulateHold(entry: number, sl: number, days: DCandle[], isLong: boolean, pw: any) {
  let hS = entry, lS = entry, daysIn = 0
  for (let i = 0; i < days.length; i++) {
    const d = days[i]; hS = Math.max(hS, d.high); lS = Math.min(lS, d.low)
    const profit = isLong ? ((d.close - entry) / entry) * 100 : ((entry - d.close) / entry) * 100
    const peak = isLong ? ((hS - entry) / entry) * 100 : ((entry - lS) / entry) * 100
    if (isLong ? d.low <= sl : d.high >= sl) return { exitPrice: sl, exitDate: d.date, reason: 'STOP_LOSS', holdDays: i + 1, peakProfit: peak }
    const inside = isLong ? d.close < pw.pwHigh && d.close > pw.pwLow : d.close > pw.pwLow && d.close < pw.pwHigh
    if (inside) daysIn++; else daysIn = 0
    if (daysIn >= 2) return { exitPrice: d.close, exitDate: d.date, reason: 'FAILED_BREAKOUT', holdDays: i + 1, peakProfit: peak }
    if (profit >= 3) {
      const trail = isLong ? entry + (hS - entry) * 0.6 : entry - (entry - lS) * 0.6
      if (isLong ? d.close <= trail : d.close >= trail) return { exitPrice: trail, exitDate: d.date, reason: 'TRAILING_STOP', holdDays: i + 1, peakProfit: peak }
    }
    if (i === days.length - 1) return { exitPrice: d.close, exitDate: d.date, reason: 'FRIDAY_EXIT', holdDays: i + 1, peakProfit: peak }
  }
  return { exitPrice: entry, exitDate: null, reason: 'NO_DATA', holdDays: 0, peakProfit: 0 }
}

// ═══════════════════════════════════════════════════════════
// SECTION 7: ANALYZER
// ═══════════════════════════════════════════════════════════

function buildSummary(trades: any[]) {
  if (!trades.length) return { totalTrades: 0 }
  const w = trades.filter(t => t.result === 'WIN'), l = trades.filter(t => t.result === 'LOSS')
  const pnls = trades.map(t => t.pnlPct), total = pnls.reduce((s, p) => s + p, 0)
  const gp = w.reduce((s, t) => s + t.pnlPct, 0), gl = Math.abs(l.reduce((s, t) => s + t.pnlPct, 0))
  let maxS = 0, s = 0; for (const t of trades) { if (t.result === 'LOSS') { s++; maxS = Math.max(maxS, s) } else s = 0 }
  const sharpe = computeSharpe(pnls)
  return {
    totalTrades: trades.length, wins: w.length, losses: l.length,
    winRatePct: r2((w.length / trades.length) * 100), totalPnlPct: r2(total),
    avgPnlPct: r2(total / trades.length), avgWinPct: w.length ? r2(gp / w.length) : 0,
    avgLossPct: l.length ? r2(-gl / l.length) : 0, profitFactor: gl > 0 ? r2(gp / gl) : gp > 0 ? Infinity : 0,
    sharpeRatio: r2(sharpe), maxConsecLosses: maxS,
    avgHoldDays: r2(mean(trades.map(t => t.holdDays))),
    bestTrade: r2(Math.max(...pnls)), worstTrade: r2(Math.min(...pnls)),
  }
}

function buildAnalysis(trades: any[]) {
  if (trades.length < 5) return null
  const avg = (arr: any[]) => arr.length ? r2(mean(arr.map(t => t.pnlPct))) : 0
  const wr = (arr: any[]) => arr.length ? r2((arr.filter(t => t.result === 'WIN').length / arr.length) * 100) : 0
  const longs = trades.filter(t => t.direction === 'LONG'), shorts = trades.filter(t => t.direction === 'SHORT')
  const mondays = trades.filter(t => t.isMondayEntry), nonMon = trades.filter(t => !t.isMondayEntry)
  const bos = trades.filter(t => t.entryType === 'BREAKOUT'), rts = trades.filter(t => t.entryType === 'RETEST')
  const withBase = trades.filter(t => t.baseClass !== 'NONE' && t.baseClass !== 'NO_BASE'), noBase = trades.filter(t => t.baseClass === 'NONE' || t.baseClass === 'NO_BASE')
  const strongRS = trades.filter(t => t.rsRank === 'STRONG' || t.rsRank === 'VERY_STRONG')
  const byReason: Record<string, { count: number; pnl: number }> = {}
  for (const t of trades) { if (!byReason[t.exitReason]) byReason[t.exitReason] = { count: 0, pnl: 0 }; byReason[t.exitReason].count++; byReason[t.exitReason].pnl += t.pnlPct }
  let cum = 0, peak = 0, maxDD = 0; for (const t of trades) { cum += t.pnlPct; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum) }
  return {
    byDirection: { long: { count: longs.length, avgPnl: avg(longs), winRate: wr(longs) }, short: { count: shorts.length, avgPnl: avg(shorts), winRate: wr(shorts) } },
    mondayEffect: { monday: { count: mondays.length, avgPnl: avg(mondays), winRate: wr(mondays) }, nonMonday: { count: nonMon.length, avgPnl: avg(nonMon), winRate: wr(nonMon) }, edge: mondays.length >= 3 ? r2((avg(mondays) as number) - (avg(nonMon) as number)) : null },
    entryType: { breakout: { count: bos.length, avgPnl: avg(bos), winRate: wr(bos) }, retest: { count: rts.length, avgPnl: avg(rts), winRate: wr(rts) } },
    baseEffect: { withBase: { count: withBase.length, avgPnl: avg(withBase), winRate: wr(withBase) }, noBase: { count: noBase.length, avgPnl: avg(noBase), winRate: wr(noBase) } },
    rsEffect: { strong: { count: strongRS.length, avgPnl: avg(strongRS), winRate: wr(strongRS) } },
    byExitReason: Object.entries(byReason).map(([r, d]) => ({ reason: r, count: d.count, avgPnl: r2(d.pnl / d.count) })),
    maxDrawdownPct: r2(maxDD), finalCumPnlPct: r2(cum),
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 8: RISK GATE
// ═══════════════════════════════════════════════════════════

export function preWeekGate(market: { indiaVix: number | null; regime: any }): { allowed: boolean; blocks: any[]; warnings: any[]; sizeMultiplier: number } {
  const blocks: any[] = [], warnings: any[] = []; let sm = 1.0
  if (market.indiaVix !== null) {
    if (market.indiaVix > WB_CONFIG.VIX_BLOCK) blocks.push({ rule: 'VIX', msg: `VIX ${market.indiaVix} > ${WB_CONFIG.VIX_BLOCK}` })
    else if (market.indiaVix > WB_CONFIG.VIX_WARN) { warnings.push({ rule: 'VIX', msg: `VIX ${market.indiaVix} elevated` }); sm = 0.6 }
  }
  if (market.regime?.regime === 'CHOPPY') { warnings.push({ rule: 'CHOPPY', msg: 'Choppy regime — breakouts less reliable' }); sm = Math.min(sm, 0.5) }
  return { allowed: blocks.length === 0, blocks, warnings, sizeMultiplier: sm }
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function mean(arr: number[]) { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length }
function r2(n: number) { return Math.round(n * 100) / 100 }
function r4(n: number) { return Math.round(n * 10000) / 10000 }
function clamp(v: number, min = 0, max = 100) { return Math.min(max, Math.max(min, v)) }
function mapRange(v: number, i1: number, i2: number, o1: number, o2: number) { return ((v - i1) / (i2 - i1)) * (o2 - o1) + o1 }
function dayGap(d1: string, d2: string) { return Math.round(Math.abs(new Date(d2).getTime() - new Date(d1).getTime()) / 864e5) }
function safeNum(v: number | null | undefined, fallback = 0): number { if (v == null || isNaN(v) || !isFinite(v)) return fallback; return v }
function linSlope(vals: number[]) {
  const n = vals.length; if (n < 2) return 0
  let sx = 0, sy = 0, sxy = 0, sx2 = 0
  for (let i = 0; i < n; i++) { sx += i; sy += vals[i]; sxy += i * vals[i]; sx2 += i * i }
  const d = n * sx2 - sx * sx; return d !== 0 ? (n * sxy - sx * sy) / d : 0
}
function computeSharpe(pnls: number[]): number {
  if (pnls.length < 2) return 0
  const a = mean(pnls), s = Math.sqrt(pnls.reduce((v, p) => v + (p - a) ** 2, 0) / (pnls.length - 1))
  return s === 0 ? 0 : (a / s) * Math.sqrt(52)
}
