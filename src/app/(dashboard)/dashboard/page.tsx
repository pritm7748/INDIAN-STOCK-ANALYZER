// src/app/(dashboard)/dashboard/page.tsx
'use client'

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from 'next/navigation'
import { STOCK_LIST, StockSymbol } from "@/lib/stockList"
import { useUser } from '@/lib/hooks/useUser'
import { useWatchlists, useStockInWatchlists } from '@/lib/hooks/useWatchlists'
import { createClient } from '@/lib/supabase/client'
import {
  getFromCache,
  saveToCache,
  hasValidCache,
  clearCacheEntry,
  formatAge
} from '@/lib/cache'

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
  Radio, Snowflake, Database, Clock
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
  const colorClasses: Record<string, { text: string; glow: string; bg: string }> = {
    white: { text: 'text-[var(--foreground)]', glow: 'hover:shadow-gray-500/10', bg: 'from-gray-500/10 to-gray-600/5' },
    green: { text: 'text-emerald-500 dark:text-emerald-400', glow: 'hover:shadow-emerald-500/20', bg: 'from-emerald-500/10 to-emerald-600/5' },
    red: { text: 'text-rose-500 dark:text-rose-400', glow: 'hover:shadow-rose-500/20', bg: 'from-rose-500/10 to-rose-600/5' },
    yellow: { text: 'text-amber-500 dark:text-yellow-400', glow: 'hover:shadow-amber-500/20', bg: 'from-amber-500/10 to-amber-600/5' },
    blue: { text: 'text-blue-500 dark:text-blue-400', glow: 'hover:shadow-blue-500/20', bg: 'from-blue-500/10 to-blue-600/5' },
    purple: { text: 'text-purple-500 dark:text-purple-400', glow: 'hover:shadow-purple-500/20', bg: 'from-purple-500/10 to-purple-600/5' },
    orange: { text: 'text-orange-500 dark:text-orange-400', glow: 'hover:shadow-orange-500/20', bg: 'from-orange-500/10 to-orange-600/5' },
    cyan: { text: 'text-cyan-500 dark:text-cyan-400', glow: 'hover:shadow-cyan-500/20', bg: 'from-cyan-500/10 to-cyan-600/5' },
  }
  const style = colorClasses[color] || colorClasses.white

  return (
    <div className={`glass-card p-4 ${style.glow} transition-all duration-300 group relative hover:-translate-y-0.5`}>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground-secondary)] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-10 pointer-events-none max-w-xs text-center shadow-xl">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--card)] border-r border-b border-[var(--border)] rotate-45 -mt-1" />
        </div>
      )}
      <div className="flex items-center gap-2 text-[var(--foreground-muted)] mb-2">
        <div className={`p-1 rounded-md bg-gradient-to-br ${style.bg}`}>
          <Icon size={12} className={style.text} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${style.text}`}>
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
  const colorClasses: Record<string, { text: string; bg: string }> = {
    blue: { text: 'text-blue-400', bg: 'from-blue-500/20 to-cyan-500/20' },
    green: { text: 'text-emerald-400', bg: 'from-emerald-500/20 to-teal-500/20' },
    red: { text: 'text-rose-400', bg: 'from-rose-500/20 to-pink-500/20' },
    yellow: { text: 'text-yellow-400', bg: 'from-yellow-500/20 to-amber-500/20' },
    purple: { text: 'text-purple-400', bg: 'from-purple-500/20 to-indigo-500/20' },
    orange: { text: 'text-orange-400', bg: 'from-orange-500/20 to-red-500/20' },
    cyan: { text: 'text-cyan-400', bg: 'from-cyan-500/20 to-blue-500/20' },
    pink: { text: 'text-pink-400', bg: 'from-pink-500/20 to-rose-500/20' },
  }
  const style = colorClasses[color] || colorClasses.blue

  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="flex items-center gap-2.5 text-xs font-bold text-gray-300 uppercase tracking-widest">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${style.bg}`}>
          <Icon size={14} className={style.text} />
        </div>
        {title}
      </h3>
      {badge && (
        <span className="text-[10px] px-2.5 py-1 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-full text-purple-400 font-medium">
          {badge}
        </span>
      )}
    </div>
  )
}

