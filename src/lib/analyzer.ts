// src/lib/analyzer.ts
import { fetchMarketData, fetchNewsData, fetchIndexData } from './data';
import { 
  calculateIndicators, detectPatterns, calculatePivotPoints, findSupportResistance, 
  calculateZigZag, detectChartPatterns, calculateRiskMetrics 
} from './technicals';
import { runBacktest } from './backtest';
import { predictFutureTrends } from './ml';
import { TimeFrame, AnalysisResult } from './types';

export async function analyzeStock(symbol: string, timeframe: TimeFrame): Promise<AnalysisResult> {
  
  // 1. GET DATA (Stock + Market Index)
  const { quotes, quote } = await fetchMarketData(symbol);
  const marketQuotes = await fetchIndexData();
  const { news, score: newsScore } = await fetchNewsData(symbol);

  // 2. PREPARE VECTORS
  const closes = quotes.map((q: any) => q.close);
  const opens = quotes.map((q: any) => q.open);
  const highs = quotes.map((q: any) => q.high);
  const lows = quotes.map((q: any) => q.low);
  const dates = quotes.map((q: any) => new Date(q.date).toISOString().split('T')[0]);

  // 3. RUN MATH
  const tech = calculateIndicators(closes);
  const candlePatterns = detectPatterns(opens, highs, lows, closes);
  const sr = findSupportResistance(highs, lows, closes);
  const pivots = calculatePivotPoints(
    quotes[quotes.length-2].high, 
    quotes[quotes.length-2].low, 
    quotes[quotes.length-2].close
  );

  const deviation = (timeframe === '1Y' || timeframe === '6M') ? 5 : 2;
  const zigzag = calculateZigZag(dates, highs, lows, deviation);
  const chartPatterns = detectChartPatterns(zigzag);

  // 4. RISK & SIMULATIONS
  const risk = calculateRiskMetrics(quotes, marketQuotes);
  const backtestResult = runBacktest(quotes, timeframe);
  
  const historyForML = quotes.map((q: any) => ({
    date: new Date(q.date).toISOString(),
    price: q.close
  }));
  const prediction = predictFutureTrends(historyForML, timeframe);

  const currentPrice = quote.regularMarketPrice || closes[closes.length - 1];
  const prevClose = quote.regularMarketPreviousClose || closes[closes.length - 2];
  const change = currentPrice - prevClose;
  const changePercent = (change / prevClose) * 100;

  // 5. SCORING ENGINE
  let score = 50;
  let details: string[] = [];

  // --- A. News ---
  score += newsScore;
  if (newsScore >= 5) details.push(`News Sentiment is Bullish (+${newsScore})`);
  else if (newsScore <= -5) details.push(`News Sentiment is Bearish (${newsScore})`);

  // --- B. Fundamentals ---
  const pe = quote.trailingPE || 0;
  if (pe > 0 && pe < 20) { score += 5; details.push("Undervalued P/E (<20)"); }
  if (pe > 60) { score -= 5; details.push("Overvalued P/E (>60)"); }

  // --- C. Risk & Context (NEW) ---
  // If Market is Bullish and stock has high beta (>1), it's a leader.
  if (risk.marketTrend === 'BULLISH') {
    if (risk.beta > 1.2) { 
      score += 5; 
      details.push("High Beta Leader in Bull Market"); 
    } else if (risk.beta < 0.5) {
      score -= 5;
      details.push("Low Volatility (Lagging) in Bull Market");
    }
  } 
  // If Market is Bearish and stock has high beta, it's dangerous.
  else if (risk.marketTrend === 'BEARISH') {
    if (risk.beta > 1.2) {
      score -= 10;
      details.push("High Beta Risk in Bear Market");
    } else if (risk.beta < 0.5) {
      score += 5;
      details.push("Defensive Stock in Bear Market");
    }
  }

  if (risk.alpha > 0.1) details.push(`High Alpha (Outperforming Market by ${(risk.alpha*100).toFixed(1)}%)`);

  // --- D. Structure ---
  if (chartPatterns.includes("Double Bottom (W Pattern)")) { score += 20; details.push("Double Bottom Detected"); }
  if (chartPatterns.includes("Double Top (M Pattern)")) { score -= 20; details.push("Double Top Detected"); }
  if (chartPatterns.some(p => p.includes("Higher Highs"))) { score += 10; details.push("Uptrend Structure (HH/HL)"); }
  
  if (sr.support.some(s => Math.abs(currentPrice - s) / currentPrice < 0.015)) {
    score += 10; details.push("Price near Key Support");
  }
  if (sr.resistance.some(r => Math.abs(currentPrice - r) / currentPrice < 0.015)) {
    score -= 10; details.push("Price near Key Resistance");
  }

  // --- E. Technicals ---
  if (tech.rsi < 30) { score += 15; details.push("RSI Oversold"); }
  else if (tech.rsi > 70) { score -= 15; details.push("RSI Overbought"); }
  
  if (tech.macd.histogram && tech.macd.histogram > 0) { score += 10; details.push("MACD Bullish"); }
  else { score -= 10; details.push("MACD Bearish"); }

  if (tech.crossSignal === 'GOLDEN') { score += 20; details.push("GOLDEN CROSS"); }
  if (tech.crossSignal === 'DEATH') { score -= 20; details.push("DEATH CROSS"); }

  if (candlePatterns.some(p => p.includes("Bullish"))) score += 10;
  if (candlePatterns.some(p => p.includes("Bearish"))) score -= 10;

  // --- F. ADAPTIVE CORRECTION ---
  if (backtestResult.accuracy < 50) {
    const penalty = (50 - backtestResult.accuracy) / 50; 
    if (score > 50) score = score - (score - 50) * penalty; 
    if (score < 50) score = score + (50 - score) * penalty; 
    details.push(`⚠️ Score adjusted: Low historical accuracy (${backtestResult.accuracy.toFixed(0)}%)`);
  }

  // ML Trend Check
  const predictedReturn = (prediction[prediction.length-1].price - currentPrice) / currentPrice;
  if (score > 60 && predictedReturn < -0.02) {
    score -= 15;
    details.push("⚠️ Score lowered: AI predicts downtrend");
  }

  score = Math.min(100, Math.max(0, score));

  // Verdict
  let recommendation: AnalysisResult['recommendation'] = 'HOLD';
  if (score >= 75) recommendation = 'STRONG BUY';
  else if (score >= 60) recommendation = 'BUY';
  else if (score <= 25) recommendation = 'STRONG SELL';
  else if (score <= 40) recommendation = 'SELL';

  const allPatterns = [...candlePatterns, ...chartPatterns];

  let slice = -60;
  if (timeframe === '6M') slice = -120;
  if (timeframe === '1Y') slice = -250;

  return {
    symbol,
    price: currentPrice,
    change,
    changePercent,
    recommendation,
    score: Math.round(score),
    details,
    patterns: allPatterns,
    news,
    fundamentals: {
      marketCap: quote.marketCap || 0,
      peRatio: quote.trailingPE || 0,
      pbRatio: quote.priceToBook || 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
    },
    metrics: {
      rsi: tech.rsi,
      macdHistogram: tech.macd.histogram || 0,
      bollingerUpper: tech.bb ? tech.bb.upper : 0,
      bollingerLower: tech.bb ? tech.bb.lower : 0,
      sma50: tech.sma50,
      sma200: tech.sma200
    },
    levels: {
      support: sr.support,
      resistance: sr.resistance,
      pivot: pivots.pivot,
      r1: pivots.r1,
      s1: pivots.s1
    },
    risk, // NEW
    zigzag,
    history: quotes.slice(slice).map((q: any) => ({
      date: new Date(q.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      price: q.close
    })),
    backtest: backtestResult,
    prediction 
  };
}

export type { TimeFrame };
