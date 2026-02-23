// src/lib/reconciliation.ts
// Score Reconciliation Engine - Unifies technical, sentiment, and prediction signals

import { AISentimentResult } from './types';
import { RegimeAnalysis } from './ml-regime';
import { MarketContext } from './market-context';

export interface ReconciledScore {
    finalScore: number;              // 0-100
    technicalContribution: number;   // Points from technicals
    aiContribution: number;          // Points from AI sentiment
    predictionContribution: number;  // Points from ML prediction
    marketContextContribution: number; // Points from market context

    signalAlignment: 'ALIGNED' | 'MIXED' | 'CONFLICTING';
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceScore: number;         // 0-100

    signals: {
        technical: 'BUY' | 'HOLD' | 'SELL';
        sentiment: 'BUY' | 'HOLD' | 'SELL';
        prediction: 'BUY' | 'HOLD' | 'SELL';
        market: 'BUY' | 'HOLD' | 'SELL';
    };

    conflictDetails?: string[];      // Details about conflicting signals
    explanation: string;             // Human-readable reasoning
}

export interface ReconciliationInput {
    technicalScore: number;          // 0-100 technical score
    aiSentiment: AISentimentResult;
    prediction: { price: number }[]; // ML predictions
    currentPrice: number;
    marketContext?: MarketContext;
    regime?: RegimeAnalysis;
    timeframe: string;
}

/**
 * Reconcile different analysis signals into a unified score
 * This is the core logic that prevents conflicting recommendations
 */
export function reconcileScores(input: ReconciliationInput): ReconciledScore {
    const {
        technicalScore,
        aiSentiment,
        prediction,
        currentPrice,
        marketContext,
        regime,
        timeframe
    } = input;

    // 1. Determine individual signals
    const signals = {
        technical: getSignalFromScore(technicalScore),
        sentiment: getSignalFromSentiment(aiSentiment),
        prediction: getSignalFromPrediction(prediction, currentPrice),
        market: marketContext ? getSignalFromMarketContext(marketContext) : 'HOLD' as const
    };

    // 2. Calculate signal alignment
    const { alignment, conflictDetails } = analyzeAlignment(signals);

    // 3. Calculate contributions with timeframe-aware weighting
    const weights = getTimeframeWeights(timeframe, regime);

    // Technical contribution (normalized from 0-100 to 0-40 points)
    const technicalContribution = ((technicalScore - 50) / 50) * weights.technical * 40;

    // AI sentiment contribution (-10 to +10 scaled to -15 to +15)
    const aiContribution = aiSentiment.overallScore * weights.sentiment * 1.5;

    // Prediction contribution
    const predictionContribution = calculatePredictionContribution(
        prediction, currentPrice, weights.prediction
    );

    // Market context contribution
    const marketContextContribution = marketContext
        ? calculateMarketContextContribution(marketContext, weights.market)
        : 0;

    // 4. Calculate base score
    let baseScore = 50 + technicalContribution + aiContribution +
        predictionContribution + marketContextContribution;

    // 5. Apply alignment adjustment
    const alignmentAdjustment = getAlignmentAdjustment(alignment, baseScore);
    const adjustedScore = baseScore + alignmentAdjustment;

    // 6. Calculate confidence
    const { confidenceLevel, confidenceScore } = calculateConfidence(
        alignment, aiSentiment.confidence, regime, signals
    );

    // 7. Clamp final score
    const finalScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));

    // 8. Generate explanation
    const explanation = generateExplanation(
        signals, alignment, finalScore, conflictDetails
    );

    return {
        finalScore,
        technicalContribution: Math.round(technicalContribution * 10) / 10,
        aiContribution: Math.round(aiContribution * 10) / 10,
        predictionContribution: Math.round(predictionContribution * 10) / 10,
        marketContextContribution: Math.round(marketContextContribution * 10) / 10,
        signalAlignment: alignment,
        confidenceLevel,
        confidenceScore,
        signals,
        conflictDetails: alignment === 'CONFLICTING' ? conflictDetails : undefined,
        explanation
    };
}

/**
 * Convert numeric score to signal
 */
function getSignalFromScore(score: number): 'BUY' | 'HOLD' | 'SELL' {
    if (score >= 65) return 'BUY';
    if (score <= 35) return 'SELL';
    return 'HOLD';
}

/**
 * Convert AI sentiment to signal
 */
function getSignalFromSentiment(sentiment: AISentimentResult): 'BUY' | 'HOLD' | 'SELL' {
    if (sentiment.overallScore >= 4) return 'BUY';
    if (sentiment.overallScore <= -4) return 'SELL';
    return 'HOLD';
}

/**
 * Convert prediction to signal
 */
