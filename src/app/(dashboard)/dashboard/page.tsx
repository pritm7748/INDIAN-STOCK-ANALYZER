// src/app/(dashboard)/dashboard/page.tsx
'use client'

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from 'next/navigation'
import { STOCK_LIST, StockSymbol } from "@/lib/stockList"
import { useUser } from '@/lib/hooks/useUser'
import { useWatchlists, useStockInWatchlists } from '@/lib/hooks/useWatchlists'
import { createClient } from '@/lib/supabase/client'

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, ComposedChart, Bar,
} from 'recharts'
import { 
  ArrowUp, ArrowDown, Activity, BarChart2, Zap, TrendingUp, TrendingDown,
  ScanEye, Newspaper, Briefcase, History, BrainCircuit, Volume2, 
  Shield, Target, AlertTriangle, Bookmark, BookmarkCheck, RefreshCw,
  ChevronDown, ChevronUp, Info, Gauge, Waves, LineChart, Cloud,
  Crosshair, Layers, CircleDot, Flame, Loader2, ArrowRightLeft,
  Radio, Snowflake
} from 'lucide-react'

// ============================================================
// TYPE DEFINITIONS (Complete - matching backend)
// ============================================================

interface AnalysisData {
  symbol: string
  price: number
  change: number
  changePercent: number
  recommendation: string
  score: number
  confidence?: number
  details: string[]
  patterns: string[]
  news: NewsItem[]
  fundamentals: FundamentalData
  metrics: MetricData
  levels: LevelData
  risk: RiskData
  volume?: VolumeData
  volatility?: VolatilityData
  stochRsi?: StochRSIData
  ichimoku?: IchimokuData
  momentum?: { score: number; interpretation: string }
  zigzag: ZigZagPoint[]
  history: HistoryPoint[]
  backtest: BacktestData
  prediction: PredictionPoint[]
}

interface NewsItem {
  title: string
  link: string
  pubDate: string
  sentiment: 'Positive' | 'Negative' | 'Neutral'
  recencyWeight?: number
}

interface FundamentalData {
  marketCap: number
  peRatio: number
  pbRatio: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
}

interface MetricData {
  rsi: number
  macdHistogram: number
  bollingerUpper: number
  bollingerLower: number
  sma50: number
  sma200: number
  ema9?: number
  ema21?: number
}

interface LevelData {
  support: number[]
  resistance: number[]
  pivot: number
  r1: number
  s1: number
}

interface RiskData {
  beta: number
  alpha: number
  correlation: number
  marketTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  sharpeRatio?: number
  sortinoRatio?: number
  maxDrawdown?: number
  maxDrawdownPercent?: number
  volatility?: number
  valueAtRisk?: number
  riskGrade?: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH'
}

interface VolumeData {
  obv: number
  obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  vwap: number
  volumeSpike: boolean
  avgVolume: number
  currentVolume: number
  volumeRatio: number
  volumeTrend: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL'
}

interface VolatilityData {
  atr: number
  atrPercent: number
  supertrend: number
  supertrendSignal: 'BUY' | 'SELL'
  adx: number
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NO TREND'
  plusDI: number
  minusDI: number
}

interface StochRSIData {
  k: number
  d: number
  signal: 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL'
  crossover: boolean
}

interface IchimokuData {
  tenkanSen: number
  kijunSen: number
  senkouSpanA: number
  senkouSpanB: number
  chikouSpan: number
  cloudTop: number
  cloudBottom: number
  priceVsCloud: 'ABOVE' | 'BELOW' | 'INSIDE'
  tkCross: 'BULLISH' | 'BEARISH' | 'NONE'
  cloudColor: 'GREEN' | 'RED'
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'
}

interface ZigZagPoint {
  date: string
  price: number
  type: 'HIGH' | 'LOW'
}

interface HistoryPoint {
  date: string
  price: number
  volume?: number
}

interface BacktestData {
  results: BacktestResult[]
  accuracy: number
  totalReturn: number
}

interface BacktestResult {
  date: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  priceAtSignal: number
  priceAfter: number
  returnPct: number
  isWin: boolean
}

interface PredictionPoint {
  date: string
  price: number
  upper: number
  lower: number
  isFuture: boolean
}

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  color = 'white',
  tooltip 
}: { 
  icon: any
  label: string
  value: string | number
  subValue?: string
  color?: string
  tooltip?: string
}) {
  const colorClasses: Record<string, string> = {
    white: 'text-white',
    green: 'text-emerald-400',
    red: 'text-rose-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    cyan: 'text-cyan-400',
  }

  return (
    <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-xl hover:border-white/10 transition-colors group relative">
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none max-w-xs text-center">
          {tooltip}
        </div>
      )}
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <Icon size={14} /> 
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-gray-500 mt-1">{subValue}</p>
      )}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, color = 'blue', badge }: { 
  icon: any
  title: string
  color?: string
  badge?: string 
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    red: 'text-rose-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    cyan: 'text-cyan-400',
    pink: 'text-pink-400',
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <Icon size={14} className={colorClasses[color]} /> {title}
      </h3>
      {badge && (
        <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-gray-400">
          {badge}
        </span>
      )}
    </div>
  )
}

function SignalBadge({ signal, size = 'md' }: { signal: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  }

  const getSignalStyle = (s: string) => {
    const signal = s.toUpperCase()
    if (signal.includes('STRONG_BUY') || signal.includes('STRONG BUY')) 
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    if (signal.includes('BUY') || signal.includes('BULLISH')) 
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    if (signal.includes('STRONG_SELL') || signal.includes('STRONG SELL')) 
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30'
    if (signal.includes('SELL') || signal.includes('BEARISH')) 
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    if (signal.includes('OVERBOUGHT')) 
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    if (signal.includes('OVERSOLD')) 
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }

  return (
    <span className={`${sizeClasses[size]} ${getSignalStyle(signal)} rounded-md font-medium border`}>
      {signal.replace(/_/g, ' ')}
    </span>
  )
}

