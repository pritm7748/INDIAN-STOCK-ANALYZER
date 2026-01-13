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

export async function analyzeStock(symbol: string, timeframe: TimeFrame): Promise<AnalysisResult> {
  let interval: '1d' | '1wk' = '1d';
  
  // Switch to weekly candles for longer trends to reduce noise
  if (timeframe === '6M' || timeframe === '1Y') {
    interval = '1wk'; 
  }

  // 1. FIX: FETCH 5 YEARS OF DATA
  // 5 years = ~260 weekly candles. This ensures we have enough for SMA 200.
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 5); 
  const period1 = pastDate.toISOString().split('T')[0];

  const chartResult = await yf.chart(symbol, { period1, interval } as any) as any;
  const quote = await yf.quote(symbol) as any;

  // Process Data
  const historical = chartResult?.quotes;

  // We lower the strict limit slightly (180) to allow for holidays, 
  // but generally, we expect ~250+ candles now.
  if (!historical || historical.length < 180) {
    throw new Error(`Insufficient data for ${symbol}. Only found ${historical?.length || 0} candles. Needed 200 for SMA.`);
  }

  // Filter and Map Data
  const cleanData = historical.filter((c: any) => c.close !== null && c.date !== null);
  const closes: number[] = cleanData.map((h: any) => h.close);
  
  const currentPrice = quote.regularMarketPrice || closes[closes.length - 1];
  const prevClose = quote.regularMarketPreviousClose || closes[closes.length - 2];
  const change = currentPrice - prevClose;
  const changePercent = (change / prevClose) * 100;

  // Calculate Indicators
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

  // SCORING ENGINE
  let score = 50; 
  let details: string[] = [];

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
    details.push("MACD Histogram Positive -> Bullish Momentum");
  } else if (currentMACD.histogram && currentMACD.histogram < 0) {
    score -= 10;
    details.push("MACD Histogram Negative -> Bearish Momentum");
  }

  // SMA Trend Logic
  if (currentPrice > currentSMA50) {
    score += 10;
    details.push("Price above 50 SMA -> Uptrend");
  } else {
    score -= 10;
    details.push("Price below 50 SMA -> Downtrend");
  }

  if (currentPrice > currentSMA200) {
    score += 5; 
    details.push("Price above 200 SMA -> Long-term Bullish");
  } else {
    details.push("Price below 200 SMA -> Long-term Bearish");
  }

  // Recommendation Mapping
  let recommendation: AnalysisResult['recommendation'] = 'HOLD';
  if (score >= 80) recommendation = 'STRONG BUY';
  else if (score >= 60) recommendation = 'BUY';
  else if (score <= 20) recommendation = 'STRONG SELL';
  else if (score <= 40) recommendation = 'SELL';

  // Format history for Chart (Show more history for context)
  // We determine how much history to send to the UI based on timeframe
  let sliceAmount = -60;
  if (timeframe === '1Y') sliceAmount = -100; // Show 100 weeks for 1Y view
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