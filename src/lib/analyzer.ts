// src/lib/analyzer.ts
import { fetchMarketData, fetchNewsData, fetchIndexData } from './data';
import { 
  calculateIndicators, 
  detectPatterns, 
  calculatePivotPoints, 
  findSupportResistance, 
  calculateZigZag, 
  detectChartPatterns, 
  calculateRiskMetrics,
  analyzeVolume,
  analyzeVolatility
} from './technicals';
import { runBacktest } from './backtest';
import { predictFutureTrends } from './ml';
import { TimeFrame, AnalysisResult, VolumeData, VolatilityData } from './types';

export async function analyzeStock(symbol: string, timeframe: TimeFrame): Promise<AnalysisResult> {
  
  // ============================================================
  // 1. FETCH ALL DATA
  // ============================================================
  const { quotes, quote } = await fetchMarketData(symbol);
  const marketQuotes = await fetchIndexData();
  const { news, score: newsScore } = await fetchNewsData(symbol);

  // ============================================================
  // 2. PREPARE DATA VECTORS
  // ============================================================
  const closes = quotes.map((q: any) => q.close);
  const opens = quotes.map((q: any) => q.open);
  const highs = quotes.map((q: any) => q.high);
  const lows = quotes.map((q: any) => q.low);
  const volumes = quotes.map((q: any) => q.volume || 0);
  const dates = quotes.map((q: any) => new Date(q.date).toISOString().split('T')[0]);

  // ============================================================
  // 3. RUN ALL CALCULATIONS
  // ============================================================
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

  // NEW: Volume Analysis
  const volumeData: VolumeData = analyzeVolume(closes, volumes, highs, lows);

  // NEW: Volatility Analysis (ATR, Supertrend, ADX)
  const volatilityData: VolatilityData = analyzeVolatility(highs, lows, closes);

  // Risk & Simulations
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

  // ============================================================
  // 4. ENHANCED SCORING ENGINE
  // ============================================================
  let score = 50;
  let details: string[] = [];
  let confidenceFactors = 0;
  let confidenceTotal = 0;

  // Helper function to add score with confidence tracking
  const addScore = (points: number, reason: string, confidence: number = 1) => {
    score += points;
    details.push(reason);
    confidenceFactors += confidence;
    confidenceTotal++;
  };

  // --- A. NEWS SENTIMENT ---
  score += newsScore;
  if (newsScore >= 10) addScore(0, `📰 Strong Bullish News Sentiment (+${newsScore})`, 0.8);
  else if (newsScore >= 5) addScore(0, `📰 Bullish News Sentiment (+${newsScore})`, 0.6);
  else if (newsScore <= -10) addScore(0, `📰 Strong Bearish News Sentiment (${newsScore})`, 0.8);
  else if (newsScore <= -5) addScore(0, `📰 Bearish News Sentiment (${newsScore})`, 0.6);

  // --- B. FUNDAMENTALS ---
  const pe = quote.trailingPE || 0;
  if (pe > 0 && pe < 15) { addScore(8, "💰 Very Undervalued P/E (<15)", 0.7); }
  else if (pe > 0 && pe < 25) { addScore(5, "💰 Reasonable P/E (<25)", 0.5); }
  else if (pe > 50) { addScore(-8, "⚠️ Overvalued P/E (>50)", 0.7); }

  // --- C. VOLUME ANALYSIS (NEW!) ---
  if (volumeData.volumeSpike) {
    if (change > 0) {
      addScore(10, `📊 Volume Spike (${volumeData.volumeRatio.toFixed(1)}x) with Price Rise`, 0.9);
    } else {
      addScore(-10, `📊 Volume Spike (${volumeData.volumeRatio.toFixed(1)}x) with Price Drop`, 0.9);
    }
  }

  if (volumeData.obvTrend === 'BULLISH') {
    addScore(8, "📈 OBV Trend: Accumulation (Bullish)", 0.7);
  } else if (volumeData.obvTrend === 'BEARISH') {
    addScore(-8, "📉 OBV Trend: Distribution (Bearish)", 0.7);
  }

  if (volumeData.volumeTrend === 'ACCUMULATION') {
    addScore(5, "💹 Smart Money Accumulation Detected", 0.6);
  } else if (volumeData.volumeTrend === 'DISTRIBUTION') {
    addScore(-5, "💸 Distribution Phase Detected", 0.6);
  }

  // VWAP Position
  if (currentPrice > volumeData.vwap * 1.02) {
    addScore(5, `📍 Price Above VWAP (₹${volumeData.vwap.toFixed(2)})`, 0.5);
  } else if (currentPrice < volumeData.vwap * 0.98) {
    addScore(-5, `📍 Price Below VWAP (₹${volumeData.vwap.toFixed(2)})`, 0.5);
  }

  // --- D. VOLATILITY & TREND (NEW!) ---
  // Supertrend Signal
  if (volatilityData.supertrendSignal === 'BUY') {
    addScore(12, `🎯 Supertrend: BUY Signal (ST: ₹${volatilityData.supertrend.toFixed(2)})`, 0.85);
  } else {
    addScore(-12, `🎯 Supertrend: SELL Signal (ST: ₹${volatilityData.supertrend.toFixed(2)})`, 0.85);
  }

  // ADX Trend Strength
  if (volatilityData.trendStrength === 'STRONG') {
    addScore(5, `💪 Strong Trend (ADX: ${volatilityData.adx.toFixed(1)})`, 0.7);
    // Amplify signals in strong trends
    if (volatilityData.plusDI > volatilityData.minusDI) {
      addScore(5, "📈 +DI > -DI: Bullish Momentum", 0.6);
    } else {
      addScore(-5, "📉 -DI > +DI: Bearish Momentum", 0.6);
    }
  } else if (volatilityData.trendStrength === 'NO TREND') {
    addScore(0, `🔄 Sideways Market (ADX: ${volatilityData.adx.toFixed(1)}) - Reduce Position Size`, 0.3);
  }

  // ATR-based stop loss suggestion
  const suggestedStopLoss = currentPrice - (volatilityData.atr * 2);
  details.push(`🛡️ Suggested Stop Loss: ₹${suggestedStopLoss.toFixed(2)} (2x ATR)`);

  // --- E. MARKET CONTEXT ---
  if (risk.marketTrend === 'BULLISH') {
    if (risk.beta > 1.2) { 
      addScore(8, "🐂 High Beta Leader in Bull Market", 0.7); 
    } else if (risk.beta < 0.5) {
      addScore(-3, "🐢 Defensive Stock in Bull Market (Lagging)", 0.4);
    }
  } else if (risk.marketTrend === 'BEARISH') {
    if (risk.beta > 1.2) {
      addScore(-12, "⚠️ High Beta Risk in Bear Market", 0.8);
    } else if (risk.beta < 0.5) {
      addScore(8, "🛡️ Defensive Stock in Bear Market", 0.7);
    }
  }

  // Sharpe Ratio
  if (risk.sharpeRatio > 1.5) {
    addScore(5, `📊 Excellent Risk-Adjusted Returns (Sharpe: ${risk.sharpeRatio.toFixed(2)})`, 0.6);
  } else if (risk.sharpeRatio < 0) {
    addScore(-5, `📊 Poor Risk-Adjusted Returns (Sharpe: ${risk.sharpeRatio.toFixed(2)})`, 0.6);
  }

  // Max Drawdown Warning
  if (risk.maxDrawdownPercent > 30) {
    addScore(-5, `⚠️ High Historical Drawdown (${risk.maxDrawdownPercent.toFixed(1)}%)`, 0.5);
  }

  // Alpha
  if (risk.alpha > 0.15) {
    addScore(5, `🌟 High Alpha (${(risk.alpha * 100).toFixed(1)}% above market)`, 0.6);
  } else if (risk.alpha < -0.1) {
    addScore(-5, `📉 Negative Alpha (${(risk.alpha * 100).toFixed(1)}% below market)`, 0.6);
  }

  // --- F. CHART PATTERNS ---
  if (chartPatterns.includes("Double Bottom (W Pattern)")) { 
    addScore(20, "📈 Double Bottom Pattern Detected", 0.9); 
  }
  if (chartPatterns.includes("Double Top (M Pattern)")) { 
    addScore(-20, "📉 Double Top Pattern Detected", 0.9); 
  }
  if (chartPatterns.some(p => p.includes("Higher Highs"))) { 
    addScore(10, "📈 Uptrend Structure (HH/HL)", 0.8); 
  }
  if (chartPatterns.some(p => p.includes("Lower Lows"))) { 
    addScore(-10, "📉 Downtrend Structure (LH/LL)", 0.8); 
  }
  
  // Support/Resistance Proximity
  const nearSupport = sr.support.some(s => Math.abs(currentPrice - s) / currentPrice < 0.015);
  const nearResistance = sr.resistance.some(r => Math.abs(currentPrice - r) / currentPrice < 0.015);
  
  if (nearSupport) {
    addScore(10, "🟢 Price at Key Support Level", 0.7);
  }
  if (nearResistance) {
    addScore(-10, "🔴 Price at Key Resistance Level", 0.7);
  }

  // --- G. TECHNICAL INDICATORS ---
  // RSI
  if (tech.rsi < 25) { addScore(15, "🔥 RSI Extremely Oversold (<25)", 0.8); }
  else if (tech.rsi < 30) { addScore(10, "📉 RSI Oversold (<30)", 0.7); }
  else if (tech.rsi > 75) { addScore(-15, "🔥 RSI Extremely Overbought (>75)", 0.8); }
  else if (tech.rsi > 70) { addScore(-10, "📈 RSI Overbought (>70)", 0.7); }
  
  // MACD
  if (tech.macd && tech.macd.histogram) {
    const prevHistogram = tech.macd.histogram;
    if (prevHistogram > 0) { 
      addScore(8, "📊 MACD Histogram Positive", 0.6); 
    } else { 
      addScore(-8, "📊 MACD Histogram Negative", 0.6); 
    }
  }

  // SMA Cross
  if (tech.crossSignal === 'GOLDEN') { 
    addScore(20, "✨ GOLDEN CROSS (SMA50 > SMA200)", 0.95); 
  }
  if (tech.crossSignal === 'DEATH') { 
    addScore(-20, "💀 DEATH CROSS (SMA50 < SMA200)", 0.95); 
  }

  // EMA Cross (Short-term)
  if (tech.emaCrossSignal === 'BULLISH') {
    addScore(8, "📈 Short-term EMA Bullish Cross (9 > 21)", 0.6);
  } else if (tech.emaCrossSignal === 'BEARISH') {
    addScore(-8, "📉 Short-term EMA Bearish Cross (9 < 21)", 0.6);
  }

  // Bollinger Bands
  if (tech.bb) {
    if (currentPrice < tech.bb.lower) {
      addScore(8, "📉 Price Below Lower Bollinger Band", 0.7);
    } else if (currentPrice > tech.bb.upper) {
      addScore(-8, "📈 Price Above Upper Bollinger Band", 0.7);
    }
  }

  // Candlestick Patterns
  if (candlePatterns.some(p => p.includes("Bullish Engulfing"))) addScore(10, "🕯️ Bullish Engulfing Pattern", 0.7);
  if (candlePatterns.some(p => p.includes("Hammer"))) addScore(8, "🔨 Hammer Pattern (Reversal)", 0.6);
  if (candlePatterns.some(p => p.includes("Bearish Engulfing"))) addScore(-10, "🕯️ Bearish Engulfing Pattern", 0.7);
  if (candlePatterns.some(p => p.includes("Shooting Star"))) addScore(-8, "💫 Shooting Star Pattern (Reversal)", 0.6);

  // --- H. ADAPTIVE CORRECTIONS ---
  // Backtest Accuracy Adjustment
  if (backtestResult.accuracy < 45) {
    const penalty = (50 - backtestResult.accuracy) / 50; 
    const adjustment = (score - 50) * penalty;
    score = score - adjustment;
    details.push(`⚠️ Score adjusted by ${Math.abs(adjustment).toFixed(0)} pts: Low historical accuracy (${backtestResult.accuracy.toFixed(0)}%)`);
  }

  // ML Prediction Crosscheck
  if (prediction.length > 0) {
    const predictedReturn = (prediction[prediction.length-1].price - currentPrice) / currentPrice;
    if (score > 65 && predictedReturn < -0.03) {
      score -= 12;
      details.push("⚠️ AI Model predicts downtrend - Score reduced");
    } else if (score < 35 && predictedReturn > 0.03) {
      score += 12;
      details.push("🤖 AI Model predicts uptrend - Score boosted");
    }
  }

  // --- I. FINAL BOUNDS & CONFIDENCE ---
  score = Math.min(100, Math.max(0, Math.round(score)));
  
  const confidence = confidenceTotal > 0 
    ? Math.round((confidenceFactors / confidenceTotal) * 100) 
    : 50;

  // --- J. RECOMMENDATION ---
  let recommendation: AnalysisResult['recommendation'] = 'HOLD';
  if (score >= 75) recommendation = 'STRONG BUY';
  else if (score >= 60) recommendation = 'BUY';
  else if (score <= 25) recommendation = 'STRONG SELL';
  else if (score <= 40) recommendation = 'SELL';

  // ============================================================
  // 5. PREPARE HISTORY WITH VOLUME
  // ============================================================
  let slice = -60;
  if (timeframe === '6M') slice = -120;
  if (timeframe === '1Y') slice = -250;

  const allPatterns = [...candlePatterns, ...chartPatterns];

  return {
    symbol,
    price: currentPrice,
    change,
    changePercent,
    recommendation,
    score,
    confidence,
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
      macdHistogram: tech.macd?.histogram || 0,
      bollingerUpper: tech.bb?.upper || 0,
      bollingerLower: tech.bb?.lower || 0,
      sma50: tech.sma50,
      sma200: tech.sma200,
      ema9: tech.ema9,
      ema21: tech.ema21
    },
    levels: {
      support: sr.support,
      resistance: sr.resistance,
      pivot: pivots.pivot,
      r1: pivots.r1,
      s1: pivots.s1
    },
    risk,
    volume: volumeData,
    volatility: volatilityData,
    zigzag,
    history: quotes.slice(slice).map((q: any) => ({
      date: new Date(q.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      price: q.close,
      volume: q.volume
    })),
    backtest: backtestResult,
    prediction 
  };
}

export type { TimeFrame };