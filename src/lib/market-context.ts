// src/lib/market-context.ts
// Market Context Analysis - Sector Trends and Market Breadth

import { SMA, RSI } from 'technicalindicators';

export interface MarketContext {
    niftyTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    niftyStrength: number;         // 0-100
    sectorTrend: 'OUTPERFORMING' | 'UNDERPERFORMING' | 'INLINE';
    relativeStrength: number;      // vs Nifty 50 (positive = outperforming)
    breadth: 'STRONG' | 'WEAK' | 'NEUTRAL';
    marketMomentum: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
    riskEnvironment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
    recommendations: string[];
}

export interface SectorAnalysis {
    sectorName: string;
    sectorTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    relativePerformance: number;   // vs Nifty
    momentum: number;              // 0-100
    isLeadingSector: boolean;
}

// Sector classification based on stock suffix/name patterns
const SECTOR_PATTERNS: Record<string, string[]> = {
    'Banking': ['BANK', 'HDFC', 'ICICI', 'KOTAK', 'AXIS', 'SBI', 'PNB', 'BOB', 'INDUS'],
    'IT': ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'COFORGE', 'MPHASIS'],
    'Pharma': ['CIPLA', 'SUNPHARMA', 'DRREDDY', 'BIOCON', 'LUPIN', 'DIVISLAB', 'AUROPHARMA'],
    'Auto': ['MARUTI', 'TATAMOTORS', 'M&M', 'HEROMOTOCO', 'BAJAJ', 'EICHER', 'ASHOK'],
    'Energy': ['RELIANCE', 'ONGC', 'BPCL', 'IOC', 'NTPC', 'POWERGRID', 'ADANIGREEN'],
    'Metal': ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'NMDC', 'COALINDIA'],
    'FMCG': ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'COLPAL'],
    'Financial Services': ['BAJFINANCE', 'BAJAJFINSV', 'HDFC', 'SBILIFE', 'HDFCLIFE'],
    'Realty': ['DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'BRIGADE'],
    'Telecom': ['BHARTIARTL', 'IDEA', 'TATACOMM'],
};

/**
 * Detect which sector a stock belongs to
 */
export function detectSector(symbol: string): string {
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '').toUpperCase();

    for (const [sector, patterns] of Object.entries(SECTOR_PATTERNS)) {
        for (const pattern of patterns) {
            if (cleanSymbol.includes(pattern)) {
                return sector;
            }
        }
    }

    return 'General';
}

/**
 * Analyze market context and relative strength
 */
export function analyzeMarketContext(
    stockQuotes: any[],
    marketQuotes: any[],
    sectorQuotes?: any[]
): MarketContext {
    if (stockQuotes.length < 50 || marketQuotes.length < 50) {
        return getDefaultContext();
    }

    // 1. Calculate Nifty trend
    const marketCloses = marketQuotes.map((q: any) => q.close);
    const niftyAnalysis = analyzeIndex(marketCloses);

    // 2. Calculate stock performance
    const stockCloses = stockQuotes.map((q: any) => q.close);
    const stockAnalysis = analyzeIndex(stockCloses);

    // 3. Calculate relative strength
    const stockReturn = calculateReturn(stockCloses, 20);
    const marketReturn = calculateReturn(marketCloses, 20);
    const relativeStrength = stockReturn - marketReturn;

    // 4. Determine sector trend
    let sectorTrend: 'OUTPERFORMING' | 'UNDERPERFORMING' | 'INLINE' = 'INLINE';
    if (relativeStrength > 2) {
        sectorTrend = 'OUTPERFORMING';
    } else if (relativeStrength < -2) {
        sectorTrend = 'UNDERPERFORMING';
    }

    // 5. Analyze market breadth (using momentum)
    const breadth = analyzeBreadth(niftyAnalysis.rsi, niftyAnalysis.trend);

    // 6. Determine market momentum
    const recentReturn = calculateReturn(marketCloses, 5);
    const priorReturn = calculateReturn(marketCloses.slice(0, -5), 5);
    let marketMomentum: 'ACCELERATING' | 'DECELERATING' | 'STABLE' = 'STABLE';
    if (recentReturn > priorReturn + 0.5) {
        marketMomentum = 'ACCELERATING';
    } else if (recentReturn < priorReturn - 0.5) {
        marketMomentum = 'DECELERATING';
    }

    // 7. Determine risk environment
    const riskEnvironment = determineRiskEnvironment(niftyAnalysis, marketMomentum);

    // 8. Generate recommendations
    const recommendations = generateRecommendations(
        niftyAnalysis.trend,
        sectorTrend,
        riskEnvironment
    );

    return {
        niftyTrend: niftyAnalysis.trend,
        niftyStrength: niftyAnalysis.strength,
        sectorTrend,
        relativeStrength,
        breadth,
        marketMomentum,
        riskEnvironment,
        recommendations
    };
}

/**
 * Analyze an index or stock
 */
