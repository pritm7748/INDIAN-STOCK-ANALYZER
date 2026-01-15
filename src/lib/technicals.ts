// src/lib/technicals.ts

import { RSI, SMA, EMA, MACD, BollingerBands, ATR, ADX, StochasticRSI } from 'technicalindicators';
import { ZigZagPoint, VolumeData, VolatilityData, StochRSIData, IchimokuData } from './types';

// ============================================================
// 1. BASIC INDICATORS (Enhanced with EMA)
// ============================================================
export function calculateIndicators(closes: number[]) {
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const currentRSI = rsiValues[rsiValues.length - 1] || 50;

  const sma50Values = SMA.calculate({ values: closes, period: 50 });
  const sma200Values = SMA.calculate({ values: closes, period: 200 });
  const currentSMA50 = sma50Values[sma50Values.length - 1] || 0;
  const currentSMA200 = sma200Values[sma200Values.length - 1] || 0;
  
  // NEW: EMA 9 and 21 for short-term trends
  const ema9Values = EMA.calculate({ values: closes, period: 9 });
  const ema21Values = EMA.calculate({ values: closes, period: 21 });
  const currentEMA9 = ema9Values[ema9Values.length - 1] || 0;
  const currentEMA21 = ema21Values[ema21Values.length - 1] || 0;
  
  const prevSMA50 = sma50Values[sma50Values.length - 5] || 0;
  const prevSMA200 = sma200Values[sma200Values.length - 5] || 0;
  
  let crossSignal = 'NONE';
  if (currentSMA50 > currentSMA200 && prevSMA50 < prevSMA200) crossSignal = 'GOLDEN';
  if (currentSMA50 < currentSMA200 && prevSMA50 > prevSMA200) crossSignal = 'DEATH';

  // NEW: EMA Cross for short-term
  let emaCrossSignal = 'NONE';
  const prevEMA9 = ema9Values[ema9Values.length - 3] || 0;
  const prevEMA21 = ema21Values[ema21Values.length - 3] || 0;
  if (currentEMA9 > currentEMA21 && prevEMA9 < prevEMA21) emaCrossSignal = 'BULLISH';
  if (currentEMA9 < currentEMA21 && prevEMA9 > prevEMA21) emaCrossSignal = 'BEARISH';

  const macdValues = MACD.calculate({ 
    values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, 
    SimpleMAOscillator: false, SimpleMASignal: false 
  });
  const currentMACD = macdValues[macdValues.length - 1];

  const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const currentBB = bbValues[bbValues.length - 1];

  return {
    rsi: currentRSI,
    sma50: currentSMA50,
    sma200: currentSMA200,
    ema9: currentEMA9,
    ema21: currentEMA21,
    crossSignal,
    emaCrossSignal,
    macd: currentMACD,
    bb: currentBB
  };
}

// ============================================================
// 2. VOLUME ANALYSIS (NEW!)
// ============================================================

/**
 * On-Balance Volume (OBV)
 * Measures buying/selling pressure using volume flow
 */
export function calculateOBV(closes: number[], volumes: number[]): { obv: number; obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; obvValues: number[] } {
  let obv = 0;
  const obvValues: number[] = [0];
  
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
    // If prices are equal, OBV stays the same
    obvValues.push(obv);
  }
  
  // Determine OBV trend using 20-day SMA of OBV
  const obvSMA = SMA.calculate({ values: obvValues, period: 20 });
  const currentOBV = obvValues[obvValues.length - 1];
  const currentOBVSMA = obvSMA[obvSMA.length - 1] || 0;
  const prevOBVSMA = obvSMA[obvSMA.length - 10] || 0;
  
  let obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  
  // Check if OBV is above its SMA and rising
  if (currentOBV > currentOBVSMA && currentOBVSMA > prevOBVSMA) {
    obvTrend = 'BULLISH';
  } else if (currentOBV < currentOBVSMA && currentOBVSMA < prevOBVSMA) {
    obvTrend = 'BEARISH';
  }
  
  return { obv: currentOBV, obvTrend, obvValues };
}

/**
 * Volume Weighted Average Price (VWAP)
 * Institutional fair value reference
 */
