// src/lib/ml-regime.ts
// Market Regime Detection for Enhanced ML Forecasting

import { SMA, RSI, ADX } from 'technicalindicators';

export type MarketRegime = 'BULL_TREND' | 'BEAR_TREND' | 'SIDEWAYS' | 'HIGH_VOLATILITY';
export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

export interface RegimeAnalysis {
    marketRegime: MarketRegime;
    volatilityRegime: VolatilityRegime;
    trendStrength: number;          // 0-100
    trendDirection: 'UP' | 'DOWN' | 'FLAT';
    regimeConfidence: number;       // 0-1
    meanReversionProbability: number; // 0-1 (higher = more likely to mean revert)
    trendFollowProbability: number;   // 0-1 (higher = more likely to continue trend)
    recommendedStrategies: string[];
}

/**
 * Detect market regime (bull, bear, sideways, high volatility)
 * Uses multiple indicators for confirmation
 */
export function detectMarketRegime(
    closes: number[],
    highs: number[],
    lows: number[]
): RegimeAnalysis {
    if (closes.length < 50) {
        return getDefaultRegime();
    }

    // 1. Calculate indicators
    const sma20 = SMA.calculate({ values: closes, period: 20 });
    const sma50 = SMA.calculate({ values: closes, period: 50 });
    const sma200 = SMA.calculate({ values: closes, period: 200 });

    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const currentRSI = rsiValues[rsiValues.length - 1] || 50;

    const adxValues = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const currentADX = adxValues.length > 0 ? adxValues[adxValues.length - 1].adx : 20;

    // 2. Calculate volatility
    const volatility = calculateHistoricalVolatility(closes, 20);
    const volatilityPercentile = calculateVolatilityPercentile(closes);

    // 3. Calculate trend metrics
    const currentPrice = closes[closes.length - 1];
    const currentSMA20 = sma20[sma20.length - 1] || currentPrice;
    const currentSMA50 = sma50[sma50.length - 1] || currentPrice;
    const currentSMA200 = sma200.length > 0 ? sma200[sma200.length - 1] : currentPrice;

    // Price position relative to MAs
    const priceAboveSMA20 = currentPrice > currentSMA20;
    const priceAboveSMA50 = currentPrice > currentSMA50;
    const priceAboveSMA200 = currentPrice > currentSMA200;
    const maAlignment = (priceAboveSMA20 ? 1 : 0) + (priceAboveSMA50 ? 1 : 0) + (priceAboveSMA200 ? 1 : 0);

    // MA slope (trend direction)
    const sma20Slope = calculateSlope(sma20.slice(-10));
    const sma50Slope = calculateSlope(sma50.slice(-10));

    // 4. Determine trend direction
    let trendDirection: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    if (sma20Slope > 0.001 && maAlignment >= 2) {
        trendDirection = 'UP';
    } else if (sma20Slope < -0.001 && maAlignment <= 1) {
        trendDirection = 'DOWN';
    }

    // 5. Calculate trend strength (0-100)
    const trendStrength = Math.min(100, Math.max(0,
        (currentADX || 20) * 0.6 +  // ADX contribution (0-60)
        Math.abs(sma20Slope) * 2000 +  // Slope contribution
        (maAlignment === 3 || maAlignment === 0 ? 20 : 5)  // MA alignment bonus
    ));

    // 6. Determine market regime
    let marketRegime: MarketRegime = 'SIDEWAYS';
    let regimeConfidence = 0.5;

    if (volatilityPercentile > 0.85) {
        marketRegime = 'HIGH_VOLATILITY';
        regimeConfidence = volatilityPercentile;
    } else if (currentADX > 25 && trendDirection === 'UP' && maAlignment >= 2) {
        marketRegime = 'BULL_TREND';
        regimeConfidence = Math.min(0.95, (currentADX / 50) + (maAlignment / 4));
    } else if (currentADX > 25 && trendDirection === 'DOWN' && maAlignment <= 1) {
        marketRegime = 'BEAR_TREND';
        regimeConfidence = Math.min(0.95, (currentADX / 50) + ((3 - maAlignment) / 4));
    } else {
        marketRegime = 'SIDEWAYS';
        regimeConfidence = 1 - (currentADX / 50);
    }

    // 7. Determine volatility regime
    let volatilityRegime: VolatilityRegime = 'NORMAL';
    if (volatilityPercentile < 0.2) {
        volatilityRegime = 'LOW';
    } else if (volatilityPercentile > 0.9) {
        volatilityRegime = 'EXTREME';
    } else if (volatilityPercentile > 0.7) {
        volatilityRegime = 'HIGH';
    }

    // 8. Calculate strategy probabilities
    const meanReversionProbability = calculateMeanReversionProbability(
        currentRSI, currentADX, volatilityPercentile
    );
    const trendFollowProbability = 1 - meanReversionProbability;

    // 9. Recommend strategies
    const recommendedStrategies = getRecommendedStrategies(
        marketRegime, volatilityRegime, trendStrength
    );

    return {
        marketRegime,
        volatilityRegime,
        trendStrength,
        trendDirection,
        regimeConfidence,
        meanReversionProbability,
        trendFollowProbability,
        recommendedStrategies
    };
}

