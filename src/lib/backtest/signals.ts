// src/lib/backtest/signals.ts
// Comprehensive market signal detection: Smart Money, Technical, Structure, Momentum
// 14+ signal types for ultimate-level analysis

import { BarData } from './types'

// ============================================================
// CORE TYPES
// ============================================================

export interface Signal {
    name: string
    category: 'smart-money' | 'candlestick' | 'technical' | 'momentum' | 'structure'
    direction: 'bullish' | 'bearish' | 'neutral'
    strength: 1 | 2 | 3 | 4 | 5
    description: string
    priceLevel?: number
}

export interface PriceLevel {
    price: number
    type: 'support' | 'resistance'
    strength: number
    source: string
}

export interface FVG {
    startIdx: number
    highPrice: number
    lowPrice: number
    midPrice: number
    type: 'bullish' | 'bearish'
    filled: boolean
    date: string
}

export interface OrderBlock {
    price: number
    type: 'bullish' | 'bearish'
    strength: number
    date: string
}

export interface FibLevel {
    level: string
    price: number
    type: 'support' | 'resistance'
}

export interface StockPriceTargets {
    currentPrice: number
    immediateSupport: number
    immediateResistance: number
    target1: number
    target2: number
    stopLoss: number
    riskRewardRatio: number
}

export interface SignalSummary {
    signals: Signal[]
    supportResistance: PriceLevel[]
    priceTargets: StockPriceTargets
    fvgs: FVG[]
    orderBlocks: OrderBlock[]
    fibLevels: FibLevel[]
    overallBias: 'bullish' | 'bearish' | 'neutral'
    overallScore: number // -100 to +100
    priceVsLevels: string
    // Legacy compat
    candlestickPatterns: Signal[]
    candlestickBias: 'bullish' | 'bearish' | 'neutral'
    candlestickScore: number
}

// ============================================================
// MASTER ANALYZER
// ============================================================

export function analyzeSignals(bars: BarData[]): SignalSummary {
    const signals: Signal[] = []

    // Gather all signals
    signals.push(...detectCandlestickPatterns(bars))
    signals.push(...detectFVGs(bars).signals)
    signals.push(...detectOrderBlocks(bars).signals)
    signals.push(...detectBOS(bars))
    signals.push(...detectDivergences(bars))
    signals.push(...detectMACrossovers(bars))
    signals.push(...detectBollingerSqueeze(bars))
    signals.push(...detectADXTrend(bars))
    signals.push(...detectIchimoku(bars))
    signals.push(...detectGaps(bars))
    signals.push(...detectVWAP(bars))

    const levels = findSupportResistance(bars)
    const fibs = calculateFibonacci(bars)
    const fvgs = detectFVGs(bars).fvgs
    const obs = detectOrderBlocks(bars).blocks
    const targets = calculatePriceTargets(bars, levels)

    // Compute overall bias
    const bullishScore = signals.filter(s => s.direction === 'bullish').reduce((acc, s) => acc + s.strength * 8, 0)
    const bearishScore = signals.filter(s => s.direction === 'bearish').reduce((acc, s) => acc + s.strength * 8, 0)
    const overallScore = Math.max(-100, Math.min(100, bullishScore - bearishScore))
    const overallBias: 'bullish' | 'bearish' | 'neutral' = overallScore > 15 ? 'bullish' : overallScore < -15 ? 'bearish' : 'neutral'

    // Candlestick subset for compat
    const candlestickPatterns = signals.filter(s => s.category === 'candlestick')
    const candleScore = candlestickPatterns.filter(s => s.direction === 'bullish').reduce((a, s) => a + s.strength * 15, 0) -
        candlestickPatterns.filter(s => s.direction === 'bearish').reduce((a, s) => a + s.strength * 15, 0)

    // Price context
    const currentPrice = bars[bars.length - 1].close
    const nearSupport = levels.find(l => l.type === 'support' && Math.abs(l.price - currentPrice) / currentPrice < 0.02)
    const nearResistance = levels.find(l => l.type === 'resistance' && Math.abs(l.price - currentPrice) / currentPrice < 0.02)
    let priceVsLevels = ''
    if (nearSupport) priceVsLevels = `Near support at ₹${nearSupport.price.toFixed(0)} (${nearSupport.source})`
    else if (nearResistance) priceVsLevels = `Near resistance at ₹${nearResistance.price.toFixed(0)} (${nearResistance.source})`
    else priceVsLevels = `Between S:₹${targets.immediateSupport.toFixed(0)} and R:₹${targets.immediateResistance.toFixed(0)}`

    return {
        signals,
        supportResistance: levels,
        priceTargets: targets,
        fvgs,
        orderBlocks: obs,
        fibLevels: fibs,
        overallBias,
        overallScore,
        priceVsLevels,
        candlestickPatterns,
        candlestickBias: candleScore > 10 ? 'bullish' : candleScore < -10 ? 'bearish' : 'neutral',
        candlestickScore: Math.max(-100, Math.min(100, candleScore)),
    }
}

// ============================================================
// 1. CANDLESTICK PATTERNS (16 patterns)
// ============================================================

