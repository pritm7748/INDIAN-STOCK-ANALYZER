// src/app/api/strategy/event-driven/route.ts
// Streams event-driven / catalyst trading analysis via SSE

import yahooFinance from 'yahoo-finance2'
import {
  analyzeEarningsSurprise, analyzeBulkDeal, analyzeIndexRebalancing,
  generateRBICalendar, getEarningsSeasonDates, getIndexRebalanceDates,
  calcReturn, calcVolatility, calcAvgVolume, DEFAULT_ED_CONFIG,
} from '@/lib/strategy/event-driven'
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
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }

      try {
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(endDate.getMonth() - 8)
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        const total = STOCK_LIST.length
        send('status', { phase: 'init', message: `Scanning ${total} stocks for event-driven signals...`, total })

        // 1. Fetch all stocks
        const stockData: Record<string, any> = {}
        let scannedCount = 0, errorCount = 0, fetchedCount = 0

        for (let batchIdx = 0; batchIdx < Math.ceil(total / BATCH_SIZE); batchIdx++) {
          const batch = STOCK_LIST.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (stock) => {
              const chartResult = await yf.chart(stock.symbol, { period1, period2, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 60) throw new Error('Insufficient data')

              const quotes = chartResult.quotes.filter((q: any) =>
                q.open !== null && q.high !== null && q.low !== null && q.close !== null && q.volume !== null
              )
              if (quotes.length < 60) throw new Error('Insufficient valid quotes')

              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0 ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7 : 0

              return {
                symbol: stock.symbol, name: stock.name, sector: stock.sector || '',
                opens: quotes.map((q: any) => q.open as number),
                highs: quotes.map((q: any) => q.high as number),
                lows: quotes.map((q: any) => q.low as number),
                closes: quotes.map((q: any) => q.close as number),
                prices: quotes.map((q: any) => q.close as number),
                volumes: quotes.map((q: any) => q.volume as number),
                avgDailyTurnoverCr: avgTurnover,
              }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
              stockData[r.value.symbol] = r.value
              fetchedCount++
            } else { errorCount++ }
          }

          scannedCount += batch.length
          send('progress', { scanned: scannedCount, total, fetched: fetchedCount, errors: errorCount, pct: Math.round((scannedCount / total) * 100) })
        }

        // 2. Detect potential earnings surprise signals
        // Look for stocks with unusual volume + gap up in recent 5 days (proxy for post-earnings)
        send('status', { phase: 'analyzing', message: `Analyzing ${fetchedCount} stocks for event catalysts...` })

        const earningsSignals: any[] = []
        const bulkDealSignals: any[] = []

        for (const [symbol, data] of Object.entries(stockData) as [string, any][]) {
          const closes = data.closes; const volumes = data.volumes
          const opens = data.opens; const highs = data.highs; const lows = data.lows
          if (!closes || closes.length < 60) continue

          // Scan last 5 days for possible earnings-like events (volume surge + gap up)
          for (let lookback = 1; lookback <= 5; lookback++) {
            const idx = closes.length - lookback
            if (idx < 51) continue

            const avgVol = calcAvgVolume(volumes.slice(0, idx), 20)
            if (!avgVol || avgVol <= 0) continue
            const volRatio = volumes[idx] / avgVol

            // Check for volume surge > 2.5x AND bullish candle (proxy for potential earnings surprise)
            if (volRatio >= 2.5 && closes[idx] > opens[idx]) {
              const gapPct = idx > 0 ? (opens[idx] - closes[idx - 1]) / closes[idx - 1] : 0
              const bodyRatio = (highs[idx] - lows[idx]) > 0 ? Math.abs(closes[idx] - opens[idx]) / (highs[idx] - lows[idx]) : 0

              if (gapPct > -0.01 && bodyRatio >= 0.4) {
                // Mock earnings data based on price action
                const mockEPS = closes[idx] / 20
                const signal = analyzeEarningsSurprise(
                  { symbol, actualEPS: mockEPS * 1.15, consensusEPS: mockEPS, previousEPS: mockEPS * 0.90, consecutiveBeats: 2, revenueActual: null, revenueEstimate: null },
                  { opens, highs, lows, closes, volumes, earningsDayIndex: idx }
                )
                earningsSignals.push({
                  ...signal,
                  detectedFrom: 'Volume surge + bullish candle',
                  daysAgo: lookback,
                  stockName: data.name,
                })
                break // Only one signal per stock
              }
            }
          }

          // Scan for bulk deal-like activity (single day with extremely high volume)
          for (let lookback = 1; lookback <= 3; lookback++) {
            const idx = closes.length - lookback
            if (idx < 51) continue

            const avgVol = calcAvgVolume(volumes.slice(0, idx), 20)
            if (!avgVol || avgVol <= 0) continue
            const volRatio = volumes[idx] / avgVol

            if (volRatio >= 5.0) {
              const signal = analyzeBulkDeal(
                {
                  symbol, date: new Date(Date.now() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10), dealType: 'BULK',
                  buyerName: 'Detected from volume spike', buyerCategory: 'DII',
                  quantityShares: Math.round(volumes[idx] * 0.3), pricePerShare: closes[idx],
                  stakePct: 0.8, totalDealValueCr: Math.round(volumes[idx] * closes[idx] / 1e7),
                },
                data
              )
              if (signal.score >= 2) {
                bulkDealSignals.push({
                  ...signal,
                  detectedFrom: `${volRatio.toFixed(1)}× volume spike`,
                  daysAgo: lookback,
                  stockName: data.name,
                })
              }
              break
            }
          }
        }

        // Sort by quality
        earningsSignals.sort((a, b) => b.qualityScore - a.qualityScore)
        bulkDealSignals.sort((a, b) => b.qualityScore - a.qualityScore)

        // 3. Generate calendar
        const currentYear = new Date().getFullYear()
        const rbiCalendar = generateRBICalendar(currentYear)
        const earningsSeasons = getEarningsSeasonDates(currentYear)
        const indexRebalances = getIndexRebalanceDates(currentYear)

        // Find next upcoming events
        const today = new Date(Date.now() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10)
        const upcomingRBI = rbiCalendar.filter(e => e.date >= today).slice(0, 2)
        const currentEarningsSeason = earningsSeasons.find(e => today >= e.startDate && today <= e.endDate)
        const upcomingRebalances = indexRebalances.filter(e => e.date >= today).slice(0, 2)

        send('result', {
          earningsSignals: earningsSignals.slice(0, 20),
          bulkDealSignals: bulkDealSignals.slice(0, 15),
          calendar: { upcomingRBI, currentEarningsSeason, upcomingRebalances, rbiCalendar, earningsSeasons, indexRebalances },
          summary: {
            totalStocksScanned: fetchedCount,
            earningsTriggered: earningsSignals.filter(s => s.triggered).length,
            earningsCandidates: earningsSignals.length,
            bulkDealTriggered: bulkDealSignals.filter(s => s.triggered).length,
            bulkDealCandidates: bulkDealSignals.length,
          },
          config: DEFAULT_ED_CONFIG,
          fetchStats: { totalSymbols: total, successfulFetches: fetchedCount, failedFetches: errorCount },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Event-driven scan failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
  })
}
