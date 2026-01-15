// src/lib/types.ts

export type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  recencyWeight?: number; // NEW: How much this news matters
}

export interface MetricData {
  rsi: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerLower: number;
  sma50: number;
  sma200: number;
  // NEW: EMA
  ema9: number;
  ema21: number;
}

export interface FundamentalData {
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

export interface LevelData {
  support: number[];
  resistance: number[];
  pivot: number;
  r1: number;
  s1: number;
}

export interface ZigZagPoint {
  date: string;
  price: number;
  type: 'HIGH' | 'LOW';
}

export interface BacktestResult {
  date: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  priceAtSignal: number;
  priceAfter: number;
  returnPct: number;
  isWin: boolean;
}

export interface PredictionPoint {
  date: string;
  price: number;
  upper: number;
  lower: number;
  isFuture: boolean;
}

// NEW: Volume Analysis Data
export interface VolumeData {
  obv: number;
  obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  vwap: number;
  volumeSpike: boolean;
  avgVolume: number;
  currentVolume: number;
  volumeRatio: number; // current / avg (>2 = spike)
  volumeTrend: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
}

// NEW: Volatility & Trend Data
export interface VolatilityData {
  atr: number;
  atrPercent: number; // ATR as % of price (useful for stop-loss)
  supertrend: number;
  supertrendSignal: 'BUY' | 'SELL';
  adx: number;
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NO TREND';
  plusDI: number;
  minusDI: number;
}

// UPDATED: Risk & Context Data (Enhanced)
export interface RiskData {
  // Market Correlation
  beta: number;
  alpha: number;
  correlation: number;
  marketTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  // NEW: Advanced Risk Metrics
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  volatility: number; // Annualized
  valueAtRisk: number; // 95% 1-day VaR
  // NEW: Risk Grade
  riskGrade: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
}

// UPDATED: Analysis Result
export interface AnalysisResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  score: number;
  confidence: number; // NEW: 0-100 confidence in the recommendation
  details: string[];
  patterns: string[];
  news: NewsItem[];
  fundamentals: FundamentalData;
  metrics: MetricData;
  levels: LevelData;
  risk: RiskData;
  volume: VolumeData; // NEW
  volatility: VolatilityData; // NEW
  stochRsi: StochRSIData;
  ichimoku: IchimokuData;
  sector?: SectorData;
  momentum: { score: number; interpretation: string };
  zigzag: ZigZagPoint[];
  history: { date: string; price: number; volume?: number }[];
  backtest: {
    results: BacktestResult[];
    accuracy: number;
    totalReturn: number;
  };
  prediction: PredictionPoint[];
}

export interface StochRSIData {
  k: number;           // Fast %K line (0-100)
  d: number;           // Slow %D line (0-100)
  signal: 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  crossover: boolean;  // True if K crossed D recently
}

// Ichimoku Cloud Data
export interface IchimokuData {
  tenkanSen: number;      // Conversion Line (9-period)
  kijunSen: number;       // Base Line (26-period)
  senkouSpanA: number;    // Leading Span A (forms cloud)
  senkouSpanB: number;    // Leading Span B (forms cloud)
  chikouSpan: number;     // Lagging Span
  cloudTop: number;       // Max of Span A & B
  cloudBottom: number;    // Min of Span A & B
  priceVsCloud: 'ABOVE' | 'BELOW' | 'INSIDE';
  tkCross: 'BULLISH' | 'BEARISH' | 'NONE';  // Tenkan/Kijun cross
  cloudColor: 'GREEN' | 'RED';              // Cloud direction
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}

// Sector Performance Data
export interface SectorData {
  sectorName: string;
  sectorChange: number;       // Sector % change (1D)
  stockVsSector: number;      // Stock performance vs sector
  sectorRank: number;         // Rank within sector (1 = best)
  sectorStockCount: number;   // Total stocks in sector
  isOutperforming: boolean;   // Stock > Sector?
  topPerformers: string[];    // Top 3 in sector
  bottomPerformers: string[]; // Bottom 3 in sector
}

// Enhanced ML Prediction
export interface MLPrediction {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;          // 0-100
  predictedReturn: number;     // Expected % return
  targetPrice: number;
  stopLoss: number;
  riskReward: number;          // Risk/Reward ratio
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  signals: string[];           // Contributing factors
}