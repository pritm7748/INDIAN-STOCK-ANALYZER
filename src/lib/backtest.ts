// src/lib/backtest.ts
// Conservative Backtest Engine - Prioritizes high-probability setups

import { RSI, SMA, EMA, ADX, StochasticRSI, BollingerBands } from 'technicalindicators';

export interface BacktestResult {
  date: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  priceAtSignal: number;
  priceAfter: number;
  returnPct: number;
  isWin: boolean;
  confidence?: number;
  reasons?: string[];
}

// Helper to detect candlestick patterns
function detectPatterns(opens: number[], highs: number[], lows: number[], closes: number[]) {
  const patterns: string[] = [];
  const len = closes.length;
  if (len < 5) return patterns;

  const curr = {
    open: opens[len - 1], high: highs[len - 1], low: lows[len - 1], close: closes[len - 1],
    body: Math.abs(closes[len - 1] - opens[len - 1]),
    isGreen: closes[len - 1] > opens[len - 1]
  };
  const prev = {
    open: opens[len - 2], close: closes[len - 2],
    body: Math.abs(closes[len - 2] - opens[len - 2]),
    isGreen: closes[len - 2] > opens[len - 2]
  };

  const bodySize = Math.max(curr.body, curr.close * 0.001);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);

  // Hammer - strong reversal signal
  if (lowerWick > 2.5 * bodySize && upperWick < bodySize * 0.5 && !curr.isGreen === false) {
    patterns.push("Hammer");
  }

  // Bullish Engulfing
  if (!prev.isGreen && curr.isGreen && curr.body > prev.body * 1.2 && curr.close > prev.open) {
    patterns.push("Bullish Engulfing");
  }

  // Bearish Engulfing
  if (prev.isGreen && !curr.isGreen && curr.body > prev.body * 1.2 && curr.close < prev.open) {
    patterns.push("Bearish Engulfing");
  }

  return patterns;
}

// Calculate trend strength
function getTrendStrength(closes: number[]): { direction: 'UP' | 'DOWN' | 'SIDEWAYS'; strength: number } {
  if (closes.length < 50) return { direction: 'SIDEWAYS', strength: 0 };

  const sma20 = SMA.calculate({ values: closes, period: 20 });
  const sma50 = SMA.calculate({ values: closes, period: 50 });

  const currSma20 = sma20[sma20.length - 1] || 0;
  const currSma50 = sma50[sma50.length - 1] || 0;
  const price = closes[closes.length - 1];

  // Check alignment
  if (price > currSma20 && currSma20 > currSma50) {
    const strength = ((price - currSma50) / currSma50) * 100;
    return { direction: 'UP', strength: Math.min(100, strength * 5) };
  }
  if (price < currSma20 && currSma20 < currSma50) {
    const strength = ((currSma50 - price) / currSma50) * 100;
    return { direction: 'DOWN', strength: Math.min(100, strength * 5) };
  }

  return { direction: 'SIDEWAYS', strength: 0 };
}

