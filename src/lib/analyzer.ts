// src/lib/analyzer.ts
import yahooFinance from 'yahoo-finance2'; 
import { RSI, SMA, MACD, BollingerBands } from 'technicalindicators';

// FORCE INITIALIZATION
const yf = new (yahooFinance as any)();

export type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface AnalysisResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  score: number;
  details: string[];
  patterns: string[];
  metrics: {
    rsi: number;
    macdHistogram: number;
    bollingerUpper: number;
    bollingerLower: number;
    sma50: number;
    sma200: number;
  };
  history: { date: string; price: number }[];
}

// --- HELPER: CUSTOM PATTERN RECOGNITION ---
// Since the library removed these features, we implement the math directly.
function detectCandlePatterns(opens: number[], highs: number[], lows: number[], closes: number[]) {
  const patterns: string[] = [];
  const len = closes.length;
  if (len < 2) return patterns;

  // Get last 2 candles
  const curr = {
    open: opens[len - 1], high: highs[len - 1], low: lows[len - 1], close: closes[len - 1],
    body: Math.abs(closes[len - 1] - opens[len - 1]),
    range: highs[len - 1] - lows[len - 1],
    isGreen: closes[len - 1] > opens[len - 1]
  };
  
  const prev = {
    open: opens[len - 2], high: highs[len - 2], low: lows[len - 2], close: closes[len - 2],
    body: Math.abs(closes[len - 2] - opens[len - 2]),
    isGreen: closes[len - 2] > opens[len - 2]
  };

  // 1. DOJI: Body is extremely small relative to range (< 10%)
  if (curr.body <= curr.range * 0.1) {
    patterns.push("Doji (Indecision)");
  }

  // 2. HAMMER: Small body at top, long lower wick (> 2x body), small upper wick
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  
  if (lowerWick > 2 * curr.body && upperWick < curr.body * 0.5) {
    // If it happens after a "dip" (prev close < curr close), it's stronger
    patterns.push("Hammer (Reversal)"); 
  }

  // 3. SHOOTING STAR: Small body at bottom, long upper wick (> 2x body)
  if (upperWick > 2 * curr.body && lowerWick < curr.body * 0.5) {
    patterns.push("Shooting Star (Reversal)");
  }

  // 4. BULLISH ENGULFING: 
  // Prev Red, Curr Green. Curr Body completely covers Prev Body.
  if (!prev.isGreen && curr.isGreen) {
    if (curr.close > prev.open && curr.open < prev.close) {
      patterns.push("Bullish Engulfing");
    }
  }

  // 5. BEARISH ENGULFING:
  // Prev Green, Curr Red. Curr Body completely covers Prev Body.
  if (prev.isGreen && !curr.isGreen) {
    if (curr.close < prev.open && curr.open > prev.close) {
      patterns.push("Bearish Engulfing");
    }
  }

  return patterns;
}

// --- MAIN ANALYZER FUNCTION ---
export async function analyzeStock(symbol: string, timeframe: TimeFrame): Promise<AnalysisResult> {
  let interval: '1d' | '1wk' = '1d';
  
  if (timeframe === '6M' || timeframe === '1Y') {
    interval = '1wk'; 
  }

  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 5); 
  const period1 = pastDate.toISOString().split('T')[0];

  const chartResult = await yf.chart(symbol, { period1, interval } as any) as any;
  const quote = await yf.quote(symbol) as any;

  const historical = chartResult?.quotes;

  if (!historical || historical.length < 180) {
    throw new Error(`Insufficient data for ${symbol}. Only found ${historical?.length || 0} candles.`);
  }

  const cleanData = historical.filter((c: any) => c.close !== null && c.date !== null);
  const closes: number[] = cleanData.map((h: any) => h.close);
  const opens: number[] = cleanData.map((h: any) => h.open);
  const highs: number[] = cleanData.map((h: any) => h.high);
  const lows: number[] = cleanData.map((h: any) => h.low);
  
  const currentPrice = quote.regularMarketPrice || closes[closes.length - 1];
  const prevClose = quote.regularMarketPreviousClose || closes[closes.length - 2];
  const change = currentPrice - prevClose;
  const changePercent = (change / prevClose) * 100;

  // Indicators
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const currentRSI = rsiValues[rsiValues.length - 1] || 50;

  const sma50Values = SMA.calculate({ values: closes, period: 50 });
  const sma200Values = SMA.calculate({ values: closes, period: 200 });
  const currentSMA50 = sma50Values[sma50Values.length - 1] || 0;
  const currentSMA200 = sma200Values[sma200Values.length - 1] || 0;

  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const currentMACD = macdValues[macdValues.length - 1];

  const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const currentBB = bbValues[bbValues.length - 1];

  // --- PATTERN RECOGNITION (New Custom Function) ---
  const patterns = detectCandlePatterns(opens, highs, lows, closes);
  
  // SCORING ENGINE
  let score = 50; 
  let details: string[] = [];

  // Pattern Scoring
  if (patterns.includes("Bullish Engulfing")) { score += 15; }
  if (patterns.includes("Bearish Engulfing")) { score -= 15; }
  if (patterns.includes("Hammer (Reversal)")) { score += 10; }
  if (patterns.includes("Shooting Star (Reversal)")) { score -= 10; }
  if (patterns.includes("Doji (Indecision)")) {
    if (currentRSI > 70) score -= 5;
    if (currentRSI < 30) score += 5;
  }

  // RSI Logic
  if (currentRSI < 30) {
    score += 15;
    details.push("RSI is Oversold (<30) -> Potential Rebound");
  } else if (currentRSI > 70) {
    score -= 15;
    details.push("RSI is Overbought (>70) -> Potential Pullback");
  } else {
    details.push(`RSI is Neutral (${currentRSI.toFixed(2)})`);
  }

  // MACD Logic
  if (currentMACD.histogram && currentMACD.histogram > 0) {
    score += 10;
    details.push("MACD Positive -> Bullish Momentum");
  } else if (currentMACD.histogram && currentMACD.histogram < 0) {
    score -= 10;
    details.push("MACD Negative -> Bearish Momentum");
  }

  // SMA Trend Logic
  if (currentPrice > currentSMA50) {
    score += 10;
    details.push("Price > 50 SMA -> Uptrend");
  } else {
    score -= 10;
    details.push("Price < 50 SMA -> Downtrend");
  }

  if (currentPrice > currentSMA200) {
    score += 5; 
  } 

  // Recommendation
  let recommendation: AnalysisResult['recommendation'] = 'HOLD';
  if (score >= 80) recommendation = 'STRONG BUY';
  else if (score >= 60) recommendation = 'BUY';
  else if (score <= 20) recommendation = 'STRONG SELL';
  else if (score <= 40) recommendation = 'SELL';

  // Format History
  let sliceAmount = -60;
  if (timeframe === '1Y') sliceAmount = -100;
  if (timeframe === '6M') sliceAmount = -50;

  const historySlice = cleanData.slice(sliceAmount).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    price: d.close
  }));

  return {
    symbol,
    price: currentPrice,
    change,
    changePercent,
    recommendation,
    score,
    details,
    patterns, 
    metrics: {
      rsi: currentRSI,
      macdHistogram: currentMACD.histogram || 0,
      bollingerUpper: currentBB ? currentBB.upper : 0,
      bollingerLower: currentBB ? currentBB.lower : 0,
      sma50: currentSMA50,
      sma200: currentSMA200
    },
    history: historySlice
  };
}