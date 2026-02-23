// src/lib/signals/generator.ts
// Signal Generator - Creates trade signals from analysis results
// V2: ATR-based targets, calibrated thresholds, regime filter, score weighting

import { SignalGenerationResult } from './types';

export interface AnalysisInput {
  symbol: string;
  stock_name?: string;
  price: number;
  score: number;
  confidence?: number;
  details: string[];
  recommendation: string;
  timeframe: string;
  risk?: {
    volatility?: number;
    beta?: number;
    marketTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    atr?: number;  // Average True Range for precise targets
  };
  technicals?: {
    rsi?: number;
    adx?: number;
    trend?: string;
  };
}

// Calibrated thresholds based on typical backtest performance
const CONFIG = {
  // Score thresholds - calibrated to match backtest signals
  STRONG_BUY_SCORE: 75,     // High confidence buy
  MIN_BUY_SCORE: 65,        // Minimum for buy signal
  MAX_SELL_SCORE: 35,       // Maximum for sell signal
  STRONG_SELL_SCORE: 25,    // High confidence sell
  
  // Confidence thresholds
  MIN_CONFIDENCE: 0.50,     // Minimum confidence to generate any signal
  HIGH_CONFIDENCE: 0.70,    // High confidence threshold
  
  // ATR multipliers for stop-loss and target
  ATR_SL_MULTIPLIER: 1.5,   // Stop-loss = Entry ± (ATR × 1.5)
  ATR_TARGET_MULTIPLIER: 2.5, // Target = Entry ± (ATR × 2.5)
  
  // Fallback percentages when ATR not available
  FALLBACK_TARGET_PCT: 3.0,
  FALLBACK_SL_PCT: 1.5,
  
  // Score-based adjustments
  SCORE_WEIGHT_MULTIPLIER: 0.02, // Per point above/below threshold
  
  // Minimum risk-reward ratio
  MIN_RISK_REWARD: 1.5,
};

/**
 * Check market regime compatibility with signal direction
 */
function isRegimeCompatible(
  signalType: 'BUY' | 'SELL',
  marketTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  adx?: number
): { compatible: boolean; strength: 'STRONG' | 'MODERATE' | 'WEAK' } {
  // If no trend data, assume compatible but weak
  if (!marketTrend) {
    return { compatible: true, strength: 'WEAK' };
  }
  
  // Strong trend (ADX > 25) in same direction = STRONG
  // Weak trend (ADX < 20) = allow counter-trend
  const isTrending = adx && adx > 25;
  const isWeakTrend = !adx || adx < 20;
  
  if (signalType === 'BUY') {
    if (marketTrend === 'BULLISH') {
      return { compatible: true, strength: isTrending ? 'STRONG' : 'MODERATE' };
    } else if (marketTrend === 'BEARISH') {
      // Counter-trend buy - only allow if weak trend
      return { compatible: isWeakTrend, strength: 'WEAK' };
    }
    return { compatible: true, strength: 'MODERATE' };
  } else {
    if (marketTrend === 'BEARISH') {
      return { compatible: true, strength: isTrending ? 'STRONG' : 'MODERATE' };
    } else if (marketTrend === 'BULLISH') {
      // Counter-trend sell - only allow if weak trend
      return { compatible: isWeakTrend, strength: 'WEAK' };
    }
    return { compatible: true, strength: 'MODERATE' };
  }
}

/**
 * Calculate ATR-based target and stop-loss
 */
