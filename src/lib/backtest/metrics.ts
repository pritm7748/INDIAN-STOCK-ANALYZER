// src/lib/backtest/metrics.ts
// Comprehensive performance analytics + Monte Carlo simulation

import { Trade, EquityPoint, BacktestConfig, PerformanceMetrics, MonteCarloResult } from './types'

// ============================================================
// CALCULATE ALL PERFORMANCE METRICS
// ============================================================

export function calculateMetrics(
    trades: Trade[],
    equityCurve: EquityPoint[],
    config: BacktestConfig
): PerformanceMetrics {
    if (trades.length === 0) return getEmptyMetrics()

    const wins = trades.filter(t => t.pnl > 0)
    const losses = trades.filter(t => t.pnl <= 0)

    // ----- Returns -----
    const finalEquity = equityCurve.length > 0
        ? equityCurve[equityCurve.length - 1].equity
        : config.initialCapital
    const totalReturnPct = ((finalEquity - config.initialCapital) / config.initialCapital) * 100
    const tradePcts = trades.map(t => t.pnlPct)

    // CAGR
    const startDate = new Date(equityCurve[0]?.date || Date.now())
    const endDate = new Date(equityCurve[equityCurve.length - 1]?.date || Date.now())
    const years = Math.max(0.1, (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 3600 * 1000))
    const cagr = (Math.pow(finalEquity / config.initialCapital, 1 / years) - 1) * 100

    // ----- Risk -----
    const maxDrawdownPct = equityCurve.length > 0
        ? Math.max(...equityCurve.map(e => e.drawdownPct))
        : 0

    // Max Drawdown Duration
    let maxDDDuration = 0
    let currentDDStart = -1
    for (let i = 0; i < equityCurve.length; i++) {
        if (equityCurve[i].drawdownPct > 0.1) {
            if (currentDDStart === -1) currentDDStart = i
        } else {
            if (currentDDStart !== -1) {
                maxDDDuration = Math.max(maxDDDuration, i - currentDDStart)
                currentDDStart = -1
            }
        }
    }
    if (currentDDStart !== -1) {
        maxDDDuration = Math.max(maxDDDuration, equityCurve.length - currentDDStart)
    }

    // VaR & CVaR (95%)
    const sortedReturns = [...tradePcts].sort((a, b) => a - b)
    const var95Index = Math.floor(sortedReturns.length * 0.05)
    const var95 = sortedReturns.length > 0 ? sortedReturns[var95Index] || 0 : 0
    const cvar = sortedReturns.length > 0
        ? sortedReturns.slice(0, var95Index + 1).reduce((a, b) => a + b, 0) / (var95Index + 1)
        : 0

    // ----- Risk-Adjusted Returns -----
    const avgReturn = tradePcts.reduce((a, b) => a + b, 0) / tradePcts.length
    const riskFreeRate = 6.5 / 252 // India 10Y bond rate, daily
    const avgExcessReturn = avgReturn - riskFreeRate

    // Sharpe Ratio
    const stdDev = calculateStdDev(tradePcts)
    const sharpeRatio = stdDev > 0
        ? (avgExcessReturn / stdDev) * Math.sqrt(252 / Math.max(1, avgHoldingDays(trades)))
        : 0

    // Sortino Ratio (only downside deviation)
    const downsideReturns = tradePcts.filter(r => r < 0)
    const downsideDev = downsideReturns.length > 0 ? calculateStdDev(downsideReturns) : 0.01
    const sortinoRatio = downsideDev > 0
        ? (avgExcessReturn / downsideDev) * Math.sqrt(252 / Math.max(1, avgHoldingDays(trades)))
        : 0

    // Calmar Ratio
    const calmarRatio = maxDrawdownPct > 0 ? cagr / maxDrawdownPct : 0

    // ----- Trade Stats -----
    const winRate = (wins.length / trades.length) * 100
    const grossProfit = wins.reduce((a, t) => a + t.pnl, 0)
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
    const expectancy = trades.reduce((a, t) => a + t.pnl, 0) / trades.length
    const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + Math.abs(t.pnl), 0) / losses.length : 0
    const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0

    // ----- Streaks -----
    let maxConsecWins = 0, maxConsecLosses = 0
    let currentWins = 0, currentLosses = 0
    for (const trade of trades) {
        if (trade.pnl > 0) {
            currentWins++
            currentLosses = 0
            maxConsecWins = Math.max(maxConsecWins, currentWins)
        } else {
            currentLosses++
            currentWins = 0
            maxConsecLosses = Math.max(maxConsecLosses, currentLosses)
        }
    }

    // ----- Time -----
    const avgHold = avgHoldingDays(trades)
    const totalDaysInMarket = trades.reduce((a, t) => a + t.holdingDays, 0)
    const totalCalendarDays = equityCurve.length
    const timeInMarketPct = totalCalendarDays > 0 ? (totalDaysInMarket / totalCalendarDays) * 100 : 0

    // Best/Worst Month (from trade P&L by month)
    const monthlyPnl = new Map<string, number>()
    for (const trade of trades) {
        const d = new Date(trade.exitDate)
        const key = `${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`
        monthlyPnl.set(key, (monthlyPnl.get(key) || 0) + trade.pnlPct)
    }
    let bestMonth = { label: '-', returnPct: 0 }
    let worstMonth = { label: '-', returnPct: 0 }
    for (const [label, ret] of monthlyPnl) {
        if (ret > bestMonth.returnPct) bestMonth = { label, returnPct: Math.round(ret * 100) / 100 }
        if (ret < worstMonth.returnPct) worstMonth = { label, returnPct: Math.round(ret * 100) / 100 }
    }

    // Recovery Factor
    const totalProfit = finalEquity - config.initialCapital
    const recoveryFactor = maxDrawdownPct > 0
        ? totalReturnPct / maxDrawdownPct
        : 0

    return {
        totalReturnPct: round2(totalReturnPct),
        cagr: round2(cagr),
        avgTradePct: round2(avgReturn),
        bestTradePct: round2(Math.max(...tradePcts)),
        worstTradePct: round2(Math.min(...tradePcts)),
        maxDrawdownPct: round2(maxDrawdownPct),
        maxDrawdownDuration: maxDDDuration,
        var95: round2(var95),
        cvar: round2(cvar),
        sharpeRatio: round2(sharpeRatio),
        sortinoRatio: round2(sortinoRatio),
        calmarRatio: round2(calmarRatio),
        totalTrades: trades.length,
        winRate: round2(winRate),
        profitFactor: round2(profitFactor),
        expectancy: round2(expectancy),
        avgWinLossRatio: round2(avgWinLossRatio),
        avgWin: round2(avgWin),
        avgLoss: round2(avgLoss),
        maxConsecutiveWins: maxConsecWins,
        maxConsecutiveLosses: maxConsecLosses,
        avgHoldingDays: round2(avgHold),
        timeInMarketPct: round2(timeInMarketPct),
        bestMonth,
        worstMonth,
        recoveryFactor: round2(recoveryFactor),
        riskOfRuin: 0 // populated by Monte Carlo
    }
}

