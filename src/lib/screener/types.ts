// src/lib/screener/types.ts

export interface ScreenerFilters {
  // Technical
  rsiMin?: number
  rsiMax?: number
  aboveSMA50?: boolean
  aboveSMA200?: boolean
  belowSMA50?: boolean
  belowSMA200?: boolean
  goldenCross?: boolean
  deathCross?: boolean
  macdBullish?: boolean
  macdBearish?: boolean
  
  // Price Action
  near52WeekHigh?: boolean
  near52WeekLow?: boolean
  priceChangeMin?: number
  priceChangeMax?: number
  volumeSpike?: boolean
  
  // Fundamentals
  peMin?: number
  peMax?: number
  marketCapMin?: number
  marketCapMax?: number
  
  // Sector
  sectors?: string[]
}

export interface ScreenerResult {
  symbol: string
  name: string
  sector?: string
  price: number
  change: number
  changePercent: number
  rsi: number
  sma50: number
  sma200: number
  macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  pe: number | null
  marketCap: number
  volume: number
  avgVolume: number
  volumeRatio: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  distanceFrom52High: number
  distanceFrom52Low: number
  matchedFilters: string[]
}

export interface ScreenerPreset {
  id: string
  name: string
  description: string
  icon: string
  color: string
  filters: ScreenerFilters
}

export const SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: 'oversold',
    name: 'Oversold Stocks',
    description: 'RSI below 30 - potential bounce candidates',
    icon: 'TrendingDown',
    color: 'cyan',
    filters: { rsiMax: 30 }
  },
  {
    id: 'overbought',
    name: 'Overbought Stocks',
    description: 'RSI above 70 - potential pullback candidates',
    icon: 'TrendingUp',
    color: 'orange',
    filters: { rsiMin: 70 }
  },
  {
    id: 'bullish-momentum',
    name: 'Bullish Momentum',
    description: 'Above SMAs with bullish MACD',
    icon: 'Rocket',
    color: 'emerald',
    filters: { aboveSMA50: true, aboveSMA200: true, macdBullish: true }
  },
  {
    id: 'golden-cross',
    name: 'Golden Cross',
    description: 'SMA50 just crossed above SMA200',
    icon: 'Sparkles',
    color: 'yellow',
    filters: { goldenCross: true }
  },
  {
    id: 'death-cross',
    name: 'Death Cross',
    description: 'SMA50 just crossed below SMA200',
    icon: 'Skull',
    color: 'rose',
    filters: { deathCross: true }
  },
  {
    id: 'near-52-high',
    name: 'Near 52-Week High',
    description: 'Within 5% of yearly high',
    icon: 'ArrowUpCircle',
    color: 'emerald',
    filters: { near52WeekHigh: true }
  },
  {
    id: 'near-52-low',
    name: 'Near 52-Week Low',
    description: 'Within 10% of yearly low',
    icon: 'ArrowDownCircle',
    color: 'rose',
    filters: { near52WeekLow: true }
  },
  {
    id: 'undervalued',
    name: 'Undervalued',
    description: 'Low P/E with positive trend',
    icon: 'BadgeDollarSign',
    color: 'blue',
    filters: { peMax: 15, aboveSMA200: true }
  },
  {
    id: 'high-momentum',
    name: 'High Momentum',
    description: 'Strong RSI with bullish signals',
    icon: 'Zap',
    color: 'purple',
    filters: { rsiMin: 55, rsiMax: 75, aboveSMA50: true, macdBullish: true }
  },
  {
    id: 'large-cap-bullish',
    name: 'Large Cap Bullish',
    description: 'Big companies with bullish setup',
    icon: 'Building',
    color: 'blue',
    filters: { marketCapMin: 50000, aboveSMA50: true, macdBullish: true }
  }
]

export const SECTORS = [
  'Financial Services',
  'Information Technology',
  'Healthcare',
  'Consumer Durables',
  'Automobile and Auto Components',
  'Capital Goods',
  'Oil Gas & Consumable Fuels',
  'Metals & Mining',
  'Fast Moving Consumer Goods',
  'Power',
  'Chemicals',
  'Construction',
  'Construction Materials',
  'Telecommunication',
  'Realty',
  'Consumer Services',
  'Services',
  'Textiles',
  'Media Entertainment & Publication',
  'Diversified'
]