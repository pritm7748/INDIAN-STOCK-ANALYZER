// src/app/(dashboard)/dashboard/signals/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { TradeSignal, SignalStats } from '@/lib/signals/types'
import { calculateCurrentPnL } from '@/lib/signals/generator'
import { STOCK_LIST } from '@/lib/stockList'
import {
    Target, TrendingUp, TrendingDown, AlertTriangle, Clock,
    CheckCircle2, XCircle, Loader2, RefreshCw, BarChart3,
    ArrowUp, ArrowDown, Activity, Zap, Trophy, Ban, Radio
} from 'lucide-react'

// Stat Card Component
function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    color,
    delay = 0
}: {
    icon: any
    label: string
    value: string | number
    subValue?: string
    color: string
    delay?: number
}) {
    const colorClasses: Record<string, { bg: string; text: string; glow: string }> = {
        blue: { bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
        emerald: { bg: 'from-emerald-500/20 to-teal-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
        rose: { bg: 'from-rose-500/20 to-pink-500/20', text: 'text-rose-400', glow: 'shadow-rose-500/20' },
        purple: { bg: 'from-purple-500/20 to-indigo-500/20', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
        amber: { bg: 'from-amber-500/20 to-orange-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
        gray: { bg: 'from-gray-500/20 to-slate-500/20', text: 'text-gray-400', glow: 'shadow-gray-500/20' },
    }
    const style = colorClasses[color] || colorClasses.gray

    return (
        <div
            className={`glass-card p-4 hover:shadow-lg ${style.glow} transition-all duration-300 animate-fade-in-up`}
            style={{ animationDelay: `${delay}s` }}
        >
            <div className={`flex items-center gap-2 ${style.text} text-xs mb-2`}>
                <Icon size={14} />
                <span className="font-medium">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${style.text}`}>{value}</p>
            {subValue && <p className="text-xs text-[var(--foreground-muted)]">{subValue}</p>}
        </div>
    )
}

export default function SignalsPage() {
    const [signals, setSignals] = useState<TradeSignal[]>([])
    const [stats, setStats] = useState<SignalStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)
    const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL')
    const [prices, setPrices] = useState<Record<string, number>>({})

    const { isAuthenticated, isLoading: authLoading } = useUser()
    const supabase = createClient()

    // Fetch signals
    const fetchSignals = useCallback(async () => {
        if (!isAuthenticated) return

        setLoading(true)
        try {
            const status = filter === 'ALL' ? '' : filter === 'ACTIVE' ? 'ACTIVE' : 'CLOSED'
            const res = await fetch(`/api/signals${status ? `?status=${status}` : ''}`)
            const data = await res.json()

            if (data.signals) {
                setSignals(data.signals)
                setStats(data.stats)
            }
        } catch (err) {
            console.error('Error fetching signals:', err)
        } finally {
            setLoading(false)
        }
    }, [isAuthenticated, filter])

    // Check signals for target/SL hits
    const checkSignals = async () => {
        setChecking(true)
        try {
            const res = await fetch('/api/signals/check')
            const data = await res.json()

            if (data.updated > 0) {
                await fetchSignals()
            }
        } catch (err) {
            console.error('Error checking signals:', err)
        } finally {
            setChecking(false)
        }
    }

    // Cancel a signal
    const cancelSignal = async (signalId: string) => {
        if (!confirm('Cancel this signal?')) return

        try {
            await fetch(`/api/signals?id=${signalId}`, { method: 'DELETE' })
            await fetchSignals()
        } catch (err) {
            console.error('Error cancelling signal:', err)
        }
    }

    // Fetch current prices for active signals
    const fetchPrices = useCallback(async () => {
        const activeSignals = signals.filter(s => s.status === 'ACTIVE')
        if (activeSignals.length === 0) return

        const symbols = [...new Set(activeSignals.map(s => s.symbol))]
        const newPrices: Record<string, number> = {}

        for (const symbol of symbols) {
            try {
                const res = await fetch(`/api/quote?symbol=${symbol}`)
                const data = await res.json()
                if (data.price) {
                    newPrices[symbol] = data.price
                }
            } catch {
                // Ignore individual price fetch errors
            }
        }

        setPrices(newPrices)
    }, [signals])

    useEffect(() => {
        if (isAuthenticated) {
            fetchSignals()
        }
    }, [isAuthenticated, fetchSignals])

    useEffect(() => {
        if (signals.some(s => s.status === 'ACTIVE')) {
            fetchPrices()
            const interval = setInterval(fetchPrices, 60000)
            return () => clearInterval(interval)
        }
    }, [signals, fetchPrices])

    const getStockName = (symbol: string) => {
        const stock = STOCK_LIST.find(s => s.symbol === symbol)
        return stock?.name || symbol.replace('.NS', '')
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs flex items-center gap-1.5 font-medium"><Radio size={10} className="animate-pulse" /> Active</span>
            case 'TARGET_HIT':
                return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-1.5 font-medium"><CheckCircle2 size={12} /> Target Hit</span>
            case 'STOP_LOSS':
                return <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-1.5 font-medium"><XCircle size={12} /> Stop Loss</span>
            case 'EXPIRED':
                return <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-lg text-xs flex items-center gap-1.5 font-medium"><Clock size={12} /> Expired</span>
            case 'CANCELLED':
                return <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-lg text-xs flex items-center gap-1.5 font-medium"><Ban size={12} /> Cancelled</span>
            default:
                return null
        }
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="animate-spin text-blue-400 mx-auto mb-4" size={40} />
                    <p className="text-[var(--foreground-muted)]">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center glass-card p-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6">
                    <Target className="text-blue-400" size={40} />
                </div>
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Sign in Required</h2>
                <p className="text-[var(--foreground-muted)]">Please sign in to view your trade signals</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-down">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--foreground)]">Trade Signals</h1>
                        <p className="text-[var(--foreground-muted)] text-sm">Track your live signals and accuracy</p>
                    </div>
                </div>

                <button
                    onClick={checkSignals}
                    disabled={checking}
                    className="flex items-center gap-2 px-4 py-2.5 glass-card hover:bg-[var(--background-secondary)] text-[var(--foreground)] text-sm transition-all disabled:opacity-50 shadow-lg hover:shadow-xl group"
                >
                    {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />}
                    Check Signals
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard icon={BarChart3} label="Total Signals" value={stats.total_signals} color="gray" delay={0.05} />
                    <StatCard icon={Activity} label="Active" value={stats.active_signals} color="blue" delay={0.1} />
                    <StatCard icon={Trophy} label="Win Rate" value={`${stats.win_rate.toFixed(1)}%`} subValue={`${stats.wins}W / ${stats.losses}L`} color="emerald" delay={0.15} />
                    <StatCard icon={TrendingUp} label="Avg Return" value={`${stats.avg_return >= 0 ? '+' : ''}${stats.avg_return.toFixed(2)}%`} color={stats.avg_return >= 0 ? 'emerald' : 'rose'} delay={0.2} />
                    <StatCard icon={ArrowUp} label="Best Trade" value={`+${stats.best_trade.toFixed(2)}%`} color="emerald" delay={0.25} />
                    <StatCard icon={ArrowDown} label="Worst Trade" value={`${stats.worst_trade.toFixed(2)}%`} color="rose" delay={0.3} />
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 p-1 bg-[var(--background-secondary)] rounded-xl w-fit animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                {(['ALL', 'ACTIVE', 'CLOSED'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${filter === tab
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-secondary)]'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Signals List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <Loader2 className="animate-spin text-blue-400 mx-auto mb-4" size={40} />
                        <p className="text-[var(--foreground-muted)]">Loading signals...</p>
                    </div>
                </div>
            ) : signals.length === 0 ? (
                <div className="text-center py-16 glass-card">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-500/20 to-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Target className="text-[var(--foreground-muted)]" size={40} />
                    </div>
                    <p className="text-[var(--foreground-muted)] font-medium">No signals yet</p>
                    <p className="text-[var(--foreground-muted)] text-sm mt-1">Generate signals from the Stock Analyzer page</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {signals.map((signal, idx) => {
                        const currentPrice = prices[signal.symbol]
                        const pnl = signal.status === 'ACTIVE' && currentPrice
                            ? calculateCurrentPnL({ signal_type: signal.signal_type, entry_price: signal.entry_price }, currentPrice)
                            : null

                        return (
                            <div
                                key={signal.id}
                                className="glass-card p-5 hover:shadow-xl transition-all duration-300 animate-fade-in-up group"
                                style={{ animationDelay: `${0.4 + idx * 0.05}s` }}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Stock Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${signal.signal_type === 'BUY'
                                                ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-300 shadow-lg shadow-emerald-500/10'
                                                : 'bg-gradient-to-r from-rose-500/30 to-pink-500/30 text-rose-300 shadow-lg shadow-rose-500/10'
                                                }`}>
                                                {signal.signal_type}
                                            </span>
                                            <h3 className="font-bold text-[var(--foreground)] text-lg">
                                                {signal.symbol.replace('.NS', '')}
                                            </h3>
                                            <span className="text-[var(--foreground-muted)] text-sm">
                                                {getStockName(signal.symbol)}
                                            </span>
                                            {getStatusBadge(signal.status)}
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[var(--foreground-muted)]">Entry:</span>
                                                <span className="text-[var(--foreground)] font-medium">₹{signal.entry_price.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-emerald-500 dark:text-emerald-400">Target:</span>
                                                <span className="text-[var(--foreground)] font-medium">₹{signal.target_price.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-rose-500 dark:text-rose-400">SL:</span>
                                                <span className="text-[var(--foreground)] font-medium">₹{signal.stop_loss.toFixed(2)}</span>
                                            </div>
                                            {currentPrice && signal.status === 'ACTIVE' && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-blue-500 dark:text-blue-400">CMP:</span>
                                                    <span className="text-[var(--foreground)] font-medium">₹{currentPrice.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {signal.reasons && signal.reasons.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {signal.reasons.slice(0, 3).map((reason, i) => (
                                                    <span key={i} className="text-xs px-2.5 py-1 bg-[var(--background-secondary)] rounded-lg text-[var(--foreground-muted)] border border-[var(--border)]">
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* P&L */}
                                    <div className="text-right">
                                        {signal.status === 'ACTIVE' ? (
                                            pnl ? (
                                                <div className={`p-3 rounded-xl ${pnl.pnl_pct >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                                    <p className={`text-2xl font-bold ${pnl.pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {pnl.pnl_pct >= 0 ? '+' : ''}{pnl.pnl_pct.toFixed(2)}%
                                                    </p>
                                                    <p className={`text-sm ${pnl.pnl >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                                                        {pnl.pnl >= 0 ? '+' : ''}₹{pnl.pnl.toFixed(2)}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="animate-pulse">
                                                    <div className="h-8 w-20 bg-white/10 rounded-lg"></div>
                                                </div>
                                            )
                                        ) : (
                                            <div className={`p-3 rounded-xl ${(signal.return_pct || 0) >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                                <p className={`text-2xl font-bold ${(signal.return_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {(signal.return_pct || 0) >= 0 ? '+' : ''}{(signal.return_pct || 0).toFixed(2)}%
                                                </p>
                                                <p className="text-xs text-[var(--foreground-muted)]">
                                                    Exit: ₹{signal.exit_price?.toFixed(2)}
                                                </p>
                                            </div>
                                        )}

                                        <p className="text-xs text-[var(--foreground-muted)] mt-2">
                                            {new Date(signal.created_at).toLocaleDateString()}
                                        </p>

                                        {signal.status === 'ACTIVE' && (
                                            <button
                                                onClick={() => cancelSignal(signal.id)}
                                                className="mt-2 text-xs text-[var(--foreground-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-500/10"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