export function calculateVWAP(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  volumes: number[],
  lookback: number = 20 // Calculate for last N days
): number {
  const startIdx = Math.max(0, closes.length - lookback);
  
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = startIdx; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];
  }
  
  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : closes[closes.length - 1];
}

/**
 * Volume Spike Detection & Analysis
 */
export function analyzeVolume(
  closes: number[],
  volumes: number[],
  highs: number[],
  lows: number[]
): VolumeData {
  const lookback = 20;
  
  // Calculate average volume
  const recentVolumes = volumes.slice(-lookback - 1, -1);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  
  // OBV
  const { obv, obvTrend } = calculateOBV(closes, volumes);
  
  // VWAP
  const vwap = calculateVWAP(highs, lows, closes, volumes);
  
  // Volume Trend (Accumulation vs Distribution)
  // Look at price direction with volume
  let upVol = 0, downVol = 0;
  for (let i = closes.length - 10; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      upVol += volumes[i];
    } else {
      downVol += volumes[i];
    }
  }
  
  let volumeTrend: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';
  const volRatio = upVol / (downVol || 1);
  if (volRatio > 1.5) volumeTrend = 'ACCUMULATION';
  else if (volRatio < 0.67) volumeTrend = 'DISTRIBUTION';
  
  return {
    obv,
    obvTrend,
    vwap,
    volumeSpike: volumeRatio > 2, // 2x average = spike
    avgVolume,
    currentVolume,
    volumeRatio,
    volumeTrend
  };
}

// ============================================================
// 3. VOLATILITY INDICATORS (NEW!)
// ============================================================

/**
 * Average True Range (ATR)
 * Measures volatility - useful for stop-loss calculation
 */
export function calculateATR(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = 14
): { atr: number; atrPercent: number; atrValues: number[] } {
  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period });
  const currentATR = atrValues[atrValues.length - 1] || 0;
  const currentPrice = closes[closes.length - 1];
  const atrPercent = (currentATR / currentPrice) * 100;
  
  return { atr: currentATR, atrPercent, atrValues };
}

/**
 * Supertrend Indicator
 * Trend-following indicator that provides buy/sell signals
 */
export function calculateSupertrend(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = 10, 
  multiplier: number = 3
): { supertrend: number; supertrendSignal: 'BUY' | 'SELL'; supertrendValues: number[] } {
  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period });
  
  if (atrValues.length === 0) {
    return { supertrend: closes[closes.length - 1], supertrendSignal: 'BUY', supertrendValues: [] };
  }
  
  const supertrendValues: number[] = [];
  const signals: ('BUY' | 'SELL')[] = [];
  
  let prevUpperBand = Infinity;
  let prevLowerBand = 0;
  let prevSupertrend = 0;
  let prevClose = closes[period - 1] || closes[0];
  let currentTrend: 'UP' | 'DOWN' = 'UP';
  
  for (let i = 0; i < atrValues.length; i++) {
    const dataIdx = i + period;
    if (dataIdx >= closes.length) break;
    
    const atr = atrValues[i];
    const high = highs[dataIdx];
    const low = lows[dataIdx];
    const close = closes[dataIdx];
    const hl2 = (high + low) / 2;
    
    // Calculate bands
    let upperBand = hl2 + (multiplier * atr);
    let lowerBand = hl2 - (multiplier * atr);
    
    // Adjust bands based on previous values and close
    if (lowerBand > prevLowerBand || prevClose < prevLowerBand) {
      // Keep new lower band
    } else {
      lowerBand = prevLowerBand;
    }
    
    if (upperBand < prevUpperBand || prevClose > prevUpperBand) {
      // Keep new upper band
    } else {
      upperBand = prevUpperBand;
    }
    
    // Determine trend and supertrend value
    let st: number;
    let signal: 'BUY' | 'SELL';
    
    if (i === 0) {
      // Initialize
      st = close > upperBand ? lowerBand : upperBand;
      signal = close > upperBand ? 'BUY' : 'SELL';
      currentTrend = signal === 'BUY' ? 'UP' : 'DOWN';
    } else {
      if (currentTrend === 'UP') {
        if (close < prevSupertrend) {
          currentTrend = 'DOWN';
          st = upperBand;
          signal = 'SELL';
        } else {
          st = lowerBand;
          signal = 'BUY';
        }
      } else {
        if (close > prevSupertrend) {
          currentTrend = 'UP';
          st = lowerBand;
          signal = 'BUY';
        } else {
          st = upperBand;
          signal = 'SELL';
        }
      }
    }
    
    supertrendValues.push(st);
    signals.push(signal);
    
    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    prevSupertrend = st;
    prevClose = close;
  }
  
  return {
    supertrend: supertrendValues[supertrendValues.length - 1] || 0,
    supertrendSignal: signals[signals.length - 1] || 'BUY',
    supertrendValues
  };
}

