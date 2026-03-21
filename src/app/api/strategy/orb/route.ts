// src/app/api/strategy/orb/route.ts
// Streams ORB (Opening Range Breakout) analysis across ALL ~500 stocks via SSE
// Uses 5-minute intraday data from Yahoo Finance
// High-beta F&O stocks are tagged for quick identification

import yahooFinance from 'yahoo-finance2'
import { runFullBacktest, CONFIG } from '@/lib/strategy/orb'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// High-beta F&O stocks best suited for ORB — tagged in results
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
        // Yahoo Finance 5-min data is limited to ~60 days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 55)
        const period1 = startDate.toISOString().split('T')[0]

        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)

        send('status', { message: `Scanning ${allSymbols.length} stocks for ORB setups (5-min data)...` })

        const stockResults: any[] = []
        let scannedCount = 0
        let errorCount = 0

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol: string) => {
              const nsSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
              const cleanSymbol = symbol.replace('.NS', '')

              const chartResult = await yf.chart(nsSymbol, { period1, interval: '5m' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 30) throw new Error('Insufficient 5-min data')

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const candles = quotes.map((q: any) => ({
                time: new Date(q.date),
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume,
              }))

              // Group candles by day
              const dayMap = new Map<string, { highs: number[]; lows: number[]; closes: number[]; totalVol: number }>()
              for (const c of candles) {
                const key = (c.time as Date).toISOString().slice(0, 10)
                if (!dayMap.has(key)) dayMap.set(key, { highs: [], lows: [], closes: [], totalVol: 0 })
                const day = dayMap.get(key)!
                day.highs.push(c.high)
                day.lows.push(c.low)
                day.closes.push(c.close)
                day.totalVol += c.volume
              }

              const dailyRanges: number[] = []
              const dailyVolumes: number[] = []
              for (const [, day] of dayMap) {
                const dayHigh = Math.max(...day.highs)
                const dayLow = Math.min(...day.lows)
                const dayClose = day.closes[day.closes.length - 1]
                if (dayClose > 0) dailyRanges.push((dayHigh - dayLow) / dayClose)
                dailyVolumes.push(day.totalVol)
              }

              const avgDailyVolume = dailyVolumes.length > 0
                ? dailyVolumes.reduce((s, v) => s + v, 0) / dailyVolumes.length : 0
              const atr14Pct = dailyRanges.length > 0
                ? dailyRanges.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, dailyRanges.length) : 0

              // Run backtest on this stock's 5-min data
              const backtest = runFullBacktest(candles, {
                variant: '15min',
                capital: CONFIG.DEFAULT_CAPITAL,
              })

              // Run today's signal detection
              const sortedDates = [...dayMap.keys()].sort()
              const todayKey = sortedDates[sortedDates.length - 1]
              const todayCandles = candles.filter((c: any) =>
                (c.time as Date).toISOString().slice(0, 10) === todayKey
              )

              let todaySignal = null
              if (todayCandles.length >= 6) {
                const prevDayKey = sortedDates.length > 1 ? sortedDates[sortedDates.length - 2] : null
                const prevDayCandles = prevDayKey
                  ? candles.filter((c: any) => (c.time as Date).toISOString().slice(0, 10) === prevDayKey)
                  : []
                const prevClose = prevDayCandles.length > 0
                  ? prevDayCandles[prevDayCandles.length - 1].close
                  : null

                const { computeVWAP, buildORBRange, detectBreakoutSignal } = await import('@/lib/strategy/orb')
                const dayCopy = todayCandles.map((c: any) => ({ ...c }))
                computeVWAP(dayCopy)
                const orb = buildORBRange(dayCopy, '15min')
                if (orb) {
                  const signal = detectBreakoutSignal(dayCopy, orb, {
                    variant: '15min',
                    prevClose,
                    useGapFilter: false,
                  })
                  if (signal) {
                    todaySignal = {
                      direction: signal.direction,
                      entryPrice: Math.round(signal.entryPrice * 100) / 100,
                      sl: Math.round(signal.sl * 100) / 100,
                      t1: signal.targets[0] ? Math.round(signal.targets[0].price * 100) / 100 : null,
                      t2: signal.targets[1] ? Math.round(signal.targets[1].price * 100) / 100 : null,
                      orbHigh: Math.round(orb.orbHigh * 100) / 100,
                      orbLow: Math.round(orb.orbLow * 100) / 100,
                      rangeWidthPct: Math.round(orb.rangeWidthPct * 10000) / 100,
                      entryTime: signal.entryTime,
                      vwap: signal.breakoutCandle?.vwap ? Math.round(signal.breakoutCandle.vwap * 100) / 100 : null,
                    }
                  }
                }
              }

              const isHighBeta = HIGH_BETA_SYMBOLS.has(cleanSymbol)

              return {
                symbol: cleanSymbol,
                name: cleanSymbol,
                sector: 'N/A',
                isHighBeta,
                avgDailyVolume: Math.round(avgDailyVolume),
                atr14Pct: Math.round(atr14Pct * 10000) / 100,
                totalCandles: candles.length,
                daysOfData: dayMap.size,
                todaySignal,
                backtest: backtest.report ? {
                  totalTrades: backtest.report.totalTrades,
                  winRatePct: backtest.report.winRatePct,
                  expectancyPct: backtest.report.expectancyPct,
                  totalReturnPct: backtest.report.totalReturnPct,
                  maxDrawdownPct: backtest.report.maxDrawdownPct,
                  profitFactor: backtest.report.profitFactor,
                  sharpeRatio: backtest.report.sharpeRatio,
                  avgWinLossRatio: backtest.report.avgWinLossRatio,
                  longWinRate: backtest.report.longWinRate,
                  shortWinRate: backtest.report.shortWinRate,
                  exitReasonBreakdown: backtest.report.exitReasonBreakdown,
                } : null,
                tradedDays: backtest.tradedDays,
                totalDays: backtest.totalDays,
                hitRate: backtest.hitRate,
              }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled') stockResults.push(r.value)
            else errorCount++
          }

          scannedCount += batch.length
          send('progress', {
            scanned: scannedCount,
            total: allSymbols.length,
            fetched: stockResults.length,
            errors: errorCount,
            pct: Math.round((scannedCount / allSymbols.length) * 100),
          })
        }

        // Separate stocks with today's signal vs without
        const activeSignals = stockResults.filter(s => s.todaySignal !== null)
        const noSignal = stockResults.filter(s => s.todaySignal === null && s.backtest)

        // Sort active: high-beta first, then by direction
        activeSignals.sort((a, b) => {
          if (a.isHighBeta !== b.isHighBeta) return a.isHighBeta ? -1 : 1
          if (a.todaySignal.direction !== b.todaySignal.direction) return a.todaySignal.direction === 'LONG' ? -1 : 1
          return 0
        })

        // Sort no-signal: high-beta first, then by win rate
        noSignal.sort((a, b) => {
          if (a.isHighBeta !== b.isHighBeta) return a.isHighBeta ? -1 : 1
          return (b.backtest?.winRatePct || 0) - (a.backtest?.winRatePct || 0)
        })

        const highBetaSignals = activeSignals.filter(s => s.isHighBeta).length

        send('result', {
          activeSignals,
          backtestRanking: noSignal.slice(0, 30),
          totalScanned: allSymbols.length,
          totalWithSignals: activeSignals.length,
          highBetaSignals,
          totalWithBacktest: stockResults.filter(s => s.backtest).length,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: stockResults.length,
            failedFetches: errorCount,
          },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'ORB scan failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
