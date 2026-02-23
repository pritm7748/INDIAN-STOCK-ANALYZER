// src/app/(dashboard)/dashboard/screener/page.tsx

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Search,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Rocket,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
  Building,
  Loader2,
  BarChart2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Bookmark,
  BookmarkCheck,
  BadgeDollarSign,
  Skull,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Info,
  Database,
  Clock,
  Activity
} from 'lucide-react'
import { SCREENER_PRESETS, SECTORS, ScreenerFilters, ScreenerResult, ScreenerPreset } from '@/lib/screener/types'
import { useUser } from '@/lib/hooks/useUser'
import { useWatchlists } from '@/lib/hooks/useWatchlists'
import { createClient } from '@/lib/supabase/client'

// Icon mapping
const iconMap: Record<string, any> = {
  TrendingUp,
  TrendingDown,
  Rocket,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
  Building,
  BadgeDollarSign,
  Skull
}

// Format helpers
const formatNumber = (num: number): string => {
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(0)} Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(0)} L`
  return `₹${num.toLocaleString('en-IN')}`
}

const formatPrice = (price: number): string => {
  return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface CacheStatus {
  totalStocks: number
  cachedStocks: number
  coverage: number
  lastScanAt: number
  cacheAge: number
  ageMinutes?: number
  isStale: boolean
}

interface ScanStatus {
  scanId: string
  status: 'idle' | 'running' | 'completed' | 'error'
  completed: number
  total: number
}

export default function ScreenerPage() {
  // State
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [totalResults, setTotalResults] = useState(0)
  const [sortBy, setSortBy] = useState<'changePercent' | 'rsi' | 'pe' | 'marketCap'>('changePercent')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Cache & Scan status
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Custom filters
  const [filters, setFilters] = useState<ScreenerFilters>({})
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])

  // Hooks
  const { userId, isAuthenticated } = useUser()
  const { getOrCreateDefaultWatchlist } = useWatchlists()
  const supabase = createClient()

  // Watchlist state
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null)
  const [watchlistSymbols, setWatchlistSymbols] = useState<Set<string>>(new Set())

  // Polling ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch cache status on mount
  useEffect(() => {
    fetchStatus()

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  // Poll for scan progress when running
  useEffect(() => {
    if (scanStatus?.status === 'running') {
      pollIntervalRef.current = setInterval(fetchStatus, 2000)
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [scanStatus?.status])

  // Fetch status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/screener?action=status')
      const data = await response.json()

      if (data.cache) setCacheStatus(data.cache)
      if (data.scan) setScanStatus(data.scan)
    } catch (err) {
      console.error('Failed to fetch status:', err)
    }
  }

  // Trigger refresh
  const triggerRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/screener?action=refresh')
      const data = await response.json()

      if (data.scan) setScanStatus(data.scan)
      if (data.cache) setCacheStatus(data.cache)
    } catch (err) {
      console.error('Failed to start refresh:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Run screener
  const runScreener = useCallback(async (customFilters?: ScreenerFilters) => {
    setIsLoading(true)
    setError(null)

    try {
      const filtersToUse = customFilters || {
        ...filters,
        sectors: selectedSectors.length > 0 ? selectedSectors : undefined
      }

      const response = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: filtersToUse,
          sortBy,
          sortOrder
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Screener failed')
      }

      setResults(data.results || [])
      setTotalResults(data.total || 0)

      if (data.cache) setCacheStatus(data.cache)
      if (data.scan) setScanStatus(data.scan)

      if (data.message) {
        setError(data.message)
      }
    } catch (err: any) {
      console.error('Screener error:', err)
      setError(err.message || 'Failed to run screener')
    } finally {
      setIsLoading(false)
    }
  }, [filters, selectedSectors, sortBy, sortOrder])

  // Apply preset
  const applyPreset = (preset: ScreenerPreset) => {
    setActivePreset(preset.id)
    setFilters(preset.filters)
    setSelectedSectors([])
    runScreener(preset.filters)
  }

  // Clear filters
  const clearFilters = () => {
    setFilters({})
    setSelectedSectors([])
    setActivePreset(null)
    setResults([])
  }

  // Toggle sector
  const toggleSector = (sector: string) => {
    setSelectedSectors(prev =>
      prev.includes(sector)
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    )
  }

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    let aVal: number = 0
    let bVal: number = 0

    switch (sortBy) {
      case 'changePercent':
        aVal = a.changePercent
        bVal = b.changePercent
        break
      case 'rsi':
        aVal = a.rsi
        bVal = b.rsi
        break
      case 'pe':
        aVal = a.pe || 999
        bVal = b.pe || 999
        break
      case 'marketCap':
        aVal = a.marketCap
        bVal = b.marketCap
        break
    }

    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
  })

  // Toggle sort
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // Add to watchlist
  const addToWatchlist = async (symbol: string) => {
    if (!userId) return

    setAddingToWatchlist(symbol)
    try {
      const defaultWatchlist = await getOrCreateDefaultWatchlist()

      await supabase.from('watchlist_items').insert({
        watchlist_id: defaultWatchlist.id,
        user_id: userId,
        symbol,
      })

      setWatchlistSymbols(prev => new Set([...prev, symbol]))
    } catch (err) {
      console.error('Failed to add to watchlist:', err)
    } finally {
      setAddingToWatchlist(null)
    }
  }

  // Get color classes for presets
  const getPresetColors = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
      cyan: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', text: 'text-cyan-500', activeBg: 'bg-cyan-500/15' },
      orange: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-500', activeBg: 'bg-orange-500/15' },
      emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-500', activeBg: 'bg-emerald-500/15' },
      yellow: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', text: 'text-yellow-500', activeBg: 'bg-yellow-500/15' },
      rose: { bg: 'bg-rose-500/5', border: 'border-rose-500/20', text: 'text-rose-500', activeBg: 'bg-rose-500/15' },
      blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-500', activeBg: 'bg-blue-500/15' },
      purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-500', activeBg: 'bg-purple-500/15' },
    }
    const c = colors[color] || colors.blue
    return isActive
      ? `${c.activeBg} ${c.border} ${c.text} ring-2 ring-offset-2 ring-offset-[var(--background)]`
      : `${c.bg} ${c.border} hover:${c.activeBg}`
  }

  // Calculate progress percentage
  const scanProgress = scanStatus?.status === 'running' && scanStatus.total > 0
    ? Math.round((scanStatus.completed / scanStatus.total) * 100)
    : null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Stock Screener</h1>
          <p className="text-[var(--foreground-muted)]">Find stocks matching your criteria</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${showFilters
                ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                : 'bg-[var(--card)] text-[var(--foreground-secondary)] border-[var(--border)] hover:bg-[var(--card-hover)]'
              }`}
          >
            <SlidersHorizontal size={18} />
            Custom Filters
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {(Object.keys(filters).length > 0 || selectedSectors.length > 0) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--card)] text-[var(--foreground-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--card-hover)] transition-colors"
            >
              <X size={18} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cache & Scan Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm">
        <div className="flex items-center gap-6">
          {/* Cache Status */}
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[var(--primary)]" />
            <span className="text-sm text-[var(--foreground-secondary)]">
              {cacheStatus ? (
                <>
                  <span className="text-[var(--foreground)] font-semibold">{cacheStatus.cachedStocks}</span>
                  /{cacheStatus.totalStocks} stocks
                </>
              ) : (
                'Loading...'
              )}
            </span>
          </div>

          {/* Last Update */}
          {cacheStatus && cacheStatus.ageMinutes !== undefined && (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[var(--foreground-muted)]" />
              <span className="text-sm text-[var(--foreground-muted)]">
                {cacheStatus.ageMinutes === 0 ? 'Just now' : `${cacheStatus.ageMinutes} min ago`}
              </span>
            </div>
          )}

          {/* Scan Progress */}
          {scanStatus?.status === 'running' && scanProgress !== null && (
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[var(--success)] animate-pulse" />
              <span className="text-sm text-[var(--success)] font-medium">
                Scanning... {scanProgress}%
              </span>
              <div className="w-24 h-1.5 bg-[var(--background-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--success)] transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={triggerRefresh}
          disabled={isRefreshing || scanStatus?.status === 'running'}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 text-[var(--foreground-secondary)] rounded-xl transition-colors"
        >
          <RefreshCw size={16} className={isRefreshing || scanStatus?.status === 'running' ? 'animate-spin' : ''} />
          {scanStatus?.status === 'running' ? 'Scanning...' : 'Refresh Data'}
        </button>
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SCREENER_PRESETS.map((preset) => {
          const Icon = iconMap[preset.icon] || Zap
          const isActive = activePreset === preset.id

          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              disabled={isLoading || !cacheStatus || cacheStatus.cachedStocks === 0}
              className={`p-4 rounded-2xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getPresetColors(preset.color, isActive)}`}
            >
              <Icon size={20} className={isActive ? '' : 'text-[var(--foreground-muted)]'} />
              <p className={`font-medium mt-2 text-sm ${isActive ? '' : 'text-[var(--foreground)]'}`}>
                {preset.name}
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1 line-clamp-2">
                {preset.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Custom Filters Panel */}
      {showFilters && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-6 shadow-sm animate-fade-in">
          {/* Technical Filters */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-4">
              Technical Indicators
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* RSI Range */}
              <div>
                <label className="text-xs text-[var(--foreground-muted)] mb-1 block">RSI Min</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.rsiMin || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, rsiMin: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="0"
                  className="input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--foreground-muted)] mb-1 block">RSI Max</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.rsiMax || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, rsiMax: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="100"
                  className="input w-full px-3 py-2 text-sm"
                />
              </div>

              {/* P/E Range */}
              <div>
                <label className="text-xs text-[var(--foreground-muted)] mb-1 block">P/E Min</label>
                <input
                  type="number"
                  min={0}
                  value={filters.peMin || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, peMin: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="0"
                  className="input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--foreground-muted)] mb-1 block">P/E Max</label>
                <input
                  type="number"
                  min={0}
                  value={filters.peMax || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, peMax: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="∞"
                  className="input w-full px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Toggle Filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                { key: 'aboveSMA50', label: 'Above SMA50' },
                { key: 'aboveSMA200', label: 'Above SMA200' },
                { key: 'macdBullish', label: 'MACD Bullish' },
                { key: 'macdBearish', label: 'MACD Bearish' },
                { key: 'goldenCross', label: 'Golden Cross' },
                { key: 'deathCross', label: 'Death Cross' },
                { key: 'near52WeekHigh', label: 'Near 52W High' },
                { key: 'near52WeekLow', label: 'Near 52W Low' },
                { key: 'volumeSpike', label: 'Volume Spike (2x)' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof ScreenerFilters] }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${filters[key as keyof ScreenerFilters]
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]'
                      : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] border-[var(--border)] hover:bg-[var(--background-tertiary)]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sector Filter */}
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-4">
              Sectors ({selectedSectors.length} selected)
            </h3>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((sector) => (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${selectedSectors.includes(sector)
                      ? 'bg-[var(--purple-light)] text-[var(--purple)] border-[var(--purple)]'
                      : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] border-[var(--border)] hover:bg-[var(--background-tertiary)]'
                    }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <div className="flex justify-end">
            <button
              onClick={() => runScreener()}
              disabled={isLoading || !cacheStatus || cacheStatus.cachedStocks === 0}
              className="btn btn-primary px-6 py-3"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              Run Screener
            </button>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {error && !error.includes('Scan started') && (
        <div className="flex items-center gap-3 p-4 bg-[var(--danger-light)] border border-[var(--danger)] rounded-xl">
          <AlertCircle className="text-[var(--danger)]" size={20} />
          <p className="text-[var(--danger)]">{error}</p>
        </div>
      )}

      {/* Scan in progress message */}
      {(scanStatus?.status === 'running' || error?.includes('Scan started')) && (
        <div className="flex items-center gap-3 p-4 bg-[var(--primary-light)] border border-[var(--primary)] rounded-xl">
          <Activity className="text-[var(--primary)] animate-pulse" size={20} />
          <div>
            <p className="text-[var(--primary)] font-medium">Scanning stocks...</p>
            <p className="text-[var(--primary)]/70 text-sm">
              This is the first scan. Please wait while we fetch data for all {cacheStatus?.totalStocks || 500}+ stocks.
              {scanProgress !== null && ` (${scanProgress}% complete)`}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[var(--primary-light)] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-[var(--primary)] rounded-full animate-spin"></div>
          </div>
          <p className="text-[var(--foreground-muted)]">Filtering stocks...</p>
        </div>
      )}

      {/* Results Table */}
      {!isLoading && results.length > 0 && (
        <div className="card overflow-hidden">
          {/* Results Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-[var(--success)]" />
              <span className="text-[var(--foreground)] font-medium">
                {totalResults} stocks found
              </span>
              <span className="text-xs text-[var(--foreground-muted)]">
                from {cacheStatus?.cachedStocks || 0} cached
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Price</th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:text-[var(--foreground)] transition-colors"
                    onClick={() => toggleSort('changePercent')}
                  >
                    <span className="flex items-center gap-1">
                      Change
                      {sortBy === 'changePercent' && (sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:text-[var(--foreground)] transition-colors hidden sm:table-cell"
                    onClick={() => toggleSort('rsi')}
                  >
                    <span className="flex items-center gap-1">
                      RSI
                      {sortBy === 'rsi' && (sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:text-[var(--foreground)] transition-colors hidden md:table-cell"
                    onClick={() => toggleSort('pe')}
                  >
                    <span className="flex items-center gap-1">
                      P/E
                      {sortBy === 'pe' && (sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:text-[var(--foreground)] transition-colors hidden lg:table-cell"
                    onClick={() => toggleSort('marketCap')}
                  >
                    <span className="flex items-center gap-1">
                      Market Cap
                      {sortBy === 'marketCap' && (sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />)}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left hidden xl:table-cell">Signals</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((stock) => (
                  <tr key={stock.symbol} className="table-row">
                    {/* Stock Info */}
                    <td className="px-4 py-4">
                      <div>
                        <Link
                          href={`/dashboard?symbol=${stock.symbol}`}
                          className="font-medium text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                        >
                          {stock.symbol.replace('.NS', '')}
                        </Link>
                        <p className="text-xs text-[var(--foreground-muted)] truncate max-w-32">{stock.name}</p>
                        {stock.sector && (
                          <span className="badge badge-info mt-1 text-[10px]">
                            {stock.sector}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-4">
                      <span className="text-[var(--foreground)] font-medium">{formatPrice(stock.price)}</span>
                    </td>

                    {/* Change */}
                    <td className="px-4 py-4">
                      <span className={`flex items-center gap-1 font-medium ${stock.changePercent >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {stock.changePercent >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* RSI */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className={`font-medium ${stock.rsi > 70 ? 'text-[var(--danger)]' :
                          stock.rsi < 30 ? 'text-[var(--success)]' : 'text-[var(--foreground)]'
                        }`}>
                        {stock.rsi.toFixed(1)}
                      </span>
                    </td>

                    {/* P/E */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-[var(--foreground-secondary)]">
                        {stock.pe ? stock.pe.toFixed(1) : '—'}
                      </span>
                    </td>

                    {/* Market Cap */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-[var(--foreground-secondary)]">{formatNumber(stock.marketCap)}</span>
                    </td>

                    {/* Signals */}
                    <td className="px-4 py-4 hidden xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {stock.macdSignal === 'BULLISH' && (
                          <span className="badge badge-success">MACD+</span>
                        )}
                        {stock.macdSignal === 'BEARISH' && (
                          <span className="badge badge-danger">MACD-</span>
                        )}
                        {stock.price > stock.sma50 && (
                          <span className="badge badge-info">&gt;SMA50</span>
                        )}
                        {stock.volumeRatio > 2 && (
                          <span className="badge badge-purple">Vol Spike</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard?symbol=${stock.symbol}`}
                          className="p-2 rounded-lg hover:bg-[var(--primary-light)] text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                          title="Analyze"
                        >
                          <BarChart2 size={16} />
                        </Link>
                        {isAuthenticated && (
                          <button
                            onClick={() => addToWatchlist(stock.symbol)}
                            disabled={addingToWatchlist === stock.symbol || watchlistSymbols.has(stock.symbol)}
                            className={`p-2 rounded-lg transition-colors ${watchlistSymbols.has(stock.symbol)
                                ? 'text-[var(--warning)] cursor-default'
                                : 'hover:bg-[var(--warning-light)] text-[var(--foreground-muted)] hover:text-[var(--warning)]'
                              }`}
                            title={watchlistSymbols.has(stock.symbol) ? 'In watchlist' : 'Add to watchlist'}
                          >
                            {addingToWatchlist === stock.symbol ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : watchlistSymbols.has(stock.symbol) ? (
                              <BookmarkCheck size={16} />
                            ) : (
                              <Bookmark size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && results.length === 0 && !error && scanStatus?.status !== 'running' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-[var(--primary-light)] rounded-2xl flex items-center justify-center mb-6">
            <Search size={40} className="text-[var(--primary)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Ready to Scan</h2>
          <p className="text-[var(--foreground-muted)] max-w-md mb-6">
            {cacheStatus && cacheStatus.cachedStocks > 0
              ? `${cacheStatus.cachedStocks} stocks cached and ready. Choose a preset or create custom filters.`
              : 'Click "Refresh Data" to start scanning stocks.'}
          </p>
          {(!cacheStatus || cacheStatus.cachedStocks === 0) && (
            <button
              onClick={triggerRefresh}
              disabled={isRefreshing}
              className="btn btn-primary px-6 py-3"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              Start Initial Scan
            </button>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="flex items-start gap-3 p-4 bg-[var(--info-light)] border border-[var(--info)] rounded-xl">
        <Info size={18} className="text-[var(--info)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-[var(--info)] font-medium">How the Screener Works</p>
          <p className="text-xs text-[var(--info)]/80 mt-1">
            The screener caches all {cacheStatus?.totalStocks || 500}+ stocks with pre-calculated technical indicators.
            Filtering is instant once data is cached. Click "Refresh Data" to update prices and indicators.
          </p>
        </div>
      </div>
    </div>
  )
}