/**
 * Average Directional Index (ADX)
 * Measures trend strength (not direction)
 */
export function calculateADX(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = 14
): { adx: number; plusDI: number; minusDI: number; trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NO TREND' } {
  const adxResult = ADX.calculate({ high: highs, low: lows, close: closes, period });
  
  if (adxResult.length === 0) {
    return { adx: 0, plusDI: 0, minusDI: 0, trendStrength: 'NO TREND' };
  }
  
  const latest = adxResult[adxResult.length - 1];
  const currentADX = latest.adx;
  const plusDI = latest.pdi;
  const minusDI = latest.mdi;
  
  let trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NO TREND' = 'NO TREND';
  if (currentADX >= 50) trendStrength = 'STRONG';
  else if (currentADX >= 25) trendStrength = 'MODERATE';
  else if (currentADX >= 20) trendStrength = 'WEAK';
  
  return { adx: currentADX, plusDI, minusDI, trendStrength };
}

/**
 * Complete Volatility Analysis
 */
export function analyzeVolatility(
  highs: number[], 
  lows: number[], 
  closes: number[]
): VolatilityData {
  const { atr, atrPercent } = calculateATR(highs, lows, closes);
  const { supertrend, supertrendSignal } = calculateSupertrend(highs, lows, closes);
  const { adx, plusDI, minusDI, trendStrength } = calculateADX(highs, lows, closes);
  
  return {
    atr,
    atrPercent,
    supertrend,
    supertrendSignal,
    adx,
    trendStrength,
    plusDI,
    minusDI
  };
}

// ============================================================
// 4. CANDLESTICK PATTERNS (Existing - Unchanged)
// ============================================================
export function detectPatterns(opens: number[], highs: number[], lows: number[], closes: number[]) {
  const patterns: string[] = [];
  const len = closes.length;
  if (len < 5) return patterns;

  for (let i = 0; i < 3; i++) {
    const idx = len - 1 - i;
    const prevIdx = idx - 1;
    if (idx < 0 || prevIdx < 0) continue;

    const curr = {
      open: opens[idx], high: highs[idx], low: lows[idx], close: closes[idx],
      body: Math.abs(closes[idx] - opens[idx]),
      range: highs[idx] - lows[idx],
      isGreen: closes[idx] > opens[idx]
    };
    const prev = { 
      open: opens[prevIdx],
      close: closes[prevIdx],
      isGreen: closes[prevIdx] > opens[prevIdx] 
    };
    const suffix = i === 0 ? "" : i === 1 ? " (1d ago)" : " (2d ago)";

    if (curr.range > 0 && curr.body <= curr.range * 0.1) patterns.push(`Doji${suffix}`);

    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const bodySize = Math.max(curr.body, curr.close * 0.0005); 

    if (lowerWick > 2 * bodySize && upperWick < bodySize) patterns.push(`Hammer${suffix}`);
    if (upperWick > 2 * bodySize && lowerWick < bodySize) patterns.push(`Shooting Star${suffix}`);

    if (!prev.isGreen && curr.isGreen && curr.close > prev.open && curr.open < prev.close) {
      patterns.push(`Bullish Engulfing${suffix}`);
    }
    if (prev.isGreen && !curr.isGreen && curr.close < prev.open && curr.open > prev.close) {
      patterns.push(`Bearish Engulfing${suffix}`);
    }
  }
  return [...new Set(patterns)];
}

// ============================================================
// 5. PIVOT POINTS (Existing - Unchanged)
// ============================================================
export function calculatePivotPoints(high: number, low: number, close: number) {
  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const s1 = 2 * pp - high;
  const r2 = pp + (high - low);
  const s2 = pp - (high - low);
  return { pivot: pp, r1, s1, r2, s2 };
}