function getSignalFromPrediction(
    prediction: { price: number }[],
    currentPrice: number
): 'BUY' | 'HOLD' | 'SELL' {
    if (prediction.length === 0) return 'HOLD';

    const finalPrediction = prediction[prediction.length - 1].price;
    const expectedReturn = (finalPrediction - currentPrice) / currentPrice;

    if (expectedReturn > 0.03) return 'BUY';      // >3% expected
    if (expectedReturn < -0.03) return 'SELL';    // <-3% expected
    return 'HOLD';
}

/**
 * Convert market context to signal
 */
function getSignalFromMarketContext(context: MarketContext): 'BUY' | 'HOLD' | 'SELL' {
    if (context.niftyTrend === 'BULLISH' && context.riskEnvironment === 'RISK_ON') {
        return 'BUY';
    }
    if (context.niftyTrend === 'BEARISH' && context.riskEnvironment === 'RISK_OFF') {
        return 'SELL';
    }
    return 'HOLD';
}

/**
 * Analyze signal alignment
 */
function analyzeAlignment(signals: {
    technical: 'BUY' | 'HOLD' | 'SELL';
    sentiment: 'BUY' | 'HOLD' | 'SELL';
    prediction: 'BUY' | 'HOLD' | 'SELL';
    market: 'BUY' | 'HOLD' | 'SELL';
}): { alignment: 'ALIGNED' | 'MIXED' | 'CONFLICTING'; conflictDetails: string[] } {
    const signalValues = Object.values(signals);
    const buyCount = signalValues.filter(s => s === 'BUY').length;
    const sellCount = signalValues.filter(s => s === 'SELL').length;
    const holdCount = signalValues.filter(s => s === 'HOLD').length;

    const conflictDetails: string[] = [];

    // Check for direct conflicts
    if (buyCount > 0 && sellCount > 0) {
        if (signals.technical === 'BUY' && signals.prediction === 'SELL') {
            conflictDetails.push('Technical bullish but ML predicts decline');
        }
        if (signals.technical === 'SELL' && signals.prediction === 'BUY') {
            conflictDetails.push('Technical bearish but ML predicts rise');
        }
        if (signals.sentiment === 'BUY' && signals.technical === 'SELL') {
            conflictDetails.push('Positive news but weak technicals');
        }
        if (signals.sentiment === 'SELL' && signals.technical === 'BUY') {
            conflictDetails.push('Negative news despite strong technicals');
        }
        return { alignment: 'CONFLICTING', conflictDetails };
    }

    // Strong alignment
    if (buyCount >= 3 || sellCount >= 3) {
        return { alignment: 'ALIGNED', conflictDetails: [] };
    }

    // Moderate alignment (2 agree, others are HOLD)
    if ((buyCount === 2 && sellCount === 0) || (sellCount === 2 && buyCount === 0)) {
        return { alignment: 'ALIGNED', conflictDetails: [] };
    }

    // Mixed signals (but no direct conflict)
    return { alignment: 'MIXED', conflictDetails: ['Signals are mixed but not directly conflicting'] };
}

/**
 * Get timeframe-aware weights
 */
function getTimeframeWeights(
    timeframe: string,
    regime?: RegimeAnalysis
): { technical: number; sentiment: number; prediction: number; market: number } {
    // Base weights by timeframe
    let weights = { technical: 0.35, sentiment: 0.25, prediction: 0.25, market: 0.15 };

    switch (timeframe) {
        case '1W': // Short-term: favor momentum and sentiment
            weights = { technical: 0.30, sentiment: 0.35, prediction: 0.25, market: 0.10 };
            break;
        case '1M': // Swing: balanced
            weights = { technical: 0.35, sentiment: 0.25, prediction: 0.25, market: 0.15 };
            break;
        case '3M':
        case '6M': // Medium-term: favor technicals and prediction
            weights = { technical: 0.40, sentiment: 0.20, prediction: 0.25, market: 0.15 };
            break;
        case '1Y': // Long-term: favor market context and technicals
            weights = { technical: 0.35, sentiment: 0.15, prediction: 0.25, market: 0.25 };
            break;
    }

    // Regime adjustments
    if (regime) {
        if (regime.marketRegime === 'HIGH_VOLATILITY') {
            // In high volatility, reduce prediction weight (less reliable)
            weights.prediction *= 0.7;
            weights.technical *= 1.15;
        } else if (regime.marketRegime === 'SIDEWAYS') {
            // In sideways, reduce momentum/prediction weight
            weights.prediction *= 0.8;
            weights.sentiment *= 1.2;
        }
    }

    // Normalize weights to sum to 1
    const sum = weights.technical + weights.sentiment + weights.prediction + weights.market;
    return {
        technical: weights.technical / sum,
        sentiment: weights.sentiment / sum,
        prediction: weights.prediction / sum,
        market: weights.market / sum
    };
}

