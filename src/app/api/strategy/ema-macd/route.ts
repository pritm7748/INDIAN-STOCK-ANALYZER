// src/app/api/strategy/ema-macd/route.ts
// Streams EMA Crossover + MACD analysis across ALL ~500 stocks via SSE
// Uses 5-minute intraday data from Yahoo Finance

import yahooFinance from 'yahoo-finance2'
import { runFullEMABacktest, runEMAForDay, groupByDay, EMA_CONFIG, analyzePerformance, systemBreakdown, directionBreakdown, exitReasonBreakdown, macdStrengthAnalysis } from '@/lib/strategy/ema-macd'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// High-beta F&O stocks best suited for EMA trend following
const HIGH_BETA_SYMBOLS = new Set([
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
        // IST date helper
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

        send('status', { message: `Scanning ${allSymbols.length} stocks for EMA Crossover + MACD (5-min data)...` })

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

              // Daily stats
              const dayMap = new Map<string, { highs: number[]; lows: number[]; closes: number[]; totalVol: number }>()
              for (const c of candles) {
                const key = toIST(c.time as Date)
                if (!dayMap.has(key)) dayMap.set(key, { highs: [], lows: [], closes: [], totalVol: 0 })
                const day = dayMap.get(key)!
                day.highs.push(c.high); day.lows.push(c.low); day.closes.push(c.close); day.totalVol += c.volume
              }

              const dailyVolumes: number[] = []
              const dailyRanges: number[] = []
              for (const [, day] of dayMap) {
                const dayHigh = Math.max(...day.highs)
                const dayLow = Math.min(...day.lows)
                const dayClose = day.closes[day.closes.length - 1]
                if (dayClose > 0) dailyRanges.push((dayHigh - dayLow) / dayClose)
                dailyVolumes.push(day.totalVol)
              }

              const avgDailyVolume = dailyVolumes.length > 0 ? dailyVolumes.reduce((s, v) => s + v, 0) / dailyVolumes.length : 0
              const atr14Pct = dailyRanges.length > 0 ? dailyRanges.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, dailyRanges.length) : 0

              // Run both systems backtest
              const dualBacktest = runFullEMABacktest(candles, { system: 'DUAL_9_20', capital: EMA_CONFIG.DEFAULT_CAPITAL })
              const tripleBacktest = runFullEMABacktest(candles, { system: 'TRIPLE_5_13_26', capital: EMA_CONFIG.DEFAULT_CAPITAL })

              // Today's signals (both systems)
              const sortedDates = [...dayMap.keys()].sort()
              const todayKey = sortedDates[sortedDates.length - 1]
              const todayCandles = candles.filter((c: any) => toIST(c.time as Date) === todayKey)

              let todayDualSignals: any[] = []
              let todayTripleSignals: any[] = []
              if (todayCandles.length >= 10) {
                todayDualSignals = runEMAForDay(todayCandles, { system: 'DUAL_9_20' })
                todayTripleSignals = runEMAForDay(todayCandles, { system: 'TRIPLE_5_13_26' })
              }

              const lastPrice = candles[candles.length - 1]?.close ?? 0
              const isHighBeta = HIGH_BETA_SYMBOLS.has(cleanSymbol)

              return {
                symbol: cleanSymbol,
                lastPrice: Math.round(lastPrice * 100) / 100,
                avgDailyVolume: Math.round(avgDailyVolume),
                atr14Pct: Math.round(atr14Pct * 10000) / 100,
                isHighBeta,
                dualBacktest: dualBacktest.report,
                tripleBacktest: tripleBacktest.report,
                dualTrades: dualBacktest.trades.length,
                tripleTrades: tripleBacktest.trades.length,
                todayDualSignals: todayDualSignals.length,
                todayTripleSignals: todayTripleSignals.length,
                todaySignals: [...todayDualSignals, ...todayTripleSignals].map(t => ({
                  system: t.system, direction: t.direction, entryPrice: Math.round(t.entryPrice * 100) / 100,
                  entryTime: t.entryTime, exitTime: t.exitTime,
                  sl: Math.round(t.sl * 100) / 100,
                  netPnlPct: Math.round(t.netPnlPct * 10000) / 100,
                  isWinner: t.isWinner, exitReason: t.primaryExitReason,
                  ema9: t.ema9AtEntry ? Math.round(t.ema9AtEntry * 100) / 100 : null,
                  ema20: t.ema20AtEntry ? Math.round(t.ema20AtEntry * 100) / 100 : null,
                  macdHist: t.macdHistAtEntry ? Math.round(t.macdHistAtEntry * 100) / 100 : null,
                })),
                totalDays: dualBacktest.totalDays,
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

        // Rank by combined expectancy
        stockResults.sort((a, b) => {
          const aExp = Math.max(a.dualBacktest?.expectancyPct ?? -999, a.tripleBacktest?.expectancyPct ?? -999)
          const bExp = Math.max(b.dualBacktest?.expectancyPct ?? -999, b.tripleBacktest?.expectancyPct ?? -999)
          return bExp - aExp
        })

        // Aggregate today's signals
        const allTodaySignals = stockResults
          .filter(s => s.todaySignals.length > 0)
          .map(s => ({ symbol: s.symbol, lastPrice: s.lastPrice, isHighBeta: s.isHighBeta, signals: s.todaySignals }))

        send('result', {
          stocks: stockResults.slice(0, 50),
          todaySignals: allTodaySignals,
          totalStocksScanned: scannedCount,
          totalErrors: errorCount,
          topDualByWinRate: stockResults.filter(s => (s.dualBacktest?.totalTrades ?? 0) >= 5).sort((a, b) => (b.dualBacktest?.winRatePct ?? 0) - (a.dualBacktest?.winRatePct ?? 0)).slice(0, 10).map(s => ({ symbol: s.symbol, winRate: s.dualBacktest?.winRatePct, trades: s.dualBacktest?.totalTrades, expectancy: s.dualBacktest?.expectancyPct })),
          topTripleByWinRate: stockResults.filter(s => (s.tripleBacktest?.totalTrades ?? 0) >= 3).sort((a, b) => (b.tripleBacktest?.winRatePct ?? 0) - (a.tripleBacktest?.winRatePct ?? 0)).slice(0, 10).map(s => ({ symbol: s.symbol, winRate: s.tripleBacktest?.winRatePct, trades: s.tripleBacktest?.totalTrades, expectancy: s.tripleBacktest?.expectancyPct })),
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