// ============================================================
// 6. SUPPORT & RESISTANCE (Existing - Unchanged)
// ============================================================
export function findSupportResistance(highs: number[], lows: number[], closes: number[]) {
  const lookback = 60;
  const startIdx = Math.max(0, highs.length - lookback);
  const levels: number[] = [];
  
  for (let i = startIdx + 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2]) levels.push(highs[i]);
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) levels.push(lows[i]);
  }

  levels.sort((a, b) => a - b);
  const mergedLevels: { price: number, count: number }[] = [];
  const tolerance = 0.015;

  for (const lvl of levels) {
    let found = false;
    for (const merged of mergedLevels) {
      if (Math.abs(lvl - merged.price) / merged.price < tolerance) {
        merged.price = (merged.price * merged.count + lvl) / (merged.count + 1);
        merged.count++;
        found = true;
        break;
      }
    }
    if (!found) mergedLevels.push({ price: lvl, count: 1 });
  }

  const strongLevels = mergedLevels.filter(l => l.count >= 2).map(l => l.price);
  const currentPrice = closes[closes.length - 1];

  return {
    support: strongLevels.filter(l => l < currentPrice).slice(-3),
    resistance: strongLevels.filter(l => l > currentPrice).slice(0, 3)
  };
}

// ============================================================
// 7. ZIGZAG (Existing - Unchanged)
// ============================================================
export function calculateZigZag(dates: string[], highs: number[], lows: number[], deviationPercent: number = 3): ZigZagPoint[] {
  const points: ZigZagPoint[] = [];
  let trend: 'UP' | 'DOWN' | null = null;
  let lastPivotPrice = 0;

  points.push({ date: dates[0], price: (highs[0] + lows[0]) / 2, type: 'LOW' }); 
  lastPivotPrice = points[0].price;

  for (let i = 1; i < dates.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const date = dates[i];

    if (trend === null) {
      if (high > lastPivotPrice * (1 + deviationPercent / 100)) {
        trend = 'UP';
        points.push({ date, price: high, type: 'HIGH' });
        lastPivotPrice = high;
      } else if (low < lastPivotPrice * (1 - deviationPercent / 100)) {
        trend = 'DOWN';
        points.push({ date, price: low, type: 'LOW' });
        lastPivotPrice = low;
      }
    } else if (trend === 'UP') {
      if (high > lastPivotPrice) {
        points[points.length - 1] = { date, price: high, type: 'HIGH' };
        lastPivotPrice = high;
      } else if (low < lastPivotPrice * (1 - deviationPercent / 100)) {
        trend = 'DOWN';
        points.push({ date, price: low, type: 'LOW' });
        lastPivotPrice = low;
      }
    } else if (trend === 'DOWN') {
      if (low < lastPivotPrice) {
        points[points.length - 1] = { date, price: low, type: 'LOW' };
        lastPivotPrice = low;
      } else if (high > lastPivotPrice * (1 + deviationPercent / 100)) {
        trend = 'UP';
        points.push({ date, price: high, type: 'HIGH' });
        lastPivotPrice = high;
      }
    }
  }
  return points;
}

// ============================================================
// 8. CHART PATTERNS (Existing - Unchanged)
// ============================================================
export function detectChartPatterns(zigzag: ZigZagPoint[]) {
  const patterns: string[] = [];
  if (zigzag.length < 5) return patterns;

  const p4 = zigzag[zigzag.length - 1]; 
  const p3 = zigzag[zigzag.length - 2];
  const p2 = zigzag[zigzag.length - 3];
  const p1 = zigzag[zigzag.length - 4];

  if (p1.type === 'LOW' && p3.type === 'LOW') {
    const diff = Math.abs(p1.price - p3.price) / p1.price;
    if (diff < 0.03) patterns.push("Double Bottom (W Pattern)");
  }

  if (p1.type === 'HIGH' && p3.type === 'HIGH') {
    const diff = Math.abs(p1.price - p3.price) / p1.price;
    if (diff < 0.03) patterns.push("Double Top (M Pattern)");
  }

  if (p3.type === 'LOW' && p4.type === 'HIGH') {
    if (p4.price > p2.price && p3.price > p1.price) {
      patterns.push("Structure: Higher Highs & Higher Lows (Bullish)");
    }
  }
  
  if (p3.type === 'HIGH' && p4.type === 'LOW') {
    if (p4.price < p2.price && p3.price < p1.price) {
      patterns.push("Structure: Lower Highs & Lower Lows (Bearish)");
    }
  }

  return patterns;
}

