// src/app/api/strategy/momentum/route.ts
// Streams momentum analysis across ALL ~500 stocks via SSE

import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { generateMomentumPortfolio, checkMarketRegime, StockData, DEFAULT_CONFIG } from '@/lib/strategy/momentum'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

export const maxDuration = 120 // Vercel edge timeout
export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Fetch 10 months of data for 6M lookback
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(endDate.getMonth() - 10)
        const period1 = startDate.toISOString().split('T')[0]

        // 1. Fetch Nifty first for regime check
        send('status', { phase: 'regime', message: 'Checking market regime (Nifty 50)...' })
        let niftyPrices: number[] = []
        try {
          const niftyResult = await yf.chart('^NSEI', { period1, interval: '1d' } as any) as any
          if (niftyResult?.quotes) {
            niftyPrices = niftyResult.quotes.filter((q: any) => q.close !== null).map((q: any) => q.close)
          }
        } catch { /* continue without regime filter */ }

        const regime = checkMarketRegime(niftyPrices, DEFAULT_CONFIG.NIFTY_SMA_PERIOD)
        send('regime', { ...regime, smaPeriod: DEFAULT_CONFIG.NIFTY_SMA_PERIOD })

        // 2. Scan all stocks in batches
        const allSymbols = STOCK_LIST.map(s => s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)
        const allStockData: StockData[] = []
        let scannedCount = 0
        let errorCount = 0

        send('status', { phase: 'scanning', message: `Scanning ${allSymbols.length} stocks...`, total: allSymbols.length })

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol) => {
              const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 50) {
                throw new Error('Insufficient data')
              }

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const prices = quotes.map((q: any) => q.close as number)
              const volumes = quotes.map((q: any) => q.volume as number)

              // Estimate avg daily turnover in crores
              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0
                ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7
                : 0

              // Fetch earnings date and beta from quote
              let earningsDate: string | null = null
              let beta: number | null = null
              try {
                const quote = await yf.quote(symbol) as any
                if (quote) {
                  // earningsTimestamp or earningsTimestampStart
                  const ets = quote.earningsTimestamp || quote.earningsTimestampStart
                  if (ets) {
                    earningsDate = new Date(ets instanceof Date ? ets : ets * 1000).toISOString().split('T')[0]
                  }
                  if (typeof quote.beta === 'number') {
                    beta = quote.beta
                  }
                }
              } catch { /* quote data optional */ }

              const stockInfo = STOCK_LIST.find(s => s.symbol === symbol)

              return {
                symbol,
                name: stockInfo?.name || symbol.replace('.NS', ''),
                sector: stockInfo?.sector || 'Unknown',
                prices,
                volumes,
                avgDailyTurnoverCr: avgTurnover,
                earningsDate,
                beta,
              } as StockData
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

          // Send progress update with intermediate top picks
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

        // 3. Run the full momentum engine on all fetched data
        send('status', { phase: 'analyzing', message: `Analyzing ${allStockData.length} stocks...` })

        const portfolio = generateMomentumPortfolio(allStockData, niftyPrices, DEFAULT_CONFIG)

        send('result', {
          ...portfolio,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: allStockData.length,
            failedFetches: errorCount,
          }
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Strategy failed' })
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