// ============================================================
// MONTE CARLO SIMULATION
// ============================================================

export function runMonteCarlo(
    trades: Trade[],
    initialCapital: number,
    simulations: number = 1000
): MonteCarloResult {
    if (trades.length < 5) {
        return {
            simulations: 0,
            drawdownDistribution: [],
            medianDrawdown: 0,
            percentile95Drawdown: 0,
            worstCaseDrawdown: 0,
            riskOfRuin: 0,
            equityBands: { percentile5: [], percentile50: [], percentile95: [], dates: [] }
        }
    }

    const tradePnls = trades.map(t => t.pnl)
    const maxDrawdowns: number[] = []
    const allEquityCurves: number[][] = []

    // Run N simulations with shuffled trade order
    for (let sim = 0; sim < simulations; sim++) {
        const shuffled = shuffleArray([...tradePnls])
        let equity = initialCapital
        let peak = equity
        let maxDD = 0
        const curve: number[] = [equity]

        for (const pnl of shuffled) {
            equity += pnl
            peak = Math.max(peak, equity)
            const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
            maxDD = Math.max(maxDD, dd)
            curve.push(equity)
        }

        maxDrawdowns.push(maxDD)
        allEquityCurves.push(curve)
    }

    // Sort drawdowns
    maxDrawdowns.sort((a, b) => a - b)

    // Calculate percentiles
    const medianIdx = Math.floor(maxDrawdowns.length * 0.5)
    const p95Idx = Math.floor(maxDrawdowns.length * 0.95)

    // Risk of Ruin: probability of 50%+ drawdown
    const ruinCount = maxDrawdowns.filter(dd => dd >= 50).length
    const riskOfRuin = (ruinCount / simulations) * 100

    // Equity bands (5th, 50th, 95th percentile at each trade step)
    const numSteps = trades.length + 1
    const percentile5: number[] = []
    const percentile50: number[] = []
    const percentile95: number[] = []

    for (let step = 0; step < numSteps; step++) {
        const vals = allEquityCurves
            .map(curve => curve[Math.min(step, curve.length - 1)])
            .sort((a, b) => a - b)

        percentile5.push(vals[Math.floor(vals.length * 0.05)] || 0)
        percentile50.push(vals[Math.floor(vals.length * 0.5)] || 0)
        percentile95.push(vals[Math.floor(vals.length * 0.95)] || 0)
    }

    // Generate date labels (trade indexes)
    const dates = Array.from({ length: numSteps }, (_, i) =>
        i === 0 ? 'Start' : `Trade ${i}`
    )

    return {
        simulations,
        drawdownDistribution: maxDrawdowns,
        medianDrawdown: round2(maxDrawdowns[medianIdx] || 0),
        percentile95Drawdown: round2(maxDrawdowns[p95Idx] || 0),
        worstCaseDrawdown: round2(maxDrawdowns[maxDrawdowns.length - 1] || 0),
        riskOfRuin: round2(riskOfRuin),
        equityBands: { percentile5, percentile50, percentile95, dates }
    }
}

// ============================================================
// HELPERS
// ============================================================

function calculateStdDev(values: number[]): number {
    if (values.length <= 1) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1)
    return Math.sqrt(variance)
}

function avgHoldingDays(trades: Trade[]): number {
    if (trades.length === 0) return 0
    return trades.reduce((a, t) => a + t.holdingDays, 0) / trades.length
}

function shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

function round2(value: number): number {
    return Math.round(value * 100) / 100
}

function getEmptyMetrics(): PerformanceMetrics {
    return {
        totalReturnPct: 0, cagr: 0, avgTradePct: 0, bestTradePct: 0, worstTradePct: 0,
        maxDrawdownPct: 0, maxDrawdownDuration: 0, var95: 0, cvar: 0,
        sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0,
        totalTrades: 0, winRate: 0, profitFactor: 0, expectancy: 0,
        avgWinLossRatio: 0, avgWin: 0, avgLoss: 0,
        maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
        avgHoldingDays: 0, timeInMarketPct: 0,
        bestMonth: { label: '-', returnPct: 0 }, worstMonth: { label: '-', returnPct: 0 },
        recoveryFactor: 0, riskOfRuin: 0
    }
}