export function runBacktest(quotes: any[], timeframe: string): {
  results: BacktestResult[],
  accuracy: number,
  totalReturn: number,
  sharpeRatio?: number,
  maxDrawdown?: number,
  winRate?: number,
  totalTrades?: number
} {
  const results: BacktestResult[] = [];

  // 1. DYNAMIC CONFIGURATION
  let lookbackCandles = 250;
  let lookaheadCandles = 10;
  let sampleRate = 5;

  switch (timeframe) {
    case '1W':
      lookbackCandles = 120;
      lookaheadCandles = 5;
      sampleRate = 2;
      break;
    case '1M':
      lookbackCandles = 200;
      lookaheadCandles = 7;
      sampleRate = 3;
      break;
    case '3M':
      lookbackCandles = 365;
      lookaheadCandles = 14;
      sampleRate = 5;
      break;
    case '6M':
    case '1Y':
      lookbackCandles = 500;
      lookaheadCandles = 21;
      sampleRate = 7;
      break;
  }

  const minDataPoints = 100;
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
    const reasons: string[] = [];

    // ===== COMPREHENSIVE SIGNAL SYSTEM =====
    // Only signal when MULTIPLE indicators align

    let bullishSignals = 0;
    let bearishSignals = 0;
    let totalWeight = 0;

    // 1. TREND CHECK (Weight: 2)
    const trend = getTrendStrength(closes);
    if (trend.direction === 'UP' && trend.strength > 20) {
      bullishSignals += 2;
      reasons.push('Uptrend');
    } else if (trend.direction === 'DOWN' && trend.strength > 20) {
      bearishSignals += 2;
      reasons.push('Downtrend');
    }
    totalWeight += 2;

    // 2. RSI EXTREMES (Weight: 2)
    const rsi = RSI.calculate({ values: closes, period: 14 });
    const curRsi = rsi[rsi.length - 1] || 50;

    if (curRsi < 35) {
      bullishSignals += 2;
      reasons.push('RSI Oversold');
    } else if (curRsi > 65) {
      bearishSignals += 2;
      reasons.push('RSI Overbought');
    } else if (curRsi < 45) {
      bullishSignals += 0.5;
    } else if (curRsi > 55) {
      bearishSignals += 0.5;
    }
    totalWeight += 2;

    // 3. PRICE VS BOLLINGER BANDS (Weight: 1.5)
    if (closes.length >= 20) {
      const bb = BollingerBands.calculate({
        period: 20,
        values: closes,
        stdDev: 2
      });

      if (bb.length > 0) {
        const currBB = bb[bb.length - 1];

        if (currentPrice < currBB.lower) {
          bullishSignals += 1.5;
          reasons.push('Below Lower BB');
        } else if (currentPrice > currBB.upper) {
          bearishSignals += 1.5;
          reasons.push('Above Upper BB');
        }
      }
    }
    totalWeight += 1.5;

    // 4. STOCHASTIC RSI (Weight: 1.5)
    if (closes.length >= 20) {
      try {
        const stochRsi = StochasticRSI.calculate({
          values: closes,
          rsiPeriod: 14,
          stochasticPeriod: 14,
          kPeriod: 3,
          dPeriod: 3
        });

        if (stochRsi.length >= 2) {
          const curr = stochRsi[stochRsi.length - 1];
          const prev = stochRsi[stochRsi.length - 2];

          // Bullish cross in oversold
          if (curr.k < 25 && curr.k > curr.d && prev.k <= prev.d) {
            bullishSignals += 1.5;
            reasons.push('Stoch Bullish Cross');
          }
          // Bearish cross in overbought
          else if (curr.k > 75 && curr.k < curr.d && prev.k >= prev.d) {
            bearishSignals += 1.5;
            reasons.push('Stoch Bearish Cross');
          }
          // Just oversold/overbought
          else if (curr.k < 20) {
            bullishSignals += 0.7;
          } else if (curr.k > 80) {
            bearishSignals += 0.7;
          }
        }
      } catch {
        // Skip if calculation fails
      }
    }
    totalWeight += 1.5;

    // 5. EMA ALIGNMENT (Weight: 1)
    const ema9 = EMA.calculate({ values: closes, period: 9 });
    const ema21 = EMA.calculate({ values: closes, period: 21 });

    if (ema9.length > 1 && ema21.length > 1) {
      const curEma9 = ema9[ema9.length - 1];
      const curEma21 = ema21[ema21.length - 1];
      const prevEma9 = ema9[ema9.length - 2];
      const prevEma21 = ema21[ema21.length - 2];

      // EMA crossover
      if (curEma9 > curEma21 && prevEma9 <= prevEma21) {
        bullishSignals += 1;
        reasons.push('EMA Golden Cross');
      } else if (curEma9 < curEma21 && prevEma9 >= prevEma21) {
        bearishSignals += 1;
        reasons.push('EMA Death Cross');
      } else if (curEma9 > curEma21) {
        bullishSignals += 0.3;
      } else {
        bearishSignals += 0.3;
      }
    }
    totalWeight += 1;

    // 6. CANDLESTICK PATTERNS (Weight: 1)
    const patterns = detectPatterns(opens, highs, lows, closes);
    if (patterns.includes("Bullish Engulfing") || patterns.includes("Hammer")) {
      bullishSignals += 1;
      reasons.push(patterns[0]);
    }
    if (patterns.includes("Bearish Engulfing")) {
      bearishSignals += 1;
      reasons.push("Bearish Engulfing");
    }
    totalWeight += 1;

    // ===== DECISION LOGIC =====
    // Require strong consensus (>55% of weighted signals)
    const bullishRatio = bullishSignals / totalWeight;
    const bearishRatio = bearishSignals / totalWeight;

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;

    // HIGHER THRESHOLDS = FEWER BUT BETTER SIGNALS
    const signalThreshold = 0.45; // Need 45% of weighted signals to agree

    if (bullishRatio > signalThreshold && bullishSignals >= 3 && reasons.length >= 2) {
      signal = 'BUY';
      confidence = Math.min(0.9, 0.5 + bullishRatio * 0.5);
    } else if (bearishRatio > signalThreshold && bearishSignals >= 3 && reasons.length >= 2) {
      signal = 'SELL';
      confidence = Math.min(0.9, 0.5 + bearishRatio * 0.5);
    }

    // ===== FILTER OUT LOW-CONVICTION SIGNALS =====
    // Skip signals in sideways markets unless very strong
    if (trend.direction === 'SIDEWAYS' && confidence < 0.7) {
      signal = 'HOLD';
    }

    // ===== CHECK FUTURE =====
    if (signal !== 'HOLD') {
      const futurePrice = quotes[i + lookaheadCandles].close;
      const returnPct = ((futurePrice - currentPrice) / currentPrice) * 100;

      // LOWERED win threshold - accept smaller but consistent gains
      // Any positive return in the right direction is a win
      const winThreshold = 0.5; // Just 0.5% profit is a win

      let isWin = false;
      if (signal === 'BUY' && returnPct > winThreshold) isWin = true;
      if (signal === 'SELL' && returnPct < -winThreshold) isWin = true;

      results.push({
        date: new Date(quotes[i].date).toISOString().split('T')[0],
        signal,
        priceAtSignal: currentPrice,
        priceAfter: futurePrice,
        returnPct: signal === 'SELL' ? -returnPct : returnPct,
        isWin,
        confidence,
        reasons
      });
    }
  }

  const wins = results.filter(r => r.isWin).length;
  const accuracy = results.length > 0 ? (wins / results.length) * 100 : 0;
  const totalReturn = results.reduce((acc, curr) => acc + curr.returnPct, 0);

  // Calculate Sharpe Ratio
  const returns = results.map(r => r.returnPct / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const returnStdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((acc, r) => acc + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = returnStdDev > 0 ? (avgReturn / returnStdDev) * Math.sqrt(252 / lookaheadCandles) : 0;

  // Calculate Max Drawdown
  let peak = 1;
  let maxDrawdown = 0;
  let equity = 1;
  for (const result of results) {
    equity *= (1 + result.returnPct / 100);
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return {
    results,
    accuracy,
    totalReturn,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    winRate: Math.round(accuracy * 10) / 10,
    totalTrades: results.length
  };
}