/**
 * Calculate prediction contribution to score
 */
function calculatePredictionContribution(
    prediction: { price: number }[],
    currentPrice: number,
    weight: number
): number {
    if (prediction.length === 0) return 0;

    const finalPrediction = prediction[prediction.length - 1].price;
    const expectedReturn = ((finalPrediction - currentPrice) / currentPrice) * 100;

    // Scale: ±5% return = ±10 points
    const baseContribution = Math.max(-10, Math.min(10, expectedReturn * 2));

    return baseContribution * weight * 2;
}

/**
 * Calculate market context contribution
 */
function calculateMarketContextContribution(
    context: MarketContext,
    weight: number
): number {
    let contribution = 0;

    // Nifty trend
    if (context.niftyTrend === 'BULLISH') contribution += 3;
    else if (context.niftyTrend === 'BEARISH') contribution -= 3;

    // Relative strength
    contribution += Math.max(-3, Math.min(3, context.relativeStrength / 2));

    // Risk environment
    if (context.riskEnvironment === 'RISK_ON') contribution += 2;
    else if (context.riskEnvironment === 'RISK_OFF') contribution -= 2;

    return contribution * weight * 2;
}

/**
 * Get alignment adjustment
 */
function getAlignmentAdjustment(
    alignment: 'ALIGNED' | 'MIXED' | 'CONFLICTING',
    baseScore: number
): number {
    switch (alignment) {
        case 'ALIGNED':
            // Boost score slightly when aligned
            return baseScore > 50 ? 3 : baseScore < 50 ? -3 : 0;
        case 'CONFLICTING':
            // Pull toward neutral when conflicting
            return baseScore > 50 ? -5 : baseScore < 50 ? 5 : 0;
        case 'MIXED':
            return 0;
        default:
            return 0;
    }
}

/**
 * Calculate confidence level
 */
function calculateConfidence(
    alignment: 'ALIGNED' | 'MIXED' | 'CONFLICTING',
    aiConfidence: number,
    regime: RegimeAnalysis | undefined,
    signals: {
        technical: 'BUY' | 'HOLD' | 'SELL';
        sentiment: 'BUY' | 'HOLD' | 'SELL';
        prediction: 'BUY' | 'HOLD' | 'SELL';
        market: 'BUY' | 'HOLD' | 'SELL';
    }
): { confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'; confidenceScore: number } {
    let score = 50;

    // Alignment impact
    if (alignment === 'ALIGNED') score += 25;
    else if (alignment === 'CONFLICTING') score -= 25;

    // AI confidence impact
    score += (aiConfidence - 0.5) * 20;

    // Regime confidence impact
    if (regime) {
        score += (regime.regimeConfidence - 0.5) * 15;
    }

    // Non-HOLD signals boost confidence
    const nonHoldCount = Object.values(signals).filter(s => s !== 'HOLD').length;
    score += nonHoldCount * 3;

    // Clamp and round
    const confidenceScore = Math.max(10, Math.min(95, Math.round(score)));

    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (confidenceScore >= 70) confidenceLevel = 'HIGH';
    else if (confidenceScore <= 40) confidenceLevel = 'LOW';

    return { confidenceLevel, confidenceScore };
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(
    signals: {
        technical: 'BUY' | 'HOLD' | 'SELL';
        sentiment: 'BUY' | 'HOLD' | 'SELL';
        prediction: 'BUY' | 'HOLD' | 'SELL';
        market: 'BUY' | 'HOLD' | 'SELL';
    },
    alignment: 'ALIGNED' | 'MIXED' | 'CONFLICTING',
    finalScore: number,
    conflicts: string[]
): string {
    const parts: string[] = [];

    // Direction summary
    if (finalScore >= 70) parts.push('Strong bullish outlook');
    else if (finalScore >= 60) parts.push('Moderately bullish');
    else if (finalScore <= 30) parts.push('Strong bearish outlook');
    else if (finalScore <= 40) parts.push('Moderately bearish');
    else parts.push('Neutral stance');

    // Signal summary
    const signalSummary = [];
    if (signals.technical !== 'HOLD') signalSummary.push(`technicals ${signals.technical}`);
    if (signals.sentiment !== 'HOLD') signalSummary.push(`sentiment ${signals.sentiment}`);
    if (signals.prediction !== 'HOLD') signalSummary.push(`ML ${signals.prediction}`);
    if (signals.market !== 'HOLD') signalSummary.push(`market ${signals.market}`);

    if (signalSummary.length > 0) {
        parts.push(`(${signalSummary.join(', ')})`);
    }

    // Conflict warning
    if (alignment === 'CONFLICTING' && conflicts.length > 0) {
        parts.push(`⚠️ ${conflicts[0]}`);
    }

    return parts.join(' - ');
}
