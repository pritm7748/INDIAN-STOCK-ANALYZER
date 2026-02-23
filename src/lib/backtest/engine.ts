// src/lib/backtest/engine.ts
// Walk-forward backtesting engine — bar-by-bar simulation
// Processes data chronologically to prevent look-ahead bias

import {
    BarData, Strategy, BacktestConfig, Trade, EquityPoint,
    BacktestReport, MonthlyReturn, TradeSide
} from './types'
import { evaluateAllRules, computeIndicator } from './indicators'
import { calculateMetrics, runMonteCarlo } from './metrics'
import { analyzeSignals, SignalSummary } from './signals'

// ============================================================
// MAIN BACKTEST FUNCTION
// ============================================================

export function runBacktest(
    bars: BarData[],
    strategy: Strategy,
    config: BacktestConfig,
    benchmarkBars?: BarData[]
): BacktestReport {
    const trades: Trade[] = []
    const equityCurve: EquityPoint[] = []
    let equity = config.initialCapital
    let peakEquity = equity
    let tradeId = 0

    // Current position state
    let inPosition = false
    let entryPrice = 0
    let entryDate = ''
    let entryReasons: string[] = []
    let quantity = 0
    let side: TradeSide = 'LONG'
    let stopLossPrice = 0
    let takeProfitPrice = 0
    let trailingStopPrice = 0
    let maxPriceSincEntry = 0
    let minPriceSinceEntry = Infinity

    // Need minimum 100 bars for indicator warmup
    const startIndex = Math.max(100, Math.floor(bars.length * 0.05))

    for (let i = startIndex; i < bars.length; i++) {
        const bar = bars[i]
        const prevBar = bars[i - 1]

        // ----- CHECK EXIT CONDITIONS (before entry) -----
        if (inPosition) {
            let exitTriggered = false
            let exitReason = ''
            let exitPrice = bar.open // Execute at open of next bar

            // Track MFE/MAE
            if (side === 'LONG') {
                maxPriceSincEntry = Math.max(maxPriceSincEntry, bar.high)
                minPriceSinceEntry = Math.min(minPriceSinceEntry, bar.low)
            } else {
                maxPriceSincEntry = Math.min(maxPriceSincEntry, bar.low)
                minPriceSinceEntry = Math.max(minPriceSinceEntry, bar.high)
            }

            // Check stop-loss
            if (strategy.riskManagement.stopLossType !== 'none') {
                if (strategy.riskManagement.stopLossType === 'trailing') {
                    // Update trailing stop
                    if (side === 'LONG') {
                        const newTrailingStop = bar.high * (1 - strategy.riskManagement.stopLossValue / 100)
                        trailingStopPrice = Math.max(trailingStopPrice, newTrailingStop)
                        if (bar.low <= trailingStopPrice) {
                            exitTriggered = true
                            exitPrice = trailingStopPrice
                            exitReason = `Trailing SL hit (${strategy.riskManagement.stopLossValue}%)`
                        }
                    }
                } else if (strategy.riskManagement.stopLossType === 'fixed_pct' || strategy.riskManagement.stopLossType === 'atr_based') {
                    if (side === 'LONG' && bar.low <= stopLossPrice) {
                        exitTriggered = true
                        exitPrice = stopLossPrice
                        exitReason = `Stop-loss hit (₹${stopLossPrice.toFixed(2)})`
                    }
                }
            }

            // Check take-profit
            if (!exitTriggered && strategy.riskManagement.takeProfitType !== 'none') {
                if (side === 'LONG' && bar.high >= takeProfitPrice) {
                    exitTriggered = true
                    exitPrice = takeProfitPrice
                    exitReason = `Take-profit hit (₹${takeProfitPrice.toFixed(2)})`
                }
            }

            // Check strategy exit rules
            if (!exitTriggered && strategy.exitRules.length > 0) {
                const exitResult = evaluateAllRules(strategy.exitRules, bars, i)
                if (exitResult.triggered) {
                    exitTriggered = true
                    exitPrice = bar.open
                    exitReason = exitResult.reasons.join(' + ')
                }
            }

            // Execute exit
            if (exitTriggered) {
                const commission = calculateCommission(exitPrice, quantity, config.commissionPct)
                const slippage = exitPrice * (config.slippagePct / 100)
                const adjustedExitPrice = side === 'LONG'
                    ? exitPrice - slippage
                    : exitPrice + slippage

                const pnl = side === 'LONG'
                    ? (adjustedExitPrice - entryPrice) * quantity - commission
                    : (entryPrice - adjustedExitPrice) * quantity - commission

                const pnlPct = (pnl / (entryPrice * quantity)) * 100
                const holdingDays = daysBetween(entryDate, bar.date)

                trades.push({
                    id: ++tradeId,
                    entryDate,
                    exitDate: bar.date,
                    entryPrice,
                    exitPrice: adjustedExitPrice,
                    quantity,
                    side,
                    pnl,
                    pnlPct,
                    holdingDays,
                    entryReasons,
                    exitReason,
                    maxFavorableExcursion: side === 'LONG'
                        ? ((maxPriceSincEntry - entryPrice) / entryPrice) * 100
                        : ((entryPrice - maxPriceSincEntry) / entryPrice) * 100,
                    maxAdverseExcursion: side === 'LONG'
                        ? ((entryPrice - minPriceSinceEntry) / entryPrice) * 100
                        : ((minPriceSinceEntry - entryPrice) / entryPrice) * 100,
                    commission
                })

                equity += pnl
                inPosition = false
            }
        }

        // ----- CHECK ENTRY CONDITIONS -----
        if (!inPosition) {
            const entryResult = evaluateAllRules(strategy.entryRules, bars, i)

            if (entryResult.triggered) {
                const nextBarOpen = (i + 1 < bars.length) ? bars[i + 1].open : bar.close
                const slippage = nextBarOpen * (config.slippagePct / 100)
                entryPrice = nextBarOpen + slippage
                entryDate = (i + 1 < bars.length) ? bars[i + 1].date : bar.date
                side = strategy.tradeDirection
                entryReasons = entryResult.reasons

                // Position sizing
                quantity = calculatePositionSize(
                    equity,
                    entryPrice,
                    strategy.positionSizing,
                    strategy.positionValue,
                    config
                )

                if (quantity <= 0) continue

                const commission = calculateCommission(entryPrice, quantity, config.commissionPct)
                equity -= commission

                // Set stop-loss
                stopLossPrice = 0
                trailingStopPrice = 0
                if (strategy.riskManagement.stopLossType === 'fixed_pct') {
                    stopLossPrice = side === 'LONG'
                        ? entryPrice * (1 - strategy.riskManagement.stopLossValue / 100)
                        : entryPrice * (1 + strategy.riskManagement.stopLossValue / 100)
                } else if (strategy.riskManagement.stopLossType === 'atr_based') {
                    const atr = computeIndicator('atr', bars, i, { period: 14 })
                    if (atr) {
                        stopLossPrice = side === 'LONG'
                            ? entryPrice - (atr * strategy.riskManagement.stopLossValue)
                            : entryPrice + (atr * strategy.riskManagement.stopLossValue)
                    }
                } else if (strategy.riskManagement.stopLossType === 'trailing') {
                    trailingStopPrice = side === 'LONG'
                        ? entryPrice * (1 - strategy.riskManagement.stopLossValue / 100)
                        : entryPrice * (1 + strategy.riskManagement.stopLossValue / 100)
                }

                // Set take-profit
                takeProfitPrice = 0
                if (strategy.riskManagement.takeProfitType === 'fixed_pct') {
                    takeProfitPrice = side === 'LONG'
                        ? entryPrice * (1 + strategy.riskManagement.takeProfitValue / 100)
                        : entryPrice * (1 - strategy.riskManagement.takeProfitValue / 100)
                } else if (strategy.riskManagement.takeProfitType === 'r_multiple') {
                    const risk = Math.abs(entryPrice - stopLossPrice)
                    takeProfitPrice = side === 'LONG'
                        ? entryPrice + risk * strategy.riskManagement.takeProfitValue
                        : entryPrice - risk * strategy.riskManagement.takeProfitValue
                }

                maxPriceSincEntry = entryPrice
                minPriceSinceEntry = entryPrice
                inPosition = true

                // Skip to next bar (entry executes at next bar's open)
                if (i + 1 < bars.length) i++
            }
        }

        // ----- UPDATE EQUITY CURVE -----
        let currentEquity = equity
        if (inPosition) {
            const unrealizedPnl = side === 'LONG'
                ? (bar.close - entryPrice) * quantity
                : (entryPrice - bar.close) * quantity
            currentEquity += unrealizedPnl
        }

        peakEquity = Math.max(peakEquity, currentEquity)
        const drawdown = peakEquity - currentEquity
        const drawdownPct = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0

        equityCurve.push({
            date: bar.date,
            equity: currentEquity,
            drawdown,
            drawdownPct
        })
    }

    // Close any remaining position at last bar's close
    if (inPosition) {
        const lastBar = bars[bars.length - 1]
        const commission = calculateCommission(lastBar.close, quantity, config.commissionPct)
        const pnl = side === 'LONG'
            ? (lastBar.close - entryPrice) * quantity - commission
            : (entryPrice - lastBar.close) * quantity - commission
        const pnlPct = (pnl / (entryPrice * quantity)) * 100

        trades.push({
            id: ++tradeId,
            entryDate,
            exitDate: lastBar.date,
            entryPrice,
            exitPrice: lastBar.close,
            quantity,
            side,
            pnl,
            pnlPct,
            holdingDays: daysBetween(entryDate, lastBar.date),
            entryReasons,
            exitReason: 'End of backtest period',
            maxFavorableExcursion: side === 'LONG'
                ? ((maxPriceSincEntry - entryPrice) / entryPrice) * 100
                : ((entryPrice - maxPriceSincEntry) / entryPrice) * 100,
            maxAdverseExcursion: side === 'LONG'
                ? ((entryPrice - minPriceSinceEntry) / entryPrice) * 100
                : ((minPriceSinceEntry - entryPrice) / entryPrice) * 100,
            commission
        })
        equity += pnl
    }

    // Calculate monthly returns
    const monthlyReturns = calculateMonthlyReturns(trades)

    // Calculate performance metrics
    const metrics = calculateMetrics(trades, equityCurve, config)

    // Run Monte Carlo simulation
    const monteCarlo = runMonteCarlo(trades, config.initialCapital, 1000)

    // Build benchmark equity curve
    let benchmarkEquity: EquityPoint[] | undefined
    if (benchmarkBars && benchmarkBars.length > 0) {
        benchmarkEquity = buildBenchmarkEquity(benchmarkBars, config.initialCapital, startIndex)
    }

    return {
        trades,
        equityCurve,
        metrics,
        monthlyReturns,
        monteCarlo,
        config,
        strategy,
        benchmarkEquity,
        dataRange: {
            startDate: bars[startIndex]?.date || '',
            endDate: bars[bars.length - 1]?.date || '',
            totalBars: bars.length - startIndex
        }
    }
}