function detectCandlestickPatterns(bars: BarData[]): Signal[] {
    if (bars.length < 5) return []
    const signals: Signal[] = []
    const c = bars[bars.length - 1], p = bars[bars.length - 2], pp = bars[bars.length - 3]
    const body = Math.abs(c.close - c.open), range = c.high - c.low
    const upperWick = c.high - Math.max(c.open, c.close)
    const lowerWick = Math.min(c.open, c.close) - c.low
    const isBullish = c.close > c.open, isBearish = c.close < c.open
    const pBody = Math.abs(p.close - p.open), pIsBullish = p.close > p.open, pIsBearish = p.close < p.open
    const ppBody = Math.abs(pp.close - pp.open), ppIsBullish = pp.close > pp.open, ppIsBearish = pp.close < pp.open
    const avgBody = bars.slice(-20).reduce((s, b) => s + Math.abs(b.close - b.open), 0) / 20
    const uptrend = isInUptrend(bars), downtrend = isInDowntrend(bars)

    if (body < range * 0.1 && range > 0)
        signals.push({ name: 'Doji', category: 'candlestick', direction: 'neutral', strength: 2, description: 'Indecision — body tiny relative to range' })
    if (lowerWick > body * 2 && upperWick < body * 0.5 && isBullish && downtrend)
        signals.push({ name: 'Hammer', category: 'candlestick', direction: 'bullish', strength: 3, description: 'Bullish reversal — long lower wick after downtrend' })
    if (upperWick > body * 2 && lowerWick < body * 0.5 && downtrend)
        signals.push({ name: 'Inverted Hammer', category: 'candlestick', direction: 'bullish', strength: 2, description: 'Potential reversal — buying pressure emerging' })
    if (upperWick > body * 2 && lowerWick < body * 0.5 && isBearish && uptrend)
        signals.push({ name: 'Shooting Star', category: 'candlestick', direction: 'bearish', strength: 3, description: 'Bearish reversal — rejection at highs' })
    if (lowerWick > body * 2 && upperWick < body * 0.5 && uptrend)
        signals.push({ name: 'Hanging Man', category: 'candlestick', direction: 'bearish', strength: 2, description: 'Warning — selling pressure at highs' })
    if (body > avgBody * 1.5 && upperWick < body * 0.1 && lowerWick < body * 0.1)
        signals.push({ name: isBullish ? 'Bullish Marubozu' : 'Bearish Marubozu', category: 'candlestick', direction: isBullish ? 'bullish' : 'bearish', strength: 4, description: `Strong ${isBullish ? 'buying' : 'selling'} conviction — full-body candle` })
    if (isBullish && pIsBearish && c.open <= p.close && c.close >= p.open && body > pBody)
        signals.push({ name: 'Bullish Engulfing', category: 'candlestick', direction: 'bullish', strength: 4, description: 'Strong reversal — completely engulfs prior bearish candle' })
    if (isBearish && pIsBullish && c.open >= p.close && c.close <= p.open && body > pBody)
        signals.push({ name: 'Bearish Engulfing', category: 'candlestick', direction: 'bearish', strength: 4, description: 'Strong reversal — completely engulfs prior bullish candle' })
    if (pIsBearish && isBullish && c.open < p.close && c.close > (p.open + p.close) / 2 && c.close < p.open)
        signals.push({ name: 'Piercing Line', category: 'candlestick', direction: 'bullish', strength: 3, description: 'Opens below prior close, closes above midpoint' })
    if (pIsBullish && isBearish && c.open > p.close && c.close < (p.open + p.close) / 2 && c.close > p.open)
        signals.push({ name: 'Dark Cloud Cover', category: 'candlestick', direction: 'bearish', strength: 3, description: 'Opens above prior close, closes below midpoint' })
    if (Math.abs(c.low - p.low) < range * 0.02 && pIsBearish && isBullish && downtrend)
        signals.push({ name: 'Tweezer Bottom', category: 'candlestick', direction: 'bullish', strength: 3, description: 'Identical lows showing strong support' })
    if (Math.abs(c.high - p.high) < range * 0.02 && pIsBullish && isBearish && uptrend)
        signals.push({ name: 'Tweezer Top', category: 'candlestick', direction: 'bearish', strength: 3, description: 'Identical highs showing strong resistance' })
    if (ppIsBearish && ppBody > avgBody && Math.abs(p.close - p.open) < avgBody * 0.3 && isBullish && c.close > (pp.open + pp.close) / 2)
        signals.push({ name: 'Morning Star', category: 'candlestick', direction: 'bullish', strength: 5, description: 'Strong reversal — bearish, indecision, then strong bullish' })
    if (ppIsBullish && ppBody > avgBody && Math.abs(p.close - p.open) < avgBody * 0.3 && isBearish && c.close < (pp.open + pp.close) / 2)
        signals.push({ name: 'Evening Star', category: 'candlestick', direction: 'bearish', strength: 5, description: 'Strong reversal — bullish, indecision, then strong bearish' })
    if (ppIsBullish && pIsBullish && isBullish && c.close > p.close && p.close > pp.close && body > avgBody * 0.5 && pBody > avgBody * 0.5)
        signals.push({ name: 'Three White Soldiers', category: 'candlestick', direction: 'bullish', strength: 5, description: 'Three consecutive rising bullish candles' })
    if (ppIsBearish && pIsBearish && isBearish && c.close < p.close && p.close < pp.close && body > avgBody * 0.5 && pBody > avgBody * 0.5)
        signals.push({ name: 'Three Black Crows', category: 'candlestick', direction: 'bearish', strength: 5, description: 'Three consecutive falling bearish candles' })

    return signals
}