// ============================================================
// 9. RISK METRICS (ENHANCED!)
// ============================================================
export function calculateRiskMetrics(
  stockQuotes: any[], 
  marketQuotes: any[],
  riskFreeRate: number = 0.065 // 6.5% India 10Y bond rate
) {
  // Sync Data: Create a map of market dates
  const marketMap = new Map();
  marketQuotes.forEach((q: any) => {
    const dateStr = new Date(q.date).toISOString().split('T')[0];
    marketMap.set(dateStr, q.close);
  });

  const stockReturns: number[] = [];
  const marketReturns: number[] = [];
  const negativeReturns: number[] = []; // For Sortino

  // Calculate daily returns for matching dates
  for (let i = 1; i < stockQuotes.length; i++) {
    const dateStr = new Date(stockQuotes[i].date).toISOString().split('T')[0];
    const marketPrice = marketMap.get(dateStr);
    const prevMarketPrice = marketMap.get(new Date(stockQuotes[i-1].date).toISOString().split('T')[0]);

    if (marketPrice && prevMarketPrice) {
      const sRet = (stockQuotes[i].close - stockQuotes[i-1].close) / stockQuotes[i-1].close;
      const mRet = (marketPrice - prevMarketPrice) / prevMarketPrice;
      stockReturns.push(sRet);
      marketReturns.push(mRet);
      
      if (sRet < 0) negativeReturns.push(sRet);
    }
  }

  if (stockReturns.length < 30) {
    return { 
      beta: 1, alpha: 0, correlation: 0, marketTrend: 'NEUTRAL' as const,
      sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
      volatility: 0, valueAtRisk: 0, riskGrade: 'MODERATE' as const
    };
  }

  // --- BETA & ALPHA ---
  const n = stockReturns.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (let i = 0; i < n; i++) {
    sumX += marketReturns[i];
    sumY += stockReturns[i];
    sumXY += marketReturns[i] * stockReturns[i];
    sumXX += marketReturns[i] * marketReturns[i];
    sumYY += stockReturns[i] * stockReturns[i];
  }

  const betaDenom = (n * sumXX - sumX * sumX);
  const beta = betaDenom !== 0 ? (n * sumXY - sumX * sumY) / betaDenom : 1;
  const dailyAlpha = (sumY - beta * sumX) / n;
  const annualizedAlpha = dailyAlpha * 252;

  // --- CORRELATION ---
  const numerator = (n * sumXY - sumX * sumY);
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  const correlation = denominator === 0 ? 0 : numerator / denominator;

  // --- VOLATILITY (Annualized) ---
  const meanReturn = sumY / n;
  let sumSquaredDiff = 0;
  for (const ret of stockReturns) {
    sumSquaredDiff += Math.pow(ret - meanReturn, 2);
  }
  const variance = sumSquaredDiff / n;
  const dailyVolatility = Math.sqrt(variance);
  const annualizedVolatility = dailyVolatility * Math.sqrt(252);

  // --- SHARPE RATIO ---
  const annualizedReturn = meanReturn * 252;
  const excessReturn = annualizedReturn - riskFreeRate;
  const sharpeRatio = annualizedVolatility !== 0 ? excessReturn / annualizedVolatility : 0;

  // --- SORTINO RATIO ---
  let sumNegSquared = 0;
  for (const ret of negativeReturns) {
    sumNegSquared += ret * ret;
  }
  const downsideDeviation = negativeReturns.length > 0 
    ? Math.sqrt(sumNegSquared / negativeReturns.length) * Math.sqrt(252) 
    : 0;
    const sortinoRatio = downsideDeviation !== 0 ? excessReturn / downsideDeviation : 0;

  // --- MAX DRAWDOWN ---
  let peak = stockQuotes[0].close;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const quote of stockQuotes) {
    if (quote.close > peak) {
      peak = quote.close;
    }
    const drawdown = peak - quote.close;
    const drawdownPct = (drawdown / peak) * 100;

    if (drawdownPct > maxDrawdownPercent) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPct;
    }
  }

  // --- VALUE AT RISK (95% confidence, 1-day) ---
  const sortedReturns = [...stockReturns].sort((a, b) => a - b);
  const varIndex = Math.floor(n * 0.05);
  const var95 = sortedReturns[varIndex] || 0;
  const currentPrice = stockQuotes[stockQuotes.length - 1].close;
  const valueAtRisk = Math.abs(var95) * currentPrice;

  // --- MARKET TREND ---
  const marketCloses = marketQuotes.map((q: any) => q.close);
  const marketSMA50 = SMA.calculate({ values: marketCloses, period: 50 });
  const curMarketSMA = marketSMA50[marketSMA50.length - 1] || 0;
  const lastMarketPrice = marketQuotes[marketQuotes.length - 1]?.close || 0;
  
  let marketTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (lastMarketPrice > curMarketSMA * 1.02) marketTrend = 'BULLISH';
  else if (lastMarketPrice < curMarketSMA * 0.98) marketTrend = 'BEARISH';

  // --- RISK GRADE ---
  let riskGrade: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH' = 'MODERATE';
  const riskScore = (annualizedVolatility * 100) + (maxDrawdownPercent * 0.5) + (Math.abs(beta - 1) * 10);
  
  if (riskScore < 20) riskGrade = 'LOW';
  else if (riskScore < 40) riskGrade = 'MODERATE';
  else if (riskScore < 60) riskGrade = 'HIGH';
  else riskGrade = 'VERY HIGH';

  return { 
    beta, 
    alpha: annualizedAlpha, 
    correlation, 
    marketTrend,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    maxDrawdownPercent,
    volatility: annualizedVolatility,
    valueAtRisk,
    riskGrade
  };
}

