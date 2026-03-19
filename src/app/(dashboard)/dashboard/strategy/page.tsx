'use client'

import { useState, useRef, useCallback } from 'react'
import {
    Brain, Loader2, TrendingUp, TrendingDown, Shield,
    Zap, Target, BarChart3, AlertTriangle, ChevronDown,
    ChevronRight, Activity, Clock, Filter, Info, StopCircle,
    CalendarDays, ArrowRightLeft, ShieldCheck, Play,
    Crosshair, Eye, GitPullRequestArrow
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
    trailingStopLevel: number | null
    trailingStopActive: boolean
    entrySignal: string
    daysSinceRecentHigh: number
    priceVs52wHigh: number | null
    beta: number | null
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
    rebalance?: {
        scanDate: string
        entryDate: string
        exitDate: string
        holdingDays: number
        nextScanDate: string
    }
    entryGuidance?: {
        action: string
        timing: string
        sizing: string
        stopLossRule: string
        trailingStopRule: string
        exitRule: string
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

    // Swing state
    const [swingScanning, setSwingScanning] = useState(false)
    const [swingResult, setSwingResult] = useState<any>(null)
    const [swingError, setSwingError] = useState('')
    const [swingProgress, setSwingProgress] = useState<ScanProgress | null>(null)
    const [swingStatusMsg, setSwingStatusMsg] = useState('')
    const [showSwingSetupA, setShowSwingSetupA] = useState(true)
    const [showSwingSetupB, setShowSwingSetupB] = useState(true)
    const [showSwingNearMiss, setShowSwingNearMiss] = useState(false)
    const [showSwingFiltered, setShowSwingFiltered] = useState(false)
    const swingAbortRef = useRef<AbortController | null>(null)

    // Mean Reversion state
    const [mrScanning, setMrScanning] = useState(false)
    const [mrResult, setMrResult] = useState<any>(null)
    const [mrError, setMrError] = useState('')
    const [mrProgress, setMrProgress] = useState<ScanProgress | null>(null)
    const [mrStatusMsg, setMrStatusMsg] = useState('')
    const [showMrWatchlist, setShowMrWatchlist] = useState(false)
    const [showMrFiltered, setShowMrFiltered] = useState(false)
    const mrAbortRef = useRef<AbortController | null>(null)

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

    const stopSwingScan = useCallback(() => {
        swingAbortRef.current?.abort()
        setSwingScanning(false)
        setSwingStatusMsg('Scan stopped')
    }, [])

    const stopMrScan = useCallback(() => {
        mrAbortRef.current?.abort()
        setMrScanning(false)
        setMrStatusMsg('Scan stopped')
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

    const runSwingStrategy = useCallback(async () => {
        setSwingScanning(true)
        setSwingError('')
        setSwingResult(null)
        setSwingProgress(null)
        setSwingStatusMsg('Connecting...')

        const abort = new AbortController()
        swingAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/swing', { signal: abort.signal })
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
                                    setSwingStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setSwingProgress(data)
                                    setSwingStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setSwingResult(data)
                                    setSwingStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setSwingError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setSwingError(err.message || 'Something went wrong')
            }
        } finally {
            setSwingScanning(false)
        }
    }, [])

    const runMeanReversion = useCallback(async () => {
        setMrScanning(true)
        setMrError('')
        setMrResult(null)
        setMrProgress(null)
        setMrStatusMsg('Connecting...')

        const abort = new AbortController()
        mrAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/mean-reversion', { signal: abort.signal })
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

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        switch (data.type) {
                            case 'status':
                                setMrStatusMsg(data.message || '')
                                break
                            case 'progress':
                                setMrProgress(data)
                                setMrStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                break
                            case 'result':
                                setMrResult(data.data)
                                setMrStatusMsg('Analysis complete!')
                                break
                            case 'error':
                                setMrError(data.message)
                                break
                            case 'done':
                                break
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setMrError(err.message || 'Something went wrong')
            }
        } finally {
            setMrScanning(false)
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

                                {/* ENTRY GUIDANCE & REBALANCE SCHEDULE */}
                                {result.signal === 'INVEST' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Entry Guidance */}
                                        {result.entryGuidance && (
                                            <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Play size={14} className="text-emerald-400" />
                                                    <span className="text-xs font-semibold text-[var(--foreground)]">Entry & Exit Rules</span>
                                                </div>
                                                <div className="space-y-2 text-[11px]">
                                                    {[
                                                        { icon: '🟢', label: 'Entry', value: result.entryGuidance.action },
                                                        { icon: '⏰', label: 'Timing', value: result.entryGuidance.timing },
                                                        { icon: '⚖️', label: 'Sizing', value: result.entryGuidance.sizing },
                                                        { icon: '🛑', label: 'Stop Loss', value: result.entryGuidance.stopLossRule },
                                                        { icon: '📉', label: 'Trailing Stop', value: result.entryGuidance.trailingStopRule },
                                                        { icon: '🔄', label: 'Exit', value: result.entryGuidance.exitRule },
                                                    ].map(r => (
                                                        <div key={r.label} className="flex gap-2">
                                                            <span className="shrink-0">{r.icon}</span>
                                                            <div>
                                                                <span className="font-semibold text-[var(--foreground)]">{r.label}: </span>
                                                                <span className="text-[var(--foreground-muted)]">{r.value}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rebalance Schedule */}
                                        {result.rebalance && (
                                            <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <CalendarDays size={14} className="text-blue-400" />
                                                    <span className="text-xs font-semibold text-[var(--foreground)]">Rebalance Schedule</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {[
                                                        { label: 'Scan Date', value: result.rebalance.scanDate, icon: '📅', color: 'text-[var(--foreground)]' },
                                                        { label: 'Entry Date', value: result.rebalance.entryDate, icon: '🟢', color: 'text-emerald-400' },
                                                        { label: 'Exit Date', value: result.rebalance.exitDate, icon: '🔴', color: 'text-red-400' },
                                                        { label: 'Next Scan', value: result.rebalance.nextScanDate, icon: '🔄', color: 'text-blue-400' },
                                                    ].map(d => (
                                                        <div key={d.label} className="flex items-center justify-between text-[11px]">
                                                            <span className="text-[var(--foreground-muted)] flex items-center gap-1.5">
                                                                {d.icon} {d.label}
                                                            </span>
                                                            <span className={`font-bold ${d.color}`}>{d.value}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--border)]">
                                                        <span className="text-[var(--foreground-muted)]">⏱️ Holding Period</span>
                                                        <span className="font-bold text-[var(--foreground)]">{result.rebalance.holdingDays} trading days</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
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

                                                        {/* Price + Stop Levels */}
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-bold text-[var(--foreground)]">₹{h.currentPrice.toFixed(0)}</p>
                                                            <p className="text-[10px] text-red-400">Hard SL: ₹{h.stopLoss.toFixed(0)}</p>
                                                            {h.trailingStopLevel && (
                                                                <p className={`text-[10px] ${h.trailingStopActive ? 'text-amber-400' : 'text-[var(--foreground-muted)]'}`}>
                                                                    Trail: ₹{h.trailingStopLevel.toFixed(0)} {h.trailingStopActive ? '⚡' : ''}
                                                                </p>
                                                            )}
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
                                                { l: 'Stop Loss', v: `${(result.config.STOP_LOSS_PCT * 100).toFixed(0)}% hard` },
                                                { l: 'Trailing Stop', v: `After +${(result.config.TRAILING_STOP_ACTIVATION * 100).toFixed(0)}%, trail at ${result.config.TRAILING_STOP_LOOKBACK}d low` },
                                                { l: 'Min Turnover', v: `₹${result.config.MIN_AVG_TURNOVER_CR}cr` },
                                                { l: 'Vol Cap', v: `${(result.config.MAX_ANNUALIZED_VOLATILITY * 100).toFixed(0)}%` },
                                                { l: 'Regime Filter', v: `Nifty > ${result.config.NIFTY_SMA_PERIOD}d SMA` },
                                                { l: 'Earnings Blackout', v: `±${result.config.EARNINGS_BLACKOUT_DAYS}d from earnings` },
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

                    {/* ========================================== */}
                    {/* STRATEGY 2: SWING TRADING */}
                    {/* ========================================== */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border)]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                                        <Crosshair size={20} className="text-violet-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)]">SWING TRADING</h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">20-EMA Pullback + MACD Crossover · Multi-confluence · Technical Analysis</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[9px] font-bold rounded-full border border-violet-500/20">2 SETUPS</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {swingScanning && (
                                        <button onClick={stopSwingScan}
                                            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl flex items-center gap-2 transition-all text-sm border border-red-500/20">
                                            <StopCircle size={16} /> Stop
                                        </button>
                                    )}
                                    <button onClick={runSwingStrategy} disabled={swingScanning}
                                        className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-sm">
                                        {swingScanning ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : <><Crosshair size={16} /> Scan Swing Setups</>}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--foreground-muted)]">
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📈 Setup A: 20-EMA Pullback (7 conditions)</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📊 Setup B: MACD Crossover (5 conditions)</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🇮🇳 Indian market filters</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">⏱️ 2-4 week hold</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🔍 ~500 stocks</span>
                            </div>
                        </div>

                        {/* SWING SCANNING PROGRESS */}
                        {swingScanning && (
                            <div className="p-4 sm:p-5 space-y-3 border-b border-[var(--border)] bg-gradient-to-b from-violet-500/5 to-transparent">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--foreground-muted)] flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin text-violet-400" />
                                            {swingStatusMsg}
                                        </span>
                                        {swingProgress && <span className="text-violet-400 font-bold">{swingProgress.pct}%</span>}
                                    </div>
                                    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${swingProgress?.pct || 2}%` }} />
                                    </div>
                                    {swingProgress && (
                                        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--foreground-muted)]">
                                            <span>📊 Scanned: <strong className="text-[var(--foreground)]">{swingProgress.scanned}/{swingProgress.total}</strong></span>
                                            <span>✅ Fetched: <strong className="text-emerald-400">{swingProgress.fetched}</strong></span>
                                            {swingProgress.errors > 0 && <span>❌ Errors: <strong className="text-red-400">{swingProgress.errors}</strong></span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {swingError && (
                            <div className="p-4 mx-4 mb-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-400">
                                <AlertTriangle size={16} /> {swingError}
                            </div>
                        )}

                        {/* SWING RESULTS */}
                        {swingResult && !swingScanning && (
                            <div className="p-4 sm:p-5 space-y-4">
                                {/* Stats Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {[
                                        { label: 'Scanned', value: swingResult.fetchStats?.totalSymbols || swingResult.totalScanned, icon: Activity, color: 'text-blue-400' },
                                        { label: 'Setup A Hits', value: swingResult.setupA_signals?.length || 0, icon: TrendingUp, color: 'text-emerald-400' },
                                        { label: 'Setup B Hits', value: swingResult.setupB_signals?.length || 0, icon: BarChart3, color: 'text-violet-400' },
                                        { label: 'Near Misses', value: swingResult.nearMiss?.length || 0, icon: Eye, color: 'text-amber-400' },
                                        { label: 'Filtered Out', value: swingResult.totalFiltered || 0, icon: Filter, color: 'text-red-400' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                            <div className={`flex items-center gap-1.5 text-[10px] ${s.color} mb-1`}><s.icon size={12} /> {s.label}</div>
                                            <p className="text-lg font-bold text-[var(--foreground)]">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Expected Performance */}
                                {swingResult.performance && (
                                    <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BarChart3 size={14} className="text-violet-400" />
                                            <span className="text-xs font-semibold text-[var(--foreground)]">Expected Performance</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { l: 'Win Rate', v: swingResult.performance.expectedWinRate, c: 'text-emerald-400' },
                                                { l: 'Reward:Risk', v: swingResult.performance.rewardRisk, c: 'text-cyan-400' },
                                                { l: 'Holding', v: swingResult.performance.avgHoldingDays, c: 'text-blue-400' },
                                            ].map(m => (
                                                <div key={m.l} className="text-center py-2">
                                                    <p className={`text-sm font-bold ${m.c}`}>{m.v}</p>
                                                    <p className="text-[9px] text-[var(--foreground-muted)]">{m.l}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-2 flex items-center gap-1">
                                            <Info size={10} /> {swingResult.performance.methodology}
                                        </p>
                                    </div>
                                )}

                                {/* SETUP A SIGNALS */}
                                {swingResult.setupA_signals && swingResult.setupA_signals.length > 0 && (
                                    <div className="space-y-2">
                                        <button onClick={() => setShowSwingSetupA(!showSwingSetupA)}
                                            className="flex items-center gap-2">
                                            {showSwingSetupA ? <ChevronDown size={14} className="text-emerald-400" /> : <ChevronRight size={14} className="text-emerald-400" />}
                                            <TrendingUp size={14} className="text-emerald-400" />
                                            <span className="text-sm font-semibold text-[var(--foreground)]">Setup A: 20-EMA Pullback</span>
                                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full">{swingResult.setupA_signals.length} signals</span>
                                        </button>

                                        {showSwingSetupA && swingResult.setupA_signals.map((sig: any) => (
                                            <div key={sig.symbol} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] hover:border-emerald-500/20 transition-all space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--foreground)]">{sig.name}</p>
                                                        <p className="text-[10px] text-[var(--foreground-muted)]">{sig.symbol.replace('.NS', '')} · {sig.sector}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg">
                                                            Confluence: {sig.confluenceRatio}
                                                        </span>
                                                        <span className="text-sm font-bold text-[var(--foreground)]">₹{sig.indicators?.close?.toFixed(0)}</span>
                                                    </div>
                                                </div>

                                                {/* Condition checklist */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 text-[10px]">
                                                    {sig.reasons?.map((r: string, i: number) => (
                                                        <span key={i} className={`px-2 py-0.5 rounded ${r.startsWith('✓') ? 'text-emerald-400' : r.startsWith('~') ? 'text-amber-400' : 'text-red-400'}`}>{r}</span>
                                                    ))}
                                                </div>

                                                {/* Trade plan */}
                                                {sig.trade && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border)]">
                                                        {[
                                                            { l: 'Entry', v: `₹${sig.trade.entry}`, c: 'text-emerald-400' },
                                                            { l: 'Stop Loss', v: `₹${sig.trade.stopLoss} (${sig.trade.riskPct})`, c: 'text-red-400' },
                                                            { l: 'Target 1', v: `₹${sig.trade.target1} (${sig.trade.target1Pct})`, c: 'text-cyan-400' },
                                                            { l: 'R:R', v: sig.trade.riskRewardRatio, c: 'text-violet-400' },
                                                        ].map(m => (
                                                            <div key={m.l} className="text-center bg-[var(--card)] rounded-lg p-1.5">
                                                                <p className={`text-[10px] font-bold ${m.c}`}>{m.v}</p>
                                                                <p className="text-[7px] text-[var(--foreground-muted)]">{m.l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Indicators */}
                                                <div className="flex flex-wrap gap-2 text-[9px] text-[var(--foreground-muted)]">
                                                    {sig.indicators?.ema20 && <span>EMA20: ₹{sig.indicators.ema20}</span>}
                                                    {sig.indicators?.sma50 && <span>SMA50: ₹{sig.indicators.sma50}</span>}
                                                    {sig.indicators?.rsi && <span>RSI: {sig.indicators.rsi}</span>}
                                                    {sig.indicators?.macdLine !== null && <span>MACD: {sig.indicators.macdLine}</span>}
                                                    {sig.indicators?.volumeRatio && <span>Vol: {sig.indicators.volumeRatio}x</span>}
                                                    {sig.indicators?.volatility && <span>σ: {sig.indicators.volatility}</span>}
                                                </div>

                                                {sig.warnings && sig.warnings.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {sig.warnings.map((w: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] rounded-lg">⚠️ {w}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* SETUP B SIGNALS */}
                                {swingResult.setupB_signals && swingResult.setupB_signals.length > 0 && (
                                    <div className="space-y-2">
                                        <button onClick={() => setShowSwingSetupB(!showSwingSetupB)}
                                            className="flex items-center gap-2">
                                            {showSwingSetupB ? <ChevronDown size={14} className="text-violet-400" /> : <ChevronRight size={14} className="text-violet-400" />}
                                            <BarChart3 size={14} className="text-violet-400" />
                                            <span className="text-sm font-semibold text-[var(--foreground)]">Setup B: MACD Crossover</span>
                                            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[9px] font-bold rounded-full">{swingResult.setupB_signals.length} signals</span>
                                        </button>

                                        {showSwingSetupB && swingResult.setupB_signals.map((sig: any) => (
                                            <div key={sig.symbol} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] hover:border-violet-500/20 transition-all space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--foreground)]">{sig.name}</p>
                                                        <p className="text-[10px] text-[var(--foreground-muted)]">{sig.symbol.replace('.NS', '')} · {sig.sector}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-violet-500/10 text-violet-400 text-[10px] font-bold rounded-lg">
                                                            Confluence: {sig.confluenceRatio}
                                                        </span>
                                                        <span className="text-sm font-bold text-[var(--foreground)]">₹{sig.indicators?.close?.toFixed(0)}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 text-[10px]">
                                                    {sig.reasons?.map((r: string, i: number) => (
                                                        <span key={i} className={`px-2 py-0.5 rounded ${r.startsWith('✓') ? 'text-emerald-400' : r.startsWith('~') ? 'text-amber-400' : 'text-red-400'}`}>{r}</span>
                                                    ))}
                                                </div>

                                                {sig.trade && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
                                                        {[
                                                            { l: 'Entry', v: `₹${sig.trade.entry}`, c: 'text-emerald-400' },
                                                            { l: 'Stop Loss', v: `₹${sig.trade.stopLoss} (${sig.trade.riskPct})`, c: 'text-red-400' },
                                                            { l: 'Target', v: sig.trade.targetMethod, c: 'text-cyan-400' },
                                                        ].map(m => (
                                                            <div key={m.l} className="text-center bg-[var(--card)] rounded-lg p-1.5">
                                                                <p className={`text-[10px] font-bold ${m.c}`}>{m.v}</p>
                                                                <p className="text-[7px] text-[var(--foreground-muted)]">{m.l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap gap-2 text-[9px] text-[var(--foreground-muted)]">
                                                    {sig.indicators?.ema20 && <span>EMA20: ₹{sig.indicators.ema20}</span>}
                                                    {sig.indicators?.macdLine !== null && <span>MACD: {sig.indicators.macdLine}</span>}
                                                    {sig.indicators?.signalLine !== null && <span>Signal: {sig.indicators.signalLine}</span>}
                                                    {sig.indicators?.histogram !== null && <span>Hist: {sig.indicators.histogram}</span>}
                                                    {sig.indicators?.volumeRatio && <span>Vol: {sig.indicators.volumeRatio}x</span>}
                                                </div>

                                                {sig.warnings && sig.warnings.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {sig.warnings.map((w: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] rounded-lg">⚠️ {w}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* NO SIGNALS */}
                                {(!swingResult.setupA_signals || swingResult.setupA_signals.length === 0) &&
                                 (!swingResult.setupB_signals || swingResult.setupB_signals.length === 0) && (
                                    <div className="text-center py-8 space-y-3">
                                        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
                                            <Crosshair size={32} className="text-amber-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-amber-400">No Active Swing Setups</h3>
                                        <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto">
                                            No stocks currently meet the multi-confluence criteria for either the 20-EMA Pullback or MACD Crossover setups. Check the near-misses for stocks approaching setup conditions.
                                        </p>
                                    </div>
                                )}

                                {/* NEAR MISSES */}
                                {swingResult.nearMiss && swingResult.nearMiss.length > 0 && (
                                    <>
                                        <button onClick={() => setShowSwingNearMiss(!showSwingNearMiss)}
                                            className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showSwingNearMiss ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Eye size={14} /> {swingResult.nearMiss.length} near-misses (watchlist)
                                        </button>

                                        {showSwingNearMiss && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {swingResult.nearMiss.map((nm: any) => (
                                                    <div key={nm.symbol} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px]">
                                                        <div>
                                                            <span className="font-medium text-[var(--foreground)]">{nm.symbol.replace('.NS', '')}</span>
                                                            <span className="text-[var(--foreground-muted)] ml-1">{nm.name}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <span className="text-emerald-400">A:{nm.setupA_score}</span>
                                                            <span className="text-violet-400">B:{nm.setupB_score}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* FILTERED OUT */}
                                {swingResult.filtered && swingResult.filtered.length > 0 && (
                                    <>
                                        <button onClick={() => setShowSwingFiltered(!showSwingFiltered)}
                                            className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showSwingFiltered ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            {swingResult.filtered.length} stocks filtered out
                                        </button>

                                        {showSwingFiltered && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {swingResult.filtered.map((f: any) => (
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
                                {swingResult.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] flex flex-wrap gap-4 text-[10px] text-[var(--foreground-muted)]">
                                        <span>🔍 Universe: <strong className="text-[var(--foreground)]">{swingResult.fetchStats.totalSymbols}</strong></span>
                                        <span>✅ Fetched: <strong className="text-emerald-400">{swingResult.fetchStats.successfulFetches}</strong></span>
                                        {swingResult.fetchStats.failedFetches > 0 && (
                                            <span>❌ Failed: <strong className="text-red-400">{swingResult.fetchStats.failedFetches}</strong></span>
                                        )}
                                    </div>
                                )}

                                {/* Config */}
                                {swingResult.config && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                        <p className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Strategy Configuration</p>
                                        <div className="flex flex-wrap gap-2 text-[10px]">
                                            {[
                                                { l: 'EMA Fast/Mid', v: `${swingResult.config.EMA_FAST}/${swingResult.config.EMA_MID}` },
                                                { l: 'SMA Slow', v: swingResult.config.SMA_SLOW },
                                                { l: 'RSI Zone', v: `${swingResult.config.RSI_RESET_LOW}-${swingResult.config.RSI_RESET_HIGH}` },
                                                { l: 'MACD', v: `${swingResult.config.MACD_FAST}/${swingResult.config.MACD_SLOW}/${swingResult.config.MACD_SIGNAL}` },
                                                { l: 'Pullback', v: `±${(swingResult.config.PULLBACK_PROXIMITY_PCT * 100).toFixed(0)}% of EMA20` },
                                                { l: 'Vol Trigger (A)', v: `${swingResult.config.TRIGGER_VOLUME_MULTIPLIER}x` },
                                                { l: 'Vol Trigger (B)', v: `${swingResult.config.MACD_VOLUME_MULTIPLIER}x` },
                                                { l: 'Min Stop', v: `${(swingResult.config.MIN_STOP_DISTANCE_PCT * 100).toFixed(0)}%` },
                                                { l: 'Dead Money', v: `${swingResult.config.DEAD_MONEY_DAYS}d / ${(swingResult.config.DEAD_MONEY_THRESHOLD * 100).toFixed(0)}%` },
                                                { l: 'Risk/Trade', v: `${(swingResult.config.MAX_RISK_PER_TRADE_PCT * 100).toFixed(0)}%` },
                                                { l: 'Max Positions', v: swingResult.config.MAX_CONCURRENT_POSITIONS },
                                                { l: 'Min Turnover', v: `₹${swingResult.config.MIN_AVG_TURNOVER_CR}cr` },
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

                    {/* ═══ STRATEGY 3: MEAN REVERSION ═══ */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-[var(--border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                                        <GitPullRequestArrow size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                                            Strategy 3: Mean Reversion (RSI2)
                                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">CONTRARIAN</span>
                                        </h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">Buy oversold Nifty 100 stocks above 200-SMA · RSI(2) &lt; 10 entry · Connors &amp; Alvarez</p>
                                    </div>
                                </div>
                                <button
                                    onClick={mrScanning ? stopMrScan : runMeanReversion}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                        mrScanning
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/25'
                                    }`}
                                >
                                    {mrScanning ? <><StopCircle size={14} /> Stop</> : <><Play size={14} /> Run Scan</>}
                                </button>
                            </div>

                            {/* Progress */}
                            {(mrScanning || mrProgress) && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-[10px] text-[var(--foreground-muted)] mb-1">
                                        <span>{mrStatusMsg}</span>
                                        <span>{mrProgress?.pct || 0}%</span>
                                    </div>
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${mrProgress?.pct || 0}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {mrError && (
                            <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                                <AlertTriangle size={14} className="inline mr-1" /> {mrError}
                            </div>
                        )}

                        {/* Expected Performance (before scan) */}
                        {!mrResult && !mrScanning && (
                            <div className="p-5">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    {[
                                        { label: 'Win Rate', value: '70-80%', icon: Target, color: 'text-emerald-400' },
                                        { label: 'Avg Gain', value: '3-5%', icon: TrendingUp, color: 'text-teal-400' },
                                        { label: 'Holding', value: '4-7 days', icon: Clock, color: 'text-cyan-400' },
                                        { label: 'Max DD', value: '10-15%', icon: Shield, color: 'text-amber-400' },
                                    ].map(m => (
                                        <div key={m.label} className="bg-[var(--background)] rounded-xl p-3 text-center">
                                            <m.icon size={16} className={`${m.color} mx-auto mb-1`} />
                                            <div className="text-sm font-bold text-[var(--foreground)]">{m.value}</div>
                                            <div className="text-[9px] text-[var(--foreground-muted)]">{m.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[10px] text-[var(--foreground-muted)] bg-[var(--background)] rounded-lg p-3">
                                    <p className="font-medium text-[var(--foreground)] mb-1">How it works:</p>
                                    <ul className="space-y-0.5 list-disc list-inside">
                                        <li>Scans for stocks in <span className="text-emerald-400">long-term uptrends</span> (price &gt; 200-SMA)</li>
                                        <li>Identifies <span className="text-emerald-400">extreme short-term oversold</span> conditions (RSI(2) &lt; 10)</li>
                                        <li>Requires 2+ consecutive down closes + earnings blackout check</li>
                                        <li>Exit: RSI(2) &gt; 70, above 5-SMA, or 10-day time stop</li>
                                        <li>Stop-loss: tighter of 2×ATR(14) or 7% below entry</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Results */}
                        {mrResult && (
                            <div className="p-5 space-y-4">
                                {/* Market Regime */}
                                {mrResult.regime && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                                        mrResult.regime.regime === 'BULL' ? 'bg-emerald-500/10 text-emerald-400' :
                                        mrResult.regime.regime === 'BULL_PANIC' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-red-500/10 text-red-400'
                                    }`}>
                                        {mrResult.regime.regime === 'BULL' ? <TrendingUp size={14} /> : mrResult.regime.regime === 'BULL_PANIC' ? <AlertTriangle size={14} /> : <TrendingDown size={14} />}
                                        <span className="font-semibold">Market: {mrResult.regime.regime}</span>
                                        {mrResult.regime.nifty && <span className="text-[var(--foreground-muted)]">• Nifty {mrResult.regime.nifty} ({mrResult.regime.distancePct} from 200-SMA)</span>}
                                        {mrResult.regime.warning && <span className="text-amber-400 ml-1">⚠ {mrResult.regime.warning}</span>}
                                    </div>
                                )}

                                {/* Stats Row */}
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Scanned', value: mrResult.totalScanned, color: 'text-[var(--foreground)]' },
                                        { label: 'Signals', value: mrResult.signalCount, color: 'text-emerald-400' },
                                        { label: 'Watchlist', value: mrResult.watchlist?.length || 0, color: 'text-amber-400' },
                                        { label: 'Filtered', value: mrResult.totalFiltered, color: 'text-[var(--foreground-muted)]' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-[var(--background)] rounded-xl p-3 text-center">
                                            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                                            <div className="text-[9px] text-[var(--foreground-muted)]">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Triggered Signals */}
                                {mrResult.signals?.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                            <Zap size={14} /> TRIGGERED SIGNALS ({mrResult.signals.length})
                                        </h4>
                                        {mrResult.signals.map((sig: any, idx: number) => (
                                            <div key={idx} className="bg-[var(--background)] rounded-xl p-4 border border-emerald-500/20">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <span className="text-sm font-bold text-[var(--foreground)]">{sig.symbol}</span>
                                                        {sig.name && <span className="text-[10px] text-[var(--foreground-muted)] ml-2">{sig.name}</span>}
                                                        {sig.overallGrade && (
                                                            <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                                                sig.overallGrade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                sig.overallGrade === 'B' ? 'bg-teal-500/20 text-teal-400' :
                                                                'bg-amber-500/20 text-amber-400'
                                                            }`}>Grade {sig.overallGrade}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-emerald-400 font-semibold">Quality: {sig.qualityScore}/{sig.maxQualityScore}</span>
                                                </div>

                                                {/* Conditions */}
                                                <div className="grid grid-cols-2 gap-1.5 mb-3">
                                                    {sig.conditions?.map((c: any, ci: number) => (
                                                        <div key={ci} className={`text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 ${
                                                            c.met ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {c.met ? '✓' : '✗'} {c.name.replace(/_/g, ' ')}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Quality Factors */}
                                                {sig.qualityFactors?.length > 0 && (
                                                    <div className="text-[10px] text-[var(--foreground-muted)] mb-3 space-y-0.5">
                                                        {sig.qualityFactors.map((f: string, fi: number) => (
                                                            <div key={fi}>• {f}</div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Trade Plan */}
                                                {sig.trade && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Entry</div>
                                                            <div className="font-bold text-[var(--foreground)]">₹{sig.trade.entryPrice}</div>
                                                        </div>
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Stop Loss</div>
                                                            <div className="font-bold text-red-400">₹{sig.trade.stopLoss} ({sig.trade.stopDistancePct})</div>
                                                        </div>
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Target (BB Mid)</div>
                                                            <div className="font-bold text-emerald-400">₹{sig.trade.bbMiddleTarget}</div>
                                                        </div>
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Risk:Reward</div>
                                                            <div className="font-bold text-teal-400">{sig.trade.estimatedRiskReward}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Key Indicators */}
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {[
                                                        { l: 'RSI(2)', v: sig.indicators?.rsi2 },
                                                        { l: 'RSI(14)', v: sig.indicators?.rsi14 },
                                                        { l: 'BB %B', v: sig.indicators?.bbPercentB },
                                                        { l: 'Down Days', v: sig.indicators?.consecutiveDown },
                                                        { l: 'Decline', v: sig.indicators?.cumulativeDecline },
                                                    ].map(ind => (
                                                        <span key={ind.l} className="text-[9px] px-2 py-0.5 bg-[var(--card)] rounded border border-[var(--border)] text-[var(--foreground-muted)]">
                                                            <span className="text-[var(--foreground)] font-medium">{ind.l}:</span> {ind.v ?? 'N/A'}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {mrResult.signals?.length === 0 && mrResult.regime?.tradeable && (
                                    <div className="text-center py-8 text-[var(--foreground-muted)] text-sm">
                                        <Info size={24} className="mx-auto mb-2 opacity-50" />
                                        No stocks currently meet all 4 mean reversion conditions.
                                        <br />
                                        <span className="text-[10px]">Check the watchlist for stocks close to triggering.</span>
                                    </div>
                                )}

                                {/* Watchlist */}
                                {mrResult.watchlist?.length > 0 && (
                                    <div>
                                        <button onClick={() => setShowMrWatchlist(!showMrWatchlist)} className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                                            {showMrWatchlist ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Eye size={14} /> WATCHLIST — Almost Triggered ({mrResult.watchlist.length})
                                        </button>
                                        {showMrWatchlist && (
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {mrResult.watchlist.map((w: any, i: number) => (
                                                    <div key={i} className="bg-[var(--background)] rounded-lg p-3 text-[10px] border border-amber-500/10">
                                                        <div className="font-bold text-[var(--foreground)] text-xs">{w.symbol} <span className="text-[var(--foreground-muted)] font-normal">{w.name}</span></div>
                                                        <div className="text-[var(--foreground-muted)] mt-1">Score: {w.score}/4 • RSI(2): {w.rsi2} • Down: {w.consecutiveDown} days</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Filtered */}
                                {mrResult.filtered?.length > 0 && (
                                    <div>
                                        <button onClick={() => setShowMrFiltered(!showMrFiltered)} className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showMrFiltered ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Filter size={14} /> Filtered Stocks ({mrResult.totalFiltered})
                                        </button>
                                        {showMrFiltered && (
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {mrResult.filtered.slice(0, 20).map((f: any, i: number) => (
                                                    <div key={i} className="text-[10px] px-2.5 py-1.5 bg-[var(--background)] rounded-lg text-[var(--foreground-muted)]">
                                                        <span className="text-[var(--foreground)] font-medium">{f.symbol}</span> — {f.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Config */}
                                {mrResult.config && (
                                    <div>
                                        <h4 className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-2 flex items-center gap-1"><Info size={12} /> Configuration</h4>
                                        <div className="flex flex-wrap gap-1.5 text-[9px]">
                                            {[
                                                { l: 'RSI Entry', v: `< ${mrResult.config.RSI2_OVERSOLD}` },
                                                { l: 'RSI Exit', v: `> ${mrResult.config.RSI2_OVERBOUGHT}` },
                                                { l: 'Min Down', v: `${mrResult.config.MIN_CONSECUTIVE_DOWN} days` },
                                                { l: 'Time Stop', v: `${mrResult.config.TIME_STOP_DAYS}d` },
                                                { l: 'ATR Stop', v: `${mrResult.config.ATR_STOP_MULTIPLIER}×ATR` },
                                                { l: 'Max Stop', v: `${(mrResult.config.MAX_STOP_PCT * 100)}%` },
                                                { l: 'Trend Filter', v: `${mrResult.config.SMA_TREND}-SMA` },
                                                { l: 'Max Positions', v: mrResult.config.MAX_CONCURRENT_POSITIONS },
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
                                <p className="text-[10px] text-[var(--foreground-muted)]">Breakout · Value Momentum · Quality Factor</p>
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
