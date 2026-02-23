// src/app/api/backtest/route.ts
// Agentic backtest — auto-runs ALL strategies on a stock and produces verdict

import { NextRequest, NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { runAllStrategies } from '@/lib/backtest/engine'
import { PRESET_STRATEGIES } from '@/lib/backtest/presets'
import { BarData } from '@/lib/backtest/types'

const yf = new (yahooFinance as any)()

export async function POST(request: NextRequest) {
    try {
        const { symbol, stockName } = await request.json()

        if (!symbol) {
            return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
        }

        // Fetch 4 years of data (1 year warmup + 3 years backtest)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setFullYear(endDate.getFullYear() - 4)
        const period1 = startDate.toISOString().split('T')[0]

        const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any

        if (!chartResult?.quotes || chartResult.quotes.length < 200) {
            return NextResponse.json(
                { error: `Insufficient data for ${symbol}. Need at least 200 trading days.` },
                { status: 400 }
            )
        }

        const bars: BarData[] = chartResult.quotes
            .filter((q: any) => q.close !== null && q.open !== null && q.high !== null && q.low !== null && q.volume !== null)
            .map((q: any) => ({
                date: new Date(q.date).toISOString().split('T')[0],
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume
            }))

        // Fetch Nifty 50 benchmark
        let benchmarkBars: BarData[] = []
        try {
            const niftyResult = await yf.chart('^NSEI', { period1, interval: '1d' } as any) as any
            if (niftyResult?.quotes) {
                benchmarkBars = niftyResult.quotes
                    .filter((q: any) => q.close !== null && q.date !== null)
                    .map((q: any) => ({
                        date: new Date(q.date).toISOString().split('T')[0],
                        open: q.open || q.close,
                        high: q.high || q.close,
                        low: q.low || q.close,
                        close: q.close,
                        volume: q.volume || 0
                    }))
            }
        } catch { /* benchmark optional */ }

        // Run all 8 strategies and produce verdict
        const result = runAllStrategies(bars, PRESET_STRATEGIES, symbol, stockName || symbol, benchmarkBars)

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Backtest API Error:', error)
        return NextResponse.json({ error: error.message || 'Backtest failed' }, { status: 500 })
    }
}