// ============================================================
// 2. FAIR VALUE GAPS (FVG) — Smart Money Concept
// ============================================================

function detectFVGs(bars: BarData[]): { signals: Signal[]; fvgs: FVG[] } {
    const signals: Signal[] = []
    const fvgs: FVG[] = []
    if (bars.length < 20) return { signals, fvgs }

    const currentPrice = bars[bars.length - 1].close
    const recent = bars.slice(-30)

    for (let i = 1; i < recent.length - 1; i++) {
        const prev = recent[i - 1], cur = recent[i], next = recent[i + 1]

        // Bullish FVG: gap between prev.high and next.low
        if (next.low > prev.high) {
            const gapSize = ((next.low - prev.high) / cur.close) * 100
            if (gapSize > 0.3) { // Minimum 0.3% gap
                const filled = currentPrice <= next.low && currentPrice >= prev.high
                fvgs.push({ startIdx: i, highPrice: next.low, lowPrice: prev.high, midPrice: (next.low + prev.high) / 2, type: 'bullish', filled, date: cur.date })
            }
        }
        // Bearish FVG: gap between next.high and prev.low
        if (next.high < prev.low) {
            const gapSize = ((prev.low - next.high) / cur.close) * 100
            if (gapSize > 0.3) {
                const filled = currentPrice >= next.high && currentPrice <= prev.low
                fvgs.push({ startIdx: i, highPrice: prev.low, lowPrice: next.high, midPrice: (prev.low + next.high) / 2, type: 'bearish', filled, date: cur.date })
            }
        }
    }

    // Report recent unfilled FVGs near price
    const nearFVGs = fvgs.filter(f => !f.filled && Math.abs(f.midPrice - currentPrice) / currentPrice < 0.05)
    const bullFVGs = nearFVGs.filter(f => f.type === 'bullish' && f.midPrice < currentPrice)
    const bearFVGs = nearFVGs.filter(f => f.type === 'bearish' && f.midPrice > currentPrice)

    if (bullFVGs.length > 0)
        signals.push({ name: `Bullish FVG (${bullFVGs.length})`, category: 'smart-money', direction: 'bullish', strength: Math.min(4, bullFVGs.length + 1) as any, description: `${bullFVGs.length} unfilled bullish gap(s) below price — potential support zone at ₹${bullFVGs[0].midPrice.toFixed(0)}`, priceLevel: bullFVGs[0].midPrice })
    if (bearFVGs.length > 0)
        signals.push({ name: `Bearish FVG (${bearFVGs.length})`, category: 'smart-money', direction: 'bearish', strength: Math.min(4, bearFVGs.length + 1) as any, description: `${bearFVGs.length} unfilled bearish gap(s) above price — potential resistance at ₹${bearFVGs[0].midPrice.toFixed(0)}`, priceLevel: bearFVGs[0].midPrice })

    return { signals, fvgs }
}

// ============================================================
// 3. ORDER BLOCKS — institutional demand/supply zones
// ============================================================

function detectOrderBlocks(bars: BarData[]): { signals: Signal[]; blocks: OrderBlock[] } {
    const signals: Signal[] = []
    const blocks: OrderBlock[] = []
    if (bars.length < 20) return { signals, blocks }

    const currentPrice = bars[bars.length - 1].close
    const recent = bars.slice(-50)

    for (let i = 1; i < recent.length - 3; i++) {
        const candle = recent[i]
        const isBearish = candle.close < candle.open
        const isBullish = candle.close > candle.open

        // Check for strong impulsive move after this candle
        const move3 = (recent[i + 3].close - candle.close) / candle.close * 100

        // Bullish OB: last bearish candle before a strong bullish move (>2%)
        if (isBearish && move3 > 2) {
            const ob: OrderBlock = { price: candle.low, type: 'bullish', strength: Math.min(5, Math.round(move3)), date: candle.date }
            blocks.push(ob)
        }
        // Bearish OB: last bullish candle before a strong bearish move (<-2%)
        if (isBullish && move3 < -2) {
            const ob: OrderBlock = { price: candle.high, type: 'bearish', strength: Math.min(5, Math.round(Math.abs(move3))), date: candle.date }
            blocks.push(ob)
        }
    }

    // Report OBs near current price
    const nearOBs = blocks.filter(b => Math.abs(b.price - currentPrice) / currentPrice < 0.05)
    const bullOBs = nearOBs.filter(b => b.type === 'bullish' && b.price < currentPrice)
    const bearOBs = nearOBs.filter(b => b.type === 'bearish' && b.price > currentPrice)

    if (bullOBs.length > 0)
        signals.push({ name: `Bullish Order Block`, category: 'smart-money', direction: 'bullish', strength: Math.min(4, bullOBs[0].strength) as any, description: `Institutional demand zone at ₹${bullOBs[0].price.toFixed(0)} — expect buying interest`, priceLevel: bullOBs[0].price })
    if (bearOBs.length > 0)
        signals.push({ name: `Bearish Order Block`, category: 'smart-money', direction: 'bearish', strength: Math.min(4, bearOBs[0].strength) as any, description: `Institutional supply zone at ₹${bearOBs[0].price.toFixed(0)} — expect selling pressure`, priceLevel: bearOBs[0].price })

    return { signals, blocks }
}