function analyzeIndex(closes: number[]): {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
    rsi: number;
    smaPosition: number;
} {
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const currentRSI = rsiValues[rsiValues.length - 1] || 50;

    const sma20 = SMA.calculate({ values: closes, period: 20 });
    const sma50 = SMA.calculate({ values: closes, period: 50 });

    const currentPrice = closes[closes.length - 1];
    const currentSMA20 = sma20[sma20.length - 1] || currentPrice;
    const currentSMA50 = sma50[sma50.length - 1] || currentPrice;

    // Calculate SMA position
    const smaPosition = ((currentPrice - currentSMA50) / currentSMA50) * 100;

    // Determine trend
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 50;

    if (currentPrice > currentSMA20 && currentPrice > currentSMA50 && currentRSI > 50) {
        trend = 'BULLISH';
        strength = Math.min(100, 50 + (currentRSI - 50) + Math.abs(smaPosition));
    } else if (currentPrice < currentSMA20 && currentPrice < currentSMA50 && currentRSI < 50) {
        trend = 'BEARISH';
        strength = Math.min(100, 50 + (50 - currentRSI) + Math.abs(smaPosition));
    } else {
        strength = 50 - Math.abs(50 - currentRSI);
    }

    return { trend, strength, rsi: currentRSI, smaPosition };
}

/**
 * Calculate return over a period
 */
function calculateReturn(closes: number[], days: number): number {
    if (closes.length < days + 1) return 0;

    const endPrice = closes[closes.length - 1];
    const startPrice = closes[closes.length - 1 - days];

    return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * Analyze market breadth
 */
function analyzeBreadth(
    rsi: number,
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
): 'STRONG' | 'WEAK' | 'NEUTRAL' {
    if (trend === 'BULLISH' && rsi > 55) return 'STRONG';
    if (trend === 'BEARISH' && rsi < 45) return 'WEAK';
    return 'NEUTRAL';
}

/**
 * Determine risk environment
 */
function determineRiskEnvironment(
    analysis: { trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; strength: number; rsi: number },
    momentum: 'ACCELERATING' | 'DECELERATING' | 'STABLE'
): 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' {
    if (analysis.trend === 'BULLISH' && momentum === 'ACCELERATING') {
        return 'RISK_ON';
    }
    if (analysis.trend === 'BEARISH' && momentum === 'DECELERATING') {
        return 'RISK_OFF';
    }
    if (analysis.rsi > 70 || analysis.rsi < 30) {
        return analysis.rsi > 70 ? 'RISK_OFF' : 'RISK_ON'; // Contrarian at extremes
    }
    return 'NEUTRAL';
}

/**
 * Generate recommendations based on context
 */
function generateRecommendations(
    niftyTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    sectorTrend: 'OUTPERFORMING' | 'UNDERPERFORMING' | 'INLINE',
    riskEnv: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL'
): string[] {
    const recs: string[] = [];

    // Market context
    if (niftyTrend === 'BULLISH') {
        recs.push('📈 Market supportive for longs');
    } else if (niftyTrend === 'BEARISH') {
        recs.push('📉 Headwinds from broader market');
    }

    // Sector context
    if (sectorTrend === 'OUTPERFORMING') {
        recs.push('🚀 Stock outperforming sector - momentum present');
    } else if (sectorTrend === 'UNDERPERFORMING') {
        recs.push('⚠️ Lagging sector - watch for catalysts');
    }

    // Risk environment
    if (riskEnv === 'RISK_ON') {
        recs.push('💪 Risk-on environment favors growth');
    } else if (riskEnv === 'RISK_OFF') {
        recs.push('🛡️ Defensive stance recommended');
    }

    return recs;
}

/**
 * Default context when data is insufficient
 */
function getDefaultContext(): MarketContext {
    return {
        niftyTrend: 'NEUTRAL',
        niftyStrength: 50,
        sectorTrend: 'INLINE',
        relativeStrength: 0,
        breadth: 'NEUTRAL',
        marketMomentum: 'STABLE',
        riskEnvironment: 'NEUTRAL',
        recommendations: ['⚠️ Insufficient market data for context analysis']
    };
}

/**
 * Calculate score adjustment based on market context
 * This is used by the analyzer to adjust the final score
 */
export function getMarketContextAdjustment(context: MarketContext): {
    adjustment: number;
    reason: string;
} {
    let adjustment = 0;
    const reasons: string[] = [];

    // Nifty trend impact
    if (context.niftyTrend === 'BULLISH' && context.niftyStrength > 60) {
        adjustment += 5;
        reasons.push('bullish market');
    } else if (context.niftyTrend === 'BEARISH' && context.niftyStrength > 60) {
        adjustment -= 5;
        reasons.push('bearish market');
    }

    // Relative strength impact
    if (context.sectorTrend === 'OUTPERFORMING') {
        adjustment += 3;
        reasons.push('relative strength');
    } else if (context.sectorTrend === 'UNDERPERFORMING') {
        adjustment -= 3;
        reasons.push('relative weakness');
    }

    // Risk environment
    if (context.riskEnvironment === 'RISK_ON') {
        adjustment += 2;
    } else if (context.riskEnvironment === 'RISK_OFF') {
        adjustment -= 2;
    }

    return {
        adjustment,
        reason: reasons.length > 0 ? `Market context: ${reasons.join(', ')}` : ''
    };
}