// ============================================================
// 10. STOCHASTIC RSI
// ============================================================

/**
 * Stochastic RSI - Momentum oscillator that measures RSI relative to its range
 * More sensitive than regular RSI, good for identifying momentum shifts
 * 
 * Signals:
 * - K < 20: Oversold
 * - K > 80: Overbought  
 * - K crosses above D: Bullish
 * - K crosses below D: Bearish
 */
export function calculateStochRSI(closes: number[], period: number = 14): StochRSIData {
  const stochRsiResult = StochasticRSI.calculate({
    values: closes,
    rsiPeriod: period,
    stochasticPeriod: period,
    kPeriod: 3,
    dPeriod: 3
  });

  if (stochRsiResult.length < 2) {
    return {
      k: 50,
      d: 50,
      signal: 'NEUTRAL',
      crossover: false
    };
  }

  const current = stochRsiResult[stochRsiResult.length - 1];
  const previous = stochRsiResult[stochRsiResult.length - 2];

  const k = (current.k ?? 50) * 100;  // Convert to 0-100 scale
  const d = (current.d ?? 50) * 100;
  const prevK = (previous.k ?? 50) * 100;
  const prevD = (previous.d ?? 50) * 100;

  // Detect crossovers
  const bullishCross = prevK <= prevD && k > d;
  const bearishCross = prevK >= prevD && k < d;

  // Determine signal
  let signal: StochRSIData['signal'] = 'NEUTRAL';
  
  if (bullishCross && k < 30) {
    signal = 'BULLISH_CROSS';  // Bullish cross in oversold zone - strong signal
  } else if (bearishCross && k > 70) {
    signal = 'BEARISH_CROSS';  // Bearish cross in overbought zone - strong signal
  } else if (k < 20) {
    signal = 'OVERSOLD';
  } else if (k > 80) {
    signal = 'OVERBOUGHT';
  } else if (bullishCross) {
    signal = 'BULLISH_CROSS';
  } else if (bearishCross) {
    signal = 'BEARISH_CROSS';
  }

  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal,
    crossover: bullishCross || bearishCross
  };
}

// ============================================================
// 11. ICHIMOKU CLOUD
// ============================================================