// ============================================================
// 4. BREAK OF STRUCTURE (BOS) + CHANGE OF CHARACTER (CHoCH)
// ============================================================

function detectBOS(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 30) return signals

    const recent = bars.slice(-30)
    const swingHighs: { price: number; idx: number }[] = []
    const swingLows: { price: number; idx: number }[] = []

    // Find swing points
    for (let i = 2; i < recent.length - 2; i++) {
        if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high && recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high)
            swingHighs.push({ price: recent[i].high, idx: i })
        if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low && recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low)
            swingLows.push({ price: recent[i].low, idx: i })
    }

    const lastPrice = recent[recent.length - 1].close
    const prevPrice = recent[recent.length - 5]?.close || lastPrice

    // Check if last bar broke above most recent swing high (bullish BOS)
    if (swingHighs.length >= 2) {
        const lastSH = swingHighs[swingHighs.length - 1]
        const prevSH = swingHighs[swingHighs.length - 2]
        if (lastPrice > lastSH.price && prevPrice <= lastSH.price) {
            // Check if this is continuation or reversal
            if (prevSH.price < lastSH.price) {
                signals.push({ name: 'Bullish BOS', category: 'structure', direction: 'bullish', strength: 4, description: `Break of Structure above ₹${lastSH.price.toFixed(0)} — bullish trend continuation`, priceLevel: lastSH.price })
            } else {
                signals.push({ name: 'Bullish CHoCH', category: 'structure', direction: 'bullish', strength: 5, description: `Change of Character — first higher high above ₹${lastSH.price.toFixed(0)}, potential trend reversal to bullish`, priceLevel: lastSH.price })
            }
        }
    }

    // Check if last bar broke below most recent swing low (bearish BOS)
    if (swingLows.length >= 2) {
        const lastSL = swingLows[swingLows.length - 1]
        const prevSL = swingLows[swingLows.length - 2]
        if (lastPrice < lastSL.price && prevPrice >= lastSL.price) {
            if (prevSL.price > lastSL.price) {
                signals.push({ name: 'Bearish BOS', category: 'structure', direction: 'bearish', strength: 4, description: `Break of Structure below ₹${lastSL.price.toFixed(0)} — bearish trend continuation`, priceLevel: lastSL.price })
            } else {
                signals.push({ name: 'Bearish CHoCH', category: 'structure', direction: 'bearish', strength: 5, description: `Change of Character — first lower low below ₹${lastSL.price.toFixed(0)}, potential trend reversal to bearish`, priceLevel: lastSL.price })
            }
        }
    }

    return signals
}

// ============================================================
// 5. RSI + MACD DIVERGENCES
// ============================================================

function detectDivergences(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 30) return signals

    // Simple RSI calculation
    const closes = bars.slice(-30).map(b => b.close)
    const rsi = calculateRSI(closes, 14)
    if (rsi.length < 10) return signals

    // Find price swing points in last 20 bars
    const last20 = closes.slice(-20)
    const last20RSI = rsi.slice(-20)

    // Find local highs/lows in last 20 bars
    type SwingPoint = { idx: number; price: number; rsi: number }
    const highs: SwingPoint[] = []
    const lows: SwingPoint[] = []

    for (let i = 2; i < last20.length - 2; i++) {
        if (last20[i] > last20[i - 1] && last20[i] > last20[i - 2] && last20[i] > last20[i + 1] && last20[i] > last20[i + 2])
            highs.push({ idx: i, price: last20[i], rsi: last20RSI[i] })
        if (last20[i] < last20[i - 1] && last20[i] < last20[i - 2] && last20[i] < last20[i + 1] && last20[i] < last20[i + 2])
            lows.push({ idx: i, price: last20[i], rsi: last20RSI[i] })
    }

    // Bearish divergence: price higher high, RSI lower high
    if (highs.length >= 2) {
        const h1 = highs[highs.length - 2], h2 = highs[highs.length - 1]
        if (h2.price > h1.price && h2.rsi < h1.rsi)
            signals.push({ name: 'Bearish RSI Divergence', category: 'technical', direction: 'bearish', strength: 4, description: 'Price made a higher high but RSI made a lower high — momentum weakening' })
    }

    // Bullish divergence: price lower low, RSI higher low
    if (lows.length >= 2) {
        const l1 = lows[lows.length - 2], l2 = lows[lows.length - 1]
        if (l2.price < l1.price && l2.rsi > l1.rsi)
            signals.push({ name: 'Bullish RSI Divergence', category: 'technical', direction: 'bullish', strength: 4, description: 'Price made a lower low but RSI made a higher low — momentum building' })
    }

    // RSI overbought/oversold
    const currentRSI = rsi[rsi.length - 1]
    if (currentRSI > 70)
        signals.push({ name: 'RSI Overbought', category: 'technical', direction: 'bearish', strength: 2, description: `RSI at ${currentRSI.toFixed(0)} — overbought, potential pullback` })
    else if (currentRSI < 30)
        signals.push({ name: 'RSI Oversold', category: 'technical', direction: 'bullish', strength: 2, description: `RSI at ${currentRSI.toFixed(0)} — oversold, potential bounce` })

    // MACD crossover
    const macd = calculateMACD(closes)
    if (macd.length >= 2) {
        const curr = macd[macd.length - 1], prev = macd[macd.length - 2]
        if (curr.histogram > 0 && prev.histogram <= 0)
            signals.push({ name: 'MACD Bullish Cross', category: 'technical', direction: 'bullish', strength: 3, description: 'MACD line crossed above signal line — bullish momentum shift' })
        if (curr.histogram < 0 && prev.histogram >= 0)
            signals.push({ name: 'MACD Bearish Cross', category: 'technical', direction: 'bearish', strength: 3, description: 'MACD line crossed below signal line — bearish momentum shift' })
    }

    return signals
}

