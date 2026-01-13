// src/lib/technicals.ts
import { RSI, SMA, MACD, BollingerBands } from 'technicalindicators';
import { ZigZagPoint } from './types';

// 1. BASIC INDICATORS
export function calculateIndicators(closes: number[]) {
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const currentRSI = rsiValues[rsiValues.length - 1] || 50;

  const sma50Values = SMA.calculate({ values: closes, period: 50 });
  const sma200Values = SMA.calculate({ values: closes, period: 200 });
  const currentSMA50 = sma50Values[sma50Values.length - 1] || 0;
  const currentSMA200 = sma200Values[sma200Values.length - 1] || 0;
  
  const prevSMA50 = sma50Values[sma50Values.length - 5] || 0;
  const prevSMA200 = sma200Values[sma200Values.length - 5] || 0;
  
  let crossSignal = 'NONE';
  if (currentSMA50 > currentSMA200 && prevSMA50 < prevSMA200) crossSignal = 'GOLDEN';
  if (currentSMA50 < currentSMA200 && prevSMA50 > prevSMA200) crossSignal = 'DEATH';

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
    crossSignal,
    macd: currentMACD,
    bb: currentBB
  };
}

// 2. CANDLESTICK PATTERNS
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
    const prev = { isGreen: closes[prevIdx] > opens[prevIdx] };
    const suffix = i === 0 ? "" : i === 1 ? " (1d ago)" : " (2d ago)";

    if (curr.range > 0 && curr.body <= curr.range * 0.1) patterns.push(`Doji${suffix}`);

    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const bodySize = Math.max(curr.body, curr.close * 0.0005); 

    if (lowerWick > 2 * bodySize && upperWick < bodySize) patterns.push(`Hammer${suffix}`);
    if (upperWick > 2 * bodySize && lowerWick < bodySize) patterns.push(`Shooting Star${suffix}`);

    if (!prev.isGreen && curr.isGreen && curr.close > opens[prevIdx] && curr.open < closes[prevIdx]) {
      patterns.push(`Bullish Engulfing${suffix}`);
    }
    if (prev.isGreen && !curr.isGreen && curr.close < opens[prevIdx] && curr.open > closes[prevIdx]) {
      patterns.push(`Bearish Engulfing${suffix}`);
    }
  }
  return [...new Set(patterns)];
}

// 3. PIVOT POINTS
export function calculatePivotPoints(high: number, low: number, close: number) {
  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const s1 = 2 * pp - high;
  return { pivot: pp, r1, s1 };
}

// 4. SUPPORT & RESISTANCE
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

// 5. ZIGZAG
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

// 6. CHART PATTERNS
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

// 7. NEW: RISK METRICS (Beta, Alpha, Correlation)
export function calculateRiskMetrics(stockQuotes: any[], marketQuotes: any[]) {
  // Sync Data: Create a map of market dates
  const marketMap = new Map();
  marketQuotes.forEach((q: any) => {
    const dateStr = new Date(q.date).toISOString().split('T')[0];
    marketMap.set(dateStr, q.close);
  });

  const stockReturns: number[] = [];
  const marketReturns: number[] = [];

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
    }
  }

  if (stockReturns.length < 30) {
    return { beta: 1, alpha: 0, correlation: 0, marketTrend: 'NEUTRAL' as const };
  }

  // Calculate Beta (Slope) and Alpha (Intercept)
  const n = stockReturns.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (let i = 0; i < n; i++) {
    sumX += marketReturns[i];
    sumY += stockReturns[i];
    sumXY += marketReturns[i] * stockReturns[i];
    sumXX += marketReturns[i] * marketReturns[i];
    sumYY += stockReturns[i] * stockReturns[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX); // Beta
  const intercept = (sumY - slope * sumX) / n; // Alpha (Daily)
  
  // Annualize Alpha (approx 252 trading days)
  const annualizedAlpha = intercept * 252; 

  // Correlation
  const numerator = (n * sumXY - sumX * sumY);
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  const correlation = denominator === 0 ? 0 : numerator / denominator;

  // Market Trend (Simple SMA check on Market)
  const lastMarketPrice = marketQuotes[marketQuotes.length - 1].close;
  // Calculate SMA50 of market
  const marketCloses = marketQuotes.map((q: any) => q.close);
  const marketSMA50 = SMA.calculate({ values: marketCloses, period: 50 });
  const curMarketSMA = marketSMA50[marketSMA50.length - 1] || 0;
  
  const marketTrend = lastMarketPrice > curMarketSMA ? 'BULLISH' : 'BEARISH';

  return { 
    beta: slope, 
    alpha: annualizedAlpha, 
    correlation, 
    marketTrend: marketTrend as 'BULLISH' | 'BEARISH' 
  };
}