/**
 * Ichimoku Kinko Hyo - Complete trading system from Japan
 * 
 * Components:
 * - Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
 * - Kijun-sen (Base Line): (26-period high + 26-period low) / 2
 * - Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, plotted 26 periods ahead
 * - Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, plotted 26 periods ahead
 * - Chikou Span (Lagging Span): Close plotted 26 periods behind
 * 
 * Signals:
 * - Price above cloud: Bullish
 * - Price below cloud: Bearish
 * - Tenkan crosses above Kijun: Bullish (TK Cross)
 * - Green cloud (Span A > Span B): Bullish momentum
 */
export function calculateIchimoku(
  highs: number[], 
  lows: number[], 
  closes: number[]
): IchimokuData {
  const len = closes.length;
  
  // Minimum data check
  if (len < 52) {
    return {
      tenkanSen: closes[len - 1] || 0,
      kijunSen: closes[len - 1] || 0,
      senkouSpanA: closes[len - 1] || 0,
      senkouSpanB: closes[len - 1] || 0,
      chikouSpan: closes[len - 1] || 0,
      cloudTop: closes[len - 1] || 0,
      cloudBottom: closes[len - 1] || 0,
      priceVsCloud: 'INSIDE',
      tkCross: 'NONE',
      cloudColor: 'GREEN',
      signal: 'NEUTRAL'
    };
  }

  // Helper: Get highest high and lowest low for a period
  const getHighLow = (startIdx: number, period: number) => {
    const sliceHighs = highs.slice(startIdx, startIdx + period);
    const sliceLows = lows.slice(startIdx, startIdx + period);
    return {
      high: Math.max(...sliceHighs),
      low: Math.min(...sliceLows)
    };
  };

  // Calculate Tenkan-sen (9 periods)
  const tenkanPeriod = 9;
  const tenkanHL = getHighLow(len - tenkanPeriod, tenkanPeriod);
  const tenkanSen = (tenkanHL.high + tenkanHL.low) / 2;

  // Calculate Kijun-sen (26 periods)
  const kijunPeriod = 26;
  const kijunHL = getHighLow(len - kijunPeriod, kijunPeriod);
  const kijunSen = (kijunHL.high + kijunHL.low) / 2;

  // Calculate Senkou Span A (projected 26 periods ahead, but we use current value)
  const senkouSpanA = (tenkanSen + kijunSen) / 2;

  // Calculate Senkou Span B (52 periods)
  const senkouBPeriod = 52;
  const senkouBHL = getHighLow(len - senkouBPeriod, senkouBPeriod);
  const senkouSpanB = (senkouBHL.high + senkouBHL.low) / 2;

  // Chikou Span (current close, compared to price 26 periods ago)
  const chikouSpan = closes[len - 1];
  const price26Ago = closes[len - 27] || closes[0];

  // Current price
  const currentPrice = closes[len - 1];

  // Cloud boundaries
  const cloudTop = Math.max(senkouSpanA, senkouSpanB);
  const cloudBottom = Math.min(senkouSpanA, senkouSpanB);

  // Price vs Cloud
  let priceVsCloud: IchimokuData['priceVsCloud'] = 'INSIDE';
  if (currentPrice > cloudTop) priceVsCloud = 'ABOVE';
  else if (currentPrice < cloudBottom) priceVsCloud = 'BELOW';

  // TK Cross detection (look at last 3 periods)
  let tkCross: IchimokuData['tkCross'] = 'NONE';
  
  // Calculate previous Tenkan and Kijun
  const prevTenkanHL = getHighLow(len - tenkanPeriod - 1, tenkanPeriod);
  const prevTenkanSen = (prevTenkanHL.high + prevTenkanHL.low) / 2;
  const prevKijunHL = getHighLow(len - kijunPeriod - 1, kijunPeriod);
  const prevKijunSen = (prevKijunHL.high + prevKijunHL.low) / 2;

  if (prevTenkanSen <= prevKijunSen && tenkanSen > kijunSen) {
    tkCross = 'BULLISH';
  } else if (prevTenkanSen >= prevKijunSen && tenkanSen < kijunSen) {
    tkCross = 'BEARISH';
  }

  // Cloud color (future cloud direction)
  const cloudColor: IchimokuData['cloudColor'] = senkouSpanA > senkouSpanB ? 'GREEN' : 'RED';

  // Generate overall signal
  let signal: IchimokuData['signal'] = 'NEUTRAL';
  let bullPoints = 0;
  let bearPoints = 0;

  // Price position (most important)
  if (priceVsCloud === 'ABOVE') bullPoints += 2;
  else if (priceVsCloud === 'BELOW') bearPoints += 2;

  // TK Cross
  if (tkCross === 'BULLISH') bullPoints += 2;
  else if (tkCross === 'BEARISH') bearPoints += 2;

  // Cloud color
  if (cloudColor === 'GREEN') bullPoints += 1;
  else bearPoints += 1;

  // Chikou Span (lagging) above/below price
  if (chikouSpan > price26Ago) bullPoints += 1;
  else if (chikouSpan < price26Ago) bearPoints += 1;

  // Price above Kijun (base line)
  if (currentPrice > kijunSen) bullPoints += 1;
  else bearPoints += 1;

  // Determine signal
  const netScore = bullPoints - bearPoints;
  if (netScore >= 5) signal = 'STRONG_BUY';
  else if (netScore >= 2) signal = 'BUY';
  else if (netScore <= -5) signal = 'STRONG_SELL';
  else if (netScore <= -2) signal = 'SELL';
  else signal = 'NEUTRAL';

  return {
    tenkanSen: Math.round(tenkanSen * 100) / 100,
    kijunSen: Math.round(kijunSen * 100) / 100,
    senkouSpanA: Math.round(senkouSpanA * 100) / 100,
    senkouSpanB: Math.round(senkouSpanB * 100) / 100,
    chikouSpan: Math.round(chikouSpan * 100) / 100,
    cloudTop: Math.round(cloudTop * 100) / 100,
    cloudBottom: Math.round(cloudBottom * 100) / 100,
    priceVsCloud,
    tkCross,
    cloudColor,
    signal
  };
}