// ============================================================
// 6. GOLDEN/DEATH CROSS + MA Alignment
// ============================================================

function detectMACrossovers(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 210) return signals

    const closes = bars.map(b => b.close)
    const sma20 = calculateSMA(closes, 20)
    const sma50 = calculateSMA(closes, 50)
    const sma200 = calculateSMA(closes, 200)

    const curr20 = sma20[sma20.length - 1], prev20 = sma20[sma20.length - 2]
    const curr50 = sma50[sma50.length - 1], prev50 = sma50[sma50.length - 2]
    const curr200 = sma200[sma200.length - 1], prev200 = sma200[sma200.length - 2]

    // Golden Cross (50 crosses above 200)
    if (curr50 > curr200 && prev50 <= prev200)
        signals.push({ name: 'Golden Cross', category: 'momentum', direction: 'bullish', strength: 5, description: 'SMA 50 crossed above SMA 200 — major bullish signal' })
    // Death Cross (50 crosses below 200)
    if (curr50 < curr200 && prev50 >= prev200)
        signals.push({ name: 'Death Cross', category: 'momentum', direction: 'bearish', strength: 5, description: 'SMA 50 crossed below SMA 200 — major bearish signal' })

    // 20 crossing 50
    if (curr20 > curr50 && prev20 <= prev50)
        signals.push({ name: '20/50 Bullish Cross', category: 'momentum', direction: 'bullish', strength: 3, description: 'Short-term MA crossed above medium-term — momentum turning up' })
    if (curr20 < curr50 && prev20 >= prev50)
        signals.push({ name: '20/50 Bearish Cross', category: 'momentum', direction: 'bearish', strength: 3, description: 'Short-term MA crossed below medium-term — momentum turning down' })

    // Price vs MA alignment
    const lastClose = closes[closes.length - 1]
    if (lastClose > curr20 && curr20 > curr50 && curr50 > curr200)
        signals.push({ name: 'Full Bull Alignment', category: 'momentum', direction: 'bullish', strength: 4, description: 'Price > SMA20 > SMA50 > SMA200 — strong uptrend alignment' })
    if (lastClose < curr20 && curr20 < curr50 && curr50 < curr200)
        signals.push({ name: 'Full Bear Alignment', category: 'momentum', direction: 'bearish', strength: 4, description: 'Price < SMA20 < SMA50 < SMA200 — strong downtrend alignment' })

    return signals
}

// ============================================================
// 7. BOLLINGER BAND SQUEEZE
// ============================================================

function detectBollingerSqueeze(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 30) return signals

    const closes = bars.slice(-30).map(b => b.close)
    const sma = calculateSMA(closes, 20)
    const bandwidths: number[] = []

    for (let i = 19; i < closes.length; i++) {
        const slice = closes.slice(i - 19, i + 1)
        const mean = sma[i - 19 + sma.length - (closes.length - 19)]
        if (!mean) continue
        const stddev = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length)
        const bw = (stddev * 4 / mean) * 100
        bandwidths.push(bw)
    }

    if (bandwidths.length < 5) return signals
    const currentBW = bandwidths[bandwidths.length - 1]
    const avgBW = bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length
    const prevBW = bandwidths[bandwidths.length - 2]

    if (currentBW < avgBW * 0.6)
        signals.push({ name: 'Bollinger Squeeze', category: 'momentum', direction: 'neutral', strength: 3, description: 'Volatility compressed — breakout imminent. Direction TBD by first expansion candle' })
    if (currentBW > prevBW * 1.5 && prevBW < avgBW * 0.7) {
        const lastClose = closes[closes.length - 1]
        const lastSMA = sma[sma.length - 1]
        if (lastClose > lastSMA)
            signals.push({ name: 'Bollinger Expansion Up', category: 'momentum', direction: 'bullish', strength: 4, description: 'Squeeze released upward — bullish breakout confirmed' })
        else
            signals.push({ name: 'Bollinger Expansion Down', category: 'momentum', direction: 'bearish', strength: 4, description: 'Squeeze released downward — bearish breakout confirmed' })
    }

    return signals
}

// ============================================================
// 8. ADX TREND STRENGTH
// ============================================================

