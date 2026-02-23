// src/lib/backtest/types.ts
// Type definitions for the ultimate backtesting engine

// ============================================================
// INDICATOR & OPERATOR TYPES
// ============================================================

export type IndicatorType =
    | 'rsi'
    | 'macd'
    | 'macd_signal'
    | 'macd_histogram'
    | 'bollinger_upper'
    | 'bollinger_lower'
    | 'bollinger_middle'
    | 'sma'
    | 'ema'
    | 'supertrend'
    | 'adx'
    | 'stoch_rsi_k'
    | 'stoch_rsi_d'
    | 'atr'
    | 'obv_trend'
    | 'vwap'
    | 'ichimoku_tenkan'
    | 'ichimoku_kijun'
    | 'ichimoku_cloud'
    | 'price'
    | 'volume'
    | 'volume_sma'

export type OperatorType =
    | 'above'
    | 'below'
    | 'crosses_above'
    | 'crosses_below'
    | 'equals'
    | 'between'

export type StopLossType = 'none' | 'fixed_pct' | 'trailing' | 'atr_based'
export type TakeProfitType = 'none' | 'fixed_pct' | 'r_multiple'
export type PositionSizingMode = 'fixed_amount' | 'fixed_pct' | 'kelly'
export type TradeSide = 'LONG' | 'SHORT'

// ============================================================
// STRATEGY DEFINITION
// ============================================================

export interface StrategyRule {
    id: string
    indicator: IndicatorType
    operator: OperatorType
    value: number
    /** For crossover comparisons, e.g., SMA(50) crosses_above SMA(200) */
    compareTo?: IndicatorType
    compareParams?: Record<string, number>
    /** Indicator parameters (period, etc.) */
    params?: Record<string, number>
}

export interface RiskManagement {
    stopLossType: StopLossType
    stopLossValue: number
    takeProfitType: TakeProfitType
    takeProfitValue: number
}

export interface Strategy {
    id: string
    name: string
    description: string
    entryRules: StrategyRule[]
    exitRules: StrategyRule[]
    riskManagement: RiskManagement
    positionSizing: PositionSizingMode
    positionValue: number // ₹ for fixed_amount, % for fixed_pct
    tradeDirection: TradeSide
}

// ============================================================
// BACKTEST CONFIGURATION
// ============================================================

export type DateRangePreset = '1Y' | '2Y' | '3Y' | '5Y' | 'custom'

export interface BacktestConfig {
    symbol: string
    stockName?: string
    dateRange: DateRangePreset
    customStartDate?: string
    customEndDate?: string
    initialCapital: number
    commissionPct: number   // default 0.03%
    slippagePct: number     // default 0.05%
}

// ============================================================
// OHLCV BAR DATA
// ============================================================

export interface BarData {
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
}

// ============================================================
// TRADE
// ============================================================

export interface Trade {
    id: number
    entryDate: string
    exitDate: string
    entryPrice: number
    exitPrice: number
    quantity: number
    side: TradeSide
    pnl: number
    pnlPct: number
    holdingDays: number
    entryReasons: string[]
    exitReason: string
    /** Maximum price move in favor during trade */
    maxFavorableExcursion: number
    /** Maximum price move against during trade */
    maxAdverseExcursion: number
    commission: number
}

// ============================================================
// EQUITY CURVE POINT
// ============================================================

export interface EquityPoint {
    date: string
    equity: number
    drawdown: number
    drawdownPct: number
}

// ============================================================
// MONTHLY RETURN
// ============================================================

export interface MonthlyReturn {
    year: number
    month: number
    monthLabel: string
    returnPct: number
    trades: number
}

// ============================================================
// PERFORMANCE METRICS
// ============================================================

export interface PerformanceMetrics {
    // Returns
    totalReturnPct: number
    cagr: number
    avgTradePct: number
    bestTradePct: number
    worstTradePct: number

    // Risk
    maxDrawdownPct: number
    maxDrawdownDuration: number // days
    var95: number              // Value at Risk 95%
    cvar: number               // Conditional VaR

    // Risk-adjusted
    sharpeRatio: number
    sortinoRatio: number
    calmarRatio: number

    // Trade stats
    totalTrades: number
    winRate: number
    profitFactor: number
    expectancy: number        // avg ₹ per trade
    avgWinLossRatio: number
    avgWin: number
    avgLoss: number

    // Streaks
    maxConsecutiveWins: number
    maxConsecutiveLosses: number

    // Time
    avgHoldingDays: number
    timeInMarketPct: number
    bestMonth: { label: string; returnPct: number }
    worstMonth: { label: string; returnPct: number }

    // Advanced
    recoveryFactor: number
    riskOfRuin: number         // from Monte Carlo
}

// ============================================================
// MONTE CARLO RESULT
// ============================================================

export interface MonteCarloResult {
    simulations: number
    drawdownDistribution: number[]
    medianDrawdown: number
    percentile95Drawdown: number
    worstCaseDrawdown: number
    riskOfRuin: number
    equityBands: {
        percentile5: number[]
        percentile50: number[]
        percentile95: number[]
        dates: string[]
    }
}

// ============================================================
// COMPLETE BACKTEST REPORT
// ============================================================

export interface BacktestReport {
    trades: Trade[]
    equityCurve: EquityPoint[]
    metrics: PerformanceMetrics
    monthlyReturns: MonthlyReturn[]
    monteCarlo: MonteCarloResult
    config: BacktestConfig
    strategy: Strategy
    benchmarkEquity?: EquityPoint[] // Nifty 50 benchmark
    dataRange: {
        startDate: string
        endDate: string
        totalBars: number
    }
}