// ============================================================
// 12. WILLIAMS %R (Bonus - pairs well with Stoch RSI)
// ============================================================

/**
 * Williams %R - Momentum indicator showing overbought/oversold
 * Similar to Stochastic but inverted scale (-100 to 0)
 * 
 * - Above -20: Overbought
 * - Below -80: Oversold
 */
export function calculateWilliamsR(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = 14
): { value: number; signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' } {
  const len = closes.length;
  
  if (len < period) {
    return { value: -50, signal: 'NEUTRAL' };
  }

  const highestHigh = Math.max(...highs.slice(-period));
  const lowestLow = Math.min(...lows.slice(-period));
  const currentClose = closes[len - 1];

  const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;

  let signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' = 'NEUTRAL';
  if (williamsR > -20) signal = 'OVERBOUGHT';
  else if (williamsR < -80) signal = 'OVERSOLD';

  return {
    value: Math.round(williamsR * 100) / 100,
    signal
  };
}

// ============================================================
// 13. COMBINED MOMENTUM SCORE
// ============================================================

/**
 * Combines multiple momentum indicators into single score
 * Useful for confirming signals
 */
export function calculateMomentumScore(
  closes: number[],
  highs: number[],
  lows: number[]
): { score: number; interpretation: string } {
  let score = 50; // Neutral starting point

  // RSI
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const rsi = rsiValues[rsiValues.length - 1] || 50;
  if (rsi < 30) score += 15;
  else if (rsi < 40) score += 5;
  else if (rsi > 70) score -= 15;
  else if (rsi > 60) score -= 5;

  // Stochastic RSI
  const stochRsi = calculateStochRSI(closes);
  if (stochRsi.signal === 'BULLISH_CROSS') score += 10;
  else if (stochRsi.signal === 'BEARISH_CROSS') score -= 10;
  else if (stochRsi.signal === 'OVERSOLD') score += 5;
  else if (stochRsi.signal === 'OVERBOUGHT') score -= 5;

  // Williams %R
  const williamsR = calculateWilliamsR(highs, lows, closes);
  if (williamsR.signal === 'OVERSOLD') score += 5;
  else if (williamsR.signal === 'OVERBOUGHT') score -= 5;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Interpretation
  let interpretation = 'Neutral momentum';
  if (score >= 75) interpretation = 'Strong bullish momentum';
  else if (score >= 60) interpretation = 'Bullish momentum';
  else if (score <= 25) interpretation = 'Strong bearish momentum';
  else if (score <= 40) interpretation = 'Bearish momentum';

  return { score, interpretation };
}