/**
 * Calculate historical volatility using standard deviation of returns
 */
function calculateHistoricalVolatility(closes: number[], period: number = 20): number {
    if (closes.length < period + 1) return 0.02; // Default 2%

    const returns: number[] = [];
    for (let i = closes.length - period; i < closes.length; i++) {
        if (i > 0) {
            returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        }
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const dailyVol = Math.sqrt(variance);

    return dailyVol * Math.sqrt(252); // Annualized
}

/**
 * Calculate volatility percentile (where current vol stands vs history)
 */
function calculateVolatilityPercentile(closes: number[]): number {
    if (closes.length < 100) return 0.5;

    const currentVol = calculateHistoricalVolatility(closes, 20);

    // Calculate rolling volatilities
    const vols: number[] = [];
    for (let i = 60; i < closes.length; i++) {
        const slice = closes.slice(i - 60, i);
        vols.push(calculateHistoricalVolatility(slice, 20));
    }

    if (vols.length === 0) return 0.5;

    // Calculate percentile
    const belowCount = vols.filter(v => v < currentVol).length;
    return belowCount / vols.length;
}

/**
 * Calculate slope of a series (normalized by mean)
 */
function calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;

    let sumXY = 0, sumX = 0, sumY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumXY += i * values[i];
        sumX += i;
        sumY += values[i];
        sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope / mean; // Normalize by mean
}

/**
 * Calculate probability that price will mean revert
 */
function calculateMeanReversionProbability(
    rsi: number,
    adx: number,
    volatilityPercentile: number
): number {
    let probability = 0.5;

    // RSI extremes suggest mean reversion
    if (rsi < 30 || rsi > 70) {
        probability += 0.2;
    }
    if (rsi < 20 || rsi > 80) {
        probability += 0.15;
    }

    // Low ADX (weak trend) suggests mean reversion
    if (adx < 20) {
        probability += 0.15;
    } else if (adx > 40) {
        probability -= 0.2; // Strong trend = less likely to revert
    }

    // High volatility sometimes leads to mean reversion
    if (volatilityPercentile > 0.8) {
        probability += 0.1;
    }

    return Math.min(0.9, Math.max(0.1, probability));
}

/**
 * Get recommended strategies based on regime
 */
function getRecommendedStrategies(
    regime: MarketRegime,
    volRegime: VolatilityRegime,
    trendStrength: number
): string[] {
    const strategies: string[] = [];

    switch (regime) {
        case 'BULL_TREND':
            strategies.push('📈 Follow the trend - buy dips');
            if (trendStrength > 50) {
                strategies.push('🎯 Use trailing stops to lock in gains');
            }
            break;
        case 'BEAR_TREND':
            strategies.push('📉 Avoid new longs');
            strategies.push('⚠️ Consider defensive positions');
            break;
        case 'SIDEWAYS':
            strategies.push('↔️ Range trading - buy support, sell resistance');
            strategies.push('🔄 Mean reversion strategies may work');
            break;
        case 'HIGH_VOLATILITY':
            strategies.push('⚡ Reduce position sizes');
            strategies.push('🛡️ Widen stops to avoid whipsaws');
            break;
    }

    if (volRegime === 'LOW') {
        strategies.push('💤 Low volatility - breakout may be coming');
    }

    return strategies;
}

/**
 * Default regime when insufficient data
 */
function getDefaultRegime(): RegimeAnalysis {
    return {
        marketRegime: 'SIDEWAYS',
        volatilityRegime: 'NORMAL',
        trendStrength: 30,
        trendDirection: 'FLAT',
        regimeConfidence: 0.3,
        meanReversionProbability: 0.5,
        trendFollowProbability: 0.5,
        recommendedStrategies: ['⚠️ Insufficient data for regime analysis']
    };
}

/**
 * Get optimal model weights based on market regime
 * This is used by the ensemble predictor to adjust weights
 */
export function getModelWeightsForRegime(
    regime: MarketRegime,
    volatilityRegime: VolatilityRegime
): { linear: number; polynomial: number; exponential: number; momentum: number } {
    switch (regime) {
        case 'BULL_TREND':
            return { linear: 0.35, polynomial: 0.15, exponential: 0.25, momentum: 0.25 };
        case 'BEAR_TREND':
            return { linear: 0.30, polynomial: 0.15, exponential: 0.30, momentum: 0.25 };
        case 'SIDEWAYS':
            // Mean reversion works better in sideways markets
            return { linear: 0.20, polynomial: 0.30, exponential: 0.30, momentum: 0.20 };
        case 'HIGH_VOLATILITY':
            // Reduce momentum weight in high vol, increase dampening
            return { linear: 0.35, polynomial: 0.20, exponential: 0.35, momentum: 0.10 };
        default:
            return { linear: 0.25, polynomial: 0.25, exponential: 0.25, momentum: 0.25 };
    }
}
