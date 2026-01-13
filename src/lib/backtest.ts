// src/lib/backtest.ts
import { RSI, SMA } from 'technicalindicators';

export interface BacktestResult {
  date: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  priceAtSignal: number;
  priceAfter: number;
  returnPct: number;
  isWin: boolean;
}

// Helper to detect patterns on historical data slices
function detectBacktestPatterns(opens: number[], highs: number[], lows: number[], closes: number[]) {
  const patterns: string[] = [];
  const len = closes.length;
  if (len < 5) return patterns;

  const curr = {
    open: opens[len - 1], high: highs[len - 1], low: lows[len - 1], close: closes[len - 1],
    body: Math.abs(closes[len - 1] - opens[len - 1]),
    isGreen: closes[len - 1] > opens[len - 1]
  };
  const prev = {
    open: opens[len - 2], isGreen: closes[len - 2] > opens[len - 2]
  };

  const bodySize = Math.max(curr.body, curr.close * 0.0005); 
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);

  if (lowerWick > 2 * bodySize && upperWick < bodySize) patterns.push("Hammer");
  if (upperWick > 2 * bodySize && lowerWick < bodySize) patterns.push("Shooting Star");
  if (!prev.isGreen && curr.isGreen && curr.close > prev.open && curr.open < prev.open) patterns.push("Bullish Engulfing"); // Simplified check

  return patterns;
}

export function runBacktest(quotes: any[], timeframe: string): { results: BacktestResult[], accuracy: number, totalReturn: number } {
  const results: BacktestResult[] = [];
  
  // 1. DYNAMIC CONFIGURATION
  // Adjust simulation based on user's timeframe
  let lookbackCandles = 250; // Context window
  let lookaheadCandles = 10; // How far to look into future
  let sampleRate = 5;        // How often to check (every 5 days)

  switch (timeframe) {
    case '1W': // Scalping / Short Term
      lookbackCandles = 90;  // Use last 3 months data
      lookaheadCandles = 3;  // Check profit after 3 days
      sampleRate = 1;        // Check every single day
      break;
    case '1M': // Swing Trading
      lookbackCandles = 180;
      lookaheadCandles = 5;
      sampleRate = 2;
      break;
    case '3M': // Medium Term
      lookbackCandles = 365;
      lookaheadCandles = 15;
      sampleRate = 5;
      break;
    case '6M': 
    case '1Y': // Long Term Investing
      lookbackCandles = 500;
      lookaheadCandles = 30; // Check profit after 1 month
      sampleRate = 10;
      break;
  }

  const minDataPoints = 200; 
  // Ensure we don't start before we have enough data for indicators
  const startIndex = Math.max(minDataPoints, quotes.length - lookbackCandles);
  const endIndex = quotes.length - lookaheadCandles;

  if (startIndex >= endIndex) return { results: [], accuracy: 0, totalReturn: 0 };

  for (let i = startIndex; i < endIndex; i += sampleRate) {
    const pastSlice = quotes.slice(0, i + 1);
    
    const closes = pastSlice.map((q: any) => q.close);
    const opens = pastSlice.map((q: any) => q.open);
    const highs = pastSlice.map((q: any) => q.high);
    const lows = pastSlice.map((q: any) => q.low);
    const currentPrice = closes[closes.length - 1];

    // --- SIMULATED STRATEGY ---
    let score = 50;

    // RSI
    const rsi = RSI.calculate({ values: closes, period: 14 });
    const curRsi = rsi[rsi.length - 1] || 50;
    if (curRsi < 30) score += 15;
    else if (curRsi > 70) score -= 15;

    // SMA Trend
    const sma50 = SMA.calculate({ values: closes, period: 50 });
    const curSma50 = sma50[sma50.length - 1] || 0;
    if (currentPrice > curSma50) score += 10;
    else score -= 10;

    // Patterns
    const patterns = detectBacktestPatterns(opens, highs, lows, closes);
    if (patterns.includes("Bullish Engulfing") || patterns.includes("Hammer")) score += 15;
    if (patterns.includes("Bearish Engulfing") || patterns.includes("Shooting Star")) score -= 15;

    // Decide
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (score >= 70) signal = 'BUY';
    else if (score <= 30) signal = 'SELL';

    // --- CHECK FUTURE ---
    if (signal !== 'HOLD') {
      const futurePrice = quotes[i + lookaheadCandles].close;
      const returnPct = ((futurePrice - currentPrice) / currentPrice) * 100;
      
      let isWin = false;
      // We assume a "Win" is if price moved > 1.5% in our favor
      if (signal === 'BUY' && returnPct > 1.5) isWin = true;
      if (signal === 'SELL' && returnPct < -1.5) isWin = true; 

      results.push({
        date: new Date(quotes[i].date).toISOString().split('T')[0],
        signal,
        priceAtSignal: currentPrice,
        priceAfter: futurePrice,
        returnPct: signal === 'SELL' ? -returnPct : returnPct,
        isWin
      });
    }
  }

  const wins = results.filter(r => r.isWin).length;
  const accuracy = results.length > 0 ? (wins / results.length) * 100 : 0;
  const totalReturn = results.reduce((acc, curr) => acc + curr.returnPct, 0);

  return { results, accuracy, totalReturn };
}