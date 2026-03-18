'use client'

import { useState, useRef, useCallback } from 'react'
import {
    Brain, Loader2, TrendingUp, TrendingDown, Shield,
    Zap, Target, BarChart3, AlertTriangle, ChevronDown,
    ChevronRight, Activity, Clock, Filter, Info, StopCircle
} from 'lucide-react'

interface Holding {
    rank: number
    symbol: string
    name: string
    sector: string
    composite: number
    ret1m: number
    ret3m: number
    ret6m: number
    volatility: number
    currentPrice: number
    weightInvVol: number
    weightEqual: number
    stopLoss: number
    avgDailyTurnoverCr: number
}

interface StrategyResult {
    date: string
    regime: 'BULL' | 'BEAR'
    signal: 'INVEST' | 'CASH'
    message?: string
    niftyPrice: number
    niftySMA: number
    totalCandidates: number
    passedFilters: number
    filteredOut: { symbol: string; name: string; reason: string }[]
    holdings: Holding[]
    allScored: any[]
    holdingPeriod: string
    config: any
    performance: {
        expectedCAGR: string
        expectedWinRate: string
        avgWinnerLoserRatio: string
        maxDrawdownRange: string
        sharpeEstimate: string
        methodology: string
    }
    fetchStats: {
        totalSymbols: number
        successfulFetches: number
        failedFetches: number
    }
}

interface ScanProgress {
    scanned: number
    total: number
    fetched: number
    errors: number
    pct: number
}

interface RegimeInfo {
    isBull: boolean
    currentPrice: number
    sma: number
    smaPeriod: number
}