// ============================================================
// POSITION SIZING
// ============================================================

function calculatePositionSize(
    equity: number,
    price: number,
    mode: string,
    value: number,
    config: BacktestConfig
): number {
    let investmentAmount = 0

    switch (mode) {
        case 'fixed_amount':
            investmentAmount = Math.min(value, equity * 0.95) // Max 95% of equity
            break
        case 'fixed_pct':
            investmentAmount = equity * (value / 100)
            break
        case 'kelly':
            // Simplified Kelly: use 25% of equity (half-Kelly)
            investmentAmount = equity * 0.25
            break
        default:
            investmentAmount = equity * 0.5
    }

    return Math.max(1, Math.floor(investmentAmount / price))
}

// ============================================================
// COMMISSION MODEL (realistic Indian brokerage)
// ============================================================

function calculateCommission(price: number, quantity: number, commissionPct: number): number {
    const turnover = price * quantity
    const brokerage = Math.min(turnover * (commissionPct / 100), 20) // ₹20 cap per order (Zerodha)
    const stt = turnover * 0.001  // 0.1% STT on delivery
    const exchangeCharges = turnover * 0.0000345
    const gst = (brokerage + exchangeCharges) * 0.18
    const stampDuty = turnover * 0.00015

    return brokerage + stt + exchangeCharges + gst + stampDuty
}