function calculateATRLevels(
  price: number,
  signalType: 'BUY' | 'SELL',
  atr?: number,
  signalStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'MODERATE'
): { target: number; stopLoss: number; riskReward: number } {
  // Adjust multipliers based on signal strength
  let slMultiplier = CONFIG.ATR_SL_MULTIPLIER;
  let targetMultiplier = CONFIG.ATR_TARGET_MULTIPLIER;
  
  if (signalStrength === 'STRONG') {
    // Tighter stops, bigger targets for strong signals
    slMultiplier *= 0.85;
    targetMultiplier *= 1.15;
  } else if (signalStrength === 'WEAK') {
    // Wider stops, conservative targets for weak signals
    slMultiplier *= 1.2;
    targetMultiplier *= 0.85;
  }
  
  let target: number;
  let stopLoss: number;
  
  if (atr && atr > 0) {
    // ATR-based calculation
    if (signalType === 'BUY') {
      stopLoss = price - (atr * slMultiplier);
      target = price + (atr * targetMultiplier);
    } else {
      stopLoss = price + (atr * slMultiplier);
      target = price - (atr * targetMultiplier);
    }
  } else {
    // Fallback to percentage-based
    const slPct = CONFIG.FALLBACK_SL_PCT / 100;
    const targetPct = CONFIG.FALLBACK_TARGET_PCT / 100;
    
    if (signalType === 'BUY') {
      stopLoss = price * (1 - slPct);
      target = price * (1 + targetPct);
    } else {
      stopLoss = price * (1 + slPct);
      target = price * (1 - targetPct);
    }
  }
  
  const potentialGain = Math.abs(target - price);
  const potentialLoss = Math.abs(stopLoss - price);
  const riskReward = potentialLoss > 0 ? potentialGain / potentialLoss : 0;
  
  return {
    target: Math.round(target * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    riskReward: Math.round(riskReward * 100) / 100
  };
}

/**
 * Generate a trade signal from analysis results
 */
export function generateSignal(analysis: AnalysisInput): SignalGenerationResult {
  const { 
    score, 
    price, 
    confidence = 0.5, 
    details, 
    risk, 
    timeframe,
    technicals 
  } = analysis;
  
  // 1. Check if score qualifies for signal
  const isStrongBuy = score >= CONFIG.STRONG_BUY_SCORE;
  const isBuyCandidate = score >= CONFIG.MIN_BUY_SCORE;
  const isStrongSell = score <= CONFIG.STRONG_SELL_SCORE;
  const isSellCandidate = score <= CONFIG.MAX_SELL_SCORE;
  
  if (!isBuyCandidate && !isSellCandidate) {
    return {
      shouldGenerate: false,
      rejection_reason: `Score ${score} is in neutral zone (${CONFIG.MAX_SELL_SCORE}-${CONFIG.MIN_BUY_SCORE}). Need ≥${CONFIG.MIN_BUY_SCORE} for BUY or ≤${CONFIG.MAX_SELL_SCORE} for SELL.`
    };
  }
  
  // 2. Check confidence level
  if (confidence < CONFIG.MIN_CONFIDENCE) {
    return {
      shouldGenerate: false,
      rejection_reason: `Confidence ${(confidence * 100).toFixed(0)}% is below minimum ${(CONFIG.MIN_CONFIDENCE * 100).toFixed(0)}%`
    };
  }
  
  const signal_type: 'BUY' | 'SELL' = isBuyCandidate ? 'BUY' : 'SELL';
  
  // 3. Check market regime compatibility
  const regimeCheck = isRegimeCompatible(
    signal_type, 
    risk?.marketTrend, 
    technicals?.adx
  );
  
  if (!regimeCheck.compatible) {
    return {
      shouldGenerate: false,
      rejection_reason: `${signal_type} signal blocked: Market is ${risk?.marketTrend} with strong ADX (${technicals?.adx?.toFixed(0)})`
    };
  }
  
  // Determine signal strength based on score and regime
  let signalStrength: 'STRONG' | 'MODERATE' | 'WEAK' = regimeCheck.strength;
  
  // Upgrade strength if score is very strong
  if ((isStrongBuy || isStrongSell) && confidence >= CONFIG.HIGH_CONFIDENCE) {
    signalStrength = 'STRONG';
  }
  
  // Downgrade if counter-trend or low confidence
  if (regimeCheck.strength === 'WEAK' || confidence < 0.6) {
    signalStrength = 'WEAK';
  }
  
  // 4. Calculate ATR-based levels
  const levels = calculateATRLevels(
    price, 
    signal_type, 
    risk?.atr,
    signalStrength
  );
  
  // 5. Check risk-reward ratio
  if (levels.riskReward < CONFIG.MIN_RISK_REWARD) {
    return {
      shouldGenerate: false,
      rejection_reason: `Risk-reward ratio ${levels.riskReward} is below minimum ${CONFIG.MIN_RISK_REWARD}`
    };
  }
  
  // 6. Adjust for timeframe
  let target_price = levels.target;
  let stop_loss = levels.stopLoss;
  
  // Shorter timeframes = tighter levels
  if (timeframe === '1W') {
    const adjust = 0.7;
    target_price = price + (target_price - price) * adjust;
    stop_loss = price - (price - stop_loss) * adjust;
  }
  // Longer timeframes = wider levels
  else if (['3M', '6M', '1Y'].includes(timeframe)) {
    const adjust = 1.3;
    target_price = price + (target_price - price) * adjust;
    stop_loss = price - (price - stop_loss) * adjust;
  }
  
  // Recalculate risk-reward after adjustment
  const potentialGain = Math.abs(target_price - price);
  const potentialLoss = Math.abs(stop_loss - price);
  const final_risk_reward = potentialLoss > 0 ? potentialGain / potentialLoss : 0;
  
  // Extract top reasons from analysis details
  const reasons = details
    .filter(d => d.includes('✅') || d.includes('🔥') || d.includes('📈') || d.includes('📉') || d.includes('⚠️'))
    .slice(0, 5);
  
  // Add regime info to reasons
  if (regimeCheck.strength === 'STRONG' && risk?.marketTrend) {
    reasons.unshift(`📊 ${risk.marketTrend} market (aligned)`);
  }
  
  return {
    shouldGenerate: true,
    signal: {
      signal_type,
      entry_price: Math.round(price * 100) / 100,
      target_price: Math.round(target_price * 100) / 100,
      stop_loss: Math.round(stop_loss * 100) / 100,
      score,
      confidence,
      reasons,
      risk_reward: Math.round(final_risk_reward * 100) / 100
    }
  };
}

/**
 * Check if a signal's target or stop-loss has been hit
 */
export function checkSignalOutcome(
  signal: { signal_type: 'BUY' | 'SELL'; entry_price: number; target_price: number; stop_loss: number },
  currentPrice: number,
  highSinceEntry?: number,
  lowSinceEntry?: number
): { status: 'ACTIVE' | 'TARGET_HIT' | 'STOP_LOSS'; exit_price: number; return_pct: number } | null {
  const { signal_type, entry_price, target_price, stop_loss } = signal;
  
  const high = highSinceEntry ?? currentPrice;
  const low = lowSinceEntry ?? currentPrice;
  
  if (signal_type === 'BUY') {
    if (high >= target_price) {
      const return_pct = ((target_price - entry_price) / entry_price) * 100;
      return { status: 'TARGET_HIT', exit_price: target_price, return_pct };
    }
    if (low <= stop_loss) {
      const return_pct = ((stop_loss - entry_price) / entry_price) * 100;
      return { status: 'STOP_LOSS', exit_price: stop_loss, return_pct };
    }
  } else {
    if (low <= target_price) {
      const return_pct = ((entry_price - target_price) / entry_price) * 100;
      return { status: 'TARGET_HIT', exit_price: target_price, return_pct };
    }
    if (high >= stop_loss) {
      const return_pct = ((entry_price - stop_loss) / entry_price) * 100;
      return { status: 'STOP_LOSS', exit_price: stop_loss, return_pct };
    }
  }
  
  return null;
}

/**
 * Calculate current P&L for an active signal
 */
export function calculateCurrentPnL(
  signal: { signal_type: 'BUY' | 'SELL'; entry_price: number },
  currentPrice: number
): { pnl: number; pnl_pct: number } {
  if (signal.signal_type === 'BUY') {
    const pnl = currentPrice - signal.entry_price;
    const pnl_pct = (pnl / signal.entry_price) * 100;
    return { pnl, pnl_pct };
  } else {
    const pnl = signal.entry_price - currentPrice;
    const pnl_pct = (pnl / signal.entry_price) * 100;
    return { pnl, pnl_pct };
  }
}
