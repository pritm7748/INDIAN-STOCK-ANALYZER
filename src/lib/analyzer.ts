// src/lib/analyzer.ts
import yahooFinance from 'yahoo-finance2'; 
import { RSI, SMA, MACD, BollingerBands } from 'technicalindicators';
import { fetchStockNews, NewsItem } from './news';

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
  news: NewsItem[]; 
  // NEW: Fundamental Data
  fundamentals: {
    marketCap: number;
    peRatio: number;
    pbRatio: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
  };
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

// Custom Pattern Recognition (Keep exactly as it was)
function detectCandlePatterns(opens: number[], highs: number[], lows: number[], closes: number[]) {
  const patterns: string[] = [];
  const len = closes.length;
  if (len < 5) return patterns;

  for (let i = 0; i < 3; i++) {
    const currIdx = len - 1 - i;
    const prevIdx = currIdx - 1;
    if (currIdx < 0 || prevIdx < 0) continue;

    const curr = {
      open: opens[currIdx], high: highs[currIdx], low: lows[currIdx], close: closes[currIdx],
      body: Math.abs(closes[currIdx] - opens[currIdx]),
      range: highs[currIdx] - lows[currIdx],
      isGreen: closes[currIdx] > opens[currIdx]
    };
    
    const prev = {
      open: opens[prevIdx], high: highs[prevIdx], low: lows[prevIdx], close: closes[prevIdx],
      body: Math.abs(closes[prevIdx] - opens[prevIdx]),
      isGreen: closes[prevIdx] > opens[prevIdx]
    };

    const suffix = i === 0 ? "" : i === 1 ? " (1d ago)" : " (2d ago)";

    if (curr.range > 0 && curr.body <= curr.range * 0.1) patterns.push(`Doji${suffix}`);

    const lowerWick = Math.min(curr.open, curr.close) - curr.low;
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const bodySize = Math.max(curr.body, curr.close * 0.0005); 
    
    if (lowerWick > 2 * bodySize && upperWick < bodySize) patterns.push(`Hammer${suffix}`); 
    if (upperWick > 2 * bodySize && lowerWick < bodySize) patterns.push(`Shooting Star${suffix}`);

    if (!prev.isGreen && curr.isGreen) {
      if (curr.close > prev.open && curr.open < prev.close) patterns.push(`Bullish Engulfing${suffix}`);
    }
    if (prev.isGreen && !curr.isGreen) {
      if (curr.close < prev.open && curr.open > prev.close) patterns.push(`Bearish Engulfing${suffix}`);
    }
  }
  return [...new Set(patterns)];
}

// MAIN ANALYZER
export async function analyzeStock(symbol: string, timeframe: TimeFrame): Promise<AnalysisResult> {
  let interval: '1d' | '1wk' = '1d';
  if (timeframe === '6M' || timeframe === '1Y') interval = '1wk'; 

  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 5); 
  const period1 = pastDate.toISOString().split('T')[0];

  // Fetch Data
  const chartResult = await yf.chart(symbol, { period1, interval } as any) as any;
  const quote = await yf.quote(symbol) as any; // Quote contains fundamentals
  const historical = chartResult?.quotes;

  if (!historical || historical.length < 180) {
    throw new Error(`Insufficient data for ${symbol}. Only found ${historical?.length || 0} candles.`);
  }

  const { news, sentimentScore } = await fetchStockNews(symbol);

  // Process Technical Data
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
  const macdValues = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const currentMACD = macdValues[macdValues.length - 1];
  const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const currentBB = bbValues[bbValues.length - 1];
  const patterns = detectCandlePatterns(opens, highs, lows, closes);
  
  // SCORING ENGINE
  let score = 50; 
  let details: string[] = [];

  // 1. News
  score += sentimentScore;
  if (sentimentScore >= 5) details.push(`News Sentiment is Bullish (+${sentimentScore})`);
  else if (sentimentScore <= -5) details.push(`News Sentiment is Bearish (${sentimentScore})`);

  // 2. Fundamentals (NEW SCORING)
  // We add simplified scoring for P/E to avoid value traps
  const pe = quote.trailingPE || 0;
  if (pe > 0 && pe < 20) {
    score += 5;
    details.push("P/E Ratio indicates Undervalued (< 20)");
  } else if (pe > 60) {
    score -= 5;
    details.push("P/E Ratio indicates Overvalued (> 60)");
  }

  // 3. Patterns
  if (patterns.some(p => p.includes("Bullish Engulfing"))) score += 15;
  if (patterns.some(p => p.includes("Bearish Engulfing"))) score -= 15;
  if (patterns.some(p => p.includes("Hammer"))) score += 10;
  if (patterns.some(p => p.includes("Shooting Star"))) score -= 10;
  if (patterns.some(p => p.includes("Doji"))) {
    if (currentRSI > 70) score -= 5;
    if (currentRSI < 30) score += 5;
  }

  // 4. Technicals
  if (currentRSI < 30) { score += 15; details.push("RSI Oversold (<30)"); }
  else if (currentRSI > 70) { score -= 15; details.push("RSI Overbought (>70)"); }
  
  if (currentMACD.histogram && currentMACD.histogram > 0) { score += 10; details.push("MACD Bullish Momentum"); }
  else if (currentMACD.histogram && currentMACD.histogram < 0) { score -= 10; details.push("MACD Bearish Momentum"); }

  if (currentBB) {
    if (currentPrice < currentBB.lower) { score += 10; details.push("Price below Lower BB (Oversold Dip)"); } 
    else if (currentPrice > currentBB.upper) { score -= 10; details.push("Price above Upper BB (Overextended)"); }
  }

  if (currentPrice > currentSMA50) { score += 10; details.push("Price > 50 SMA (Uptrend)"); }
  else { score -= 10; details.push("Price < 50 SMA (Downtrend)"); }

  const prevSMA50 = sma50Values[sma50Values.length - 5];
  const prevSMA200 = sma200Values[sma200Values.length - 5];
  
  if (currentSMA50 > currentSMA200 && prevSMA50 < prevSMA200) {
    score += 20;
    details.push("GOLDEN CROSS! (50 SMA crossed above 200 SMA)");
  } else if (currentSMA50 < currentSMA200 && prevSMA50 > prevSMA200) {
    score -= 20;
    details.push("DEATH CROSS! (50 SMA crossed below 200 SMA)");
  } else if (currentPrice > currentSMA200) {
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
    news,
    // Populate Fundamentals
    fundamentals: {
      marketCap: quote.marketCap || 0,
      peRatio: quote.trailingPE || 0,
      pbRatio: quote.priceToBook || 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
    },
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