// src/lib/ml.ts

import { SMA, EMA, RSI } from 'technicalindicators';
import { detectMarketRegime, getModelWeightsForRegime, RegimeAnalysis } from './ml-regime';

export interface PredictionPoint {
  date: string;
  price: number;
  upper: number;
  lower: number;
  isFuture: boolean;
}

export interface MLPrediction {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  predictedReturn: number;
  targetPrice: number;
  stopLoss: number;
  riskReward: number;
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  signals: string[];
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate Linear Regression with Safety Checks
 */
function linearRegression(data: number[]) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }

  const denominator = (n * sumXX - sumX * sumX);

  if (denominator === 0) {
    return { slope: 0, intercept: data[n - 1] || 0, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared for confidence
  const yMean = sumY / n;
  let ssTotal = 0, ssResidual = 0;

  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssTotal += Math.pow(data[i] - yMean, 2);
    ssResidual += Math.pow(data[i] - predicted, 2);
  }

  const r2 = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

  return { slope, intercept, r2 };
}

/**
 * Calculate Logarithmic Regression
 */
function logRegression(data: number[]) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = Math.log(i + 1);
    const y = data[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = (n * sumXX - sumX * sumX);

  if (denominator === 0) {
    return { slope: 0, intercept: data[n - 1] || 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calculate Exponential Smoothing Forecast
 */
function exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
  if (data.length === 0) return [];

  const smoothed = [data[0]];

  for (let i = 1; i < data.length; i++) {
    smoothed.push(alpha * data[i] + (1 - alpha) * smoothed[i - 1]);
  }

  return smoothed;
}

/**
 * Calculate Standard Deviation
 */
function calculateStdDev(data: number[]): number {
  const n = data.length;
  if (n === 0) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / n;
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;

  return Math.sqrt(variance);
}

/**
 * Detect Trend using Multiple Methods
 */
function detectTrend(prices: number[]): { trend: 'UP' | 'DOWN' | 'SIDEWAYS'; strength: number } {
  if (prices.length < 20) {
    return { trend: 'SIDEWAYS', strength: 0 };
  }

  // Method 1: Linear Regression Slope
  const lr = linearRegression(prices);
  const slopePercent = (lr.slope / prices[prices.length - 1]) * 100;

  // Method 2: Price vs SMA
  const sma20 = SMA.calculate({ values: prices, period: 20 });
  const currentPrice = prices[prices.length - 1];
  const currentSMA = sma20[sma20.length - 1] || currentPrice;
  const priceVsSMA = ((currentPrice - currentSMA) / currentSMA) * 100;

  // Method 3: Higher Highs / Lower Lows
  const recentPrices = prices.slice(-20);
  const firstHalf = recentPrices.slice(0, 10);
  const secondHalf = recentPrices.slice(10);
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const halfChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  // Combine signals
  let upScore = 0;
  let downScore = 0;

  if (slopePercent > 0.1) upScore += 2;
  else if (slopePercent < -0.1) downScore += 2;

  if (priceVsSMA > 2) upScore += 1;
  else if (priceVsSMA < -2) downScore += 1;

  if (halfChange > 2) upScore += 1;
  else if (halfChange < -2) downScore += 1;

  // Determine trend
  let trend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
  let strength = 0;

  if (upScore >= 3) {
    trend = 'UP';
    strength = Math.min(100, upScore * 25);
  } else if (downScore >= 3) {
    trend = 'DOWN';
    strength = Math.min(100, downScore * 25);
  } else if (upScore > downScore) {
    trend = 'UP';
    strength = upScore * 20;
  } else if (downScore > upScore) {
    trend = 'DOWN';
    strength = downScore * 20;
  }

  return { trend, strength };
}

// ============================================================
// MAIN PREDICTION FUNCTION (Enhanced for Phase 2)
// ============================================================

export function predictFutureTrends(
  history: { date: string; price: number }[],
  timeframe: string
): PredictionPoint[] {
  // 1. DYNAMIC SETTINGS BASED ON TIMEFRAME
  let lookback = 50;
  let forecastDays = 14;

  switch (timeframe) {
    case '1W':
      lookback = 30;
      forecastDays = 5;
      break;
    case '1M':
      lookback = 60;
      forecastDays = 10;
      break;
    case '3M':
      lookback = 90;
      forecastDays = 20;
      break;
    case '6M':
    case '1Y':
      lookback = 200;
      forecastDays = 45;
      break;
  }

  // Slice data to respect the lookback window
  const data = history.slice(-lookback);
  const prices = data.map(d => d.price);
  const n = prices.length;

  // Insufficient data check
  if (n < 10) return [];

  // 2. TREND DETECTION
  const trendInfo = detectTrend(prices);

  // 3. ENSEMBLE MODELING

  // Model A: Linear Regression (Baseline Trend)
  const lin = linearRegression(prices);

  // Model B: Logarithmic (Curved Trend for growth stocks)
  const log = logRegression(prices);

  // Model C: Exponential Smoothing (Recent momentum)
  const smoothed = exponentialSmoothing(prices, 0.3);
  const smoothedSlope = smoothed.length >= 2
    ? (smoothed[smoothed.length - 1] - smoothed[smoothed.length - 2])
    : 0;

  // Model D: Short-term Momentum (Last 10 days)
  const shortTerm = linearRegression(prices.slice(-10));

  // Model E: Medium-term Trend (Last 30 days)
  const mediumTerm = prices.length >= 30
    ? linearRegression(prices.slice(-30))
    : lin;

  // 4. VOLATILITY CALCULATION
  const returns = [];
  for (let i = 1; i < n; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const returnStdDev = calculateStdDev(returns);
  const priceStdDev = returnStdDev * prices[n - 1];

  // 5. CONFIDENCE CALCULATION
  const rSquared = Math.max(0, lin.r2);
  const trendConfidence = trendInfo.strength / 100;
  const overallConfidence = (rSquared * 0.4 + trendConfidence * 0.6);

  // 6. REGIME-AWARE WEIGHT ADJUSTMENT
  // Use regime detection if we have high/low data, otherwise fall back to trend-based
  let linearWeight = 0.35;
  let logWeight = 0.25;
  let smoothWeight = 0.2;
  let momentumWeight = 0.2;

  // Note: We don't have highs/lows here, so use simplified regime detection based on trend
  // The full regime detection is available via detectMarketRegime when called with OHLC data
  if (trendInfo.trend === 'UP' && trendInfo.strength > 60) {
    // Strong uptrend: favor momentum and linear
    linearWeight = 0.35;
    momentumWeight = 0.30;
    logWeight = 0.20;
    smoothWeight = 0.15;
  } else if (trendInfo.trend === 'DOWN' && trendInfo.strength > 60) {
    // Strong downtrend: favor linear and exponential decay
    linearWeight = 0.40;
    momentumWeight = 0.25;
    smoothWeight = 0.25;
    logWeight = 0.10;
  } else if (trendInfo.trend === 'SIDEWAYS' || trendInfo.strength < 30) {
    // Sideways/weak trend: mean reversion, reduce momentum
    linearWeight = 0.30;
    smoothWeight = 0.35;
    logWeight = 0.25;
    momentumWeight = 0.10;
  } else if (trendInfo.trend === 'UP') {
    // Moderate uptrend
    linearWeight = 0.30;
    momentumWeight = 0.25;
    logWeight = 0.25;
    smoothWeight = 0.20;
  } else {
    // Moderate downtrend
    linearWeight = 0.35;
    smoothWeight = 0.25;
    momentumWeight = 0.25;
    logWeight = 0.15;
  }

  // 7. GENERATE FORECAST
  const predictions: PredictionPoint[] = [];
  const lastDate = new Date(data[n - 1].date);
  const lastPrice = prices[n - 1];

  for (let i = 1; i <= forecastDays; i++) {
    const futureIdx = n - 1 + i;

    // Calculate projections from each model
    const predLin = lin.slope * futureIdx + lin.intercept;
    const predLog = log.slope * Math.log(futureIdx + 1) + log.intercept;

    // Smoothed projection with decay
    const decay = Math.max(0.3, 1 - (i * 0.03));
    const predSmooth = lastPrice + (smoothedSlope * i * decay);

    // Momentum projection (also with decay)
    const momDecay = Math.max(0.2, 1 - (i * 0.05));
    const predMom = lastPrice + (shortTerm.slope * i * momDecay);

    // WEIGHTED ENSEMBLE
    const rawPrice = (
      predLin * linearWeight +
      predLog * logWeight +
      predSmooth * smoothWeight +
      predMom * momentumWeight
    );

    // Apply mean reversion for extreme predictions
    const maxChange = lastPrice * 0.3; // Max 30% change
    let finalPrice = rawPrice;
    if (Math.abs(rawPrice - lastPrice) > maxChange) {
      finalPrice = lastPrice + (rawPrice > lastPrice ? maxChange : -maxChange);
    }

    // Ensure price is positive
    finalPrice = Math.max(finalPrice, lastPrice * 0.5);

    // CONFIDENCE CONE CALCULATION
    // Uncertainty grows with square root of time
    const timeUncertainty = Math.sqrt(i);
    const baseUncertainty = priceStdDev * timeUncertainty;

    // Adjust cone based on overall confidence
    const confidenceMultiplier = 2 - overallConfidence; // Lower confidence = wider cone
    const uncertainty = baseUncertainty * confidenceMultiplier * 1.5;

    // Generate date
    const futureDate = new Date(lastDate);
    futureDate.setDate(lastDate.getDate() + i);

    // Skip weekends for more realistic dates
    while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
      futureDate.setDate(futureDate.getDate() + 1);
    }

    predictions.push({
      date: futureDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      price: Math.round(finalPrice * 100) / 100,
      upper: Math.round((finalPrice + uncertainty) * 100) / 100,
      lower: Math.round(Math.max(0, finalPrice - uncertainty) * 100) / 100,
      isFuture: true
    });
  }

  return predictions;
}

// ============================================================
// ENHANCED ML PREDICTION (Phase 2 - New Function)
// ============================================================

export function generateMLPrediction(
  history: { date: string; price: number }[],
  timeframe: string,
  currentATR: number
): MLPrediction {
  const prices = history.map(h => h.price);
  const n = prices.length;

  if (n < 30) {
    return {
      direction: 'NEUTRAL',
      confidence: 0,
      predictedReturn: 0,
      targetPrice: prices[n - 1] || 0,
      stopLoss: prices[n - 1] || 0,
      riskReward: 0,
      trendStrength: 'WEAK',
      signals: ['Insufficient data for prediction']
    };
  }

  const currentPrice = prices[n - 1];
  const signals: string[] = [];

  // 1. TREND ANALYSIS
  const trendInfo = detectTrend(prices);

  // 2. MULTIPLE TIMEFRAME ANALYSIS
  const shortTermLR = linearRegression(prices.slice(-10));
  const mediumTermLR = linearRegression(prices.slice(-30));
  const longTermLR = n >= 60 ? linearRegression(prices.slice(-60)) : mediumTermLR;

  // 3. RSI ANALYSIS
  const rsiValues = RSI.calculate({ values: prices, period: 14 });
  const currentRSI = rsiValues[rsiValues.length - 1] || 50;

  // 4. MOMENTUM SCORE
  let momentumScore = 0;

  // Short-term momentum
  if (shortTermLR.slope > 0) {
    momentumScore += 2;
    signals.push('Short-term trend positive');
  } else {
    momentumScore -= 2;
    signals.push('Short-term trend negative');
  }

  // Medium-term trend
  if (mediumTermLR.slope > 0) {
    momentumScore += 2;
    signals.push('Medium-term trend positive');
  } else {
    momentumScore -= 2;
    signals.push('Medium-term trend negative');
  }

  // Long-term trend
  if (longTermLR.slope > 0) {
    momentumScore += 1;
  } else {
    momentumScore -= 1;
  }

  // RSI signals
  if (currentRSI < 30) {
    momentumScore += 2;
    signals.push('RSI oversold - potential bounce');
  } else if (currentRSI > 70) {
    momentumScore -= 2;
    signals.push('RSI overbought - potential pullback');
  }

  // Trend alignment bonus
  if (shortTermLR.slope > 0 && mediumTermLR.slope > 0 && longTermLR.slope > 0) {
    momentumScore += 2;
    signals.push('All timeframes aligned bullish');
  } else if (shortTermLR.slope < 0 && mediumTermLR.slope < 0 && longTermLR.slope < 0) {
    momentumScore -= 2;
    signals.push('All timeframes aligned bearish');
  }

  // 5. DIRECTION & CONFIDENCE
  let direction: MLPrediction['direction'] = 'NEUTRAL';
  if (momentumScore >= 3) direction = 'BULLISH';
  else if (momentumScore <= -3) direction = 'BEARISH';

  // Confidence based on R-squared and signal strength
  const avgR2 = (shortTermLR.r2 + mediumTermLR.r2) / 2;
  const signalStrength = Math.min(100, Math.abs(momentumScore) * 12);
  const confidence = Math.round((avgR2 * 50) + (signalStrength * 0.5));

  // 6. TARGET PRICE CALCULATION
  let daysToProject = 10;
  switch (timeframe) {
    case '1W': daysToProject = 5; break;
    case '1M': daysToProject = 10; break;
    case '3M': daysToProject = 20; break;
    case '6M':
    case '1Y': daysToProject = 30; break;
  }

  // Use weighted average of slopes for projection
  const weightedSlope = (
    shortTermLR.slope * 0.5 +
    mediumTermLR.slope * 0.35 +
    longTermLR.slope * 0.15
  );

  const rawTarget = currentPrice + (weightedSlope * daysToProject);

  // Apply dampening for extreme projections
  const maxMove = currentPrice * 0.20; // Max 20% move
  let targetPrice = rawTarget;
  if (Math.abs(rawTarget - currentPrice) > maxMove) {
    targetPrice = currentPrice + (rawTarget > currentPrice ? maxMove : -maxMove);
  }

  // 7. STOP LOSS CALCULATION (2x ATR)
  const stopLoss = direction === 'BULLISH'
    ? currentPrice - (currentATR * 2)
    : currentPrice + (currentATR * 2);

  // 8. RISK/REWARD RATIO
  const potentialProfit = Math.abs(targetPrice - currentPrice);
  const potentialLoss = Math.abs(currentPrice - stopLoss);
  const riskReward = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;

  // 9. PREDICTED RETURN
  const predictedReturn = ((targetPrice - currentPrice) / currentPrice) * 100;

  // 10. TREND STRENGTH
  let trendStrength: MLPrediction['trendStrength'] = 'WEAK';
  if (trendInfo.strength >= 70) trendStrength = 'STRONG';
  else if (trendInfo.strength >= 40) trendStrength = 'MODERATE';

  return {
    direction,
    confidence: Math.min(100, Math.max(0, confidence)),
    predictedReturn: Math.round(predictedReturn * 100) / 100,
    targetPrice: Math.round(targetPrice * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100,
    trendStrength,
    signals
  };
}