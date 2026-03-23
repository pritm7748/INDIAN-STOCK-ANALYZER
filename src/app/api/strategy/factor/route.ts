// src/app/api/strategy/factor/route.ts
// Streams multi-factor quantitative scan across ALL ~500 stocks via SSE

import yahooFinance from 'yahoo-finance2'
import { rankUniverse, r2 } from '@/lib/strategy/factor'
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
        // 12 months of data for momentum lookbacks (6M+skip) and volatility
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(endDate.getMonth() - 12)
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        const allSymbols = STOCK_LIST.map(s => s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)

        const universe: any[] = []
        let scannedCount = 0
        let errorCount = 0

        send('status', { message: `Scanning ${allSymbols.length} stocks for multi-factor ranking...` })

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol) => {
              const chartResult = await yf.chart(symbol, { period1, period2, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 140) throw new Error('Insufficient data')

              const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
              const prices = quotes.map((q: any) => q.close as number)
              const volumes = quotes.map((q: any) => q.volume as number)

              // Avg daily turnover in crores
              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0
                ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7
                : 0

              // Fetch fundamentals from quote
              let fundamentals: any = {}
              try {
                const quote = await yf.quote(symbol) as any
                if (quote) {
                  fundamentals = {
                    peRatio: quote.trailingPE || quote.forwardPE || null,
                    pbRatio: quote.priceToBook || null,
                    earningsYield: quote.trailingPE ? 1 / quote.trailingPE : null,
                    evEbitda: null, // not directly available
                    eps: quote.trailingEps || null,
                    roe: null, // would need financials API
                    roic: null,
                    debtToEquity: null,
                    earningsStability: null,
                    earningsGrowth3Y: null,
                    yearsPositiveEarnings: quote.trailingEps && quote.trailingEps > 0 ? 5 : 0,
                  }
                }
              } catch { /* fundamentals optional */ }

              const stockInfo = STOCK_LIST.find(s => s.symbol === symbol)

              return {
                symbol: symbol.replace('.NS', ''),
                name: stockInfo?.name || symbol.replace('.NS', ''),
                sector: stockInfo?.sector || 'Unknown',
                prices, volumes,
                avgDailyTurnoverCr: r2(avgTurnover),
                marketCapCr: null, // not available from chart
                fundamentals,
                revisionData: null, // not available from yahoo
              }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled') {
              universe.push(r.value)
            } else {
              errorCount++
            }
          }

          scannedCount += batch.length

          send('progress', {
            scanned: scannedCount,
            total: allSymbols.length,
            fetched: universe.length,
            errors: errorCount,
            pct: Math.round((scannedCount / allSymbols.length) * 100),
          })
        }

        // Run ranking engine
        send('status', { message: `Ranking ${universe.length} stocks across 4 factors...` })
        const ranking = rankUniverse(universe)

        // Top 15 + watchlist (rank 16-30)
        const topStocks = ranking.ranked?.slice(0, 15) || []
        const watchlist = ranking.ranked?.slice(15, 30) || []

        send('result', {
          topStocks: topStocks.map((s: any) => ({
            symbol: s.symbol, sector: s.sector, rank: s.rank,
            compositeScore: r2(s.compositeScore),
            momentumPctile: r2(s.momentumPercentile),
            valuePctile: r2(s.valuePercentile),
            qualityPctile: r2(s.qualityPercentile),
            revisionPctile: r2(s.revisionPercentile),
            factorCount: s.factorCount,
            currentPrice: r2(s.currentPrice),
            ret3m: s.momentum ? r2(s.momentum.ret3m * 100) : null,
          })),
          watchlist: watchlist.map((s: any) => ({
            symbol: s.symbol, sector: s.sector, rank: s.rank,
            compositeScore: r2(s.compositeScore),
            factorCount: s.factorCount,
          })),
          totalScanned: allSymbols.length,
          qualifying: ranking.qualifying || 0,
          filtered: ranking.filtered || 0,
          fetchStats: {
            totalSymbols: allSymbols.length,
            successfulFetches: universe.length,
            failedFetches: errorCount,
          },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Factor scan failed' })
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
