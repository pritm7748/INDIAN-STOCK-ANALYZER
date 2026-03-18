'use client'

import { useState } from 'react'
import { STOCK_LIST } from '@/lib/stockList'
import {
    Brain, Search, Loader2, TrendingUp, TrendingDown, Minus,
    ChevronRight, Zap, Target, Shield, BarChart3, Activity
} from 'lucide-react'

export default function StrategyAnalysisPage() {
    const [selectedSymbol, setSelectedSymbol] = useState('')
    const [selectedName, setSelectedName] = useState('')
    const [stockSearch, setStockSearch] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [loading, setLoading] = useState(false)

    const filteredStocks = stockSearch.length > 0
        ? STOCK_LIST.filter(s =>
            s.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
            s.symbol.toLowerCase().includes(stockSearch.toLowerCase())
        ).slice(0, 15)
        : []

    return (
        <div className="max-w-[1400px] mx-auto space-y-5 overflow-x-hidden">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                    <Brain size={22} className="text-cyan-400" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[var(--foreground)]">Strategy Analysis</h1>
                    <p className="text-xs text-[var(--foreground-muted)]">Deep strategy-based analysis & insights</p>
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
                            className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
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
                    <button disabled={loading || !selectedSymbol}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap">
                        {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</> : <><Brain size={18} /> Analyze</>}
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {!loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                        <Brain size={40} className="text-cyan-400/60" />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Ready to Analyze</h2>
                    <p className="text-[var(--foreground-muted)] text-sm max-w-md">
                        Select a stock and click &quot;Analyze&quot; to run deep strategy-based analysis with custom trading strategies and actionable insights.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 mt-6 text-xs text-[var(--foreground-muted)]">
                        {['Custom Strategies', 'Pattern Analysis', 'Risk Assessment', 'Entry/Exit Points'].map(tag => (
                            <span key={tag} className="px-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] rounded-full">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
