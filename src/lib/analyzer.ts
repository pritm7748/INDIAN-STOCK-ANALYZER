// src/lib/analyzer.ts
import yahooFinance from 'yahoo-finance2';
import { RSI, SMA } from 'technicalindicators';

// 1. Define Strict Types for our Analysis
export type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface AnalysisResult {
  symbol: string;
  price: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  details: string[];
  metrics: {
    rsi: number;
    sma50: number;
  };
}

export async function analyzeStock(symbol: string, timeframe: TimeFrame): Promise<AnalysisResult> {
  // 2. Setup the query options
  let interval: '1d' | '1wk' = '1d';
  const period1 = '2023-01-01'; 

  if (timeframe === '6M' || timeframe === '1Y') {
    interval = '1wk';
  }

  const queryOptions = { period1, interval };

  // 3. Fetch Data with Explicit Casting
  // We cast to 'any' to bypass the 'never' type error
  const historical = await yahooFinance.historical(symbol, queryOptions as any) as any[];
  const quote = await yahooFinance.quote(symbol) as any;

  // 4. Validate Data
  if (!historical || historical.length < 50) {
    throw new Error(`Insufficient data for ${symbol}. Market might be closed or symbol invalid.`);
  }

  // 5. Extract closing prices safely
  // Since we cast 'historical' to any[], we can now map it without errors
  const closes: number[] = historical.map((h: any) => h.close);
  
  // Get current price safely
  const currentPrice = quote.regularMarketPrice || closes[closes.length - 1];

  // 6. Calculate Indicators
  const rsiInput = { values: closes, period: 14 };
  const rsiValues = RSI.calculate(rsiInput);
  const currentRSI = rsiValues[rsiValues.length - 1] || 0;

  const smaInput = { values: closes, period: 50 };
  const sma50Values = SMA.calculate(smaInput);
  const currentSMA50 = sma50Values[sma50Values.length - 1] || 0;

  // 7. Analysis Logic
  let score = 50;
  let details: string[] = [];
  let recommendation: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

  if (timeframe === '1W' || timeframe === '1M') {
    details.push(`Short-Term Analysis (${timeframe})`);
    
    // RSI Logic
    if (currentRSI < 30) {
      score += 20;
      details.push("RSI Oversold (Bullish)");
    } else if (currentRSI > 70) {
      score -= 20;
      details.push("RSI Overbought (Bearish)");
    }

    // SMA Logic
    if (currentPrice > currentSMA50) {
      score += 10;
      details.push("Price above 50 SMA (Uptrend)");
    }

  } else {
    details.push(`Long-Term Analysis (${timeframe})`);
    
    // Trend Logic
    if (currentPrice > currentSMA50 * 1.05) {
      score += 30;
      details.push("Strong Uptrend (>5% above SMA50)");
    } else if (currentPrice < currentSMA50 * 0.95) {
      score -= 30;
      details.push("Downtrend (<5% below SMA50)");
    }
  }

  // 8. Final Scoring
  if (score >= 70) recommendation = 'BUY';
  else if (score <= 30) recommendation = 'SELL';

  return {
    symbol,
    price: currentPrice,
    recommendation,
    score,
    details,
    metrics: { rsi: currentRSI, sma50: currentSMA50 }
  };
}