// ============================================================
// MONTHLY RETURNS CALCULATOR
// ============================================================

function calculateMonthlyReturns(trades: Trade[]): MonthlyReturn[] {
    const monthMap = new Map<string, { pnl: number; count: number }>()

    for (const trade of trades) {
        const exitDate = new Date(trade.exitDate)
        const key = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`

        const existing = monthMap.get(key) || { pnl: 0, count: 0 }
        existing.pnl += trade.pnlPct
        existing.count++
        monthMap.set(key, existing)
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const results: MonthlyReturn[] = []

    for (const [key, data] of monthMap) {
        const [year, month] = key.split('-').map(Number)
        results.push({
            year,
            month,
            monthLabel: `${months[month - 1]} ${year}`,
            returnPct: Math.round(data.pnl * 100) / 100,
            trades: data.count
        })
    }

    return results.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
}

// ============================================================
// BENCHMARK EQUITY CURVE
// ============================================================

function buildBenchmarkEquity(
    benchmarkBars: BarData[],
    initialCapital: number,
    startIndex: number
): EquityPoint[] {
    const curve: EquityPoint[] = []
    if (benchmarkBars.length === 0) return curve

    const actualStart = Math.min(startIndex, benchmarkBars.length - 1)
    const startPrice = benchmarkBars[actualStart].close
    let peak = initialCapital

    for (let i = actualStart; i < benchmarkBars.length; i++) {
        const equity = initialCapital * (benchmarkBars[i].close / startPrice)
        peak = Math.max(peak, equity)
        const drawdown = peak - equity

        curve.push({
            date: benchmarkBars[i].date,
            equity,
            drawdown,
            drawdownPct: peak > 0 ? (drawdown / peak) * 100 : 0
        })
    }

    return curve
}

// ============================================================
// UTILITIES
// ============================================================

function daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    return Math.max(1, Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}

// ============================================================
// AGENTIC: RUN ALL STRATEGIES & PRODUCE VERDICT
// ============================================================

export interface StrategyResult {
    strategy: Strategy
    report: BacktestReport
    currentSignal: 'BUY' | 'SELL' | 'WAIT'
    signalReasons: string[]
    rank: number
    recentPerformance: number
    backtestTarget: {
        target: number     // upside for BUY, downside for SELL
        stopLoss: number   // downside for BUY, upside for SELL
        avgHoldingDays: number
        avgWinPct: number
        avgLossPct: number
        direction: 'BUY' | 'SELL' | 'WAIT'
    }
}

export interface AgenticVerdict {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    confidence: number
    compositeScore: number // -100 to +100
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
        confidence: number // 0-100
        reasoning: string[]
    }
    keyInsights: string[]
    aggregateMetrics: {
        avgReturn: number
        avgSharpe: number
        avgWinRate: number
        avgMaxDD: number
        agreementPct: number
        profitableStrategies: number
    }
    signalBreakdown: { buy: number; sell: number; wait: number }
    bestCategory: string
}

export interface AgenticResult {
    verdict: AgenticVerdict
    strategies: StrategyResult[]
    signals: SignalSummary
    symbol: string
    stockName: string
}

export function runAllStrategies(
    bars: BarData[],
    strategies: Strategy[],
    symbol: string,
    stockName: string,
    benchmarkBars?: BarData[]
): AgenticResult {
    const defaultConfig: BacktestConfig = {
        symbol,
        dateRange: '3Y',
        initialCapital: 100000,
        commissionPct: 0.03,
        slippagePct: 0.05,
    }

    const currentPrice = bars[bars.length - 1]?.close || 0

    // Analyze candlestick patterns & support/resistance
    const signals = analyzeSignals(bars)

    // Run each strategy
    const results: StrategyResult[] = strategies.map(strategy => {
        const report = runBacktest(bars, strategy, defaultConfig, benchmarkBars)
        const { signal, reasons } = detectCurrentSignal(strategy, bars)

        // Calculate recent (6 month) performance
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        const recentTrades = report.trades.filter(t => new Date(t.exitDate) >= sixMonthsAgo)
        const recentReturn = recentTrades.reduce((sum, t) => sum + t.pnlPct, 0)

        return {
            strategy, report, currentSignal: signal, signalReasons: reasons, rank: 0,
            recentPerformance: Math.round(recentReturn * 100) / 100,
            backtestTarget: computeBacktestTarget(report, currentPrice, signal),
        }
    })

    // Rank by total return
    results.sort((a, b) => b.report.metrics.totalReturnPct - a.report.metrics.totalReturnPct)
    results.forEach((r, i) => r.rank = i + 1)

    // Signal counts (all strategies)
    const buySignals = results.filter(r => r.currentSignal === 'BUY').length
    const sellSignals = results.filter(r => r.currentSignal === 'SELL').length
    const waitSignals = results.filter(r => r.currentSignal === 'WAIT').length

    // Aggregate metrics
    const avgReturn = Math.round(results.reduce((s, r) => s + r.report.metrics.totalReturnPct, 0) / results.length * 100) / 100
    const avgSharpe = Math.round(results.reduce((s, r) => s + r.report.metrics.sharpeRatio, 0) / results.length * 100) / 100
    const avgWinRate = Math.round(results.reduce((s, r) => s + r.report.metrics.winRate, 0) / results.length * 100) / 100
    const avgMaxDD = Math.round(results.reduce((s, r) => s + r.report.metrics.maxDrawdownPct, 0) / results.length * 100) / 100
    const profitableStrategies = results.filter(r => r.report.metrics.totalReturnPct > 0).length
    const agreementPct = Math.round((Math.max(buySignals, sellSignals, waitSignals) / results.length) * 100)

    // Composite score (-100 to +100): weighted blend of signal direction, performance, and recent momentum
    const top5 = results.slice(0, 5)
    const signalScore = ((buySignals - sellSignals) / results.length) * 40
    const perfScore = Math.min(30, Math.max(-30, avgReturn / 2))
    const recentScore = Math.min(30, Math.max(-30, top5.reduce((s, r) => s + r.recentPerformance, 0) / 5))
    const candleScore = Math.min(15, Math.max(-15, signals.candlestickScore * 0.15))
    const signalLayerScore = Math.min(15, Math.max(-15, signals.overallScore * 0.15)) // all signal types
    const compositeScore = Math.round(Math.max(-100, Math.min(100, signalScore + perfScore + recentScore + candleScore + signalLayerScore)))

    // Direction & confidence
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
    let confidence = 50

    if (compositeScore >= 15) {
        direction = 'BULLISH'
        confidence = Math.min(95, 50 + Math.round(compositeScore * 0.45))
    } else if (compositeScore <= -15) {
        direction = 'BEARISH'
        confidence = Math.min(95, 50 + Math.round(Math.abs(compositeScore) * 0.45))
    } else {
        direction = 'NEUTRAL'
        confidence = Math.max(30, 50 - Math.abs(compositeScore))
    }

    // Price targets based on avg win/loss % of signaling strategies
    const signalingBuy = results.filter(r => r.currentSignal === 'BUY')
    const avgWinPct = signalingBuy.length > 0
        ? signalingBuy.reduce((s, r) => s + (r.report.metrics.bestTradePct + r.report.metrics.avgWin / currentPrice * 100) / 2, 0) / signalingBuy.length
        : top5.reduce((s, r) => s + r.report.metrics.avgWin / currentPrice * 100, 0) / top5.length
    const avgLossPct = top5.reduce((s, r) => s + Math.abs(r.report.metrics.avgLoss) / currentPrice * 100, 0) / top5.length

    // Use backtest-derived aggregate targets (weighted by rank)
    // Separate BUY targets from SELL targets
    const buyStrategies = results.filter(r => r.currentSignal === 'BUY')
    const sellStrategies = results.filter(r => r.currentSignal === 'SELL')
    let upside: number, downside: number

    if (direction === 'BULLISH' && buyStrategies.length > 0) {
        // Use BUY strategies' targets
        const totalWeight = buyStrategies.reduce((s, r) => s + (results.length - r.rank + 1), 0)
        upside = Math.round(buyStrategies.reduce((s, r) => s + r.backtestTarget.target * (results.length - r.rank + 1), 0) / totalWeight * 100) / 100
        downside = Math.round(buyStrategies.reduce((s, r) => s + r.backtestTarget.stopLoss * (results.length - r.rank + 1), 0) / totalWeight * 100) / 100
    } else if (direction === 'BEARISH' && sellStrategies.length > 0) {
        // Use SELL strategies' targets (target = downside, stopLoss = upside)
        const totalWeight = sellStrategies.reduce((s, r) => s + (results.length - r.rank + 1), 0)
        downside = Math.round(sellStrategies.reduce((s, r) => s + r.backtestTarget.target * (results.length - r.rank + 1), 0) / totalWeight * 100) / 100
        upside = Math.round(sellStrategies.reduce((s, r) => s + r.backtestTarget.stopLoss * (results.length - r.rank + 1), 0) / totalWeight * 100) / 100
    } else {
        upside = signals.priceTargets.target1
        downside = signals.priceTargets.stopLoss
    }

    // Key insights
    const keyInsights = generateInsights(results, avgReturn, profitableStrategies, currentPrice, bars, signals)

    // Best strategy category
    const categories = new Map<string, number[]>()
    results.forEach(r => {
        const name = r.strategy.name.toLowerCase()
        let cat = 'Other'
        if (name.includes('cross') || name.includes('supertrend') || name.includes('ichimoku')) cat = 'Trend-Following'
        else if (name.includes('rsi') || name.includes('bollinger') || name.includes('reversion')) cat = 'Mean-Reversion'
        else if (name.includes('macd') || name.includes('momentum') || name.includes('breakout')) cat = 'Momentum'
        else if (name.includes('multi') || name.includes('confluence')) cat = 'Multi-Factor'
        if (!categories.has(cat)) categories.set(cat, [])
        categories.get(cat)!.push(r.report.metrics.totalReturnPct)
    })
    let bestCategory = 'Mixed'
    let bestCatAvg = -Infinity
    for (const [cat, returns] of categories) {
        const avg = returns.reduce((a, b) => a + b, 0) / returns.length
        if (avg > bestCatAvg) { bestCategory = cat; bestCatAvg = avg }
    }

    // Summary
    const summaryParts: string[] = []
    if (buySignals > 0) summaryParts.push(`${buySignals}/${results.length} strategies signaling BUY`)
    if (sellSignals > 0) summaryParts.push(`${sellSignals}/${results.length} signaling SELL`)
    if (buySignals === 0 && sellSignals === 0) summaryParts.push('No active signals — consolidation likely')
    summaryParts.push(`${profitableStrategies}/${results.length} strategies profitable over test period`)

    return {
        verdict: {
            direction,
            confidence,
            compositeScore,
            summary: summaryParts.join(' · '),
            activeSignals: buySignals + sellSignals,
            totalStrategies: strategies.length,
            topStrategy: results[0].strategy.name,
            topReturn: results[0].report.metrics.totalReturnPct,
            priceTarget: { upside, downside, currentPrice },
            unifiedAction: computeUnifiedAction(direction, compositeScore, results, signals, currentPrice),
            keyInsights,
            aggregateMetrics: { avgReturn, avgSharpe, avgWinRate, avgMaxDD, agreementPct, profitableStrategies },
            signalBreakdown: { buy: buySignals, sell: sellSignals, wait: waitSignals },
            bestCategory
        },
        strategies: results,
        signals,
        symbol,
        stockName
    }
}

function computeUnifiedAction(
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    compositeScore: number,
    results: StrategyResult[],
    signals: SignalSummary,
    currentPrice: number
): { action: 'BUY' | 'SELL' | 'HOLD'; target: number; stopLoss: number; currentPrice: number; riskReward: number; confidence: number; reasoning: string[] } {
    const reasoning: string[] = []
    const supports = signals.supportResistance.filter(l => l.type === 'support' && l.price < currentPrice).sort((a, b) => b.price - a.price)
    const resistances = signals.supportResistance.filter(l => l.type === 'resistance' && l.price > currentPrice).sort((a, b) => a.price - b.price)
    const fibSupports = signals.fibLevels.filter(f => f.type === 'support' && f.price < currentPrice).sort((a, b) => b.price - a.price)
    const fibResistances = signals.fibLevels.filter(f => f.type === 'resistance' && f.price > currentPrice).sort((a, b) => a.price - b.price)

    // 1. Determine action from composite score
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
    if (direction === 'BULLISH' && compositeScore > 10) action = 'BUY'
    else if (direction === 'BEARISH' && compositeScore < -10) action = 'SELL'

    // 2. Collect target candidates (multiple sources, then take conservative median)
    const targetCandidates: number[] = []
    const slCandidates: number[] = []

    if (action === 'BUY') {
        // Strategy-based targets (from strategies signaling BUY)
        const buyStrats = results.filter(r => r.currentSignal === 'BUY')
        if (buyStrats.length > 0) {
            const wtTotal = buyStrats.reduce((s, r) => s + (results.length - r.rank + 1), 0)
            const stratTarget = buyStrats.reduce((s, r) => s + r.backtestTarget.target * (results.length - r.rank + 1), 0) / wtTotal
            targetCandidates.push(stratTarget)
            reasoning.push(`📊 ${buyStrats.length} strategies signal BUY → avg target ₹${stratTarget.toFixed(0)}`)

            const stratSL = buyStrats.reduce((s, r) => s + r.backtestTarget.stopLoss * (results.length - r.rank + 1), 0) / wtTotal
            slCandidates.push(stratSL)
        }

        // S/R resistance targets
        if (resistances.length > 0) {
            targetCandidates.push(resistances[0].price)
            reasoning.push(`📏 Nearest resistance: ₹${resistances[0].price.toFixed(0)} (${resistances[0].source})`)
        }

        // Fibonacci resistance
        if (fibResistances.length > 0) {
            targetCandidates.push(fibResistances[0].price)
            reasoning.push(`🔢 Fibonacci resistance: ₹${fibResistances[0].price.toFixed(0)} (${fibResistances[0].level})`)
        }

        // S/R support as stop
        if (supports.length > 0) slCandidates.push(supports[0].price)

        // Fibonacci support as stop
        if (fibSupports.length > 0) slCandidates.push(fibSupports[0].price)

    } else if (action === 'SELL') {
        // Strategy-based targets (from strategies signaling SELL)
        const sellStrats = results.filter(r => r.currentSignal === 'SELL')
        if (sellStrats.length > 0) {
            const wtTotal = sellStrats.reduce((s, r) => s + (results.length - r.rank + 1), 0)
            const stratTarget = sellStrats.reduce((s, r) => s + r.backtestTarget.target * (results.length - r.rank + 1), 0) / wtTotal
            targetCandidates.push(stratTarget)
            reasoning.push(`📊 ${sellStrats.length} strategies signal SELL → avg target ₹${stratTarget.toFixed(0)}`)

            const stratSL = sellStrats.reduce((s, r) => s + r.backtestTarget.stopLoss * (results.length - r.rank + 1), 0) / wtTotal
            slCandidates.push(stratSL)
        }

        // S/R support targets (SELL target = price dropping to support)
        if (supports.length > 0) {
            targetCandidates.push(supports[0].price)
            reasoning.push(`📏 Nearest support: ₹${supports[0].price.toFixed(0)} (${supports[0].source})`)
        }

        // Fibonacci support as target
        if (fibSupports.length > 0) {
            targetCandidates.push(fibSupports[0].price)
            reasoning.push(`🔢 Fibonacci support: ₹${fibSupports[0].price.toFixed(0)} (${fibSupports[0].level})`)
        }

        // S/R resistance as stop
        if (resistances.length > 0) slCandidates.push(resistances[0].price)

        // Fibonacci resistance as stop
        if (fibResistances.length > 0) slCandidates.push(fibResistances[0].price)
    }

    // 3. Add signal-layer reasoning
    const bullSignals = signals.signals.filter(s => s.direction === 'bullish')
    const bearSignals = signals.signals.filter(s => s.direction === 'bearish')
    if (bullSignals.length > 0 && action === 'BUY') {
        const top3 = bullSignals.sort((a, b) => b.strength - a.strength).slice(0, 3).map(s => s.name)
        reasoning.push(`🟢 ${bullSignals.length} bullish signals: ${top3.join(', ')}`)
    }
    if (bearSignals.length > 0 && action === 'SELL') {
        const top3 = bearSignals.sort((a, b) => b.strength - a.strength).slice(0, 3).map(s => s.name)
        reasoning.push(`🔴 ${bearSignals.length} bearish signals: ${top3.join(', ')}`)
    }

    // 4. FVG/OB zones as validation
    const unfilled = signals.fvgs.filter(f => !f.filled)
    if (unfilled.length > 0) {
        const relevant = action === 'BUY'
            ? unfilled.filter(f => f.type === 'bullish' && f.midPrice < currentPrice)
            : unfilled.filter(f => f.type === 'bearish' && f.midPrice > currentPrice)
        if (relevant.length > 0) {
            reasoning.push(`🏦 ${relevant.length} unfilled ${action === 'BUY' ? 'bullish' : 'bearish'} FVG(s) confirming direction`)
        }
    }

    // 5. Compute final target & SL (conservative: use median of candidates)
    let target: number, stopLoss: number

    if (targetCandidates.length > 0) {
        targetCandidates.sort((a, b) => action === 'BUY' ? a - b : b - a)
        target = targetCandidates[Math.floor(targetCandidates.length / 2)] // median
    } else {
        target = action === 'BUY' ? currentPrice * 1.05 : action === 'SELL' ? currentPrice * 0.95 : currentPrice
    }

    if (slCandidates.length > 0) {
        slCandidates.sort((a, b) => action === 'BUY' ? b - a : a - b)
        stopLoss = slCandidates[Math.floor(slCandidates.length / 2)] // median
    } else {
        stopLoss = action === 'BUY' ? currentPrice * 0.97 : action === 'SELL' ? currentPrice * 1.03 : currentPrice
    }

    // 6. Risk-reward
    const risk = Math.abs(currentPrice - stopLoss)
    const reward = Math.abs(target - currentPrice)
    const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0

    // 7. Confidence from composite + number of agreeing sources
    const agreeSources = reasoning.length
    const conf = Math.min(95, Math.max(20, Math.abs(compositeScore) * 0.6 + agreeSources * 8))

    // HOLD reasoning
    if (action === 'HOLD') {
        reasoning.length = 0
        reasoning.push('⚖️ Mixed signals — no clear directional bias')
        if (bullSignals.length > 0) reasoning.push(`${bullSignals.length} bullish vs ${bearSignals.length} bearish signals`)
        reasoning.push('Wait for clearer setup before entering')
        target = currentPrice
        stopLoss = currentPrice
    }

    return {
        action,
        target: Math.round(target * 100) / 100,
        stopLoss: Math.round(stopLoss * 100) / 100,
        currentPrice: Math.round(currentPrice * 100) / 100,
        riskReward,
        confidence: Math.round(conf),
        reasoning: reasoning.slice(0, 6)
    }
}

function generateInsights(results: StrategyResult[], avgReturn: number, profitable: number, currentPrice: number, bars: BarData[], signals: SignalSummary): string[] {
    const insights: string[] = []
    const top = results[0]
    const worst = results[results.length - 1]

    // Trend analysis
    if (profitable >= 6) insights.push('Strong historical edge — most strategies are profitable on this stock')
    else if (profitable <= 2) insights.push('⚠️ Weak backtest performance — only few strategies generated positive returns')

    // Best strategy insight
    insights.push(`${top.strategy.name} dominated with ${top.report.metrics.totalReturnPct > 0 ? '+' : ''}${top.report.metrics.totalReturnPct}% return and ${top.report.metrics.winRate}% win rate`)

    // Recent momentum
    const recentlyStrong = results.filter(r => r.recentPerformance > 5)
    const recentlyWeak = results.filter(r => r.recentPerformance < -5)
    if (recentlyStrong.length >= 3) insights.push(`Recent momentum is strong — ${recentlyStrong.length} strategies positive in last 6 months`)
    else if (recentlyWeak.length >= 3) insights.push(`⚠️ Recent momentum fading — ${recentlyWeak.length} strategies negative in last 6 months`)

    // Volatility context
    const last20 = bars.slice(-20)
    const returns = last20.map((b, i) => i > 0 ? (b.close - last20[i - 1].close) / last20[i - 1].close : 0).slice(1)
    const volatility = Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length) * Math.sqrt(252) * 100
    if (volatility > 40) insights.push(`High volatility (${volatility.toFixed(0)}% annualized) — wider stops recommended`)
    else if (volatility < 15) insights.push(`Low volatility (${volatility.toFixed(0)}% annualized) — tight range-bound action`)

    // Drawdown warning
    if (avgReturn > 0 && results[0].report.metrics.maxDrawdownPct > 25) {
        insights.push(`⚠️ Despite positive returns, max drawdown was ${results[0].report.metrics.maxDrawdownPct}% — significant risk`)
    }

    // Candlestick patterns
    const bullishPatterns = signals.candlestickPatterns.filter(p => p.direction === 'bullish')
    const bearishPatterns = signals.candlestickPatterns.filter(p => p.direction === 'bearish')
    if (bullishPatterns.length > 0) {
        const strongest = bullishPatterns.sort((a, b) => b.strength - a.strength)[0]
        insights.push(`Candlestick: ${strongest.name} detected — ${strongest.description}`)
    }
    if (bearishPatterns.length > 0) {
        const strongest = bearishPatterns.sort((a, b) => b.strength - a.strength)[0]
        insights.push(`Candlestick: ${strongest.name} detected — ${strongest.description}`)
    }

    // Support/Resistance context
    insights.push(`Price action: ${signals.priceVsLevels}`)

    return insights.slice(0, 5) // Max 5 insights
}

// Detect if a strategy is currently signaling based on the latest bars
function detectCurrentSignal(
    strategy: Strategy,
    bars: BarData[]
): { signal: 'BUY' | 'SELL' | 'WAIT'; reasons: string[] } {
    if (bars.length < 100) return { signal: 'WAIT', reasons: ['Insufficient data'] }

    const lastIdx = bars.length - 1

    // Check entry rules on the last bar
    const entryResult = evaluateAllRules(strategy.entryRules, bars, lastIdx)
    if (entryResult.triggered) {
        return { signal: 'BUY', reasons: entryResult.reasons }
    }

    // Check exit rules on the last bar
    const exitResult = evaluateAllRules(strategy.exitRules, bars, lastIdx)
    if (exitResult.triggered) {
        return { signal: 'SELL', reasons: exitResult.reasons }
    }

    // Check recent bars (last 3) for near-signals
    for (let i = lastIdx - 2; i <= lastIdx; i++) {
        if (i < 0) continue
        const entry = evaluateAllRules(strategy.entryRules, bars, i)
        if (entry.triggered) {
            return { signal: 'BUY', reasons: entry.reasons.map(r => `Recent: ${r}`) }
        }
    }

    return { signal: 'WAIT', reasons: ['No active signal'] }
}

// Compute per-strategy price targets from backtest results
// Direction-aware: SELL target = downside, BUY target = upside
function computeBacktestTarget(
    report: BacktestReport,
    currentPrice: number,
    signal: 'BUY' | 'SELL' | 'WAIT'
): { target: number; stopLoss: number; avgHoldingDays: number; avgWinPct: number; avgLossPct: number; direction: 'BUY' | 'SELL' | 'WAIT' } {
    const wins = report.trades.filter(t => t.pnl > 0)
    const losses = report.trades.filter(t => t.pnl < 0)

    const avgWinPct = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 3
    const avgLossPct = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 2
    const avgHoldingDays = report.trades.length > 0
        ? Math.round(report.trades.reduce((s, t) => s + t.holdingDays, 0) / report.trades.length)
        : 10

    let target: number, stopLoss: number
    if (signal === 'SELL') {
        // SELL: target is price going DOWN, stop loss is price going UP
        target = Math.round(currentPrice * (1 - avgWinPct / 100) * 100) / 100
        stopLoss = Math.round(currentPrice * (1 + avgLossPct / 100) * 100) / 100
    } else {
        // BUY or WAIT: target is price going UP, stop loss is price going DOWN
        target = Math.round(currentPrice * (1 + avgWinPct / 100) * 100) / 100
        stopLoss = Math.round(currentPrice * (1 - avgLossPct / 100) * 100) / 100
    }

    return { target, stopLoss, avgHoldingDays, avgWinPct: Math.round(avgWinPct * 100) / 100, avgLossPct: Math.round(avgLossPct * 100) / 100, direction: signal }
}
