// src/app/api/strategy/mean-reversion/route.ts
// Streams mean-reversion scan across ALL ~500 stocks via SSE

import yahooFinance from 'yahoo-finance2'
import {
  scanUniverse,
  MRStockData,
  DEFAULT_MR_CONFIG,
} from '@/lib/strategy/mean-reversion'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(endDate.getMonth() - 12) // 12 months for 200-SMA + buffer
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        const allSymbols = STOCK_LIST
        const total = allSymbols.length

        send({ type: 'status', message: 'Starting Mean Reversion scan...', total })

        // 1. Fetch Nifty 50 data for market regime check
        let niftyCloses: number[] = []
        try {
          const niftyResult = await yf.chart('^NSEI', { period1, period2, interval: '1d' } as any) as any
          if (niftyResult?.quotes) {
            niftyCloses = niftyResult.quotes
              .filter((q: any) => q.close !== null)
              .map((q: any) => q.close)
          }
        } catch {
          // Continue without Nifty data — regime will be UNKNOWN
        }

        // 2. Scan all stocks in batches
        const stockDataList: MRStockData[] = []
        let scannedCount = 0
        let errorCount = 0

        for (let batchIdx = 0; batchIdx < Math.ceil(total / BATCH_SIZE); batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (stock) => {
              // stock.symbol already has .NS suffix (e.g., RELIANCE.NS)
              const chartResult = await yf.chart(stock.symbol, { period1, period2, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 50) {
                throw new Error('Insufficient data')
              }

              const quotes = chartResult.quotes.filter(
                (q: any) => q.open !== null && q.high !== null && q.low !== null && q.close !== null && q.volume !== null
              )
              if (quotes.length < 50) throw new Error('Insufficient valid quotes')

              // Estimate avg daily turnover in crores
              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0
                ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7
                : 0

              return {
                symbol: stock.symbol,
                name: stock.name,
                sector: stock.sector || '',
                opens: quotes.map((q: any) => q.open),
                highs: quotes.map((q: any) => q.high),
                lows: quotes.map((q: any) => q.low),
                closes: quotes.map((q: any) => q.close),
                volumes: quotes.map((q: any) => q.volume),
                avgDailyTurnoverCr: avgTurnover,
              } as MRStockData
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled') {
              stockDataList.push(r.value)
            } else {
              errorCount++
            }
          }

          scannedCount += batch.length
          const pct = Math.round((scannedCount / total) * 100)

          send({
            type: 'progress',
            scanned: scannedCount,
            total,
            pct,
            fetched: stockDataList.length,
            errors: errorCount,
            message: `Scanning ${scannedCount}/${total} stocks...`,
          })
        }

        // 3. Run the full mean-reversion engine
        send({ type: 'status', message: `Analyzing ${stockDataList.length} stocks...` })

        const currentDate = new Date(Date.now() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10) // IST
        const scanResult = scanUniverse(stockDataList, niftyCloses, currentDate)

        send({
          type: 'result',
          data: scanResult,
          summary: {
            totalScanned: scanResult.totalScanned,
            signalCount: scanResult.signalCount,
            watchlistCount: scanResult.watchlist.length,
            filteredCount: scanResult.totalFiltered,
            regime: scanResult.regime,
          },
        })

        send({ type: 'done' })
        controller.close()
      } catch (err: any) {
        send({ type: 'error', message: err.message || 'Scan failed' })
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
