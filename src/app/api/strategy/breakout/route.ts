// src/app/api/strategy/breakout/route.ts
// Streams breakout (VCP/Darvas) scan across ALL ~500 stocks via SSE

import yahooFinance from 'yahoo-finance2'
import { analyzeBreakout, r2 } from '@/lib/strategy/breakout'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

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
        // 12 months of data needed for 200-SMA + base detection
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(endDate.getMonth() - 12)
        const period1 = startDate.toISOString().split('T')[0]
        const currentDate = endDate.toISOString().split('T')[0]

        const allSymbols = STOCK_LIST.map(s => s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)

        const allSignals: any[] = []
        const watchlist: any[] = []
        let scannedCount = 0
        let errorCount = 0
        let fetchedCount = 0

        send('status', { message: `Scanning ${allSymbols.length} stocks for breakout patterns...` })

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol) => {
              const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 230) {
                throw new Error('Insufficient data')
              }

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const opens = quotes.map((q: any) => q.open as number)
              const highs = quotes.map((q: any) => q.high as number)
              const lows = quotes.map((q: any) => q.low as number)
              const closes = quotes.map((q: any) => q.close as number)
              const volumes = quotes.map((q: any) => q.volume as number)

              // Avg daily turnover in crores
              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0
                ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7
                : 0

              // Delivery % — not available from yahoo, estimate via volume profile
              const stockInfo = STOCK_LIST.find(s => s.symbol === symbol)

              return {
                symbol: symbol.replace('.NS', ''),
                name: stockInfo?.name || symbol.replace('.NS', ''),
                sector: stockInfo?.sector || 'Unknown',
                opens, highs, lows, closes, volumes,
                avgDailyTurnoverCr: r2(avgTurnover),
              }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled') {
              fetchedCount++
              const stock = r.value
              const signal = analyzeBreakout(stock, currentDate)

              if (signal.triggered) {
                allSignals.push(signal)
              } else if (signal.score >= 4) {
                watchlist.push({
                  symbol: stock.symbol,
                  score: `${signal.score}/${signal.totalConditions}`,
                  missingConditions: signal.conditions.filter((c: any) => !c.met).map((c: any) => c.name),
                  bbSqueeze: signal.bbSqueezePercentile,
                  baseDetected: !!signal.baseAnalysis,
                })
              }
            } else {
              errorCount++
            }
          }

          scannedCount += batch.length

          send('progress', {
            scanned: scannedCount,
            total: allSymbols.length,
            fetched: fetchedCount,
            errors: errorCount,
            pct: Math.round((scannedCount / allSymbols.length) * 100),
          })
        }

        // Sort signals by quality
        allSignals.sort((a, b) => b.qualityScore - a.qualityScore)

        send('result', {
          signals: allSignals,
          watchlist: watchlist.slice(0, 20),
          totalScanned: allSymbols.length,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: fetchedCount,
            failedFetches: errorCount,
          },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Breakout scan failed' })
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
