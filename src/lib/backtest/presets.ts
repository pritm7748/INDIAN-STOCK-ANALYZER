// src/lib/backtest/presets.ts
// 8 pre-built strategy templates for the backtesting engine

import { Strategy } from './types'

function rid(): string {
    return Math.random().toString(36).substring(2, 10)
}

// ============================================================
// PRESET STRATEGIES
// ============================================================

export const PRESET_STRATEGIES: Strategy[] = [
    // 1. RSI Mean Reversion
    {
        id: 'preset-rsi-mean-reversion',
        name: 'RSI Mean Reversion',
        description: 'Buy when RSI drops below 30 (oversold), sell when RSI rises above 70 (overbought). Classic mean-reversion strategy.',
        entryRules: [
            {
                id: rid(),
                indicator: 'rsi',
                operator: 'crosses_below',
                value: 30,
                params: { period: 14 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'rsi',
                operator: 'crosses_above',
                value: 70,
                params: { period: 14 }
            }
        ],
        riskManagement: {
            stopLossType: 'fixed_pct',
            stopLossValue: 5,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    },

    // 2. Golden Cross / Death Cross
    {
        id: 'preset-golden-cross',
        name: 'Golden Cross',
        description: 'Buy when SMA(50) crosses above SMA(200), sell on the inverse. Classic trend-following strategy used by institutions.',
        entryRules: [
            {
                id: rid(),
                indicator: 'sma',
                operator: 'crosses_above',
                value: 0,
                params: { period: 50 },
                compareTo: 'sma',
                compareParams: { period: 200 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'sma',
                operator: 'crosses_below',
                value: 0,
                params: { period: 50 },
                compareTo: 'sma',
                compareParams: { period: 200 }
            }
        ],
        riskManagement: {
            stopLossType: 'trailing',
            stopLossValue: 8,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 60,
        tradeDirection: 'LONG'
    },

    // 3. Bollinger Bounce
    {
        id: 'preset-bollinger-bounce',
        name: 'Bollinger Bounce',
        description: 'Buy when price touches the lower Bollinger Band with RSI confirmation (< 35). Sell when price reaches the upper band.',
        entryRules: [
            {
                id: rid(),
                indicator: 'price',
                operator: 'below',
                value: 0,
                compareTo: 'bollinger_lower',
                compareParams: { period: 20, stdDev: 2 }
            },
            {
                id: rid(),
                indicator: 'rsi',
                operator: 'below',
                value: 35,
                params: { period: 14 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'price',
                operator: 'above',
                value: 0,
                compareTo: 'bollinger_upper',
                compareParams: { period: 20, stdDev: 2 }
            }
        ],
        riskManagement: {
            stopLossType: 'atr_based',
            stopLossValue: 2,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    },

    // 4. MACD Momentum
    {
        id: 'preset-macd-momentum',
        name: 'MACD Momentum',
        description: 'Buy when MACD line crosses above signal line, sell on bearish crossover. Captures momentum shifts.',
        entryRules: [
            {
                id: rid(),
                indicator: 'macd',
                operator: 'crosses_above',
                value: 0,
                params: { fast: 12, slow: 26, signal: 9 },
                compareTo: 'macd_signal',
                compareParams: { fast: 12, slow: 26, signal: 9 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'macd',
                operator: 'crosses_below',
                value: 0,
                params: { fast: 12, slow: 26, signal: 9 },
                compareTo: 'macd_signal',
                compareParams: { fast: 12, slow: 26, signal: 9 }
            }
        ],
        riskManagement: {
            stopLossType: 'fixed_pct',
            stopLossValue: 4,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    },

    // 5. Supertrend Follower
    {
        id: 'preset-supertrend',
        name: 'Supertrend Follower',
        description: 'Follow the Supertrend indicator — enter when it flips bullish, exit when it flips bearish. The indicator acts as a built-in stop-loss.',
        entryRules: [
            {
                id: rid(),
                indicator: 'supertrend',
                operator: 'equals',
                value: 1,
                params: { period: 10, multiplier: 3 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'supertrend',
                operator: 'equals',
                value: -1,
                params: { period: 10, multiplier: 3 }
            }
        ],
        riskManagement: {
            stopLossType: 'none',
            stopLossValue: 0,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    },

    // 6. Ichimoku Cloud
    {
        id: 'preset-ichimoku',
        name: 'Ichimoku Cloud',
        description: 'Buy when price is above the Ichimoku Cloud with a bullish TK cross (Tenkan above Kijun). Exit when price drops below cloud.',
        entryRules: [
            {
                id: rid(),
                indicator: 'ichimoku_cloud',
                operator: 'equals',
                value: 1
            },
            {
                id: rid(),
                indicator: 'ichimoku_tenkan',
                operator: 'above',
                value: 0,
                compareTo: 'ichimoku_kijun'
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'ichimoku_cloud',
                operator: 'equals',
                value: -1
            }
        ],
        riskManagement: {
            stopLossType: 'trailing',
            stopLossValue: 10,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    },

    // 7. Multi-Indicator Confluence
    {
        id: 'preset-multi-indicator',
        name: 'Multi-Indicator Confluence',
        description: 'Requires 3 indicators to agree: RSI oversold, EMA crossover bullish, and ADX showing trend strength. High-probability setups.',
        entryRules: [
            {
                id: rid(),
                indicator: 'rsi',
                operator: 'below',
                value: 40,
                params: { period: 14 }
            },
            {
                id: rid(),
                indicator: 'ema',
                operator: 'above',
                value: 0,
                params: { period: 9 },
                compareTo: 'ema',
                compareParams: { period: 21 }
            },
            {
                id: rid(),
                indicator: 'adx',
                operator: 'above',
                value: 25,
                params: { period: 14 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'rsi',
                operator: 'above',
                value: 65,
                params: { period: 14 }
            }
        ],
        riskManagement: {
            stopLossType: 'atr_based',
            stopLossValue: 1.5,
            takeProfitType: 'r_multiple',
            takeProfitValue: 2
        },
        positionSizing: 'fixed_pct',
        positionValue: 40,
        tradeDirection: 'LONG'
    },

    // 8. Volume Breakout
    {
        id: 'preset-volume-breakout',
        name: 'Volume Breakout',
        description: 'Buy when price breaks above SMA(20) on high volume (2x average) with ADX confirming trend. Captures breakout moves.',
        entryRules: [
            {
                id: rid(),
                indicator: 'price',
                operator: 'above',
                value: 0,
                compareTo: 'sma',
                compareParams: { period: 20 }
            },
            {
                id: rid(),
                indicator: 'volume',
                operator: 'above',
                value: 0,
                compareTo: 'volume_sma',
                compareParams: { period: 20 }
            },
            {
                id: rid(),
                indicator: 'adx',
                operator: 'above',
                value: 20,
                params: { period: 14 }
            }
        ],
        exitRules: [
            {
                id: rid(),
                indicator: 'price',
                operator: 'below',
                value: 0,
                compareTo: 'sma',
                compareParams: { period: 20 }
            }
        ],
        riskManagement: {
            stopLossType: 'fixed_pct',
            stopLossValue: 6,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    }
]

// Get a deep copy of a preset strategy
export function getPresetStrategy(id: string): Strategy | undefined {
    const preset = PRESET_STRATEGIES.find(s => s.id === id)
    if (!preset) return undefined
    return JSON.parse(JSON.stringify(preset))
}

// Create a blank custom strategy
export function createBlankStrategy(): Strategy {
    return {
        id: 'custom-' + rid(),
        name: 'Custom Strategy',
        description: 'Build your own strategy with custom entry and exit rules.',
        entryRules: [],
        exitRules: [],
        riskManagement: {
            stopLossType: 'fixed_pct',
            stopLossValue: 5,
            takeProfitType: 'none',
            takeProfitValue: 0
        },
        positionSizing: 'fixed_pct',
        positionValue: 50,
        tradeDirection: 'LONG'
    }
}
