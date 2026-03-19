// src/app/api/strategy/swing/route.ts
// Streams swing analysis across ALL ~500 stocks via SSE

import yahooFinance from 'yahoo-finance2'
import { scanUniverse, SwingStockData, DEFAULT_SWING_CONFIG } from '@/lib/strategy/swing'
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
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Fetch 10 months of OHLCV data for 6M lookback + SMA50 warmup
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(endDate.getMonth() - 10)
        const period1 = startDate.toISOString().split('T')[0]
        const currentDate = endDate.toISOString().split('T')[0]

        // Scan all stocks in batches
        const allSymbols = STOCK_LIST.map(s => s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)
        const allStockData: SwingStockData[] = []
        let scannedCount = 0
        let errorCount = 0

        send('status', { phase: 'scanning', message: `Scanning ${allSymbols.length} stocks for swing setups...`, total: allSymbols.length })

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol) => {
              const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 60) {
                throw new Error('Insufficient data')
              }

              const quotes = chartResult.quotes.filter((q: any) =>
                q.open !== null && q.high !== null && q.low !== null && q.close !== null && q.volume !== null
              )

              const opens = quotes.map((q: any) => q.open as number)
              const highs = quotes.map((q: any) => q.high as number)
              const lows = quotes.map((q: any) => q.low as number)
              const closes = quotes.map((q: any) => q.close as number)
              const volumes = quotes.map((q: any) => q.volume as number)

              // Estimate avg daily turnover in crores
              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0
                ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7
                : 0

              // Fetch earnings date from quote
              let earningsDate: string | null = null
              try {
                const quote = await yf.quote(symbol) as any
                if (quote) {
                  const ets = quote.earningsTimestamp || quote.earningsTimestampStart
                  if (ets) {
                    earningsDate = new Date(ets instanceof Date ? ets : ets * 1000).toISOString().split('T')[0]
                  }
                }
              } catch { /* optional */ }

              const stockInfo = STOCK_LIST.find(s => s.symbol === symbol)

              return {
                symbol,
                name: stockInfo?.name || symbol.replace('.NS', ''),
                sector: stockInfo?.sector || 'Unknown',
                opens,
                highs,
                lows,
                closes,
                volumes,
                avgDailyTurnoverCr: avgTurnover,
                earningsDate,
              } as SwingStockData
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled') {
              allStockData.push(r.value)
            } else {
              errorCount++
            }
          }

          scannedCount += batch.length

          send('progress', {
            scanned: scannedCount,
            total: allSymbols.length,
            fetched: allStockData.length,
            errors: errorCount,
            batchDone: batchIdx + 1,
            totalBatches,
            pct: Math.round((scannedCount / allSymbols.length) * 100),
          })
        }

        // Run the full swing scanner on all fetched data
        send('status', { phase: 'analyzing', message: `Analyzing ${allStockData.length} stocks for swing setups...` })

        const scanResult = scanUniverse(allStockData, currentDate, DEFAULT_SWING_CONFIG)

        send('result', {
          ...scanResult,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: allStockData.length,
            failedFetches: errorCount,
          },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Swing strategy failed' })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