function detectADXTrend(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 30) return signals

    // Simplified ADX calculation
    const period = 14
    const recent = bars.slice(-period * 2)
    let sumTR = 0, sumPDM = 0, sumNDM = 0

    for (let i = 1; i < recent.length; i++) {
        const tr = Math.max(recent[i].high - recent[i].low, Math.abs(recent[i].high - recent[i - 1].close), Math.abs(recent[i].low - recent[i - 1].close))
        const pdm = Math.max(0, recent[i].high - recent[i - 1].high)
        const ndm = Math.max(0, recent[i - 1].low - recent[i].low)
        sumTR += tr; sumPDM += pdm; sumNDM += ndm
    }

    const pdi = (sumPDM / sumTR) * 100
    const ndi = (sumNDM / sumTR) * 100
    const dx = Math.abs(pdi - ndi) / (pdi + ndi) * 100
    const adx = dx // Simplified

    if (adx > 40)
        signals.push({ name: 'Strong Trend', category: 'momentum', direction: pdi > ndi ? 'bullish' : 'bearish', strength: 4, description: `ADX ${adx.toFixed(0)} — very strong ${pdi > ndi ? 'bullish' : 'bearish'} trend in place` })
    else if (adx > 25)
        signals.push({ name: 'Trending', category: 'momentum', direction: pdi > ndi ? 'bullish' : 'bearish', strength: 2, description: `ADX ${adx.toFixed(0)} — moderate ${pdi > ndi ? 'bullish' : 'bearish'} trend` })
    else if (adx < 20)
        signals.push({ name: 'No Trend', category: 'momentum', direction: 'neutral', strength: 1, description: `ADX ${adx.toFixed(0)} — ranging market, avoid trend strategies` })

    return signals
}

// ============================================================
// 9. ICHIMOKU CLOUD SIGNALS
// ============================================================

function detectIchimoku(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 52) return signals

    const closes = bars.map(b => b.close)
    const highs = bars.map(b => b.high)
    const lows = bars.map(b => b.low)
    const n = closes.length

    // Tenkan (9), Kijun (26)
    const tenkan = (Math.max(...highs.slice(-9)) + Math.min(...lows.slice(-9))) / 2
    const kijun = (Math.max(...highs.slice(-26)) + Math.min(...lows.slice(-26))) / 2

    // Senkou A & B (shifted 26 periods forward — use current for reference)
    const senkouA = (tenkan + kijun) / 2
    const senkouB = (Math.max(...highs.slice(-52)) + Math.min(...lows.slice(-52))) / 2

    const lastClose = closes[n - 1]
    const cloudTop = Math.max(senkouA, senkouB)
    const cloudBottom = Math.min(senkouA, senkouB)

    // Price vs Cloud
    if (lastClose > cloudTop)
        signals.push({ name: 'Above Ichimoku Cloud', category: 'technical', direction: 'bullish', strength: 3, description: `Price above cloud (₹${cloudTop.toFixed(0)}) — bullish territory` })
    else if (lastClose < cloudBottom)
        signals.push({ name: 'Below Ichimoku Cloud', category: 'technical', direction: 'bearish', strength: 3, description: `Price below cloud (₹${cloudBottom.toFixed(0)}) — bearish territory` })
    else
        signals.push({ name: 'Inside Ichimoku Cloud', category: 'technical', direction: 'neutral', strength: 2, description: 'Price inside cloud — indecision zone, avoid new entries' })

    // TK Cross
    const prevTenkan = (Math.max(...highs.slice(-10, -1)) + Math.min(...lows.slice(-10, -1))) / 2
    const prevKijun = (Math.max(...highs.slice(-27, -1)) + Math.min(...lows.slice(-27, -1))) / 2

    if (tenkan > kijun && prevTenkan <= prevKijun)
        signals.push({ name: 'TK Bullish Cross', category: 'technical', direction: 'bullish', strength: 3, description: 'Tenkan crossed above Kijun — bullish momentum signal' })
    if (tenkan < kijun && prevTenkan >= prevKijun)
        signals.push({ name: 'TK Bearish Cross', category: 'technical', direction: 'bearish', strength: 3, description: 'Tenkan crossed below Kijun — bearish momentum signal' })

    // Cloud color (future)
    if (senkouA > senkouB)
        signals.push({ name: 'Green Cloud', category: 'technical', direction: 'bullish', strength: 1, description: 'Kumo is bullish (green) — upward bias' })
    else
        signals.push({ name: 'Red Cloud', category: 'technical', direction: 'bearish', strength: 1, description: 'Kumo is bearish (red) — downward bias' })

    return signals
}

// ============================================================
// 10. GAP ANALYSIS
// ============================================================

function detectGaps(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 3) return signals

    const last = bars[bars.length - 1], prev = bars[bars.length - 2]
    const gapPct = ((last.open - prev.close) / prev.close) * 100

    if (gapPct > 1)
        signals.push({ name: `Gap Up (${gapPct.toFixed(1)}%)`, category: 'structure', direction: 'bullish', strength: Math.min(4, Math.ceil(gapPct)) as any, description: `Opened ${gapPct.toFixed(1)}% above previous close — strong buying interest pre-market` })
    if (gapPct < -1)
        signals.push({ name: `Gap Down (${Math.abs(gapPct).toFixed(1)}%)`, category: 'structure', direction: 'bearish', strength: Math.min(4, Math.ceil(Math.abs(gapPct))) as any, description: `Opened ${Math.abs(gapPct).toFixed(1)}% below previous close — strong selling pressure` })

    return signals
}