export default function StrategyAnalysisPage() {
    const [scanning, setScanning] = useState(false)
    const [result, setResult] = useState<StrategyResult | null>(null)
    const [error, setError] = useState('')
    const [showFiltered, setShowFiltered] = useState(false)
    const [showAllScored, setShowAllScored] = useState(false)
    const [activeTimeframe, setActiveTimeframe] = useState('1M')
    const [progress, setProgress] = useState<ScanProgress | null>(null)
    const [regime, setRegime] = useState<RegimeInfo | null>(null)
    const [statusMsg, setStatusMsg] = useState('')
    const abortRef = useRef<AbortController | null>(null)

    const timeframes = [
        { id: '1W', label: '1 Week', available: false },
        { id: '1M', label: '1 Month', available: true },
        { id: '3M', label: '3 Months', available: false },
        { id: '6M', label: '6 Months', available: false },
        { id: '1Y', label: '1 Year', available: false },
    ]

    const stopScan = useCallback(() => {
        abortRef.current?.abort()
        setScanning(false)
        setStatusMsg('Scan stopped')
    }, [])

    const runMomentumStrategy = useCallback(async () => {
        setScanning(true)
        setError('')
        setResult(null)
        setProgress(null)
        setRegime(null)
        setStatusMsg('Connecting...')

        const abort = new AbortController()
        abortRef.current = abort

        try {
            const res = await fetch('/api/strategy/momentum', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                let currentEvent = ''
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setStatusMsg(data.message || '')
                                    break
                                case 'regime':
                                    setRegime(data)
                                    break
                                case 'progress':
                                    setProgress(data)
                                    setStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setResult(data)
                                    setStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip malformed JSON */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError(err.message || 'Something went wrong')
            }
        } finally {
            setScanning(false)
        }
    }, [])

    return (
        <div className="max-w-[1400px] mx-auto space-y-5 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                        <Brain size={22} className="text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--foreground)]">Strategy Analysis</h1>
                        <p className="text-xs text-[var(--foreground-muted)]">Research-backed trading strategies across multiple timeframes</p>
                    </div>
                </div>
            </div>

            {/* Timeframe Selector */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
                <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-3">Holding Period</p>
                <div className="flex flex-wrap gap-2">
                    {timeframes.map(tf => (
                        <button key={tf.id} onClick={() => tf.available && setActiveTimeframe(tf.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTimeframe === tf.id
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                                : tf.available
                                    ? 'bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] hover:border-cyan-500/30'
                                    : 'bg-[var(--background)] text-[var(--foreground-muted)] border border-[var(--border)] opacity-40 cursor-not-allowed'
                                }`}>
                            {tf.label}
                            {!tf.available && <span className="ml-1 text-[9px]">SOON</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Strategy Cards per Timeframe */}
            {activeTimeframe === '1M' && (
                <div className="space-y-4">
                    {/* Momentum Strategy Card */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border)]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                                        <TrendingUp size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)]">MOMENTUM TRADING</h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Jegadeesh & Titman · Multi-period composite scoring · Inv-vol weighting</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full border border-emerald-500/20">PROVEN</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {scanning && (
                                        <button onClick={stopScan}
                                            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl flex items-center gap-2 transition-all text-sm border border-red-500/20">
                                            <StopCircle size={16} /> Stop
                                        </button>
                                    )}
                                    <button onClick={runMomentumStrategy} disabled={scanning}
                                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-sm">
                                        {scanning ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : <><Zap size={16} /> Scan All Stocks</>}
                                    </button>
                                </div>
                            </div>
                            {/* Academic backing */}
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--foreground-muted)]">
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📚 J&T 1993</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📊 Sehgal & Balakrishnan 2002</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🇮🇳 NSE Nifty200 MOM30</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">⏱️ {result?.holdingPeriod || '22 trading days'}</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🔍 ~500 stocks universe</span>
                            </div>
                        </div>

                        {/* LIVE SCANNING PROGRESS */}
                        {scanning && (
                            <div className="p-4 sm:p-5 space-y-3 border-b border-[var(--border)] bg-gradient-to-b from-cyan-500/5 to-transparent">
                                {/* Regime info if received */}
                                {regime && (
                                    <div className={`rounded-xl p-3 border ${regime.isBull
                                        ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${regime.isBull
                                                ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {regime.isBull ? '🟢 BULL' : '🔴 BEAR'}
                                            </span>
                                            <span className="text-xs text-[var(--foreground-muted)]">
                                                Nifty ₹{regime.currentPrice?.toFixed(0)} {regime.isBull ? '>' : '<'} {regime.smaPeriod}d SMA ₹{regime.sma?.toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Progress bar */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--foreground-muted)] flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                                            {statusMsg}
                                        </span>
                                        {progress && (
                                            <span className="text-cyan-400 font-bold">{progress.pct}%</span>
                                        )}
                                    </div>
                                    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${progress?.pct || 2}%` }}
                                        />
                                    </div>
                                    {progress && (
                                        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--foreground-muted)]">
                                            <span>📊 Scanned: <strong className="text-[var(--foreground)]">{progress.scanned}/{progress.total}</strong></span>
                                            <span>✅ Fetched: <strong className="text-emerald-400">{progress.fetched}</strong></span>
                                            {progress.errors > 0 && (
                                                <span>❌ Errors: <strong className="text-red-400">{progress.errors}</strong></span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="p-4 mx-4 mb-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-400">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}

                        {/* RESULTS */}
                        {result && !scanning && (
                            <div className="p-4 sm:p-5 space-y-4">
                                {/* Market Regime Banner */}
                                <div className={`rounded-xl p-4 border-2 ${result.regime === 'BULL'
                                    ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent'
                                    : 'border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent'
                                    }`}>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${result.regime === 'BULL'
                                            ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {result.regime === 'BULL' ? '🟢 BULL MARKET' : '🔴 BEAR MARKET'}
                                        </span>
                                        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                                            <span>Nifty 50: <strong className="text-[var(--foreground)]">₹{result.niftyPrice?.toFixed(0)}</strong></span>
                                            <span>|</span>
                                            <span>{result.config?.NIFTY_SMA_PERIOD}d SMA: <strong className="text-[var(--foreground)]">₹{result.niftySMA?.toFixed(0)}</strong></span>
                                        </div>
                                        <span className={`ml-auto px-3 py-1 rounded-lg text-xs font-bold ${result.signal === 'INVEST'
                                            ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            Signal: {result.signal}
                                        </span>
                                    </div>
                                    {result.message && (
                                        <p className="mt-2 text-sm text-[var(--foreground-muted)]">{result.message}</p>
                                    )}
                                </div>

                                {/* Stats Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Universe Scanned', value: result.fetchStats?.totalSymbols || result.totalCandidates, icon: Activity, color: 'text-blue-400' },
                                        { label: 'Passed Filters', value: result.passedFilters, icon: Filter, color: 'text-emerald-400' },
                                        { label: 'Selected', value: result.holdings?.length || 0, icon: Target, color: 'text-cyan-400' },
                                        { label: 'Filtered Out', value: result.filteredOut?.length || 0, icon: AlertTriangle, color: 'text-amber-400' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                            <div className={`flex items-center gap-1.5 text-[10px] ${s.color} mb-1`}>
                                                <s.icon size={12} /> {s.label}
                                            </div>
                                            <p className="text-lg font-bold text-[var(--foreground)]">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Expected Performance */}
                                {result.performance && (
                                    <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BarChart3 size={14} className="text-violet-400" />
                                            <span className="text-xs font-semibold text-[var(--foreground)]">Expected Performance (Historical Backtests on NSE)</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                            {[
                                                { l: 'CAGR', v: result.performance.expectedCAGR, c: 'text-emerald-400' },
                                                { l: 'Win Rate', v: result.performance.expectedWinRate, c: 'text-blue-400' },
                                                { l: 'W:L Ratio', v: result.performance.avgWinnerLoserRatio, c: 'text-cyan-400' },
                                                { l: 'Max DD', v: result.performance.maxDrawdownRange, c: 'text-red-400' },
                                                { l: 'Sharpe', v: result.performance.sharpeEstimate, c: 'text-violet-400' },
                                            ].map(m => (
                                                <div key={m.l} className="text-center py-2">
                                                    <p className={`text-sm font-bold ${m.c}`}>{m.v}</p>
                                                    <p className="text-[9px] text-[var(--foreground-muted)]">{m.l}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-2 flex items-center gap-1">
                                            <Info size={10} /> {result.performance.methodology}
                                        </p>
                                    </div>
                                )}

                                {/* PORTFOLIO HOLDINGS TABLE */}
                                {result.holdings && result.holdings.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Shield size={14} className="text-cyan-400" />
                                            <h4 className="text-sm font-semibold text-[var(--foreground)]">
                                                Top {result.holdings.length} Momentum Picks
                                            </h4>
                                            <span className="text-[10px] text-[var(--foreground-muted)]">· from {result.fetchStats?.successfulFetches || result.totalCandidates} stocks · inv-vol weighted</span>
                                        </div>

                                        <div className="space-y-1.5">
                                            {result.holdings.map(h => (
                                                <div key={h.symbol} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] hover:border-cyan-500/20 transition-all">
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                        {/* Rank */}
                                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${h.rank <= 3 ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 text-cyan-300' : 'bg-[var(--card)] text-[var(--foreground-muted)]'}`}>
                                                            #{h.rank}
                                                        </span>

                                                        {/* Name */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{h.name}</p>
                                                            <div className="flex items-center gap-2 text-[10px] text-[var(--foreground-muted)]">
                                                                <span>{h.symbol.replace('.NS', '')}</span>
                                                                <span>·</span>
                                                                <span>{h.sector}</span>
                                                            </div>
                                                        </div>

                                                        {/* Score + Returns (desktop) */}
                                                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                                                            {[
                                                                { l: 'Score', v: `${(h.composite * 100).toFixed(1)}%`, c: 'text-cyan-400' },
                                                                { l: '1M', v: `${h.ret1m >= 0 ? '+' : ''}${(h.ret1m * 100).toFixed(1)}%`, c: h.ret1m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                                { l: '3M', v: `${h.ret3m >= 0 ? '+' : ''}${(h.ret3m * 100).toFixed(1)}%`, c: h.ret3m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                                { l: '6M', v: `${h.ret6m >= 0 ? '+' : ''}${(h.ret6m * 100).toFixed(1)}%`, c: h.ret6m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                                { l: 'Vol', v: `${(h.volatility * 100).toFixed(1)}%`, c: 'text-[var(--foreground)]' },
                                                                { l: 'Wt', v: `${(h.weightInvVol * 100).toFixed(1)}%`, c: 'text-violet-400' },
                                                            ].map(m => (
                                                                <div key={m.l} className="text-center px-2">
                                                                    <p className={`text-xs font-bold ${m.c}`}>{m.v}</p>
                                                                    <p className="text-[8px] text-[var(--foreground-muted)]">{m.l}</p>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Price + SL */}
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-bold text-[var(--foreground)]">₹{h.currentPrice.toFixed(0)}</p>
                                                            <p className="text-[10px] text-red-400">SL: ₹{h.stopLoss.toFixed(0)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Mobile metrics */}
                                                    <div className="grid grid-cols-6 gap-1 mt-2 sm:hidden">
                                                        {[
                                                            { l: 'Score', v: `${(h.composite * 100).toFixed(1)}%`, c: 'text-cyan-400' },
                                                            { l: '1M', v: `${h.ret1m >= 0 ? '+' : ''}${(h.ret1m * 100).toFixed(1)}%`, c: h.ret1m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                            { l: '3M', v: `${h.ret3m >= 0 ? '+' : ''}${(h.ret3m * 100).toFixed(1)}%`, c: h.ret3m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                            { l: '6M', v: `${h.ret6m >= 0 ? '+' : ''}${(h.ret6m * 100).toFixed(1)}%`, c: h.ret6m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                            { l: 'Vol', v: `${(h.volatility * 100).toFixed(1)}%`, c: 'text-[var(--foreground)]' },
                                                            { l: 'Wt', v: `${(h.weightInvVol * 100).toFixed(1)}%`, c: 'text-violet-400' },
                                                        ].map(m => (
                                                            <div key={m.l} className="text-center bg-[var(--card)] rounded-lg p-1">
                                                                <p className={`text-[10px] font-bold ${m.c}`}>{m.v}</p>
                                                                <p className="text-[7px] text-[var(--foreground-muted)]">{m.l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* BEAR MARKET — No holdings */}
                                {result.signal === 'CASH' && (
                                    <div className="text-center py-8 space-y-3">
                                        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
                                            <Shield size={32} className="text-amber-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-amber-400">Cash Position Recommended</h3>
                                        <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto">
                                            The market regime filter indicates a bearish phase. The momentum strategy avoids entering positions during downtrends to reduce drawdowns.
                                        </p>
                                    </div>
                                )}

                                {/* All Scored Toggle */}
                                {result.allScored && result.allScored.length > 0 && (
                                    <button onClick={() => setShowAllScored(!showAllScored)}
                                        className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                        {showAllScored ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        View all {result.allScored.length} scored stocks
                                    </button>
                                )}

                                {showAllScored && result.allScored && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-[var(--foreground-muted)] text-[10px]">
                                                    <th className="text-left py-2 px-2">#</th>
                                                    <th className="text-left py-2 px-2">Stock</th>
                                                    <th className="text-left py-2 px-2 hidden sm:table-cell">Sector</th>
                                                    <th className="text-right py-2 px-2">Score</th>
                                                    <th className="text-right py-2 px-2">1M</th>
                                                    <th className="text-right py-2 px-2">3M</th>
                                                    <th className="text-right py-2 px-2">6M</th>
                                                    <th className="text-right py-2 px-2">Vol</th>
                                                    <th className="text-right py-2 px-2">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.allScored.map((s: any, i: number) => (
                                                    <tr key={s.symbol} className={`border-t border-[var(--border)] ${i < (result.config?.TOP_N_STOCKS || 15) ? 'bg-cyan-500/5' : ''}`}>
                                                        <td className="py-1.5 px-2 text-[var(--foreground-muted)]">{i + 1}</td>
                                                        <td className="py-1.5 px-2 text-[var(--foreground)] font-medium">{s.symbol.replace('.NS', '')}</td>
                                                        <td className="py-1.5 px-2 text-[var(--foreground-muted)] hidden sm:table-cell text-[10px]">{s.sector}</td>
                                                        <td className="py-1.5 px-2 text-right text-cyan-400 font-bold">{(s.composite * 100).toFixed(2)}%</td>
                                                        <td className={`py-1.5 px-2 text-right ${s.ret1m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(s.ret1m * 100).toFixed(1)}%</td>
                                                        <td className={`py-1.5 px-2 text-right ${s.ret3m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(s.ret3m * 100).toFixed(1)}%</td>
                                                        <td className={`py-1.5 px-2 text-right ${s.ret6m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(s.ret6m * 100).toFixed(1)}%</td>
                                                        <td className="py-1.5 px-2 text-right text-[var(--foreground-muted)]">{(s.volatility * 100).toFixed(1)}%</td>
                                                        <td className="py-1.5 px-2 text-right text-[var(--foreground)]">₹{s.currentPrice.toFixed(0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Filtered Out Toggle */}
                                {result.filteredOut && result.filteredOut.length > 0 && (
                                    <>
                                        <button onClick={() => setShowFiltered(!showFiltered)}
                                            className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showFiltered ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            {result.filteredOut.length} stocks filtered out
                                        </button>

                                        {showFiltered && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {result.filteredOut.map((f: any) => (
                                                    <div key={f.symbol} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px]">
                                                        <span className="text-red-400">✕</span>
                                                        <span className="font-medium text-[var(--foreground)]">{f.symbol.replace('.NS', '')}</span>
                                                        <span className="text-[var(--foreground-muted)] truncate">{f.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Fetch Stats */}
                                {result.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] flex flex-wrap gap-4 text-[10px] text-[var(--foreground-muted)]">
                                        <span>🔍 Universe: <strong className="text-[var(--foreground)]">{result.fetchStats.totalSymbols}</strong> stocks</span>
                                        <span>✅ Fetched: <strong className="text-emerald-400">{result.fetchStats.successfulFetches}</strong></span>
                                        {result.fetchStats.failedFetches > 0 && (
                                            <span>❌ Failed: <strong className="text-red-400">{result.fetchStats.failedFetches}</strong></span>
                                        )}
                                    </div>
                                )}

                                {/* Strategy Config */}
                                {result.config && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                        <p className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Strategy Configuration</p>
                                        <div className="flex flex-wrap gap-2 text-[10px]">
                                            {[
                                                { l: 'Weights', v: `${(result.config.WEIGHT_1M * 100).toFixed(0)}% / ${(result.config.WEIGHT_3M * 100).toFixed(0)}% / ${(result.config.WEIGHT_6M * 100).toFixed(0)}% (1M/3M/6M)` },
                                                { l: 'Top N', v: result.config.TOP_N_STOCKS },
                                                { l: 'Stop Loss', v: `${(result.config.STOP_LOSS_PCT * 100).toFixed(0)}%` },
                                                { l: 'Min Turnover', v: `₹${result.config.MIN_AVG_TURNOVER_CR}cr` },
                                                { l: 'Vol Cap', v: `${(result.config.MAX_ANNUALIZED_VOLATILITY * 100).toFixed(0)}%` },
                                                { l: 'Regime Filter', v: `Nifty > ${result.config.NIFTY_SMA_PERIOD}d SMA` },
                                            ].map(c => (
                                                <span key={c.l} className="px-2 py-1 bg-[var(--card)] rounded-lg border border-[var(--border)] text-[var(--foreground-muted)]">
                                                    <span className="text-[var(--foreground)] font-medium">{c.l}:</span> {c.v}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* More strategies placeholder */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 border-dashed opacity-60">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--background)] rounded-xl flex items-center justify-center">
                                <Clock size={20} className="text-[var(--foreground-muted)]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[var(--foreground-muted)]">More 1-Month strategies coming soon</h3>
                                <p className="text-[10px] text-[var(--foreground-muted)]">Mean Reversion · Breakout · Value Momentum · Quality Factor</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Other Timeframes — Coming Soon */}
            {activeTimeframe !== '1M' && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                        <Clock size={40} className="text-cyan-400/60" />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Coming Soon</h2>
                    <p className="text-[var(--foreground-muted)] text-sm max-w-md">
                        {activeTimeframe} strategies are under development. Stay tuned for more research-backed strategies across all timeframes.
                    </p>
                </div>
            )}
        </div>
    )
}
