// src/app/api/strategy/vwap/route.ts
// Streams VWAP (Pullback + Breakout) analysis across ALL ~500 stocks via SSE
// Uses 5-minute intraday data from Yahoo Finance

import yahooFinance from 'yahoo-finance2'
import { runFullVWAPBacktest, runVWAPForDay, computeVWAPWithBands, computeEMA, VWAP_CONFIG, VWAP_SETUP } from '@/lib/strategy/vwap'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// High-beta F&O stocks — tagged in results
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
        // IST date helper (UTC+5:30) — ensures day grouping matches Indian market dates
        const toIST = (d: Date) => {
          const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000))
          return ist.toISOString().slice(0, 10)
        }

        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 55)
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)

        send('status', { message: `Scanning ${allSymbols.length} stocks for VWAP setups (5-min data)...` })

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
              if (!chartResult?.quotes || chartResult.quotes.length < 30) throw new Error('Insufficient 5-min data')

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const candles = quotes.map((q: any) => ({
                time: new Date(q.date),
                open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
              }))

              // Compute daily stats
              const dayMap = new Map<string, { highs: number[]; lows: number[]; closes: number[]; totalVol: number }>()
              for (const c of candles) {
                const key = toIST(c.time as Date)
                if (!dayMap.has(key)) dayMap.set(key, { highs: [], lows: [], closes: [], totalVol: 0 })
                const day = dayMap.get(key)!
                day.highs.push(c.high); day.lows.push(c.low); day.closes.push(c.close); day.totalVol += c.volume
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

              const avgDailyVolume = dailyVolumes.length > 0 ? dailyVolumes.reduce((s, v) => s + v, 0) / dailyVolumes.length : 0
              const atr14Pct = dailyRanges.length > 0 ? dailyRanges.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, dailyRanges.length) : 0

              // Run backtest
              const backtest = runFullVWAPBacktest(candles, { capital: VWAP_CONFIG.DEFAULT_CAPITAL })

              // Today's signals
              const sortedDates = [...dayMap.keys()].sort()
              const todayKey = sortedDates[sortedDates.length - 1]
              const todayCandles = candles.filter((c: any) => toIST(c.time as Date) === todayKey)

              let todaySignals: any[] = []
              if (todayCandles.length >= 10) {
                const prevDayKey = sortedDates.length > 1 ? sortedDates[sortedDates.length - 2] : null
                const prevDayCandles = prevDayKey ? candles.filter((c: any) => toIST(c.time as Date) === prevDayKey) : []
                const prevClose = prevDayCandles.length > 0 ? prevDayCandles[prevDayCandles.length - 1].close : null

                const dayCopy = todayCandles.map((c: any) => ({ ...c }))
                const signals = runVWAPForDay(dayCopy, {
                  prevDayClose: prevClose, usePDCFilter: false,
                  enabledSetups: [VWAP_SETUP.PULLBACK, VWAP_SETUP.BREAKOUT],
                })

                // Compute VWAP for display
                const vwapCopy = todayCandles.map((c: any) => ({ ...c }))
                computeVWAPWithBands(vwapCopy)
                computeEMA(vwapCopy)
                const lastCandle = vwapCopy[vwapCopy.length - 1]

                todaySignals = signals.map((trade: any) => ({
                  setup: trade.setup,
                  direction: trade.direction,
                  entryPrice: Math.round(trade.entryPrice * 100) / 100,
                  sl: Math.round(trade.sl * 100) / 100,
                  t1: trade.partialExits?.find((e: any) => e.reason === 'TARGET_1')
                    ? Math.round(trade.partialExits.find((e: any) => e.reason === 'TARGET_1').price * 100) / 100
                    : null,
                  entryTime: trade.entryTime,
                  rejectionPattern: trade.rejectionPattern,
                  vwap: lastCandle?.vwap ? Math.round(lastCandle.vwap * 100) / 100 : null,
                  vwapUpper1: lastCandle?.vwapUpper1 ? Math.round(lastCandle.vwapUpper1 * 100) / 100 : null,
                  vwapLower1: lastCandle?.vwapLower1 ? Math.round(lastCandle.vwapLower1 * 100) / 100 : null,
                  pnlPct: trade.netPnlPct ? Math.round(trade.netPnlPct * 10000) / 100 : null,
                  exitReason: trade.primaryExitReason,
                  isWinner: trade.isWinner,
                }))
              }

              const isHighBeta = HIGH_BETA_SYMBOLS.has(cleanSymbol)

              return {
                symbol: cleanSymbol, isHighBeta,
                avgDailyVolume: Math.round(avgDailyVolume),
                atr14Pct: Math.round(atr14Pct * 10000) / 100,
                totalCandles: candles.length, daysOfData: dayMap.size,
                todaySignals,
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
                  setupBreakdown: backtest.report.setupBreakdown,
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
            scanned: scannedCount, total: allSymbols.length,
            fetched: stockResults.length, errors: errorCount,
            pct: Math.round((scannedCount / allSymbols.length) * 100),
          })
        }

        // Separate stocks with today's signals vs without
        const activeSignals = stockResults.filter(s => s.todaySignals && s.todaySignals.length > 0)
        const withBacktest = stockResults.filter(s => s.backtest)

        // Sort active: high-beta first, then by setup
        activeSignals.sort((a, b) => {
          if (a.isHighBeta !== b.isHighBeta) return a.isHighBeta ? -1 : 1
          return 0
        })

        // Sort backtest ranking by win rate
        withBacktest.sort((a, b) => {
          if (a.isHighBeta !== b.isHighBeta) return a.isHighBeta ? -1 : 1
          return (b.backtest?.winRatePct || 0) - (a.backtest?.winRatePct || 0)
        })

        const allStocks = [...stockResults].sort((a, b) => {
          if (a.isHighBeta !== b.isHighBeta) return a.isHighBeta ? -1 : 1
          if (a.backtest && !b.backtest) return -1
          if (!a.backtest && b.backtest) return 1
          return (b.atr14Pct || 0) - (a.atr14Pct || 0)
        })

        send('result', {
          activeSignals,
          backtestRanking: withBacktest.slice(0, 30),
          allStocks: allStocks.slice(0, 50),
          totalScanned: allSymbols.length,
          totalWithSignals: activeSignals.length,
          totalWithBacktest: withBacktest.length,
          totalSuccessful: stockResults.length,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: stockResults.length,
            failedFetches: errorCount,
          },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'VWAP scan failed' })
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