// ============================================================
// 11. VWAP ANALYSIS
// ============================================================

function detectVWAP(bars: BarData[]): Signal[] {
    const signals: Signal[] = []
    if (bars.length < 20) return signals

    // Calculate approximate VWAP over last 20 bars
    const recent = bars.slice(-20)
    let sumPV = 0, sumVol = 0
    for (const b of recent) {
        const typicalPrice = (b.high + b.low + b.close) / 3
        sumPV += typicalPrice * b.volume
        sumVol += b.volume
    }
    const vwap = sumVol > 0 ? sumPV / sumVol : 0
    const lastClose = bars[bars.length - 1].close
    const distPct = ((lastClose - vwap) / vwap) * 100

    if (distPct > 1)
        signals.push({ name: 'Above VWAP', category: 'structure', direction: 'bullish', strength: 2, description: `Trading ${distPct.toFixed(1)}% above VWAP (₹${vwap.toFixed(0)}) — institutional buyers in control`, priceLevel: vwap })
    else if (distPct < -1)
        signals.push({ name: 'Below VWAP', category: 'structure', direction: 'bearish', strength: 2, description: `Trading ${Math.abs(distPct).toFixed(1)}% below VWAP (₹${vwap.toFixed(0)}) — institutional sellers in control`, priceLevel: vwap })

    return signals
}

// ============================================================
// FIBONACCI RETRACEMENTS
// ============================================================

function calculateFibonacci(bars: BarData[]): FibLevel[] {
    if (bars.length < 50) return []

    const recent = bars.slice(-100)
    let swingHigh = -Infinity, swingLow = Infinity
    let shIdx = 0, slIdx = 0

    for (let i = 0; i < recent.length; i++) {
        if (recent[i].high > swingHigh) { swingHigh = recent[i].high; shIdx = i }
        if (recent[i].low < swingLow) { swingLow = recent[i].low; slIdx = i }
    }

    const currentPrice = recent[recent.length - 1].close
    const isUptrend = shIdx > slIdx
    const range = swingHigh - swingLow
    const fibRatios = [
        { level: '0% (High)', ratio: 0 },
        { level: '23.6%', ratio: 0.236 },
        { level: '38.2%', ratio: 0.382 },
        { level: '50%', ratio: 0.5 },
        { level: '61.8%', ratio: 0.618 },
        { level: '78.6%', ratio: 0.786 },
        { level: '100% (Low)', ratio: 1 },
    ]

    return fibRatios.map(f => {
        const price = isUptrend ? swingHigh - range * f.ratio : swingLow + range * f.ratio
        return {
            level: f.level,
            price: Math.round(price * 100) / 100,
            type: price < currentPrice ? 'support' as const : 'resistance' as const
        }
    })
}

// ============================================================
// SUPPORT & RESISTANCE
// ============================================================

function findSupportResistance(bars: BarData[]): PriceLevel[] {
    if (bars.length < 50) return []
    const levels: PriceLevel[] = []
    const currentPrice = bars[bars.length - 1].close
    const tolerance = currentPrice * 0.015

    // Pivot points
    const recent = bars.slice(-60)
    const pivotHighs: number[] = []
    const pivotLows: number[] = []
    for (let i = 2; i < recent.length - 2; i++) {
        if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high && recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high)
            pivotHighs.push(recent[i].high)
        if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low && recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low)
            pivotLows.push(recent[i].low)
    }

    const clusterPivots = (pivots: number[], type: 'support' | 'resistance') => {
        const sorted = pivots.sort((a, b) => a - b)
        const clusters: { price: number; count: number }[] = []
        for (const p of sorted) {
            const existing = clusters.find(c => Math.abs(c.price - p) < tolerance)
            if (existing) { existing.price = (existing.price * existing.count + p) / (existing.count + 1); existing.count++ }
            else clusters.push({ price: p, count: 1 })
        }
        return clusters.map(c => ({ price: Math.round(c.price * 100) / 100, type, strength: Math.min(5, c.count), source: 'Pivot' }))
    }

    levels.push(...clusterPivots(pivotLows, 'support'))
    levels.push(...clusterPivots(pivotHighs, 'resistance'))

    // Round numbers
    const magnitude = Math.pow(10, Math.floor(Math.log10(currentPrice)))
    const roundStep = magnitude >= 100 ? 50 : magnitude >= 10 ? 5 : 0.5
    const nearestLower = Math.floor(currentPrice / roundStep) * roundStep
    const nearestUpper = Math.ceil(currentPrice / roundStep) * roundStep
    if (Math.abs(nearestLower - currentPrice) / currentPrice > 0.005)
        levels.push({ price: nearestLower, type: 'support', strength: 2, source: 'Round Number' })
    if (Math.abs(nearestUpper - currentPrice) / currentPrice > 0.005)
        levels.push({ price: nearestUpper, type: 'resistance', strength: 2, source: 'Round Number' })

    // Moving averages
    const sma50 = bars.slice(-50).reduce((s, b) => s + b.close, 0) / 50
    const sma200 = bars.length >= 200 ? bars.slice(-200).reduce((s, b) => s + b.close, 0) / 200 : null
    levels.push({ price: Math.round(sma50 * 100) / 100, type: sma50 < currentPrice ? 'support' : 'resistance', strength: 3, source: 'SMA 50' })
    if (sma200 !== null)
        levels.push({ price: Math.round(sma200 * 100) / 100, type: sma200 < currentPrice ? 'support' : 'resistance', strength: 4, source: 'SMA 200' })

    // 52W high/low
    const high52w = Math.max(...bars.slice(-252).map(b => b.high))
    const low52w = Math.min(...bars.slice(-252).map(b => b.low))
    levels.push({ price: Math.round(high52w * 100) / 100, type: 'resistance', strength: 4, source: '52W High' })
    levels.push({ price: Math.round(low52w * 100) / 100, type: 'support', strength: 4, source: '52W Low' })

    // Deduplicate
    const deduped: PriceLevel[] = []
    for (const level of levels.sort((a, b) => a.price - b.price)) {
        const dup = deduped.find(d => Math.abs(d.price - level.price) < tolerance * 0.5)
        if (dup) { dup.strength = Math.min(5, dup.strength + 1); dup.source = dup.source.includes(level.source) ? dup.source : `${dup.source}, ${level.source}` }
        else deduped.push({ ...level })
    }

    return deduped.filter(l => Math.abs(l.price - currentPrice) / currentPrice < 0.15).sort((a, b) => b.price - a.price)
}