function ProgressBar({ value, max = 100, color = 'blue', showLabel = true }: { 
  value: number
  max?: number
  color?: string
  showLabel?: boolean 
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    gradient: 'bg-gradient-to-r from-rose-500 via-yellow-500 to-emerald-500'
  }

  return (
    <div className="w-full">
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>0</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// MAIN DASHBOARD CONTENT
// ============================================================

function DashboardContent() {
  const searchParams = useSearchParams()
  const initialSymbol = searchParams.get('symbol')
  
  const [selectedStock, setSelectedStock] = useState<string>(initialSymbol || STOCK_LIST[0].symbol)
  const [timeframe, setTimeframe] = useState<string>("1M")
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [showVolume, setShowVolume] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'chart' | 'technicals' | 'momentum' | 'backtest'>('chart')
  const [watchlistLoading, setWatchlistLoading] = useState(false)

  const { userId, isAuthenticated } = useUser()
  const { getOrCreateDefaultWatchlist } = useWatchlists()
  const { isInAnyWatchlist, watchlistsContaining } = useStockInWatchlists(selectedStock)
  
  const supabase = createClient()

  // Handle URL symbol parameter
  useEffect(() => {
    if (initialSymbol && STOCK_LIST.some(s => s.symbol === initialSymbol)) {
      setSelectedStock(initialSymbol)
    }
  }, [initialSymbol])

  // Analyze function
  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnalysis(null)
    
    try {
      const res = await fetch(`/api/analyze?symbol=${selectedStock}&timeframe=${timeframe}`)
      const data = await res.json()
      
      if (!res.ok || data.error) {
        throw new Error(data.error || "Analysis failed")
      }
      
      setAnalysis(data)

      // Save to analysis history if authenticated
      if (userId) {
        await supabase.from('analysis_history').insert({
          user_id: userId,
          symbol: selectedStock,
          stock_name: selectedStockData?.name,
          timeframe,
          score: data.score,
          recommendation: data.recommendation,
          price: data.price,
        }).match(console.error)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Analysis failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [selectedStock, timeframe, userId])

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleAnalyze()
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleAnalyze])

  // Handle watchlist toggle
  const handleWatchlistToggle = async () => {
    if (!userId) return
    
    setWatchlistLoading(true)
    try {
      if (isInAnyWatchlist) {
        for (const watchlistId of watchlistsContaining) {
          await supabase
            .from('watchlist_items')
            .delete()
            .eq('watchlist_id', watchlistId)
            .eq('symbol', selectedStock)
        }
      } else {
        const defaultWatchlist = await getOrCreateDefaultWatchlist()
        await supabase.from('watchlist_items').insert({
          watchlist_id: defaultWatchlist.id,
          user_id: userId,
          symbol: selectedStock,
          added_price: analysis?.price,
        })
      }
      window.location.reload()
    } catch (err) {
      console.error('Watchlist toggle error:', err)
    } finally {
      setWatchlistLoading(false)
    }
  }

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-emerald-400"
    if (score <= 40) return "text-rose-400"
    return "text-yellow-400"
  }

  const formatLargeNumber = (num: number) => {
    if (!num) return "N/A"
    if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + " T"
    if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + " B"
    if (num >= 1.0e+7) return (num / 1.0e+7).toFixed(2) + " Cr"
    if (num >= 1.0e+5) return (num / 1.0e+5).toFixed(2) + " L"
    return num.toLocaleString('en-IN')
  }

  const formatPercent = (num: number | undefined) => {
    if (num === undefined || num === null) return "N/A"
    return `${num >= 0 ? '+' : ''}${(num * 100).toFixed(2)}%`
  }

  const getRSIStatus = (rsi: number) => {
    if (rsi > 70) return { text: 'Overbought', color: 'red' }
    if (rsi < 30) return { text: 'Oversold', color: 'green' }
    if (rsi > 60) return { text: 'Bullish', color: 'green' }
    if (rsi < 40) return { text: 'Bearish', color: 'red' }
    return { text: 'Neutral', color: 'yellow' }
  }

  const getStochRSIColor = (signal: string) => {
    if (signal.includes('BULLISH')) return 'green'
    if (signal.includes('BEARISH')) return 'red'
    if (signal === 'OVERSOLD') return 'cyan'
    if (signal === 'OVERBOUGHT') return 'orange'
    return 'white'
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-400 text-xs mb-1">{label}</p>
          <p className="text-white font-bold text-lg">
            ₹{payload[0].value?.toFixed(2)}
          </p>
          {payload[0].payload.volume && (
            <p className="text-gray-400 text-xs mt-1">
              Vol: {formatLargeNumber(payload[0].payload.volume)}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const selectedStockData = STOCK_LIST.find(s => s.symbol === selectedStock)

    // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Analyzer</h1>
          <p className="text-gray-500 text-sm">AI-powered technical analysis for Indian stocks</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {/* Stock Selector */}
          <select
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value)}
            className="flex-1 sm:flex-initial sm:w-48 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-900"
          >
            {STOCK_LIST.map((stock: StockSymbol) => (
              <option key={stock.symbol} value={stock.symbol}>
                {stock.name}
              </option>
            ))}
          </select>

          {/* Timeframe Selector */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-900"
          >
            <option value="1W">1 Week</option>
            <option value="1M">1 Month</option>
            <option value="3M">3 Months</option>
            <option value="6M">6 Months</option>
            <option value="1Y">1 Year</option>
          </select>

          {/* Watchlist Button */}
          {isAuthenticated && (
            <button
              onClick={handleWatchlistToggle}
              disabled={watchlistLoading}
              className={`p-2.5 rounded-xl transition-all disabled:opacity-50 ${
                isInAnyWatchlist 
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
              title={isInAnyWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
            >
              {watchlistLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : isInAnyWatchlist ? (
                <BookmarkCheck size={20} />
              ) : (
                <Bookmark size={20} />
              )}
            </button>
          )}

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap size={16} />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-rose-400" size={20} />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400 text-sm">Analyzing {selectedStockData?.name}...</p>
          <p className="text-gray-600 text-xs">Running Phase 2 indicators: Stoch RSI, Ichimoku, ADX...</p>
        </div>
      )}

            {/* ============================================================ */}
      {/* ANALYSIS RESULTS */}
      {/* ============================================================ */}
      {analysis && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
          
          {/* ============================================================ */}
          {/* LEFT COLUMN (8 cols) */}
          {/* ============================================================ */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Price Banner */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-white">{analysis.symbol.replace('.NS', '')}</h2>
                    {selectedStockData?.sector && (
                      <span className="px-2 py-0.5 bg-white/5 text-gray-400 rounded text-xs">
                        {selectedStockData.sector}
                      </span>
                    )}
                    {analysis.risk?.marketTrend && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        analysis.risk.marketTrend === 'BULLISH' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : analysis.risk.marketTrend === 'BEARISH'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        Market: {analysis.risk.marketTrend}
                      </span>
                    )}
                    {analysis.confidence !== undefined && (
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                        {analysis.confidence}% Confidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-4xl font-light text-white">
                      ₹{analysis.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${
                      analysis.change >= 0 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {analysis.change >= 0 ? <ArrowUp size={16} className="mr-1" /> : <ArrowDown size={16} className="mr-1" />}
                      {Math.abs(analysis.change).toFixed(2)} ({analysis.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  
                  {/* 52 Week Range Bar */}
                  {analysis.fundamentals?.fiftyTwoWeekLow && analysis.fundamentals?.fiftyTwoWeekHigh && (
                    <div className="mt-4 max-w-md">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>52W Low: ₹{analysis.fundamentals.fiftyTwoWeekLow.toFixed(2)}</span>
                        <span>52W High: ₹{analysis.fundamentals.fiftyTwoWeekHigh.toFixed(2)}</span>
                      </div>
                      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="absolute h-full bg-linear-to-r from-rose-500 via-yellow-500 to-emerald-500 rounded-full"
                          style={{ width: '100%' }}
                        />
                        <div 
                          className="absolute w-3 h-3 bg-white rounded-full shadow-lg -top-0.5 transform -translate-x-1/2"
                          style={{ 
                            left: `${Math.min(100, Math.max(0, ((analysis.price - analysis.fundamentals.fiftyTwoWeekLow) / 
                              (analysis.fundamentals.fiftyTwoWeekHigh - analysis.fundamentals.fiftyTwoWeekLow)) * 100))}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={`px-6 py-3 rounded-xl text-sm font-bold tracking-wide border ${
                  analysis.recommendation.includes('STRONG BUY') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                  analysis.recommendation.includes('BUY') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  analysis.recommendation.includes('STRONG SELL') ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
                  analysis.recommendation.includes('SELL') ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                }`}>
                  {analysis.recommendation}
                </div>
              </div>
            </div>

            {/* Chart Tabs */}
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl w-fit flex-wrap">
              {[
                { id: 'chart', label: 'Price Chart', icon: LineChart },
                { id: 'technicals', label: 'Indicators', icon: Activity },
                { id: 'momentum', label: 'Momentum', icon: Gauge },
                { id: 'backtest', label: 'Backtest', icon: History },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon size={16} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

                        {/* ============================================================ */}
            {/* TAB: PRICE CHART */}
            {/* ============================================================ */}
            {activeTab === 'chart' && (
              <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 blur-3xl pointer-events-none"></div>
                
                {/* Chart Controls */}
                <div className="flex justify-between items-center mb-4 relative z-10 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">Show:</span>
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showVolume}
                        onChange={(e) => setShowVolume(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500"
                      />
                      Volume
                    </label>
                  </div>
                  <div className="flex gap-4 text-xs">
                    {analysis.levels?.support?.length > 0 && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-emerald-400"></div> Support
                      </span>
                    )}
                    {analysis.levels?.resistance?.length > 0 && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-rose-400"></div> Resistance
                      </span>
                    )}
                    {analysis.ichimoku && (
                      <span className={`flex items-center gap-1 ${analysis.ichimoku.cloudColor === 'GREEN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <Cloud size={12} /> Ichimoku
                      </span>
                    )}
                    {analysis.volatility?.supertrend && (
                      <span className={`flex items-center gap-1 ${analysis.volatility.supertrendSignal === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <TrendingUp size={12} /> Supertrend
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analysis.history}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        yAxisId="price"
                        stroke="#666" 
                        fontSize={11} 
                        domain={['auto', 'auto']} 
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                        tickFormatter={(value) => `₹${value.toFixed(0)}`}
                      />
                      {showVolume && (
                        <YAxis 
                          yAxisId="volume"
                          orientation="right"
                          stroke="#666" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => formatLargeNumber(value)}
                        />
                      )}
                      <Tooltip content={<CustomTooltip />} />
                      
                      {/* Ichimoku Cloud Lines */}
                      {analysis.ichimoku && (
                        <>
                          <ReferenceLine 
                            yAxisId="price"
                            y={analysis.ichimoku.cloudTop} 
                            stroke={analysis.ichimoku.cloudColor === 'GREEN' ? '#10b981' : '#f43f5e'} 
                            strokeDasharray="2 2" 
                            strokeOpacity={0.3}
                          />
                          <ReferenceLine 
                            yAxisId="price"
                            y={analysis.ichimoku.cloudBottom} 
                            stroke={analysis.ichimoku.cloudColor === 'GREEN' ? '#10b981' : '#f43f5e'} 
                            strokeDasharray="2 2" 
                            strokeOpacity={0.3}
                          />
                        </>
                      )}
                      
                      {/* Support Lines */}
                      {analysis.levels?.support?.map((level: number, i: number) => (
                        <ReferenceLine 
                          key={`sup-${i}`} 
                          yAxisId="price"
                          y={level} 
                          stroke="#10b981" 
                          strokeDasharray="5 5" 
                          strokeOpacity={0.7}
                        />
                      ))}

                      {/* Resistance Lines */}
                      {analysis.levels?.resistance?.map((level: number, i: number) => (
                        <ReferenceLine 
                          key={`res-${i}`}
                          yAxisId="price" 
                          y={level} 
                          stroke="#f43f5e" 
                          strokeDasharray="5 5" 
                          strokeOpacity={0.7}
                        />
                      ))}

                      {/* Supertrend Line */}
                      {analysis.volatility?.supertrend && (
                        <ReferenceLine 
                          yAxisId="price"
                          y={analysis.volatility.supertrend} 
                          stroke={analysis.volatility.supertrendSignal === 'BUY' ? '#10b981' : '#f43f5e'} 
                          strokeWidth={2}
                          strokeOpacity={0.8}
                        />
                      )}

                      {/* Volume Bars */}
                      {showVolume && (
                        <Bar 
                          yAxisId="volume"
                          dataKey="volume" 
                          fill="url(#colorVolume)"
                          opacity={0.5}
                        />
                      )}

                      {/* Price Area */}
                      <Area 
                        yAxisId="price"
                        type="monotone" 
                        dataKey="price" 
                        stroke="#3b82f6" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

                        {/* ============================================================ */}
            {/* TAB: TECHNICAL INDICATORS */}
            {/* ============================================================ */}
            {activeTab === 'technicals' && (
              <div className="space-y-6">
                {/* Basic Indicators Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    icon={Activity}
                    label="RSI (14)"
                    value={analysis.metrics.rsi.toFixed(1)}
                    subValue={getRSIStatus(analysis.metrics.rsi).text}
                    color={getRSIStatus(analysis.metrics.rsi).color}
                    tooltip="Relative Strength Index: >70 Overbought, <30 Oversold"
                  />
                  <MetricCard 
                    icon={BarChart2}
                    label="MACD"
                    value={analysis.metrics.macdHistogram > 0 ? 'Bullish' : 'Bearish'}
                    subValue={`Histogram: ${analysis.metrics.macdHistogram.toFixed(2)}`}
                    color={analysis.metrics.macdHistogram > 0 ? 'green' : 'red'}
                    tooltip="Moving Average Convergence Divergence"
                  />
                  <MetricCard 
                    icon={TrendingUp}
                    label="SMA 50"
                    value={`₹${analysis.metrics.sma50.toFixed(2)}`}
                    subValue={analysis.price > analysis.metrics.sma50 ? 'Price Above' : 'Price Below'}
                    color={analysis.price > analysis.metrics.sma50 ? 'green' : 'red'}
                  />
                  <MetricCard 
                    icon={TrendingDown}
                    label="SMA 200"
                    value={`₹${analysis.metrics.sma200.toFixed(2)}`}
                    subValue={analysis.price > analysis.metrics.sma200 ? 'Price Above' : 'Price Below'}
                    color={analysis.price > analysis.metrics.sma200 ? 'green' : 'red'}
                  />
                </div>

                {/* Bollinger Bands */}
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <SectionHeader icon={Waves} title="Bollinger Bands (20, 2)" color="blue" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl text-center">
                      <p className="text-xs text-gray-500 mb-1">Upper Band</p>
                      <p className={`text-xl font-bold ${analysis.price > analysis.metrics.bollingerUpper ? 'text-rose-400' : 'text-white'}`}>
                        ₹{analysis.metrics.bollingerUpper.toFixed(2)}
                      </p>
                      {analysis.price > analysis.metrics.bollingerUpper && (
                        <p className="text-[10px] text-rose-400 mt-1">⚠️ Price Above</p>
                      )}
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-xl text-center border border-blue-500/20">
                      <p className="text-xs text-gray-500 mb-1">Current Price</p>
                      <p className="text-xl font-bold text-blue-400">
                        ₹{analysis.price.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {((analysis.price - analysis.metrics.bollingerLower) / (analysis.metrics.bollingerUpper - analysis.metrics.bollingerLower) * 100).toFixed(0)}% within bands
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl text-center">
                      <p className="text-xs text-gray-500 mb-1">Lower Band</p>
                      <p className={`text-xl font-bold ${analysis.price < analysis.metrics.bollingerLower ? 'text-emerald-400' : 'text-white'}`}>
                        ₹{analysis.metrics.bollingerLower.toFixed(2)}
                      </p>
                      {analysis.price < analysis.metrics.bollingerLower && (
                        <p className="text-[10px] text-emerald-400 mt-1">📍 Price Below</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Volatility Indicators */}
                {analysis.volatility && (
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <SectionHeader icon={Waves} title="Volatility & Trend Strength" color="orange" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-white/5 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">ATR (14)</p>
                        <p className="text-xl font-bold text-white">₹{analysis.volatility.atr.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-500">{analysis.volatility.atrPercent.toFixed(2)}% of price</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">Supertrend</p>
                        <p className={`text-xl font-bold ${analysis.volatility.supertrendSignal === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {analysis.volatility.supertrendSignal}
                        </p>
                        <p className="text-[10px] text-gray-500">₹{analysis.volatility.supertrend.toFixed(2)}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">ADX</p>
                        <p className="text-xl font-bold text-white">{analysis.volatility.adx.toFixed(1)}</p>
                        <p className={`text-[10px] ${
                          analysis.volatility.trendStrength === 'STRONG' ? 'text-emerald-400' :
                          analysis.volatility.trendStrength === 'MODERATE' ? 'text-yellow-400' : 'text-gray-500'
                        }`}>{analysis.volatility.trendStrength}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl">
                        <p className="text-xs text-gray-500 mb-1">DI Spread</p>
                        <p className={`text-xl font-bold ${analysis.volatility.plusDI > analysis.volatility.minusDI ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {analysis.volatility.plusDI > analysis.volatility.minusDI ? '+DI Leads' : '-DI Leads'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          +{analysis.volatility.plusDI.toFixed(1)} / -{analysis.volatility.minusDI.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Suggested Stop Loss */}
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="text-sm text-yellow-400 flex items-center gap-2">
                        <Shield size={14} />
                        Suggested Stop Loss (2x ATR): ₹{(analysis.price - (analysis.volatility.atr * 2)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {/* EMA Section */}
                {analysis.metrics.ema9 && analysis.metrics.ema21 && (
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard 
                      icon={TrendingUp}
                      label="EMA 9"
                      value={`₹${analysis.metrics.ema9.toFixed(2)}`}
                      subValue={analysis.price > analysis.metrics.ema9 ? 'Price Above' : 'Price Below'}
                      color={analysis.price > analysis.metrics.ema9 ? 'green' : 'red'}
                    />
                    <MetricCard 
                      icon={TrendingDown}
                      label="EMA 21"
                      value={`₹${analysis.metrics.ema21.toFixed(2)}`}
                      subValue={analysis.price > analysis.metrics.ema21 ? 'Price Above' : 'Price Below'}
                      color={analysis.price > analysis.metrics.ema21 ? 'green' : 'red'}
                    />
                  </div>
                )}
              </div>
            )}

                        {/* ============================================================ */}
            {/* TAB: MOMENTUM (Phase 2 - Stoch RSI, Ichimoku, Williams %R) */}
            {/* ============================================================ */}
            {activeTab === 'momentum' && (
              <div className="space-y-6">
                
                {/* Stochastic RSI Section - COMPLETE */}
                {analysis.stochRsi && (
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <SectionHeader icon={Gauge} title="Stochastic RSI" color="cyan" badge="Phase 2" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Gauge Visualization */}
                      <div className="flex flex-col items-center justify-center p-4">
                        <div className="relative w-32 h-32">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="56" stroke="#1f2937" strokeWidth="8" fill="none" />
                            <circle 
                              cx="64" cy="64" r="56" 
                              stroke={
                                analysis.stochRsi.k > 80 ? '#f43f5e' : 
                                analysis.stochRsi.k < 20 ? '#06b6d4' : '#3b82f6'
                              }
                              strokeWidth="8" 
                              fill="none" 
                              strokeDasharray={352}
                              strokeDashoffset={352 - (352 * analysis.stochRsi.k) / 100}
                              className="transition-all duration-500"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-white">{analysis.stochRsi.k.toFixed(0)}</span>
                            <span className="text-[10px] text-gray-500">%K</span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <SignalBadge signal={analysis.stochRsi.signal} size="md" />
                        </div>
                      </div>

                      {/* K and D Lines */}
                      <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-400">%K (Fast Line)</span>
                            <span className="text-lg font-bold text-white">{analysis.stochRsi.k.toFixed(1)}</span>
                          </div>
                          <ProgressBar value={analysis.stochRsi.k} color="blue" showLabel={false} />
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-400">%D (Slow Line)</span>
                            <span className="text-lg font-bold text-white">{analysis.stochRsi.d.toFixed(1)}</span>
                          </div>
                          <ProgressBar value={analysis.stochRsi.d} color="purple" showLabel={false} />
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">K-D Spread</span>
                            <span className={`text-sm font-bold ${
                              analysis.stochRsi.k > analysis.stochRsi.d ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {(analysis.stochRsi.k - analysis.stochRsi.d).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interpretation */}
                      <div className="p-4 bg-white/5 rounded-xl">
                        <h4 className="text-xs text-gray-400 uppercase mb-3">Interpretation</h4>
                        <div className="space-y-2 text-sm">
                          {analysis.stochRsi.crossover && (
                            <div className="flex items-center gap-2 text-yellow-400">
                              <Crosshair size={14} />
                              <span>Crossover Detected!</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-gray-300">
                            <ArrowRightLeft size={14} />
                            <span>K-D Spread: {(analysis.stochRsi.k - analysis.stochRsi.d).toFixed(1)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-3 p-3 bg-black/30 rounded-lg">
                            {analysis.stochRsi.k > 80 ? (
                              <span className="text-orange-400">⚠️ <strong>Overbought territory</strong> - The momentum is extremely high. Watch for potential reversal signals. Consider taking profits or tightening stops.</span>
                            ) : analysis.stochRsi.k < 20 ? (
                              <span className="text-cyan-400">📍 <strong>Oversold territory</strong> - The momentum is extremely low. This could be a potential buying opportunity if other indicators confirm. Wait for bullish crossover.</span>
                            ) : analysis.stochRsi.signal.includes('BULLISH') ? (
                              <span className="text-emerald-400">✅ <strong>Bullish momentum building</strong> - %K has crossed above %D indicating increasing buying pressure. Look for price confirmation above key resistance levels.</span>
                            ) : analysis.stochRsi.signal.includes('BEARISH') ? (
                              <span className="text-rose-400">⚠️ <strong>Bearish momentum building</strong> - %K has crossed below %D indicating increasing selling pressure. Consider protecting profits or waiting for oversold conditions.</span>
                            ) : (
                              <span>📊 <strong>Neutral zone</strong> - Wait for clearer signal. The momentum is neither overbought nor oversold. A crossover in either direction will provide better entry/exit signals.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ichimoku Cloud Section - COMPLETE */}
                {analysis.ichimoku && (
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <SectionHeader icon={Cloud} title="Ichimoku Cloud (一目均衡表)" color="pink" badge="Phase 2" />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Cloud Visualization */}
                      <div className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm text-gray-400">Cloud Position</span>
                          <SignalBadge signal={analysis.ichimoku.signal} size="md" />
                        </div>
                        
                        {/* Visual Cloud Representation */}
                        <div className="relative h-40 flex flex-col justify-between py-4">
                          {/* Resistance Zone */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Cloud Top</span>
                            <span className="text-sm text-white">₹{analysis.ichimoku.cloudTop.toFixed(2)}</span>
                          </div>
                          
                          {/* Cloud Area */}
                          <div className={`relative flex-1 mx-4 my-2 rounded-lg ${
                            analysis.ichimoku.cloudColor === 'GREEN' 
                              ? 'bg-linear-to-b from-emerald-500/20 to-emerald-500/5' 
                              : 'bg-linear-to-b from-rose-500/20 to-rose-500/5'
                          }`}>
                            {/* Price Position Indicator */}
                            <div 
                              className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 flex items-center justify-center"
                              style={{
                                top: analysis.ichimoku.priceVsCloud === 'ABOVE' ? '-8px' :
                                     analysis.ichimoku.priceVsCloud === 'BELOW' ? 'calc(100% - 8px)' : '50%'
                              }}
                            >
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                            
                            {/* Cloud Label */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-xs font-medium ${
                                analysis.ichimoku.cloudColor === 'GREEN' ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {analysis.ichimoku.cloudColor} CLOUD
                              </span>
                            </div>
                          </div>
                          
                          {/* Support Zone */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Cloud Bottom</span>
                            <span className="text-sm text-white">₹{analysis.ichimoku.cloudBottom.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className={`mt-4 p-3 rounded-lg ${
                          analysis.ichimoku.priceVsCloud === 'ABOVE' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          analysis.ichimoku.priceVsCloud === 'BELOW' ? 'bg-rose-500/10 border border-rose-500/20' : 
                          'bg-yellow-500/10 border border-yellow-500/20'
                        }`}>
                          <p className={`text-sm font-medium ${
                            analysis.ichimoku.priceVsCloud === 'ABOVE' ? 'text-emerald-400' :
                            analysis.ichimoku.priceVsCloud === 'BELOW' ? 'text-rose-400' : 'text-yellow-400'
                          }`}>
                            Price is {analysis.ichimoku.priceVsCloud} the cloud
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {analysis.ichimoku.priceVsCloud === 'ABOVE' 
                              ? 'Bullish territory - Cloud acts as support' 
                              : analysis.ichimoku.priceVsCloud === 'BELOW'
                              ? 'Bearish territory - Cloud acts as resistance'
                              : 'Consolidation zone - Wait for breakout'}
                          </p>
                        </div>
                      </div>

                      {/* Ichimoku Components */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Tenkan-sen (9)</p>
                            <p className="text-lg font-bold text-blue-400">₹{analysis.ichimoku.tenkanSen.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">Conversion Line (Short-term)</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Kijun-sen (26)</p>
                            <p className="text-lg font-bold text-purple-400">₹{analysis.ichimoku.kijunSen.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">Base Line (Medium-term)</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Senkou Span A</p>
                            <p className="text-lg font-bold text-emerald-400">₹{analysis.ichimoku.senkouSpanA.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">Leading Span A</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Senkou Span B</p>
                            <p className="text-lg font-bold text-rose-400">₹{analysis.ichimoku.senkouSpanB.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">Leading Span B (52)</p>
                          </div>
                        </div>

                        {/* TK Cross Status */}
                        <div className={`p-4 rounded-xl ${
                          analysis.ichimoku.tkCross === 'BULLISH' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          analysis.ichimoku.tkCross === 'BEARISH' ? 'bg-rose-500/10 border border-rose-500/20' :
                          'bg-white/5'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs text-gray-400">TK Cross (Tenkan/Kijun)</span>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {analysis.ichimoku.tkCross === 'BULLISH' 
                                  ? 'Tenkan crossed above Kijun - Bullish signal'
                                  : analysis.ichimoku.tkCross === 'BEARISH'
                                  ? 'Tenkan crossed below Kijun - Bearish signal'
                                  : 'No recent crossover detected'}
                              </p>
                            </div>
                            <span className={`text-sm font-bold ${
                              analysis.ichimoku.tkCross === 'BULLISH' ? 'text-emerald-400' :
                              analysis.ichimoku.tkCross === 'BEARISH' ? 'text-rose-400' : 'text-gray-400'
                            }`}>
                              {analysis.ichimoku.tkCross === 'NONE' ? 'No Cross' : analysis.ichimoku.tkCross}
                            </span>
                          </div>
                        </div>

                        {/* Chikou Span */}
                        <div className="p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500">Chikou Span (Lagging)</p>
                              <p className="text-[10px] text-gray-600">Current close plotted 26 periods back</p>
                            </div>
                            <p className="text-lg font-bold text-white">₹{analysis.ichimoku.chikouSpan.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Momentum Score Summary */}
                {analysis.momentum && (
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <SectionHeader icon={Flame} title="Combined Momentum Score" color="orange" />
                    
                    <div className="flex items-center gap-6">
                      <div className="shrink-0">
                        <div className={`text-5xl font-bold ${
                          analysis.momentum.score >= 70 ? 'text-emerald-400' :
                          analysis.momentum.score >= 60 ? 'text-emerald-300' :
                          analysis.momentum.score <= 30 ? 'text-rose-400' :
                          analysis.momentum.score <= 40 ? 'text-rose-300' : 'text-yellow-400'
                        }`}>
                          {analysis.momentum.score}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">out of 100</p>
                      </div>
                      
                      <div className="flex-1">
                        <ProgressBar 
                          value={analysis.momentum.score} 
                          color="gradient" 
                          showLabel={true}
                        />
                        <p className="text-sm text-gray-300 mt-2">
                          {analysis.momentum.interpretation}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Combines RSI, Stochastic RSI, and Williams %R for a comprehensive momentum view
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

                        {/* ============================================================ */}
            {/* TAB: BACKTEST */}
            {/* ============================================================ */}
            {activeTab === 'backtest' && analysis.backtest && (
              <div className="space-y-6">
                {/* Backtest Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    icon={Target}
                    label="Win Rate"
                    value={`${analysis.backtest.accuracy.toFixed(1)}%`}
                    color={analysis.backtest.accuracy > 50 ? 'green' : 'red'}
                    tooltip="Percentage of profitable trades"
                  />
                  <MetricCard 
                    icon={TrendingUp}
                    label="Total Return"
                    value={`${analysis.backtest.totalReturn >= 0 ? '+' : ''}${analysis.backtest.totalReturn.toFixed(1)}%`}
                    color={analysis.backtest.totalReturn >= 0 ? 'green' : 'red'}
                    tooltip="Cumulative return from all trades"
                  />
                  <MetricCard 
                    icon={History}
                    label="Total Trades"
                    value={analysis.backtest.results.length}
                    color="white"
                  />
                  <MetricCard 
                    icon={Activity}
                    label="Wins / Losses"
                    value={`${analysis.backtest.results.filter(r => r.isWin).length} / ${analysis.backtest.results.filter(r => !r.isWin).length}`}
                    color="white"
                  />
                </div>

                {/* Trade History */}
                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
                  <SectionHeader icon={History} title="Trade History" color="orange" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-white/5">
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Signal</th>
                          <th className="pb-3 font-medium">Entry Price</th>
                          <th className="pb-3 font-medium">Exit Price</th>
                          <th className="pb-3 font-medium">Return</th>
                          <th className="pb-3 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.backtest.results.slice(-10).reverse().map((trade, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 text-gray-400">{trade.date}</td>
                            <td className="py-3">
                              <SignalBadge signal={trade.signal} size="sm" />
                            </td>
                            <td className="py-3 text-white">₹{trade.priceAtSignal.toFixed(2)}</td>
                            <td className="py-3 text-white">₹{trade.priceAfter.toFixed(2)}</td>
                            <td className={`py-3 font-medium ${trade.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trade.returnPct >= 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                trade.isWin 
                                  ? 'bg-emerald-500/10 text-emerald-400' 
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {trade.isWin ? 'WIN' : 'LOSS'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {analysis.backtest.accuracy < 45 && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-xs text-yellow-400 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        Low historical accuracy ({analysis.backtest.accuracy.toFixed(0)}%) - Score has been adjusted accordingly
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

                        {/* ============================================================ */}
            {/* PATTERNS & SIGNALS ROW */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patterns */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={ScanEye} title="Detected Patterns" color="blue" />
                {analysis.patterns.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.patterns.map((pattern: string, i: number) => (
                      <div 
                        key={i} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          pattern.toLowerCase().includes('bullish') || pattern.toLowerCase().includes('bottom') || pattern.toLowerCase().includes('hammer') || pattern.toLowerCase().includes('higher')
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : pattern.toLowerCase().includes('bearish') || pattern.toLowerCase().includes('top') || pattern.toLowerCase().includes('shooting') || pattern.toLowerCase().includes('lower')
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                        }`}
                      >
                        {pattern}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No patterns detected in current timeframe.</p>
                )}
              </div>

              {/* Active Signals */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={Zap} title="Active Signals" color="yellow" />
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {analysis.details.map((detail: string, index: number) => (
                    <div 
                      key={index} 
                      className="flex gap-2 items-start text-xs p-2.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                        detail.toLowerCase().includes("bullish") || 
                        detail.toLowerCase().includes("buy") ||
                        detail.toLowerCase().includes("golden") ||
                        detail.toLowerCase().includes("support") ||
                        detail.toLowerCase().includes("oversold") ||
                        detail.toLowerCase().includes("accumulation") ||
                        detail.toLowerCase().includes("above")
                          ? "bg-emerald-500" 
                          : detail.toLowerCase().includes("bearish") || 
                            detail.toLowerCase().includes("sell") ||
                            detail.toLowerCase().includes("death") ||
                            detail.toLowerCase().includes("resistance") ||
                            detail.toLowerCase().includes("overbought") ||
                            detail.toLowerCase().includes("distribution") ||
                            detail.toLowerCase().includes("below")
                          ? "bg-rose-500" 
                          : "bg-yellow-500"
                      }`} />
                      <span className="text-gray-300 leading-snug">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* VOLUME ANALYSIS - COMPLETE */}
            {/* ============================================================ */}
            {analysis.volume && (
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={Volume2} title="Volume Analysis" color="purple" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Today's Volume</p>
                    <p className="text-lg font-bold text-white">
                      {formatLargeNumber(analysis.volume.currentVolume ?? 0)}
                    </p>
                  </div>
                                    <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Avg Volume (20D)</p>
                    <p className="text-lg font-bold text-white">
                      {formatLargeNumber(analysis.volume.avgVolume ?? 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Volume Ratio</p>
                    <p className={`text-lg font-bold ${
                      (analysis.volume.volumeRatio ?? 0) > 1.5 
                        ? 'text-emerald-400' 
                        : (analysis.volume.volumeRatio ?? 0) < 0.5 
                          ? 'text-rose-400' 
                          : 'text-white'
                    }`}>
                      {(analysis.volume.volumeRatio ?? 0).toFixed(2)}x
                    </p>
                    {analysis.volume.volumeSpike && (
                      <span className="text-xs text-yellow-400">🔥 Volume Spike!</span>
                    )}
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">OBV Trend</p>
                    <p className={`text-lg font-bold ${
                      analysis.volume.obvTrend === 'BULLISH' 
                        ? 'text-emerald-400' 
                        : analysis.volume.obvTrend === 'BEARISH' 
                          ? 'text-rose-400' 
                          : 'text-white'
                    }`}>
                      {analysis.volume.obvTrend ?? 'N/A'}
                    </p>
                  </div>
                </div>
                
                {/* Additional Volume Info */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">VWAP (Volume Weighted Avg Price)</p>
                    <p className={`text-lg font-bold ${
                      analysis.price > (analysis.volume.vwap ?? 0) 
                        ? 'text-emerald-400' 
                        : 'text-rose-400'
                    }`}>
                      ₹{(analysis.volume.vwap ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {analysis.price > (analysis.volume.vwap ?? 0) 
                        ? '📈 Price Above VWAP - Bullish intraday bias' 
                        : '📉 Price Below VWAP - Bearish intraday bias'}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Volume Trend</p>
                    <p className={`text-lg font-bold ${
                      analysis.volume.volumeTrend === 'ACCUMULATION' 
                        ? 'text-emerald-400' 
                        : analysis.volume.volumeTrend === 'DISTRIBUTION' 
                          ? 'text-rose-400' 
                          : 'text-white'
                    }`}>
                      {analysis.volume.volumeTrend ?? 'NEUTRAL'}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {analysis.volume.volumeTrend === 'ACCUMULATION' 
                        ? '💹 Smart money buying detected' 
                        : analysis.volume.volumeTrend === 'DISTRIBUTION'
                        ? '💸 Institutional selling detected'
                        : '⚖️ No clear volume bias'}
                    </p>
                  </div>
                </div>

                {/* Volume Interpretation */}
                <div className="mt-4 p-4 bg-white/5 rounded-xl">
                  <p className="text-xs text-gray-400 uppercase mb-2">Volume Interpretation</p>
                  <div className="text-sm text-gray-300 space-y-1">
                    {analysis.volume.volumeSpike && analysis.change > 0 && (
                      <p className="text-emerald-400">✅ High volume with price increase - Strong bullish confirmation</p>
                    )}
                    {analysis.volume.volumeSpike && analysis.change < 0 && (
                      <p className="text-rose-400">⚠️ High volume with price decrease - Strong bearish confirmation</p>
                    )}
                    {analysis.volume.obvTrend === 'BULLISH' && (
                      <p className="text-emerald-400">📈 OBV rising - Accumulation phase, buyers in control</p>
                    )}
                    {analysis.volume.obvTrend === 'BEARISH' && (
                      <p className="text-rose-400">📉 OBV falling - Distribution phase, sellers in control</p>
                    )}
                    {!analysis.volume.volumeSpike && analysis.volume.volumeRatio < 0.7 && (
                      <p className="text-gray-400">📊 Low volume day - Move may lack conviction</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

                    {/* ============================================================ */}
          {/* RIGHT COLUMN (4 cols) */}
          {/* ============================================================ */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Score Gauge - COMPLETE with legend */}
            <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-b from-blue-500/5 to-transparent pointer-events-none"></div>
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6 relative z-10">AI Technical Score</h3>
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="88" cy="88" r="75" stroke="#1f2937" strokeWidth="10" fill="none" />
                  <circle 
                    cx="88" cy="88" r="75" 
                    stroke={analysis.score >= 60 ? "#10b981" : analysis.score <= 40 ? "#f43f5e" : "#eab308"} 
                    strokeWidth="10" 
                    fill="none" 
                    strokeDasharray={471}
                    strokeDashoffset={471 - (471 * analysis.score) / 100}
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-5xl font-bold ${getScoreColor(analysis.score)}`}>
                    {analysis.score}
                  </span>
                  <span className="text-xs text-gray-500 uppercase mt-1">out of 100</span>
                </div>
              </div>
              {/* Score Legend */}
              <div className="mt-6 flex gap-4 text-xs flex-wrap justify-center">
                <span className="flex items-center gap-1 text-rose-400">
                  <div className="w-2 h-2 bg-rose-400 rounded-full"></div> 0-40 Sell
                </span>
                <span className="flex items-center gap-1 text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div> 40-60 Hold
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div> 60-100 Buy
                </span>
              </div>
              {/* Confidence */}
              {analysis.confidence !== undefined && (
                <div className="mt-4 w-full">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Confidence</span>
                    <span>{analysis.confidence}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${analysis.confidence}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Risk Metrics - COMPLETE */}
            {analysis.risk && (
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={Shield} title="Risk Metrics" color="red" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Beta (vs Nifty)</p>
                    <p className={`text-lg font-bold ${
                      analysis.risk.beta > 1.2 ? 'text-rose-400' : 
                      analysis.risk.beta < 0.8 ? 'text-emerald-400' : 'text-white'
                    }`}>
                      {analysis.risk.beta.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {analysis.risk.beta > 1.2 ? 'High volatility' : 
                       analysis.risk.beta < 0.8 ? 'Defensive' : 'Market-like'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Alpha (Annual)</p>
                    <p className={`text-lg font-bold ${analysis.risk.alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatPercent(analysis.risk.alpha)}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {analysis.risk.alpha > 0.1 ? 'Outperforming' : 
                       analysis.risk.alpha < -0.1 ? 'Underperforming' : 'Market-like'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Sharpe Ratio</p>
                    <p className={`text-lg font-bold ${
                      (analysis.risk.sharpeRatio ?? 0) > 1 ? 'text-emerald-400' : 
                      (analysis.risk.sharpeRatio ?? 0) < 0 ? 'text-rose-400' : 'text-white'
                    }`}>
                      {(analysis.risk.sharpeRatio ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {(analysis.risk.sharpeRatio ?? 0) > 1 ? 'Good risk-adjusted' : 
                       (analysis.risk.sharpeRatio ?? 0) < 0 ? 'Poor risk-adjusted' : 'Average'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Max Drawdown</p>
                    <p className="text-lg font-bold text-rose-400">
                      {(analysis.risk.maxDrawdownPercent ?? 0).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Largest peak-to-trough decline
                    </p>
                  </div>
                  {analysis.risk.riskGrade && (
                    <div className="col-span-2 p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Risk Grade</p>
                          <p className="text-[10px] text-gray-600">Overall risk assessment</p>
                        </div>
                        <p className={`text-xl font-bold ${
                          analysis.risk.riskGrade === 'LOW' ? 'text-emerald-400' :
                          analysis.risk.riskGrade === 'MODERATE' ? 'text-yellow-400' :
                          analysis.risk.riskGrade === 'HIGH' ? 'text-orange-400' : 'text-rose-400'
                        }`}>
                          {analysis.risk.riskGrade}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Market Context */}
                <div className="mt-4 p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Market Trend</span>
                    <span className={`text-sm font-bold ${
                      analysis.risk.marketTrend === 'BULLISH' ? 'text-emerald-400' :
                      analysis.risk.marketTrend === 'BEARISH' ? 'text-rose-400' : 'text-gray-400'
                    }`}>
                      {analysis.risk.marketTrend}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {analysis.risk.marketTrend === 'BULLISH' && analysis.risk.beta > 1.2 
                      ? '🐂 High beta in bull market - Potential outperformance'
                      : analysis.risk.marketTrend === 'BEARISH' && analysis.risk.beta > 1.2
                      ? '⚠️ High beta in bear market - Higher downside risk'
                      : analysis.risk.marketTrend === 'BEARISH' && analysis.risk.beta < 0.8
                      ? '🛡️ Defensive stock in bear market - Relative safety'
                      : 'Monitor market conditions for context'}
                  </p>
                </div>
              </div>
            )}

            {/* AI Forecast - COMPLETE */}
            {analysis.prediction && analysis.prediction.length > 0 && (
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={BrainCircuit} title={`AI Forecast (${timeframe})`} color="purple" />
                
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Target (Avg)</p>
                    <p className="text-2xl font-bold text-white">
                      ₹{analysis.prediction[analysis.prediction.length - 1].price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Expected Move</p>
                    <p className={`text-lg font-bold ${
                      analysis.prediction[analysis.prediction.length - 1].price > analysis.price 
                        ? 'text-emerald-400' 
                        : 'text-rose-400'
                    }`}>
                      {((analysis.prediction[analysis.prediction.length - 1].price - analysis.price) / analysis.price * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Prediction Range */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="p-2 bg-rose-500/10 rounded-lg">
                    <p className="text-[10px] text-gray-500">Bear Case</p>
                    <p className="text-sm font-bold text-rose-400">
                      ₹{analysis.prediction[analysis.prediction.length - 1].lower.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <p className="text-[10px] text-gray-500">Base Case</p>
                    <p className="text-sm font-bold text-blue-400">
                      ₹{analysis.prediction[analysis.prediction.length - 1].price.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <p className="text-[10px] text-gray-500">Bull Case</p>
                    <p className="text-sm font-bold text-emerald-400">
                      ₹{analysis.prediction[analysis.prediction.length - 1].upper.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analysis.prediction}>
                      <defs>
                        <linearGradient id="colorCone" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, '']}
                        labelStyle={{ color: '#888' }}
                      />
                      <Area type="monotone" dataKey="upper" stroke="none" fill="#8b5cf6" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="lower" stroke="none" fill="#8b5cf6" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorCone)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                  <span>{analysis.prediction[0]?.date}</span>
                  <span>{analysis.prediction[analysis.prediction.length - 1]?.date}</span>
                </div>
                
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-400 flex items-center gap-2">
                    <Info size={12} />
                    AI predictions are for reference only. Not financial advice.
                  </p>
                </div>
              </div>
            )}

            {/* Fundamentals - COMPLETE */}
            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
              <SectionHeader icon={Briefcase} title="Fundamentals" color="green" />
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Market Cap</p>
                  <p className="text-sm font-bold text-white">
                    ₹{formatLargeNumber(analysis.fundamentals?.marketCap)}
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">P/E Ratio</p>
                  <p className={`text-sm font-bold ${
                    analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio < 20 
                      ? 'text-emerald-400' 
                      : analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio > 40
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}>
                    {analysis.fundamentals?.peRatio ? analysis.fundamentals.peRatio.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio < 15 
                      ? 'Undervalued' 
                      : analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio > 40
                      ? 'Premium valuation'
                      : 'Fair value'}
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">P/B Ratio</p>
                  <p className="text-sm font-bold text-white">
                    {analysis.fundamentals?.pbRatio ? analysis.fundamentals.pbRatio.toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">52W Range</p>
                  <p className="text-sm font-bold text-white">
                    ₹{analysis.fundamentals?.fiftyTwoWeekLow?.toFixed(0)} - ₹{analysis.fundamentals?.fiftyTwoWeekHigh?.toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Pivot Points - COMPLETE */}
            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
              <SectionHeader icon={Target} title="Pivot Points" color="blue" />
              <div className="space-y-2">
                {/* Resistance levels (reversed order - highest first) */}
                {analysis.levels?.resistance?.slice().reverse().map((r: number, i: number) => (
                  <div key={`r-${i}`} className="flex justify-between items-center p-2 bg-rose-500/5 rounded border border-rose-500/10">
                    <span className="text-xs text-rose-400">R{analysis.levels.resistance.length - i}</span>
                    <span className="text-sm font-medium text-white">₹{r.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-500">
                      {((r - analysis.price) / analysis.price * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
                
                {/* Pivot */}
                <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <span className="text-xs text-blue-400">Pivot</span>
                  <span className="text-sm font-bold text-white">₹{analysis.levels?.pivot?.toFixed(2)}</span>
                  <span className="text-[10px] text-blue-400">
                    {analysis.price > analysis.levels?.pivot ? '📈 Above' : '📉 Below'}
                  </span>
                </div>
                
                {/* Support levels */}
                {analysis.levels?.support?.map((s: number, i: number) => (
                  <div key={`s-${i}`} className="flex justify-between items-center p-2 bg-emerald-500/5 rounded border border-emerald-500/10">
                    <span className="text-xs text-emerald-400">S{i + 1}</span>
                    <span className="text-sm font-medium text-white">₹{s.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-500">
                      {((s - analysis.price) / analysis.price * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* News Feed - COMPLETE */}
            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
              <SectionHeader icon={Newspaper} title="Recent News" color="purple" />
              <div className="space-y-4 max-h-72 overflow-y-auto custom-scrollbar">
                {analysis.news.length > 0 ? analysis.news.map((item: NewsItem, index: number) => (
                  <a 
                    key={index} 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block group"
                  >
                    <div className="flex gap-3 items-start">
                      <div className={`mt-1.5 w-1 min-h-8 rounded-full shrink-0 ${
                        item.sentiment === 'Positive' ? 'bg-emerald-500' : 
                        item.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-gray-600'
                      }`} />
                      <div className="flex-1">
                        <h4 className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            item.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400' :
                            item.sentiment === 'Negative' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {item.sentiment}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(item.pubDate).toLocaleDateString('en-IN', { 
                              day: 'numeric', 
                              month: 'short' 
                            })}
                          </span>
                          {item.recencyWeight && item.recencyWeight > 1.5 && (
                            <span className="text-[10px] text-yellow-500">
                              🔥 Recent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                )) : (
                  <p className="text-gray-500 text-sm italic">No recent news found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

            {/* ============================================================ */}
      {/* EMPTY STATE */}
      {/* ============================================================ */}
      {!analysis && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
            <BarChart2 size={40} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h2>
          <p className="text-gray-500 max-w-md mb-6">
            Select a stock and click "Analyze" to get comprehensive technical analysis with Phase 2 indicators: 
            Stochastic RSI, Ichimoku Cloud, Supertrend, and AI-powered predictions.
          </p>
          <div className="flex gap-4 text-sm text-gray-400 flex-wrap justify-center">
            <span className="flex items-center gap-1">
              <Gauge size={14} /> Stoch RSI
            </span>
            <span className="flex items-center gap-1">
              <Cloud size={14} /> Ichimoku
            </span>
            <span className="flex items-center gap-1">
              <Waves size={14} /> Supertrend
            </span>
            <span className="flex items-center gap-1">
              <BrainCircuit size={14} /> AI Predictions
            </span>
            <span className="flex items-center gap-1">
              <History size={14} /> Backtesting
            </span>
          </div>
          
          {/* Keyboard Shortcut Hint */}
          <div className="mt-8 text-xs text-gray-600">
            Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">⌘</kbd> + 
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">Enter</kbd> to analyze
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  )
}

// ============================================================
// MAIN EXPORT WITH SUSPENSE
// ============================================================

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-400 text-sm">Loading analyzer...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}