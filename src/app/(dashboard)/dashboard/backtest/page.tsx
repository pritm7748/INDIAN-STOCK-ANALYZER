'use client'

import { useState } from 'react'
import { STOCK_LIST } from '@/lib/stockList'
import {
    FlaskConical, Zap, Search, Loader2, AlertTriangle, ChevronDown, ChevronRight,
    TrendingUp, TrendingDown, Minus, Target, BarChart3, Activity, Calendar,
    Shield, Lightbulb, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ============================================================
// TYPES
// ============================================================

interface AgenticResult {
    verdict: {
        direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
        confidence: number
        compositeScore: number
        summary: string
        activeSignals: number
        totalStrategies: number
        topStrategy: string
        topReturn: number
        priceTarget: { upside: number; downside: number; currentPrice: number }
        unifiedAction: {
            action: 'BUY' | 'SELL' | 'HOLD'
            target: number
            stopLoss: number
            currentPrice: number
            riskReward: number
            confidence: number
            reasoning: string[]
        }
        keyInsights: string[]
        aggregateMetrics: {
            avgReturn: number; avgSharpe: number; avgWinRate: number
            avgMaxDD: number; agreementPct: number; profitableStrategies: number
        }
        signalBreakdown: { buy: number; sell: number; wait: number }
        bestCategory: string
    }
    strategies: {
        strategy: { id: string; name: string; description: string }
        report: any
        currentSignal: 'BUY' | 'SELL' | 'WAIT'
        signalReasons: string[]
        rank: number
        recentPerformance: number
        backtestTarget: { target: number; stopLoss: number; avgHoldingDays: number; avgWinPct: number; avgLossPct: number; direction: 'BUY' | 'SELL' | 'WAIT' }
    }[]
    signals: {
        signals: { name: string; category: string; direction: string; strength: number; description: string; priceLevel?: number }[]
        candlestickPatterns: { name: string; category: string; direction: string; strength: number; description: string }[]
        supportResistance: { price: number; type: 'support' | 'resistance'; strength: number; source: string }[]
        priceTargets: { currentPrice: number; immediateSupport: number; immediateResistance: number; target1: number; target2: number; stopLoss: number; riskRewardRatio: number }
        fvgs: { midPrice: number; type: string; filled: boolean; date: string }[]
        orderBlocks: { price: number; type: string; strength: number; date: string }[]
        fibLevels: { level: string; price: number; type: string }[]
        candlestickBias: 'bullish' | 'bearish' | 'neutral'
        candlestickScore: number
        overallBias: string
        overallScore: number
        priceVsLevels: string
    }
    symbol: string
    stockName: string
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function BacktestPage() {
    const [stockSearch, setStockSearch] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedSymbol, setSelectedSymbol] = useState('')
    const [selectedName, setSelectedName] = useState('')
    const [result, setResult] = useState<AgenticResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null)
    const [expandedTab, setExpandedTab] = useState('equity')

    const filteredStocks = STOCK_LIST.filter(s =>
        s.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
        s.symbol.toLowerCase().includes(stockSearch.toLowerCase())
    ).slice(0, 15)

    const runAnalysis = async () => {
        if (!selectedSymbol) return
        setLoading(true); setError(''); setResult(null)
        try {
            const res = await fetch('/api/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: selectedSymbol, stockName: selectedName })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Analysis failed')
            setResult(data)
        } catch (err: any) { setError(err.message) }
        finally { setLoading(false) }
    }

    const v = result?.verdict

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-xl flex items-center justify-center">
                    <FlaskConical size={24} className="text-violet-400" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">Agentic Backtesting Engine</h1>
                    <p className="text-xs text-[var(--foreground-muted)]">AI-powered multi-strategy analysis & movement prediction</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]" />
                        <input
                            value={showDropdown ? stockSearch : (selectedName || '')}
                            onChange={e => { setStockSearch(e.target.value); setShowDropdown(true) }}
                            onFocus={() => { setShowDropdown(true); setStockSearch('') }}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                            placeholder="Search any stock..."
                        />
                        {showDropdown && stockSearch.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                {filteredStocks.length > 0 ? filteredStocks.map(s => (
                                    <button key={s.symbol} onMouseDown={e => e.preventDefault()} onClick={() => {
                                        setSelectedSymbol(s.symbol); setSelectedName(s.name); setStockSearch(''); setShowDropdown(false)
                                    }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--card-hover)] flex justify-between transition-colors">
                                        <span className="text-[var(--foreground)]">{s.name}</span>
                                        <span className="text-[var(--foreground-muted)] text-xs">{s.symbol.replace('.NS', '')}</span>
                                    </button>
                                )) : <p className="px-4 py-3 text-sm text-[var(--foreground-muted)]">No stocks found</p>}
                            </div>
                        )}
                    </div>
                    <button onClick={runAnalysis} disabled={loading || !selectedSymbol}
                        className="px-8 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap">
                        {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</> : <><Zap size={18} /> Run Analysis</>}
                    </button>
                </div>
                {error && <p className="text-sm text-red-400 flex items-center gap-2 mt-3"><AlertTriangle size={14} />{error}</p>}
                {loading && (
                    <div className="mt-4 space-y-2">
                        <p className="text-sm text-[var(--foreground-muted)] text-center animate-pulse">Testing 8 strategies on {selectedName}...</p>
                        <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 rounded-full animate-pulse" style={{ width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* ===== RESULTS ===== */}
            {result && v && (
                <>
                    {/* VERDICT CARD */}
                    <div className={`rounded-2xl border-2 overflow-hidden ${v.direction === 'BULLISH' ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-emerald-900/5 to-transparent'
                        : v.direction === 'BEARISH' ? 'border-red-500/40 bg-gradient-to-br from-red-500/5 via-red-900/5 to-transparent'
                            : 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-amber-900/5 to-transparent'
                        }`}>
                        <div className="p-5 sm:p-6">
                            <div className="flex flex-col lg:flex-row gap-5">
                                {/* Left: Verdict */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${v.direction === 'BULLISH' ? 'bg-emerald-500/20 shadow-emerald-500/10' :
                                            v.direction === 'BEARISH' ? 'bg-red-500/20 shadow-red-500/10' : 'bg-amber-500/20 shadow-amber-500/10'
                                            }`}>
                                            {v.direction === 'BULLISH' ? <TrendingUp size={28} className="text-emerald-400" /> :
                                                v.direction === 'BEARISH' ? <TrendingDown size={28} className="text-red-400" /> :
                                                    <Minus size={28} className="text-amber-400" />}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-[var(--foreground)]">
                                                {result.stockName}
                                                <span className={`ml-2 ${v.direction === 'BULLISH' ? 'text-emerald-400' : v.direction === 'BEARISH' ? 'text-red-400' : 'text-amber-400'
                                                    }`}>{v.direction}</span>
                                            </h2>
                                            <p className="text-sm text-[var(--foreground-muted)]">{v.summary}</p>
                                        </div>
                                    </div>

                                    {/* UNIFIED VERDICT */}
                                    {(() => {
                                        const ua = v.unifiedAction
                                        const isBuy = ua.action === 'BUY'
                                        const isSell = ua.action === 'SELL'
                                        return (
                                            <div className={`rounded-xl p-4 border ${isBuy ? 'bg-emerald-500/5 border-emerald-500/20' : isSell ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : isSell ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '⚖️ HOLD'}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Unified Verdict</span>
                                                    <span className="text-[10px] text-[var(--foreground-muted)] ml-auto">{ua.confidence}% conf</span>
                                                </div>
                                                {ua.action !== 'HOLD' ? (
                                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                                        <div className={`rounded-lg p-2.5 text-center border ${isBuy ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                                                            <p className={`text-lg font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>₹{ua.target.toFixed(0)}</p>
                                                            <p className="text-[9px] text-[var(--foreground-muted)]">{isBuy ? 'Buy Target' : 'Sell Target'}</p>
                                                        </div>
                                                        <div className="rounded-lg p-2.5 text-center border border-[var(--border)]">
                                                            <p className="text-lg font-bold text-[var(--foreground)]">₹{ua.currentPrice.toFixed(0)}</p>
                                                            <p className="text-[9px] text-[var(--foreground-muted)]">Current Price</p>
                                                        </div>
                                                        <div className="rounded-lg p-2.5 text-center border border-red-500/20">
                                                            <p className={`text-lg font-bold ${isBuy ? 'text-red-400' : 'text-amber-400'}`}>₹{ua.stopLoss.toFixed(0)}</p>
                                                            <p className="text-[9px] text-[var(--foreground-muted)]">Stop Loss</p>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <div className="flex items-center gap-2 mb-2">
                                                    {ua.action !== 'HOLD' && (
                                                        <span className="text-[10px] text-[var(--foreground-muted)]">R:R {ua.riskReward}x</span>
                                                    )}
                                                    {ua.action !== 'HOLD' && (
                                                        <span className="text-[10px] text-[var(--foreground-muted)] ml-auto">
                                                            {isBuy ? `+${((ua.target - ua.currentPrice) / ua.currentPrice * 100).toFixed(1)}% upside` :
                                                                `-${((ua.currentPrice - ua.target) / ua.currentPrice * 100).toFixed(1)}% downside`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    {ua.reasoning.map((r: string, i: number) => (
                                                        <p key={i} className="text-[11px] text-[var(--foreground-muted)] leading-snug">• {r}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>

                                {/* Right: Scores */}
                                <div className="flex flex-row lg:flex-col gap-4 items-center lg:items-end shrink-0">
                                    {/* Confidence Ring */}
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="relative w-[72px] h-[72px]">
                                            <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 72 72">
                                                <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" strokeWidth="5" />
                                                <circle cx="36" cy="36" r="30" fill="none"
                                                    stroke={v.direction === 'BULLISH' ? '#22c55e' : v.direction === 'BEARISH' ? '#ef4444' : '#f59e0b'}
                                                    strokeWidth="5" strokeLinecap="round"
                                                    strokeDasharray={`${v.confidence * 1.885} 188.5`}
                                                    style={{ transition: 'stroke-dasharray 1s ease' }} />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-[var(--foreground)]">{v.confidence}%</span>
                                        </div>
                                        <span className="text-[9px] text-[var(--foreground-muted)]">Confidence</span>
                                    </div>
                                    {/* Composite Score */}
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center border ${v.compositeScore >= 15 ? 'bg-emerald-500/10 border-emerald-500/30' :
                                            v.compositeScore <= -15 ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
                                            }`}>
                                            <span className={`text-lg font-bold ${v.compositeScore >= 15 ? 'text-emerald-400' : v.compositeScore <= -15 ? 'text-red-400' : 'text-amber-400'
                                                }`}>{v.compositeScore > 0 ? '+' : ''}{v.compositeScore}</span>
                                        </div>
                                        <span className="text-[9px] text-[var(--foreground-muted)]">Composite</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Key Insights */}
                        {v.keyInsights.length > 0 && (
                            <div className="border-t border-[var(--border)] px-5 py-3 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                                    <Lightbulb size={13} className="text-amber-400" /> Key Insights
                                </div>
                                {v.keyInsights.map((insight, i) => (
                                    <p key={i} className="text-xs text-[var(--foreground-muted)] pl-5">• {insight}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AGGREGATE METRICS BAR */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {[
                            { label: 'Avg Return', value: `${v.aggregateMetrics.avgReturn > 0 ? '+' : ''}${v.aggregateMetrics.avgReturn}%`, color: v.aggregateMetrics.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400' },
                            { label: 'Avg Win Rate', value: `${v.aggregateMetrics.avgWinRate}%`, color: v.aggregateMetrics.avgWinRate >= 50 ? 'text-emerald-400' : 'text-amber-400' },
                            { label: 'Avg Sharpe', value: v.aggregateMetrics.avgSharpe.toFixed(2), color: v.aggregateMetrics.avgSharpe >= 0.5 ? 'text-emerald-400' : 'text-amber-400' },
                            { label: 'Avg Max DD', value: `-${v.aggregateMetrics.avgMaxDD}%`, color: v.aggregateMetrics.avgMaxDD < 20 ? 'text-emerald-400' : 'text-red-400' },
                            { label: 'Agreement', value: `${v.aggregateMetrics.agreementPct}%`, color: v.aggregateMetrics.agreementPct >= 60 ? 'text-emerald-400' : 'text-amber-400' },
                            { label: 'Best Category', value: v.bestCategory, color: 'text-violet-400' },
                        ].map(c => (
                            <div key={c.label} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-3 text-center hover:border-violet-500/30 transition-colors">
                                <p className={`text-sm font-bold ${c.color}`}>{c.value}</p>
                                <p className="text-[9px] text-[var(--foreground-muted)] mt-0.5">{c.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* SIGNAL BREAKDOWN BAR */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-[var(--foreground)]">Strategy Signal Breakdown</span>
                            <span className="text-[10px] text-[var(--foreground-muted)]">{v.totalStrategies} tested</span>
                        </div>
                        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                            {v.signalBreakdown.buy > 0 && (
                                <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${(v.signalBreakdown.buy / v.totalStrategies) * 100}%` }} />
                            )}
                            {v.signalBreakdown.wait > 0 && (
                                <div className="bg-gray-500 rounded-full transition-all" style={{ width: `${(v.signalBreakdown.wait / v.totalStrategies) * 100}%` }} />
                            )}
                            {v.signalBreakdown.sell > 0 && (
                                <div className="bg-red-500 rounded-full transition-all" style={{ width: `${(v.signalBreakdown.sell / v.totalStrategies) * 100}%` }} />
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> BUY ({v.signalBreakdown.buy})</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> WAIT ({v.signalBreakdown.wait})</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> SELL ({v.signalBreakdown.sell})</span>
                        </div>
                    </div>

                    {/* ALL SIGNALS — Grouped by Category */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">📡</span>
                            <h4 className="text-sm font-semibold text-[var(--foreground)]">Signal Dashboard</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${result.signals.overallBias === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' :
                                result.signals.overallBias === 'bearish' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>{(result.signals.overallBias || 'neutral').toUpperCase()} ({result.signals.overallScore > 0 ? '+' : ''}{result.signals.overallScore})</span>
                            <span className="text-[10px] text-[var(--foreground-muted)] ml-auto">{result.signals.signals.length} signals detected</span>
                        </div>

                        {/* Signal categories */}
                        {['smart-money', 'candlestick', 'technical', 'momentum', 'structure'].map(cat => {
                            const catSignals = result.signals.signals.filter((s: any) => s.category === cat)
                            if (catSignals.length === 0) return null
                            const catLabel: Record<string, string> = { 'smart-money': '🏦 Smart Money', 'candlestick': '🕯️ Candlestick', 'technical': '📈 Technical', 'momentum': '⚡ Momentum', 'structure': '🏗️ Structure' }
                            return (
                                <div key={cat} className="mb-3">
                                    <p className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-1.5 uppercase tracking-wide">{catLabel[cat] || cat}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {catSignals.map((s: any, i: number) => (
                                            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${s.direction === 'bullish' ? 'bg-emerald-500/5 border-emerald-500/15' :
                                                s.direction === 'bearish' ? 'bg-red-500/5 border-red-500/15' : 'bg-[var(--background)] border-[var(--border)]'
                                                }`}>
                                                <span className="mt-0.5">{s.direction === 'bullish' ? '🟢' : s.direction === 'bearish' ? '🔴' : '⚪'}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-[var(--foreground)]">{s.name}</span>
                                                        <span className="text-[8px] text-[var(--foreground-muted)]">
                                                            {'★'.repeat(s.strength)}{'☆'.repeat(5 - s.strength)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5 leading-tight">{s.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* PRICE LEVELS: S/R + Fibonacci side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Support & Resistance */}
                        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">📊</span>
                                <h4 className="text-xs font-semibold text-[var(--foreground)]">Support & Resistance</h4>
                            </div>
                            <div className="space-y-1">
                                {result.signals.supportResistance.map((level: any, i: number) => {
                                    const distPct = ((level.price - result.signals.priceTargets.currentPrice) / result.signals.priceTargets.currentPrice * 100).toFixed(1)
                                    return (
                                        <div key={i} className={`flex items-center gap-2 px-2.5 py-1 rounded text-[11px] ${level.type === 'resistance' ? 'bg-red-500/5' : 'bg-emerald-500/5'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${level.type === 'resistance' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                            <span className="font-bold text-[var(--foreground)] w-16">₹{level.price.toFixed(0)}</span>
                                            <span className="text-[var(--foreground-muted)] flex-1 truncate text-[10px]">{level.source}</span>
                                            <span className="text-[9px] text-[var(--foreground-muted)]">{'●'.repeat(Math.min(5, level.strength))}{'○'.repeat(5 - Math.min(5, level.strength))}</span>
                                            <span className={`w-10 text-right text-[10px] font-medium ${Number(distPct) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(distPct) > 0 ? '+' : ''}{distPct}%</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Fibonacci Levels */}
                        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">🔢</span>
                                <h4 className="text-xs font-semibold text-[var(--foreground)]">Fibonacci Levels</h4>
                            </div>
                            <div className="space-y-1">
                                {(result.signals.fibLevels || []).map((fib: any, i: number) => {
                                    const distPct = ((fib.price - result.signals.priceTargets.currentPrice) / result.signals.priceTargets.currentPrice * 100).toFixed(1)
                                    return (
                                        <div key={i} className={`flex items-center gap-2 px-2.5 py-1 rounded text-[11px] ${fib.type === 'resistance' ? 'bg-amber-500/5' : 'bg-cyan-500/5'
                                            }`}>
                                            <span className="text-[10px] text-[var(--foreground-muted)] w-16">{fib.level}</span>
                                            <span className="font-bold text-[var(--foreground)] flex-1">₹{fib.price.toFixed(0)}</span>
                                            <span className={`w-10 text-right text-[10px] font-medium ${Number(distPct) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(distPct) > 0 ? '+' : ''}{distPct}%</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* STRATEGY RANKINGS */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[var(--card-border)] flex items-center gap-2">
                            <Shield size={16} className="text-violet-400" />
                            <h3 className="text-sm font-semibold text-[var(--foreground)]">Strategy Performance Rankings</h3>
                            <span className="text-[10px] text-[var(--foreground-muted)]">· sorted by return · 3Y backtest</span>
                        </div>

                        {result.strategies.map(s => {
                            const m = s.report.metrics
                            const isExpanded = expandedStrategy === s.strategy.id
                            return (
                                <div key={s.strategy.id} className="border-b border-[var(--border)] last:border-b-0">
                                    <button onClick={() => setExpandedStrategy(isExpanded ? null : s.strategy.id)}
                                        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-[var(--card-hover)] transition-all text-left group">
                                        {/* Rank */}
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-110 ${s.rank <= 3 ? 'bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-violet-300' : 'bg-[var(--background)] text-[var(--foreground-muted)]'
                                            }`}>#{s.rank}</span>

                                        {/* Name */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{s.strategy.name}</p>
                                            <p className="text-[10px] text-[var(--foreground-muted)] truncate">{s.strategy.description}</p>
                                        </div>

                                        {/* Desktop metrics */}
                                        <div className="hidden md:flex items-center gap-3 shrink-0">
                                            <MetricPill label="Return" value={`${m.totalReturnPct > 0 ? '+' : ''}${m.totalReturnPct}%`}
                                                color={m.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                                            <MetricPill label="Win" value={`${m.winRate}%`} color="text-[var(--foreground)]" />
                                            <MetricPill label="Sharpe" value={m.sharpeRatio.toFixed(1)} color="text-[var(--foreground)]" />
                                            <MetricPill label="Max DD" value={`-${m.maxDrawdownPct}%`}
                                                color={m.maxDrawdownPct < 20 ? 'text-emerald-400' : 'text-red-400'} />
                                            <MetricPill label="Recent 6M" value={`${s.recentPerformance > 0 ? '+' : ''}${s.recentPerformance}%`}
                                                color={s.recentPerformance >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                                        </div>

                                        {/* Signal */}
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${s.currentSignal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/20' :
                                            s.currentSignal === 'SELL' ? 'bg-red-500/20 text-red-400 shadow-sm shadow-red-500/20' :
                                                'bg-[var(--background)] text-[var(--foreground-muted)]'
                                            }`}>{s.currentSignal === 'BUY' ? '🟢 BUY' : s.currentSignal === 'SELL' ? '🔴 SELL' : '⚪ WAIT'}</span>

                                        {isExpanded ? <ChevronDown size={14} className="text-[var(--foreground-muted)] shrink-0" /> :
                                            <ChevronRight size={14} className="text-[var(--foreground-muted)] shrink-0" />}
                                    </button>

                                    {/* Expanded */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 bg-[var(--background)] border-t border-[var(--border)]">
                                            {/* Signal Reasons + Backtest Targets */}
                                            {s.currentSignal !== 'WAIT' && (
                                                <div className="mt-3 space-y-2">
                                                    {s.signalReasons.length > 0 && (
                                                        <div className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${s.currentSignal === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                            }`}>
                                                            <Zap size={12} /> <strong>Signal:</strong> {s.signalReasons.join(' · ')}
                                                        </div>
                                                    )}
                                                    {/* Per-strategy backtest-derived targets — direction aware */}
                                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${s.currentSignal === 'SELL' ? 'bg-red-500/5 border border-red-500/20' : 'bg-violet-500/5 border border-violet-500/20'
                                                        }`}>
                                                        <Target size={12} className={s.currentSignal === 'SELL' ? 'text-red-400' : 'text-violet-400'} />
                                                        <span className="text-[var(--foreground-muted)]">{s.currentSignal === 'SELL' ? 'Sell Target:' : 'Buy Target:'}</span>
                                                        <span className={`font-bold ${s.currentSignal === 'SELL' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            ₹{s.backtestTarget.target.toFixed(0)} ({s.currentSignal === 'SELL' ? '-' : '+'}{s.backtestTarget.avgWinPct}%)
                                                        </span>
                                                        <span className="text-[var(--foreground-muted)]">|</span>
                                                        <span className="text-[var(--foreground-muted)]">SL:</span>
                                                        <span className={`font-bold ${s.currentSignal === 'SELL' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            ₹{s.backtestTarget.stopLoss.toFixed(0)} ({s.currentSignal === 'SELL' ? '+' : '-'}{s.backtestTarget.avgLossPct}%)
                                                        </span>
                                                        <span className="text-[var(--foreground-muted)]">|</span>
                                                        <span className="text-[var(--foreground-muted)]">Avg Hold:</span>
                                                        <span className="font-medium text-[var(--foreground)]">{s.backtestTarget.avgHoldingDays}d</span>
                                                    </div>
                                                </div>
                                            )}
                                            {s.currentSignal === 'WAIT' && s.signalReasons.length > 0 && s.signalReasons[0] !== 'No active signal' && (
                                                <div className="mt-3 px-3 py-2 rounded-lg text-xs bg-[var(--background)] border border-[var(--border)] text-[var(--foreground-muted)]">
                                                    <Zap size={12} className="inline mr-1" /> {s.signalReasons.join(' · ')}
                                                </div>
                                            )}

                                            {/* Mobile metrics */}
                                            <div className="grid grid-cols-5 gap-1.5 mt-3 md:hidden">
                                                {[
                                                    { l: 'Return', v: `${m.totalReturnPct > 0 ? '+' : ''}${m.totalReturnPct}%`, c: m.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                    { l: 'Win%', v: `${m.winRate}%`, c: 'text-[var(--foreground)]' },
                                                    { l: 'Sharpe', v: m.sharpeRatio.toFixed(1), c: 'text-[var(--foreground)]' },
                                                    { l: 'Max DD', v: `-${m.maxDrawdownPct}%`, c: 'text-red-400' },
                                                    { l: '6M', v: `${s.recentPerformance > 0 ? '+' : ''}${s.recentPerformance}%`, c: s.recentPerformance >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                ].map(x => (
                                                    <div key={x.l} className="text-center bg-[var(--card)] rounded-lg p-1.5">
                                                        <p className={`text-[11px] font-bold ${x.c}`}>{x.v}</p>
                                                        <p className="text-[8px] text-[var(--foreground-muted)]">{x.l}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Tabs */}
                                            <div className="flex gap-1 mt-3 bg-[var(--card)] rounded-lg p-1 w-fit">
                                                {[
                                                    { id: 'equity', icon: <TrendingUp size={11} />, label: 'Equity Curve' },
                                                    { id: 'pnl', icon: <BarChart3 size={11} />, label: 'P&L Distribution' },
                                                    { id: 'trades', icon: <Clock size={11} />, label: 'Trades' },
                                                    { id: 'monthly', icon: <Calendar size={11} />, label: 'Monthly' },
                                                    { id: 'risk', icon: <Activity size={11} />, label: 'Risk' },
                                                ].map(tab => (
                                                    <button key={tab.id} onClick={() => setExpandedTab(tab.id)}
                                                        className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors ${expandedTab === tab.id ? 'bg-violet-500/20 text-violet-300' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                                                            }`}>{tab.icon} {tab.label}</button>
                                                ))}
                                            </div>

                                            <div className="mt-3">
                                                {expandedTab === 'equity' && <EquityDetail report={s.report} />}
                                                {expandedTab === 'pnl' && <PnlDistribution report={s.report} />}
                                                {expandedTab === 'trades' && <TradesDetail report={s.report} />}
                                                {expandedTab === 'monthly' && <MonthlyDetail report={s.report} />}
                                                {expandedTab === 'risk' && <RiskDetail report={s.report} />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Empty State */}
            {!result && !loading && (
                <div className="text-center py-20 text-[var(--foreground-muted)]">
                    <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 rounded-3xl flex items-center justify-center">
                        <FlaskConical size={36} className="opacity-30" />
                    </div>
                    <p className="text-sm font-medium">Search for a stock and run analysis</p>
                    <p className="text-xs mt-1 opacity-60">The engine tests 8 strategies across 3 years and predicts movements</p>
                </div>
            )}
        </div>
    )
}

// ============================================================
// METRIC PILL (inline stat)
// ============================================================

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="text-right w-14">
            <p className={`text-[11px] font-bold ${color}`}>{value}</p>
            <p className="text-[8px] text-[var(--foreground-muted)]">{label}</p>
        </div>
    )
}

// ============================================================
// EQUITY CURVE WITH DRAWDOWN
// ============================================================

function EquityDetail({ report }: { report: any }) {
    const raw = report.equityCurve || []
    const step = Math.max(1, Math.floor(raw.length / 200))
    const data = raw.filter((_: any, i: number) => i % step === 0).map((p: any) => ({
        date: p.date?.slice(5) || '',
        equity: Math.round(p.equity),
        dd: -Math.round(p.drawdownPct * 100) / 100
    }))

    return (
        <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--foreground)]">Portfolio Equity</p>
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--foreground-muted)' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--foreground-muted)' }} tickFormatter={(v: any) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }} />
                    <Area type="monotone" dataKey="equity" stroke="#8b5cf6" fill="url(#eqGrd)" strokeWidth={2} name="Equity" />
                    <defs><linearGradient id="eqGrd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient></defs>
                </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs font-medium text-[var(--foreground)]">Underwater Drawdown</p>
            <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'var(--foreground-muted)' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 8, fill: 'var(--foreground-muted)' }} tickFormatter={(v: any) => `${v}%`} />
                    <Area type="monotone" dataKey="dd" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={1} name="DD%" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ============================================================
// P&L DISTRIBUTION HISTOGRAM
// ============================================================

function PnlDistribution({ report }: { report: any }) {
    const trades = report.trades || []
    const pnls = trades.map((t: any) => Math.round(t.pnlPct * 100) / 100)

    // Build histogram buckets
    const bucketSize = 2
    const bucketMap = new Map<number, number>()
    for (const pnl of pnls) {
        const bucket = Math.floor(pnl / bucketSize) * bucketSize
        bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1)
    }
    const data = Array.from(bucketMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([range, count]) => ({
            range: `${range}%`,
            count,
            fill: range >= 0 ? '#22c55e' : '#ef4444'
        }))

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--foreground)]">Trade P&L Distribution</p>
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="range" tick={{ fontSize: 8, fill: 'var(--foreground-muted)' }} />
                    <YAxis tick={{ fontSize: 8, fill: 'var(--foreground-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="count" name="Trades" radius={[3, 3, 0, 0]}>
                        {data.map((entry, i) => (
                            <rect key={i} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 text-[10px] text-[var(--foreground-muted)]">
                <span>Avg Win: +{(trades.filter((t: any) => t.pnl > 0).reduce((s: number, t: any) => s + t.pnlPct, 0) / Math.max(1, trades.filter((t: any) => t.pnl > 0).length)).toFixed(1)}%</span>
                <span>Avg Loss: {(trades.filter((t: any) => t.pnl < 0).reduce((s: number, t: any) => s + t.pnlPct, 0) / Math.max(1, trades.filter((t: any) => t.pnl < 0).length)).toFixed(1)}%</span>
                <span>Median: {pnls.length > 0 ? pnls.sort((a: number, b: number) => a - b)[Math.floor(pnls.length / 2)].toFixed(1) : 0}%</span>
            </div>
        </div>
    )
}

// ============================================================
// TRADES TABLE
// ============================================================

function TradesDetail({ report }: { report: any }) {
    const trades = report.trades?.slice(0, 25) || []
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
                <thead>
                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--border)]">
                        {['#', 'Entry', 'Exit', 'Entry₹', 'Exit₹', 'P&L₹', 'P&L%', 'Days', 'Exit Reason'].map(h =>
                            <th key={h} className="text-left py-2 px-1.5 font-medium">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {trades.map((t: any) => (
                        <tr key={t.id} className={`border-b border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors ${t.pnl >= 0 ? 'bg-emerald-500/[0.03]' : 'bg-red-500/[0.03]'}`}>
                            <td className="py-1.5 px-1.5 text-[var(--foreground-muted)]">{t.id}</td>
                            <td className="py-1.5 px-1.5">{t.entryDate?.slice(5)}</td>
                            <td className="py-1.5 px-1.5">{t.exitDate?.slice(5)}</td>
                            <td className="py-1.5 px-1.5">₹{t.entryPrice?.toFixed(0)}</td>
                            <td className="py-1.5 px-1.5">₹{t.exitPrice?.toFixed(0)}</td>
                            <td className={`py-1.5 px-1.5 font-medium ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t.pnl >= 0 ? '+' : ''}₹{t.pnl?.toFixed(0)}
                            </td>
                            <td className={`py-1.5 px-1.5 ${t.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct?.toFixed(1)}%
                            </td>
                            <td className="py-1.5 px-1.5">{t.holdingDays}d</td>
                            <td className="py-1.5 px-1.5 text-[var(--foreground-muted)] max-w-[120px] truncate" title={t.exitReason}>{t.exitReason}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {(report.trades?.length || 0) > 25 && <p className="text-[10px] text-[var(--foreground-muted)] mt-2 text-center">Showing first 25 of {report.trades.length} trades</p>}
        </div>
    )
}

// ============================================================
// MONTHLY HEATMAP
// ============================================================

function MonthlyDetail({ report }: { report: any }) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const yearMap = new Map<number, Map<number, number>>()
    for (const mr of (report.monthlyReturns || [])) {
        if (!yearMap.has(mr.year)) yearMap.set(mr.year, new Map())
        yearMap.get(mr.year)!.set(mr.month, mr.returnPct)
    }
    const years = Array.from(yearMap.keys()).sort()

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
                <thead>
                    <tr className="text-[var(--foreground-muted)]">
                        <th className="text-left py-1.5 px-1.5 font-medium">Year</th>
                        {months.map(m => <th key={m} className="text-center py-1.5 px-1 font-medium">{m}</th>)}
                        <th className="text-center py-1.5 px-1.5 font-medium">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {years.map(year => {
                        const md = yearMap.get(year)!
                        const total = Array.from(md.values()).reduce((a, b) => a + b, 0)
                        return (
                            <tr key={year} className="border-t border-[var(--border)]">
                                <td className="py-1 px-1.5 font-semibold text-[var(--foreground)]">{year}</td>
                                {months.map((_, i) => {
                                    const val = md.get(i + 1)
                                    return <td key={i} className="text-center py-1 px-0.5">
                                        {val !== undefined ? (
                                            <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-medium ${val > 0 ? 'bg-emerald-500/20 text-emerald-400' : val < 0 ? 'bg-red-500/20 text-red-400' : 'text-[var(--foreground-muted)]'
                                                }`}>{val > 0 ? '+' : ''}{val.toFixed(1)}</span>
                                        ) : <span className="text-[var(--foreground-muted)] opacity-30">—</span>}
                                    </td>
                                })}
                                <td className={`text-center py-1 px-1.5 font-bold text-[11px] ${total > 0 ? 'text-emerald-400' : total < 0 ? 'text-red-400' : ''}`}>
                                    {total > 0 ? '+' : ''}{total.toFixed(1)}%
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ============================================================
// RISK METRICS GRID
// ============================================================

function RiskDetail({ report }: { report: any }) {
    const m = report.metrics || {}
    const mc = report.monteCarlo || {}
    const items = [
        ['Max Drawdown', `-${m.maxDrawdownPct || 0}%`],
        ['DD Duration', `${m.maxDrawdownDuration || 0} days`],
        ['Profit Factor', (m.profitFactor || 0).toFixed(2)],
        ['Sortino Ratio', (m.sortinoRatio || 0).toFixed(2)],
        ['Calmar Ratio', (m.calmarRatio || 0).toFixed(2)],
        ['Recovery Factor', (m.recoveryFactor || 0).toFixed(2)],
        ['Expectancy', `₹${(m.expectancy || 0).toFixed(0)}`],
        ['Time in Market', `${m.timeInMarketPct || 0}%`],
        ['VaR (95%)', `${m.var95 || 0}%`],
        ['CVaR', `${m.cvar || 0}%`],
        ['Best Trade', `+${m.bestTradePct || 0}%`],
        ['Worst Trade', `${m.worstTradePct || 0}%`],
        ['Win Streak', `${m.maxConsecutiveWins || 0}`],
        ['Loss Streak', `${m.maxConsecutiveLosses || 0}`],
        ['CAGR', `${(m.cagr || 0) > 0 ? '+' : ''}${m.cagr || 0}%`],
        ['Avg Win/Loss', (m.avgWinLossRatio || 0).toFixed(2)],
    ]

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
                {items.map(([label, value]) => (
                    <div key={label} className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-2 text-center hover:border-violet-500/20 transition-colors">
                        <p className="text-[10px] font-semibold text-[var(--foreground)]">{value}</p>
                        <p className="text-[8px] text-[var(--foreground-muted)] mt-0.5">{label}</p>
                    </div>
                ))}
            </div>
            {mc.simulations > 0 && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-violet-300 mb-1.5">Monte Carlo ({mc.simulations} simulations)</p>
                    <div className="flex gap-4 text-[10px] text-[var(--foreground-muted)]">
                        <span>Median DD: <strong className="text-[var(--foreground)]">{mc.medianDrawdown}%</strong></span>
                        <span>95th DD: <strong className="text-[var(--foreground)]">{mc.percentile95Drawdown}%</strong></span>
                        <span>Risk of Ruin: <strong className={mc.riskOfRuin > 10 ? 'text-red-400' : 'text-emerald-400'}>{mc.riskOfRuin}%</strong></span>
                    </div>
                </div>
            )}
        </div>
    )
}