function SignalBadge({ signal, size = 'md' }: { signal: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  }

  const getSignalStyle = (s: string) => {
    const signal = s.toUpperCase()
    if (signal.includes('STRONG_BUY') || signal.includes('STRONG BUY'))
      return { classes: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', glow: 'shadow-emerald-500/30' }
    if (signal.includes('BUY') || signal.includes('BULLISH'))
      return { classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-emerald-500/20' }
    if (signal.includes('STRONG_SELL') || signal.includes('STRONG SELL'))
      return { classes: 'bg-rose-500/20 text-rose-400 border-rose-500/30', glow: 'shadow-rose-500/30' }
    if (signal.includes('SELL') || signal.includes('BEARISH'))
      return { classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20', glow: 'shadow-rose-500/20' }
    if (signal.includes('OVERBOUGHT'))
      return { classes: 'bg-orange-500/10 text-orange-400 border-orange-500/20', glow: 'shadow-orange-500/20' }
    if (signal.includes('OVERSOLD'))
      return { classes: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', glow: 'shadow-cyan-500/20' }
    return { classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20', glow: '' }
  }

  const style = getSignalStyle(signal)

  return (
    <span className={`${sizeClasses[size]} ${style.classes} rounded-lg font-semibold border shadow-lg ${style.glow} animate-fade-in`}>
      {signal.replace(/_/g, ' ')}
    </span>
  )
}

// Premium Card Wrapper for section containers
function PremiumCard({
  children,
  className = '',
  gradient = 'blue',
  animate = true,
  glowOnHover = true
}: {
  children: React.ReactNode
  className?: string
  gradient?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'none'
  animate?: boolean
  glowOnHover?: boolean
}) {
  const gradientBg: Record<string, string> = {
    blue: 'from-blue-500/5 via-transparent to-transparent',
    green: 'from-emerald-500/5 via-transparent to-transparent',
    red: 'from-rose-500/5 via-transparent to-transparent',
    purple: 'from-purple-500/5 via-transparent to-transparent',
    orange: 'from-orange-500/5 via-transparent to-transparent',
    cyan: 'from-cyan-500/5 via-transparent to-transparent',
    none: '',
  }

  const glowClass: Record<string, string> = {
    blue: 'hover:shadow-blue-500/10',
    green: 'hover:shadow-emerald-500/10',
    red: 'hover:shadow-rose-500/10',
    purple: 'hover:shadow-purple-500/10',
    orange: 'hover:shadow-orange-500/10',
    cyan: 'hover:shadow-cyan-500/10',
    none: '',
  }

  return (
    <div className={`
      relative overflow-hidden rounded-2xl
      bg-[var(--card)] border border-[var(--border)]
      ${animate ? 'animate-fade-in-up' : ''}
      ${glowOnHover ? `transition-all duration-300 hover:shadow-xl ${glowClass[gradient]}` : ''}
      ${className}
    `}>
      {gradient !== 'none' && (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientBg[gradient]} pointer-events-none`} />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function ProgressBar({ value, max = 100, color = 'blue', showLabel = true, animate = true }: {
  value: number
  max?: number
  color?: string
  showLabel?: boolean
  animate?: boolean
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const colorClasses: Record<string, string> = {
    blue: 'bg-gradient-to-r from-blue-600 to-blue-400',
    green: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
    red: 'bg-gradient-to-r from-rose-600 to-rose-400',
    yellow: 'bg-gradient-to-r from-amber-600 to-amber-400',
    purple: 'bg-gradient-to-r from-purple-600 to-purple-400',
    cyan: 'bg-gradient-to-r from-cyan-600 to-cyan-400',
    gradient: 'bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500'
  }

  const glowClasses: Record<string, string> = {
    blue: 'shadow-blue-500/50',
    green: 'shadow-emerald-500/50',
    red: 'shadow-rose-500/50',
    yellow: 'shadow-amber-500/50',
    purple: 'shadow-purple-500/50',
    cyan: 'shadow-cyan-500/50',
    gradient: 'shadow-amber-500/30'
  }

  return (
    <div className="w-full">
      <div className="h-2.5 bg-[var(--background-secondary)] rounded-full overflow-hidden border border-[var(--border)]">
        <div
          className={`h-full ${colorClasses[color]} rounded-full shadow-lg ${glowClasses[color]} relative overflow-hidden ${animate ? 'transition-all duration-700 ease-out' : ''}`}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      {showLabel && (
        <div className="flex justify-between text-[10px] text-[var(--foreground-muted)] mt-1">
          <span>0</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CACHE STATUS COMPONENT
// ============================================================

function CacheStatus({
  symbol,
  timeframe,
  onRefresh
}: {
  symbol: string
  timeframe: string
  onRefresh: () => void
}) {
  const cached = getFromCache<AnalysisData>(symbol, timeframe)

  if (!cached) return null

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${cached.isStale
      ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      }`}>
      <Database size={12} />
      <span>
        {cached.isStale ? 'Stale cache' : 'Cached'} • {formatAge(cached.age)}
      </span>
      {cached.isStale && (
        <button
          onClick={onRefresh}
          className="ml-1 p-0.5 hover:bg-white/10 rounded transition-colors"
          title="Refresh analysis"
        >
          <RefreshCw size={12} />
        </button>
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
  const [analysisStockSearch, setAnalysisStockSearch] = useState('')
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false)
  const analysisFilteredStocks = STOCK_LIST.filter(s =>
    s.name.toLowerCase().includes(analysisStockSearch.toLowerCase()) ||
    s.symbol.toLowerCase().includes(analysisStockSearch.toLowerCase())
  ).slice(0, 15)
  const selectedStockName = STOCK_LIST.find(s => s.symbol === selectedStock)?.name || selectedStock
  const [cacheAge, setCacheAge] = useState<number | null>(null)
  const [usedCache, setUsedCache] = useState<boolean>(false)
  const [signalLoading, setSignalLoading] = useState(false)
  const [signalMessage, setSignalMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

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

  // Analyze function with caching
  const handleAnalyze = useCallback(async (forceRefresh: boolean = false) => {
    setLoading(true)
    setError(null)
    setUsedCache(false)
    setCacheAge(null)

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getFromCache<AnalysisData>(selectedStock, timeframe)

      if (cached && !cached.isStale) {
        console.log(`📦 Using cached analysis for ${selectedStock} (${timeframe}) - ${formatAge(cached.age)}`)
        setAnalysis(cached.data)
        setCacheAge(cached.age)
        setUsedCache(true)
        setLoading(false)

        // Save to analysis history if authenticated (even for cached)
        if (userId) {
          await supabase.from('analysis_history').insert({
            user_id: userId,
            symbol: selectedStock,
            stock_name: selectedStockData?.name,
            timeframe,
            score: cached.data.score,
            recommendation: cached.data.recommendation,
            price: cached.data.price,
          })
        }
        return
      }

      // If stale cache exists, show it immediately while fetching fresh data
      if (cached && cached.isStale) {
        console.log(`⏳ Showing stale cache for ${selectedStock} while refreshing...`)
        setAnalysis(cached.data)
        setCacheAge(cached.age)
        setUsedCache(true)
        // Don't return - continue to fetch fresh data
      }
    }

    try {
      const res = await fetch(`/api/analyze?symbol=${selectedStock}&timeframe=${timeframe}`)
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || "Analysis failed")
      }

      // Save to cache
      saveToCache(selectedStock, timeframe, data)
      console.log(`💾 Saved fresh analysis to cache for ${selectedStock} (${timeframe})`)

      setAnalysis(data)
      setCacheAge(null)
      setUsedCache(false)

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
        })
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Analysis failed. Please try again.")
      // If we had stale cache displayed, keep it on error
      if (!analysis) {
        setAnalysis(null)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedStock, timeframe, userId, supabase])

  // Force refresh (bypass cache)
  const handleForceRefresh = useCallback(() => {
    clearCacheEntry(selectedStock, timeframe)
    handleAnalyze(true)
  }, [selectedStock, timeframe, handleAnalyze])

  // Generate trade signal from analysis
  const handleGenerateSignal = useCallback(async () => {
    if (!analysis || !isAuthenticated) {
      setSignalMessage({ type: 'error', text: 'Please sign in and run analysis first' })
      return
    }

    setSignalLoading(true)
    setSignalMessage(null)

    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: {
            symbol: analysis.symbol,
            stock_name: selectedStockData?.name,
            price: analysis.price,
            score: analysis.score,
            confidence: analysis.confidence,
            details: analysis.details,
            recommendation: analysis.recommendation,
            risk: {
              ...analysis.risk,
              atr: analysis.volatility?.atr,  // Pass ATR for precise targets
            },
            technicals: {
              rsi: analysis.metrics?.rsi,
              adx: analysis.volatility?.adx,  // Pass ADX for regime filtering
              trend: analysis.volatility?.trendStrength,
            }
          },
          timeframe
        })
      })

      const data = await res.json()

      if (data.generated) {
        setSignalMessage({
          type: 'success',
          text: `${data.signal.signal_type} signal created! Target: ₹${data.signal.target_price}, SL: ₹${data.signal.stop_loss}`
        })
      } else {
        setSignalMessage({
          type: 'info',
          text: data.reason || 'Signal not generated (score in neutral zone)'
        })
      }
    } catch (err: any) {
      setSignalMessage({ type: 'error', text: err.message || 'Failed to generate signal' })
    } finally {
      setSignalLoading(false)
    }
  }, [analysis, isAuthenticated, timeframe, selectedStock])  // Use selectedStock instead of selectedStockData

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleAnalyze()
      }
      // Shift+Cmd+Enter for force refresh
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        handleForceRefresh()
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleAnalyze, handleForceRefresh])

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-down">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Stock Analyzer</h1>
            <p className="text-[var(--foreground-muted)] text-sm">AI-powered technical analysis for Indian stocks</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <input
              value={showAnalysisDropdown ? analysisStockSearch : selectedStockName}
              onChange={e => { setAnalysisStockSearch(e.target.value); setShowAnalysisDropdown(true) }}
              onFocus={() => { setShowAnalysisDropdown(true); setAnalysisStockSearch('') }}
              onBlur={() => setTimeout(() => setShowAnalysisDropdown(false), 200)}
              className="w-full px-4 py-2.5 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Search stock..."
            />
            {showAnalysisDropdown && analysisStockSearch.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-xl max-h-60 overflow-y-auto">
                {analysisFilteredStocks.length > 0 ? analysisFilteredStocks.map((stock: StockSymbol) => (
                  <button key={stock.symbol} onMouseDown={e => e.preventDefault()} onClick={() => {
                    setSelectedStock(stock.symbol)
                    setAnalysisStockSearch('')
                    setShowAnalysisDropdown(false)
                  }} className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--card-hover)] flex justify-between">
                    <span className="text-[var(--foreground)]">{stock.name}</span>
                    <span className="text-[var(--foreground-muted)] text-xs">{stock.symbol.replace('.NS', '')}</span>
                  </button>
                )) : (
                  <p className="px-3 py-2 text-sm text-[var(--foreground-muted)]">No stocks found</p>
                )}
              </div>
            )}
          </div>

          {/* Timeframe Selector */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2.5 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] [&>option]:bg-[var(--card)] [&>option]:text-[var(--foreground)]"
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
              className={`p-2.5 rounded-xl transition-all disabled:opacity-50 ${isInAnyWatchlist
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
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 group"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap size={16} className="group-hover:animate-pulse" />
                Analyze
              </>
            )}
          </button>

          {/* Force Refresh Button (only shown when cache exists) */}
          {hasValidCache(selectedStock, timeframe) && !loading && (
            <button
              onClick={handleForceRefresh}
              className="p-2.5 rounded-xl bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
              title="Force refresh (bypass cache)"
            >
              <RefreshCw size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Cache Status Indicator */}
      {analysis && usedCache && cacheAge !== null && (
        <div className="flex items-center gap-3">
          <CacheStatus
            symbol={selectedStock}
            timeframe={timeframe}
            onRefresh={handleForceRefresh}
          />
          {loading && (
            <span className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 size={12} className="animate-spin" />
              Refreshing...
            </span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-rose-400" size={20} />
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !analysis && (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative w-24 h-24">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            {/* Inner pulsing orb */}
            <div className="absolute inset-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full animate-pulse"></div>
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <BrainCircuit size={28} className="text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[var(--foreground)] font-medium">Analyzing {selectedStockData?.name}...</p>
            <p className="text-[var(--foreground-muted)] text-sm mt-1">Running Phase 2 indicators: Stoch RSI, Ichimoku, ADX...</p>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
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
            <div className="glass-card p-6 animate-fade-in-up relative overflow-hidden">
              {/* Background glow effect */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">{analysis.symbol.replace('.NS', '')}</h2>
                    {selectedStockData?.sector && (
                      <span className="px-2 py-0.5 bg-[var(--background-secondary)] text-[var(--foreground-muted)] rounded text-xs border border-[var(--border)]">
                        {selectedStockData.sector}
                      </span>
                    )}
                    {analysis.risk?.marketTrend && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${analysis.risk.marketTrend === 'BULLISH'
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
                    {/* Cache indicator in price banner */}
                    {usedCache && cacheAge !== null && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs flex items-center gap-1">
                        <Clock size={10} />
                        {formatAge(cacheAge)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-4xl font-light text-[var(--foreground)]">
                      ₹{analysis.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${analysis.change >= 0
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

                <div className="flex flex-col items-end gap-2">
                  <div className={`px-6 py-3 rounded-xl text-sm font-bold tracking-wide border ${analysis.recommendation.includes('STRONG BUY') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                    analysis.recommendation.includes('BUY') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      analysis.recommendation.includes('STRONG SELL') ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
                        analysis.recommendation.includes('SELL') ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                          'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                    }`}>
                    {analysis.recommendation}
                  </div>

                  {isAuthenticated && (
                    <button
                      onClick={handleGenerateSignal}
                      disabled={signalLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                      {signalLoading ? (
                        <><Loader2 size={14} className="animate-spin" /> Creating...</>
                      ) : (
                        <><Crosshair size={14} /> Generate Signal</>
                      )}
                    </button>
                  )}

                  {signalMessage && (
                    <div className={`text-xs px-3 py-1.5 rounded-lg max-w-xs text-right ${signalMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                      signalMessage.type === 'error' ? 'bg-rose-500/10 text-rose-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                      {signalMessage.text}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chart Tabs */}
            <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-sm rounded-xl w-fit flex-wrap border border-white/5">
              {[
                { id: 'chart', label: 'Price Chart', icon: LineChart },
                { id: 'technicals', label: 'Indicators', icon: Activity },
                { id: 'momentum', label: 'Momentum', icon: Gauge },
                { id: 'backtest', label: 'Backtest', icon: History },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
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
              <PremiumCard gradient="blue" className="p-6">
                {/* Chart Controls */}
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[var(--foreground-muted)]">Show:</span>
                    {/* Premium Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={showVolume}
                        onChange={(e) => setShowVolume(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--background-tertiary)] border border-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-[var(--foreground-muted)] peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-purple-600 peer-checked:border-blue-500/50"></div>
                      <span className="ms-2 text-xs text-[var(--foreground-secondary)] group-hover:text-[var(--foreground)] transition-colors">Volume</span>
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
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
              </PremiumCard>
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
                <PremiumCard gradient="blue" className="p-6">
                  <SectionHeader icon={Waves} title="Bollinger Bands (20, 2)" color="blue" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-center hover:border-rose-500/30 transition-all">
                      <p className="text-xs text-[var(--foreground-muted)] mb-1">Upper Band</p>
                      <p className={`text-xl font-bold ${analysis.price > analysis.metrics.bollingerUpper ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--foreground)]'}`}>
                        ₹{analysis.metrics.bollingerUpper.toFixed(2)}
                      </p>
                      {analysis.price > analysis.metrics.bollingerUpper && (
                        <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1">⚠️ Price Above</p>
                      )}
                    </div>
                    <div className="p-4 bg-blue-500/10 rounded-xl text-center border border-blue-500/20">
                      <p className="text-xs text-[var(--foreground-muted)] mb-1">Current Price</p>
                      <p className="text-xl font-bold text-blue-500 dark:text-blue-400">
                        ₹{analysis.price.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                        {((analysis.price - analysis.metrics.bollingerLower) / (analysis.metrics.bollingerUpper - analysis.metrics.bollingerLower) * 100).toFixed(0)}% within bands
                      </p>
                    </div>
                    <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-center hover:border-emerald-500/30 transition-all">
                      <p className="text-xs text-[var(--foreground-muted)] mb-1">Lower Band</p>
                      <p className={`text-xl font-bold ${analysis.price < analysis.metrics.bollingerLower ? 'text-emerald-500 dark:text-emerald-400' : 'text-[var(--foreground)]'}`}>
                        ₹{analysis.metrics.bollingerLower.toFixed(2)}
                      </p>
                      {analysis.price < analysis.metrics.bollingerLower && (
                        <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-1">📍 Price Below</p>
                      )}
                    </div>
                  </div>
                </PremiumCard>

                {/* Volatility Indicators */}
                {analysis.volatility && (
                  <PremiumCard gradient="orange" className="p-6">
                    <SectionHeader icon={Waves} title="Volatility & Trend Strength" color="orange" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl group hover:border-orange-500/30 transition-all">
                        <p className="text-xs text-[var(--foreground-muted)] mb-1">ATR (14)</p>
                        <p className="text-xl font-bold text-[var(--foreground)]">₹{analysis.volatility.atr.toFixed(2)}</p>
                        <p className="text-[10px] text-[var(--foreground-muted)]">{analysis.volatility.atrPercent.toFixed(2)}% of price</p>
                      </div>
                      <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl group hover:border-orange-500/30 transition-all">
                        <p className="text-xs text-[var(--foreground-muted)] mb-1">Supertrend</p>
                        <p className={`text-xl font-bold ${analysis.volatility.supertrendSignal === 'BUY' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                          {analysis.volatility.supertrendSignal}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)]">₹{analysis.volatility.supertrend.toFixed(2)}</p>
                      </div>
                      <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl group hover:border-orange-500/30 transition-all">
                        <p className="text-xs text-[var(--foreground-muted)] mb-1">ADX</p>
                        <p className="text-xl font-bold text-[var(--foreground)]">{analysis.volatility.adx.toFixed(1)}</p>
                        <p className={`text-[10px] ${analysis.volatility.trendStrength === 'STRONG' ? 'text-emerald-500 dark:text-emerald-400' :
                          analysis.volatility.trendStrength === 'MODERATE' ? 'text-amber-500 dark:text-yellow-400' : 'text-[var(--foreground-muted)]'
                          }`}>{analysis.volatility.trendStrength}</p>
                      </div>
                      <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl group hover:border-orange-500/30 transition-all">
                        <p className="text-xs text-[var(--foreground-muted)] mb-1">DI Spread</p>
                        <p className={`text-xl font-bold ${analysis.volatility.plusDI > analysis.volatility.minusDI ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                          {analysis.volatility.plusDI > analysis.volatility.minusDI ? '+DI Leads' : '-DI Leads'}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)]">
                          +{analysis.volatility.plusDI.toFixed(1)} / -{analysis.volatility.minusDI.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    {/* Suggested Stop Loss */}
                    <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-fade-in">
                      <p className="text-sm text-amber-500 dark:text-amber-400 flex items-center gap-2 font-medium">
                        <Shield size={14} />
                        Suggested Stop Loss (2x ATR): ₹{(analysis.price - (analysis.volatility.atr * 2)).toFixed(2)}
                      </p>
                    </div>
                  </PremiumCard>
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

                {/* Stochastic RSI Section */}
                {analysis.stochRsi && (
                  <PremiumCard gradient="cyan" className="p-6">
                    <SectionHeader icon={Gauge} title="Stochastic RSI" color="cyan" badge="Phase 2" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Gauge Visualization with Glow */}
                      <div className="flex flex-col items-center justify-center p-4">
                        <div className="relative w-32 h-32">
                          {/* Glow effect behind gauge */}
                          <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${analysis.stochRsi.k > 80 ? 'bg-rose-500' :
                            analysis.stochRsi.k < 20 ? 'bg-cyan-500' : 'bg-blue-500'
                            }`} />
                          <svg className="w-full h-full transform -rotate-90 relative z-10">
                            <circle cx="64" cy="64" r="56" stroke="var(--border)" strokeWidth="8" fill="none" />
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
                              className="transition-all duration-700 ease-out"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                            <span className="text-2xl font-bold text-[var(--foreground)]">{analysis.stochRsi.k.toFixed(0)}</span>
                            <span className="text-[10px] text-[var(--foreground-muted)]">%K</span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <SignalBadge signal={analysis.stochRsi.signal} size="md" />
                        </div>
                      </div>

                      {/* K and D Lines */}
                      <div className="space-y-4">
                        <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-cyan-500/30 transition-all">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-[var(--foreground-muted)]">%K (Fast Line)</span>
                            <span className="text-lg font-bold text-[var(--foreground)]">{analysis.stochRsi.k.toFixed(1)}</span>
                          </div>
                          <ProgressBar value={analysis.stochRsi.k} color="blue" showLabel={false} />
                        </div>
                        <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-[var(--foreground-muted)]">%D (Slow Line)</span>
                            <span className="text-lg font-bold text-[var(--foreground)]">{analysis.stochRsi.d.toFixed(1)}</span>
                          </div>
                          <ProgressBar value={analysis.stochRsi.d} color="purple" showLabel={false} />
                        </div>
                        <div className="p-3 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-[var(--foreground-muted)]">K-D Spread</span>
                            <span className={`text-sm font-bold ${analysis.stochRsi.k > analysis.stochRsi.d ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                              }`}>
                              {(analysis.stochRsi.k - analysis.stochRsi.d).toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interpretation */}
                      <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl">
                        <h4 className="text-xs text-[var(--foreground-muted)] uppercase mb-3">Interpretation</h4>
                        <div className="space-y-2 text-sm">
                          {analysis.stochRsi.crossover && (
                            <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 font-medium animate-pulse">
                              <Crosshair size={14} />
                              <span>Crossover Detected!</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-[var(--foreground-secondary)]">
                            <ArrowRightLeft size={14} />
                            <span>K-D Spread: {(analysis.stochRsi.k - analysis.stochRsi.d).toFixed(1)}</span>
                          </div>
                          <div className="text-xs text-[var(--foreground-muted)] mt-3 p-3 bg-[var(--background-tertiary)] rounded-lg border border-[var(--border)]">
                            {analysis.stochRsi.k > 80 ? (
                              <span className="text-orange-500 dark:text-orange-400">⚠️ <strong>Overbought territory</strong> - Watch for potential reversal signals. Consider taking profits or tightening stops.</span>
                            ) : analysis.stochRsi.k < 20 ? (
                              <span className="text-cyan-500 dark:text-cyan-400">📍 <strong>Oversold territory</strong> - Potential buying opportunity if other indicators confirm. Wait for bullish crossover.</span>
                            ) : analysis.stochRsi.signal.includes('BULLISH') ? (
                              <span className="text-emerald-500 dark:text-emerald-400">✅ <strong>Bullish momentum building</strong> - %K crossed above %D, look for price confirmation.</span>
                            ) : analysis.stochRsi.signal.includes('BEARISH') ? (
                              <span className="text-rose-500 dark:text-rose-400">⚠️ <strong>Bearish momentum building</strong> - Consider protecting profits.</span>
                            ) : (
                              <span>📊 <strong>Neutral zone</strong> - Wait for clearer signal from crossover.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </PremiumCard>
                )}

                {/* Ichimoku Cloud Section */}
                {analysis.ichimoku && (
                  <PremiumCard gradient="purple" className="p-6">
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
                          <div className={`relative flex-1 mx-4 my-2 rounded-lg ${analysis.ichimoku.cloudColor === 'GREEN'
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
                              <span className={`text-xs font-medium ${analysis.ichimoku.cloudColor === 'GREEN' ? 'text-emerald-400' : 'text-rose-400'
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

                        <div className={`mt-4 p-3 rounded-lg ${analysis.ichimoku.priceVsCloud === 'ABOVE' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          analysis.ichimoku.priceVsCloud === 'BELOW' ? 'bg-rose-500/10 border border-rose-500/20' :
                            'bg-yellow-500/10 border border-yellow-500/20'
                          }`}>
                          <p className={`text-sm font-medium ${analysis.ichimoku.priceVsCloud === 'ABOVE' ? 'text-emerald-400' :
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
                        <div className={`p-4 rounded-xl ${analysis.ichimoku.tkCross === 'BULLISH' ? 'bg-emerald-500/10 border border-emerald-500/20' :
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
                            <span className={`text-sm font-bold ${analysis.ichimoku.tkCross === 'BULLISH' ? 'text-emerald-400' :
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
                  </PremiumCard>
                )}

                {/* Momentum Score Summary */}
                {analysis.momentum && (
                  <PremiumCard gradient="orange" className="p-6">
                    <SectionHeader icon={Flame} title="Combined Momentum Score" color="orange" />

                    <div className="flex items-center gap-6">
                      <div className="shrink-0 relative">
                        {/* Glow effect */}
                        <div className={`absolute inset-0 rounded-full blur-2xl opacity-30 ${analysis.momentum.score >= 70 ? 'bg-emerald-500' :
                          analysis.momentum.score <= 30 ? 'bg-rose-500' : 'bg-amber-500'
                          }`} />
                        <div className={`relative text-5xl font-bold ${analysis.momentum.score >= 70 ? 'text-emerald-500 dark:text-emerald-400' :
                          analysis.momentum.score >= 60 ? 'text-emerald-400 dark:text-emerald-300' :
                            analysis.momentum.score <= 30 ? 'text-rose-500 dark:text-rose-400' :
                              analysis.momentum.score <= 40 ? 'text-rose-400 dark:text-rose-300' : 'text-amber-500 dark:text-yellow-400'
                          }`}>
                          {analysis.momentum.score}
                        </div>
                        <p className="text-xs text-[var(--foreground-muted)] mt-1 text-center">out of 100</p>
                      </div>

                      <div className="flex-1">
                        <ProgressBar
                          value={analysis.momentum.score}
                          color="gradient"
                          showLabel={true}
                        />
                        <p className="text-sm text-[var(--foreground-secondary)] mt-2">
                          {analysis.momentum.interpretation}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)] mt-2">
                          Combines RSI, Stochastic RSI, and Williams %R for a comprehensive momentum view
                        </p>
                      </div>
                    </div>
                  </PremiumCard>
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
                <PremiumCard gradient="orange" className="p-6">
                  <SectionHeader icon={History} title="Trade History" color="orange" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--border)]">
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
                          <tr key={i} className={`border-b border-[var(--border)] transition-colors ${trade.isWin ? 'hover:bg-emerald-500/5' : 'hover:bg-rose-500/5'
                            }`}>
                            <td className="py-3 text-[var(--foreground-muted)]">{trade.date}</td>
                            <td className="py-3">
                              <SignalBadge signal={trade.signal} size="sm" />
                            </td>
                            <td className="py-3 text-[var(--foreground)]">₹{trade.priceAtSignal.toFixed(2)}</td>
                            <td className="py-3 text-[var(--foreground)]">₹{trade.priceAfter.toFixed(2)}</td>
                            <td className={`py-3 font-medium ${trade.returnPct >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                              {trade.returnPct >= 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                            </td>
                            <td className="py-3">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shadow-lg ${trade.isWin
                                ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 shadow-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-500 dark:text-rose-400 shadow-rose-500/20'
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
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-fade-in">
                      <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-2 font-medium">
                        <AlertTriangle size={14} />
                        Low historical accuracy ({analysis.backtest.accuracy.toFixed(0)}%) - Score has been adjusted accordingly
                      </p>
                    </div>
                  )}
                </PremiumCard>
              </div>
            )}

            {/* ============================================================ */}
            {/* PATTERNS & SIGNALS ROW */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patterns */}
              <PremiumCard gradient="blue" className="p-6">
                <SectionHeader icon={ScanEye} title="Detected Patterns" color="blue" />
                {analysis.patterns.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analysis.patterns.map((pattern: string, i: number) => (
                      <div
                        key={i}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-lg transition-all hover:scale-105 ${pattern.toLowerCase().includes('bullish') || pattern.toLowerCase().includes('bottom') || pattern.toLowerCase().includes('hammer') || pattern.toLowerCase().includes('higher')
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 dark:text-emerald-400 shadow-emerald-500/20'
                          : pattern.toLowerCase().includes('bearish') || pattern.toLowerCase().includes('top') || pattern.toLowerCase().includes('shooting') || pattern.toLowerCase().includes('lower')
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-500 dark:text-rose-400 shadow-rose-500/20'
                            : 'bg-blue-500/15 border-blue-500/30 text-blue-500 dark:text-blue-300 shadow-blue-500/20'
                          }`}
                      >
                        {pattern}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--foreground-muted)] text-sm italic">No patterns detected in current timeframe.</p>
                )}
              </PremiumCard>

              {/* Active Signals */}
              <PremiumCard gradient="orange" className="p-6">
                <SectionHeader icon={Zap} title="Active Signals" color="yellow" />
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {analysis.details.map((detail: string, index: number) => (
                    <div
                      key={index}
                      className="flex gap-2 items-start text-xs p-2.5 bg-[var(--background-secondary)] rounded-lg border border-[var(--border)] hover:border-amber-500/30 transition-all"
                    >
                      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${detail.toLowerCase().includes("bullish") ||
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
                          : "bg-amber-500"
                        }`} />
                      <span className="text-[var(--foreground-secondary)] leading-snug">{detail}</span>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </div>

            {/* ============================================================ */}
            {/* VOLUME ANALYSIS */}
            {/* ============================================================ */}
            {analysis.volume && (
              <PremiumCard gradient="purple" className="p-6">
                <SectionHeader icon={Volume2} title="Volume Analysis" color="purple" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                    <p className="text-xs text-[var(--foreground-muted)] mb-1">Today's Volume</p>
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      {formatLargeNumber(analysis.volume.currentVolume ?? 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                    <p className="text-xs text-[var(--foreground-muted)] mb-1">Avg Volume (20D)</p>
                    <p className="text-lg font-bold text-[var(--foreground)]">
                      {formatLargeNumber(analysis.volume.avgVolume ?? 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                    <p className="text-xs text-[var(--foreground-muted)] mb-1">Volume Ratio</p>
                    <p className={`text-lg font-bold ${(analysis.volume.volumeRatio ?? 0) > 1.5
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : (analysis.volume.volumeRatio ?? 0) < 0.5
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-[var(--foreground)]'
                      }`}>
                      {(analysis.volume.volumeRatio ?? 0).toFixed(2)}x
                    </p>
                    {analysis.volume.volumeSpike && (
                      <span className="text-xs text-amber-500 dark:text-yellow-400">🔥 Volume Spike!</span>
                    )}
                  </div>
                  <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                    <p className="text-xs text-[var(--foreground-muted)] mb-1">OBV Trend</p>
                    <p className={`text-lg font-bold ${analysis.volume.obvTrend === 'BULLISH'
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : analysis.volume.obvTrend === 'BEARISH'
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-[var(--foreground)]'
                      }`}>
                      {analysis.volume.obvTrend ?? 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Additional Volume Info */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                    <p className="text-xs text-[var(--foreground-muted)] mb-1">VWAP (Volume Weighted Avg Price)</p>
                    <p className={`text-lg font-bold ${analysis.price > (analysis.volume.vwap ?? 0)
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400'
                      }`}>
                      ₹{(analysis.volume.vwap ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[var(--foreground-muted)]">
                      {analysis.price > (analysis.volume.vwap ?? 0)
                        ? '📈 Price Above VWAP - Bullish intraday bias'
                        : '📉 Price Below VWAP - Bearish intraday bias'}
                    </p>
                  </div>
                  <div className="p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl hover:border-purple-500/30 transition-all">
                    <p className="text-xs text-[var(--foreground-muted)] mb-1">Volume Trend</p>
                    <p className={`text-lg font-bold ${analysis.volume.volumeTrend === 'ACCUMULATION'
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : analysis.volume.volumeTrend === 'DISTRIBUTION'
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-[var(--foreground)]'
                      }`}>
                      {analysis.volume.volumeTrend ?? 'NEUTRAL'}
                    </p>
                    <p className="text-[10px] text-[var(--foreground-muted)]">
                      {analysis.volume.volumeTrend === 'ACCUMULATION'
                        ? '💹 Smart money buying detected'
                        : analysis.volume.volumeTrend === 'DISTRIBUTION'
                          ? '💸 Institutional selling detected'
                          : '⚖️ No clear volume bias'}
                    </p>
                  </div>
                </div>

                {/* Volume Interpretation */}
                <div className="mt-4 p-4 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl">
                  <p className="text-xs text-[var(--foreground-muted)] uppercase mb-2">Volume Interpretation</p>
                  <div className="text-sm text-[var(--foreground-secondary)] space-y-1">
                    {analysis.volume.volumeSpike && analysis.change > 0 && (
                      <p className="text-emerald-500 dark:text-emerald-400">✅ High volume with price increase - Strong bullish confirmation</p>
                    )}
                    {analysis.volume.volumeSpike && analysis.change < 0 && (
                      <p className="text-rose-500 dark:text-rose-400">⚠️ High volume with price decrease - Strong bearish confirmation</p>
                    )}
                    {analysis.volume.obvTrend === 'BULLISH' && (
                      <p className="text-emerald-500 dark:text-emerald-400">📈 OBV rising - Accumulation phase, buyers in control</p>
                    )}
                    {analysis.volume.obvTrend === 'BEARISH' && (
                      <p className="text-rose-500 dark:text-rose-400">📉 OBV falling - Distribution phase, sellers in control</p>
                    )}
                    {!analysis.volume.volumeSpike && analysis.volume.volumeRatio < 0.7 && (
                      <p className="text-[var(--foreground-muted)]">📊 Low volume day - Move may lack conviction</p>
                    )}
                  </div>
                </div>
              </PremiumCard>
            )}
          </div>

          {/* ============================================================ */}
          {/* RIGHT COLUMN (4 cols) */}
          {/* ============================================================ */}
          <div className="lg:col-span-4 space-y-6">

            {/* Score Gauge */}
            <PremiumCard gradient="blue" className="p-8 flex flex-col items-center justify-center">
              <h3 className="text-[var(--foreground-muted)] text-xs font-bold uppercase tracking-widest mb-6">AI Technical Score</h3>
              <div className="relative w-44 h-44 flex items-center justify-center">
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${analysis.score >= 60 ? 'bg-emerald-500' : analysis.score <= 40 ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                <svg className="w-full h-full transform -rotate-90 relative z-10">
                  <circle cx="88" cy="88" r="75" stroke="var(--border)" strokeWidth="10" fill="none" />
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
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className={`text-5xl font-bold ${getScoreColor(analysis.score)}`}>
                    {analysis.score}
                  </span>
                  <span className="text-xs text-[var(--foreground-muted)] uppercase mt-1">out of 100</span>
                </div>
              </div>
              {/* Score Legend */}
              <div className="mt-6 flex gap-4 text-xs flex-wrap justify-center">
                <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
                  <div className="w-2 h-2 bg-rose-500 dark:bg-rose-400 rounded-full"></div> 0-40 Sell
                </span>
                <span className="flex items-center gap-1 text-amber-500 dark:text-yellow-400">
                  <div className="w-2 h-2 bg-amber-500 dark:bg-yellow-400 rounded-full"></div> 40-60 Hold
                </span>
                <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                  <div className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full"></div> 60-100 Buy
                </span>
              </div>
              {/* Confidence */}
              {analysis.confidence !== undefined && (
                <div className="mt-4 w-full">
                  <div className="flex justify-between text-xs text-[var(--foreground-muted)] mb-1">
                    <span>Confidence</span>
                    <span>{analysis.confidence}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--background-tertiary)] rounded-full overflow-hidden border border-[var(--border)]">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-700"
                      style={{ width: `${analysis.confidence}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Cache indicator */}
              {usedCache && cacheAge !== null && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                  <Database size={12} />
                  <span>From cache • {formatAge(cacheAge)}</span>
                </div>
              )}
            </PremiumCard>

            {/* Risk Metrics */}
            {analysis.risk && (
              <PremiumCard gradient="red" className="p-6">
                <SectionHeader icon={Shield} title="Risk Metrics" color="red" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Beta (vs Nifty)</p>
                    <p className={`text-lg font-bold ${analysis.risk.beta > 1.2 ? 'text-rose-400' :
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
                    <p className={`text-lg font-bold ${(analysis.risk.sharpeRatio ?? 0) > 1 ? 'text-emerald-400' :
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
                        <p className={`text-xl font-bold ${analysis.risk.riskGrade === 'LOW' ? 'text-emerald-400' :
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
                    <span className={`text-sm font-bold ${analysis.risk.marketTrend === 'BULLISH' ? 'text-emerald-400' :
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
              </PremiumCard>
            )}

            {/* AI Forecast */}
            {analysis.prediction && analysis.prediction.length > 0 && (
              <PremiumCard gradient="purple" className="p-6">
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
                    <p className={`text-lg font-bold ${analysis.prediction[analysis.prediction.length - 1].price > analysis.price
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
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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

                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-2">
                    <Info size={12} />
                    AI predictions are for reference only. Not financial advice.
                  </p>
                </div>
              </PremiumCard>
            )}

            {/* Fundamentals */}
            <PremiumCard gradient="green" className="p-6">
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
                  <p className={`text-sm font-bold ${analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio < 20
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
            </PremiumCard>

            {/* Pivot Points */}
            <PremiumCard gradient="blue" className="p-6">
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
            </PremiumCard>

            {/* News Feed */}
            <PremiumCard gradient="purple" className="p-6">
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
                      <div className={`mt-1.5 w-1 min-h-8 rounded-full shrink-0 ${item.sentiment === 'Positive' ? 'bg-emerald-500' :
                        item.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-gray-600'
                        }`} />
                      <div className="flex-1">
                        <h4 className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400' :
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
            </PremiumCard>
          </div>
        </div>
      )
      }

      {/* ============================================================ */}
      {/* EMPTY STATE */}
      {/* ============================================================ */}
      {
        !analysis && !loading && !error && (
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
            <div className="mt-8 text-xs text-gray-600 space-y-1">
              <p>
                Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">⌘</kbd> +
                <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">Enter</kbd> to analyze
              </p>
              <p>
                Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">⇧</kbd> +
                <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">⌘</kbd> +
                <kbd className="px-1.5 py-0.5 bg-white/5 rounded mx-1">Enter</kbd> to force refresh
              </p>
            </div>
          </div>
        )
      }

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
    </div >
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