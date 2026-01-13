// src/lib/types.ts

export type TimeFrame = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
}

export interface MetricData {
  rsi: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerLower: number;
  sma50: number;
  sma200: number;
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

// NEW: Risk & Context Data
export interface RiskData {
  beta: number;
  alpha: number;
  correlation: number; // -1 to 1
  marketTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface AnalysisResult {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
  score: number;
  details: string[];
  patterns: string[];
  news: NewsItem[];
  fundamentals: FundamentalData;
  metrics: MetricData;
  levels: LevelData;
  risk: RiskData; // NEW FIELD
  zigzag: ZigZagPoint[];
  history: { date: string; price: number }[];
  backtest: {
    results: BacktestResult[];
    accuracy: number;
    totalReturn: number;
  };
  prediction: PredictionPoint[];
}