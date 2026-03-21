// src/app/api/strategy/gap/route.ts
// Streams Gap Trading (Gap&Go + Gap Fill) analysis across ALL ~500 stocks via SSE

import yahooFinance from 'yahoo-finance2'
import { runFullGapBacktest, runGapForDay, classifyGap, groupByDay, GAP_CONFIG, GAP_STRATEGY } from '@/lib/strategy/gap'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

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
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 55)
        const period1 = startDate.toISOString().split('T')[0]

        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)

        send('status', { message: `Scanning ${allSymbols.length} stocks for Gap setups (5-min data)...` })

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
              if (!chartResult?.quotes || chartResult.quotes.length < 30) throw new Error('Insufficient data')

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const candles = quotes.map((q: any) => ({
                time: new Date(q.date),
                open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
              }))

              // Daily stats
              const dayMap = new Map<string, { highs: number[]; lows: number[]; closes: number[]; totalVol: number }>()
              for (const c of candles) {
                const key = (c.time as Date).toISOString().slice(0, 10)
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

              // Backtest
              const backtest = runFullGapBacktest(candles, { capital: GAP_CONFIG.DEFAULT_CAPITAL })

              // Today's signals
              const sortedDates = [...dayMap.keys()].sort()
              const todayKey = sortedDates[sortedDates.length - 1]
              const todayCandles = candles.filter((c: any) => (c.time as Date).toISOString().slice(0, 10) === todayKey)

              let todaySignals: any[] = []
              let todayGapInfo: any = null
              if (todayCandles.length >= 6 && sortedDates.length > 1) {
                const prevDayKey = sortedDates[sortedDates.length - 2]
                const prevDayCandles = candles.filter((c: any) => (c.time as Date).toISOString().slice(0, 10) === prevDayKey)
                if (prevDayCandles.length >= 3) {
                  const prevDay = {
                    open: prevDayCandles[0].open,
                    high: Math.max(...prevDayCandles.map((c: any) => c.high)),
                    low: Math.min(...prevDayCandles.map((c: any) => c.low)),
                    close: prevDayCandles[prevDayCandles.length - 1].close,
                  }

                  // Gap classification for display
                  todayGapInfo = classifyGap(todayCandles[0].open, prevDay)

                  const signals = runGapForDay(todayCandles, {
                    prevDay, enabledStrategies: [GAP_STRATEGY.GAP_AND_GO, GAP_STRATEGY.GAP_FILL],
                  })

                  todaySignals = signals.map((trade: any) => ({
                    strategy: trade.strategy,
                    direction: trade.direction,
                    entryPrice: Math.round(trade.entryPrice * 100) / 100,
                    sl: Math.round(trade.sl * 100) / 100,
                    gapFillTarget: trade.gapFillTarget ? Math.round(trade.gapFillTarget * 100) / 100 : null,
                    entryTime: trade.entryTime,
                    pnlPct: trade.netPnlPct ? Math.round(trade.netPnlPct * 10000) / 100 : null,
                    exitReason: trade.primaryExitReason,
                    isWinner: trade.isWinner,
                    gapFilled: trade.gapFilled,
                    gapType: trade.gapType,
                    gapSizeLabel: trade.gapSizeLabel,
                    catalystScore: trade.catalystScore,
                  }))
                }
              }

              const isHighBeta = HIGH_BETA_SYMBOLS.has(cleanSymbol)

              return {
                symbol: cleanSymbol, isHighBeta,
                avgDailyVolume: Math.round(avgDailyVolume),
                atr14Pct: Math.round(atr14Pct * 10000) / 100,
                totalCandles: candles.length, daysOfData: dayMap.size,
                todaySignals,
                todayGap: todayGapInfo ? {
                  type: todayGapInfo.type,
                  size: todayGapInfo.gapSize,
                  pct: Math.round(todayGapInfo.gapPctAbs * 10000) / 100,
                  direction: todayGapInfo.isGapUp ? 'UP' : todayGapInfo.isGapDown ? 'DOWN' : 'NONE',
                  fillTarget: Math.round(todayGapInfo.gapFillTarget * 100) / 100,
                } : null,
                backtest: backtest.report ? {
                  totalTrades: backtest.report.totalTrades,
                  winRatePct: backtest.report.winRatePct,
                  expectancyPct: backtest.report.expectancyPct,
                  totalReturnPct: backtest.report.totalReturnPct,
                  maxDrawdownPct: backtest.report.maxDrawdownPct,
                  profitFactor: backtest.report.profitFactor,
                  sharpeRatio: backtest.report.sharpeRatio,
                  gapsFilled: backtest.report.gapsFilled,
                  gapFillRatePct: backtest.report.gapFillRatePct,
                  strategyBreakdown: backtest.report.strategyBreakdown,
                  gapSizeBreakdown: backtest.report.gapSizeBreakdown,
                  exitReasonBreakdown: backtest.report.exitReasonBreakdown,
                  gapDirectionStats: backtest.report.gapDirectionStats,
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

        // Separate
        const activeSignals = stockResults.filter(s => s.todaySignals && s.todaySignals.length > 0)
        const withBacktest = stockResults.filter(s => s.backtest)

        activeSignals.sort((a, b) => {
          if (a.isHighBeta !== b.isHighBeta) return a.isHighBeta ? -1 : 1
          return 0
        })

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

        // Stocks with today's gap (for display)
        const todayGaps = stockResults
          .filter(s => s.todayGap && s.todayGap.type !== 'NO_GAP')
          .sort((a, b) => (b.todayGap?.pct || 0) - (a.todayGap?.pct || 0))

        send('result', {
          activeSignals,
          backtestRanking: withBacktest.slice(0, 30),
          allStocks: allStocks.slice(0, 50),
          todayGaps: todayGaps.slice(0, 30),
          totalScanned: allSymbols.length,
          totalWithSignals: activeSignals.length,
          totalWithBacktest: withBacktest.length,
          totalSuccessful: stockResults.length,
          totalGapsToday: todayGaps.length,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: stockResults.length,
            failedFetches: errorCount,
          },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Gap scan failed' })
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