// ============================================================
// PRICE TARGET CALCULATOR
// ============================================================

function calculatePriceTargets(bars: BarData[], levels: PriceLevel[]): StockPriceTargets {
    const currentPrice = bars[bars.length - 1].close
    const supports = levels.filter(l => l.type === 'support' && l.price < currentPrice).sort((a, b) => b.price - a.price)
    const resistances = levels.filter(l => l.type === 'resistance' && l.price > currentPrice).sort((a, b) => a.price - b.price)

    const immediateSupport = supports[0]?.price || currentPrice * 0.95
    const immediateResistance = resistances[0]?.price || currentPrice * 1.05

    const atrBars = bars.slice(-14)
    const atr = atrBars.reduce((sum, b, i) => {
        if (i === 0) return 0
        return sum + Math.max(b.high - b.low, Math.abs(b.high - atrBars[i - 1].close), Math.abs(b.low - atrBars[i - 1].close))
    }, 0) / (atrBars.length - 1)

    const stopLoss = Math.round(Math.max(immediateSupport - atr * 0.5, currentPrice * 0.92) * 100) / 100
    const target1 = Math.round(immediateResistance * 100) / 100
    const target2 = resistances[1]?.price ? Math.round(resistances[1].price * 100) / 100 : Math.round(currentPrice * 1.10 * 100) / 100

    const risk = currentPrice - stopLoss
    const reward = target1 - currentPrice
    const riskRewardRatio = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0

    return { currentPrice: Math.round(currentPrice * 100) / 100, immediateSupport: Math.round(immediateSupport * 100) / 100, immediateResistance: Math.round(immediateResistance * 100) / 100, target1, target2, stopLoss, riskRewardRatio }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isInUptrend(bars: BarData[]): boolean {
    const r = bars.slice(-10)
    if (r.length < 5) return false
    return r.slice(-5).reduce((s, b) => s + b.close, 0) / 5 > r.reduce((s, b) => s + b.close, 0) / r.length && r[r.length - 1].close > r[0].close
}

function isInDowntrend(bars: BarData[]): boolean {
    const r = bars.slice(-10)
    if (r.length < 5) return false
    return r.slice(-5).reduce((s, b) => s + b.close, 0) / 5 < r.reduce((s, b) => s + b.close, 0) / r.length && r[r.length - 1].close < r[0].close
}

function calculateSMA(data: number[], period: number): number[] {
    const result: number[] = []
    for (let i = period - 1; i < data.length; i++) {
        result.push(data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period)
    }
    return result
}

function calculateRSI(closes: number[], period: number): number[] {
    const result: number[] = []
    if (closes.length < period + 1) return result

    let avgGain = 0, avgLoss = 0
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1]
        if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff)
    }
    avgGain /= period; avgLoss /= period
    result.push(100 - 100 / (1 + avgGain / (avgLoss || 0.001)))

    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1]
        avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period
        avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period
        result.push(100 - 100 / (1 + avgGain / (avgLoss || 0.001)))
    }
    return result
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number }[] {
    if (closes.length < 26) return []
    const ema12 = calculateEMA(closes, 12)
    const ema26 = calculateEMA(closes, 26)
    const offset = ema12.length - ema26.length
    const macdLine = ema26.map((_, i) => ema12[i + offset] - ema26[i])
    const signalLine = calculateEMA(macdLine, 9)
    const sigOffset = macdLine.length - signalLine.length

    return signalLine.map((sig, i) => ({
        macd: macdLine[i + sigOffset],
        signal: sig,
        histogram: macdLine[i + sigOffset] - sig
    }))
}

function calculateEMA(data: number[], period: number): number[] {
    if (data.length < period) return []
    const mult = 2 / (period + 1)
    const result: number[] = [data.slice(0, period).reduce((a, b) => a + b, 0) / period]
    for (let i = period; i < data.length; i++) {
        result.push((data[i] - result[result.length - 1]) * mult + result[result.length - 1])
    }
    return result
}
