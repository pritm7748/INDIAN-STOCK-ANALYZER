// src/app/api/strategy/orderflow/route.ts
// Streams Order Flow & Market Depth analysis across ~500 stocks via SSE
// Uses 5-min intraday data from Yahoo Finance with synthetic depth

import yahooFinance from 'yahoo-finance2'
import { runFullBacktest, runOrderFlowForDay, groupByDay, OF_CONFIG, analyzePerformance, patternEffectiveness, exitReasonBreakdown } from '@/lib/strategy/orderflow'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// F&O stocks — order flow is most reliable on liquid stocks
const FNO_SYMBOLS = new Set([
  'RELIANCE', 'SBIN', 'ICICIBANK', 'HDFCBANK', 'KOTAKBANK', 'AXISBANK',
  'TCS', 'INFY', 'WIPRO', 'HCLTECH',
  'TATAMOTORS', 'M&M', 'MARUTI',
  'TATASTEEL', 'HINDALCO', 'JSWSTEEL',
  'BAJFINANCE', 'BHARTIARTL', 'ADANIENT',
  'LT', 'SUNPHARMA', 'ITC', 'TATAPOWER', 'DLF',
  'BANKBARODA', 'PNB', 'INDUSINDBK', 'TECHM',
  'POWERGRID', 'NTPC', 'BAJAJFINSV', 'ONGC',
  'COALINDIA', 'VEDL', 'SAIL', 'TATACONSUM',
  'CIPLA', 'DRREDDY', 'APOLLOHOSP', 'SBILIFE',
])

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        const toIST = (d: Date) => {
          const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000))
          return ist.toISOString().slice(0, 10)
        }

        // Yahoo Finance 5-min data limited to ~60 days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 55)
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)

        send('status', { message: `Scanning ${allSymbols.length} stocks for Order Flow patterns (5-min data)...` })

        const stockResults: any[] = []
        let scannedCount = 0
        let errorCount = 0

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol: string) => {
              const nsSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
              const cleanSymbol = symbol.replace('.NS', '')

              const chartResult = await yf.chart(nsSymbol, { period1, period2, interval: '5m' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 30) throw new Error('Insufficient data')

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const candles = quotes.map((q: any) => ({
                time: new Date(q.date),
                open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
              }))

              // Run full backtest
              const backtest = runFullBacktest(candles)

              // Today's signals
              const dayMap = groupByDay(candles, toIST)
              const sortedDates = [...dayMap.keys()].sort()
              const todayKey = sortedDates[sortedDates.length - 1]
              const todayCandles = dayMap.get(todayKey) || []

              let todayTrades: any[] = []
              if (todayCandles.length >= 10) {
                todayTrades = runOrderFlowForDay(todayCandles)
              }

              const lastPrice = candles[candles.length - 1]?.close ?? 0
              const isFnO = FNO_SYMBOLS.has(cleanSymbol)

              // Pattern effectiveness for this stock
              const patternEff = backtest.trades.length >= 3 ? patternEffectiveness(backtest.trades as any) : null

              return {
                symbol: cleanSymbol,
                lastPrice: Math.round(lastPrice * 100) / 100,
                isFnO,
                backtest: backtest.report,
                totalTrades: backtest.report?.totalTrades ?? 0,
                totalDays: backtest.totalDays,
                tradedDays: backtest.tradedDays,
                patternEff,
                todaySignals: todayTrades.map(t => ({
                  direction: t.direction,
                  entryPrice: Math.round(t.entryPrice * 100) / 100,
                  entryTime: t.entryTime,
                  sl: Math.round(t.sl * 100) / 100,
                  netPnlPct: Math.round(t.netPnlPct * 10000) / 100,
                  isWinner: t.isWinner,
                  exitReason: t.primaryExitReason,
                  patternScore: t.patternScore,
                  primaryPattern: t.primaryPattern,
                  bar: t.bar,
                  bias: t.bias,
                })),
              }
            })
          )

          for (const r of results) {
            scannedCount++
            if (r.status === 'fulfilled') { stockResults.push(r.value) }
            else { errorCount++ }
          }

          send('progress', {
            scanned: scannedCount, total: allSymbols.length, errors: errorCount,
            batch: batchIdx + 1, totalBatches,
            message: `Scanned ${scannedCount}/${allSymbols.length} stocks...`,
          })
        }

        // Rank by expectancy
        stockResults.sort((a, b) => (b.backtest?.expectancyPct ?? -999) - (a.backtest?.expectancyPct ?? -999))

        // Today's signals across all stocks
        const allTodaySignals = stockResults
          .filter(s => s.todaySignals.length > 0)
          .map(s => ({ symbol: s.symbol, lastPrice: s.lastPrice, isFnO: s.isFnO, signals: s.todaySignals }))

        // Aggregate pattern effectiveness
        const allTrades = stockResults.flatMap(s => {
          if (!s.patternEff) return []
          return Object.entries(s.patternEff).map(([pattern, data]: [string, any]) => ({ pattern, ...data }))
        })
        const aggregatedPatterns: Record<string, { count: number; totalWins: number; totalPnl: number }> = {}
        for (const t of allTrades) {
          if (!aggregatedPatterns[t.pattern]) aggregatedPatterns[t.pattern] = { count: 0, totalWins: 0, totalPnl: 0 }
          const ap = aggregatedPatterns[t.pattern]
          ap.count += t.count
          ap.totalWins += Math.round(t.count * t.winRatePct / 100)
          ap.totalPnl += t.avgPnlPct * t.count
        }
        const patternRanking = Object.entries(aggregatedPatterns)
          .map(([pattern, data]) => ({
            pattern: pattern.replace(/_/g, ' '),
            count: data.count,
            winRatePct: data.count > 0 ? Math.round((data.totalWins / data.count) * 10000) / 100 : 0,
            avgPnlPct: data.count > 0 ? Math.round((data.totalPnl / data.count) * 100) / 100 : 0,
          }))
          .sort((a, b) => b.winRatePct - a.winRatePct)

        send('result', {
          stocks: stockResults.slice(0, 50),
          todaySignals: allTodaySignals,
          totalStocksScanned: scannedCount,
          totalErrors: errorCount,
          patternRanking,
          topByWinRate: stockResults.filter(s => (s.backtest?.totalTrades ?? 0) >= 3)
            .sort((a, b) => (b.backtest?.winRatePct ?? 0) - (a.backtest?.winRatePct ?? 0))
            .slice(0, 10)
            .map(s => ({
              symbol: s.symbol, isFnO: s.isFnO,
              winRate: s.backtest?.winRatePct, trades: s.backtest?.totalTrades,
              expectancy: s.backtest?.expectancyPct, profitFactor: s.backtest?.profitFactor,
            })),
          topByExpectancy: stockResults.filter(s => (s.backtest?.totalTrades ?? 0) >= 3)
            .sort((a, b) => (b.backtest?.expectancyPct ?? 0) - (a.backtest?.expectancyPct ?? 0))
            .slice(0, 10)
            .map(s => ({
              symbol: s.symbol, isFnO: s.isFnO,
              winRate: s.backtest?.winRatePct, trades: s.backtest?.totalTrades,
              expectancy: s.backtest?.expectancyPct, profitFactor: s.backtest?.profitFactor,
            })),
        })

        send('done', { total: scannedCount, errors: errorCount })
      } catch (err: any) {
        send('error', { message: err.message || 'Unknown error' })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
