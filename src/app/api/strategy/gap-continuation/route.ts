// src/app/api/strategy/gap-continuation/route.ts
// SSE route for Strategy 11: Gap Continuation Swing (2-5 Days)
// Two-phase: Today's Gaps (watchlist) + Yesterday's Gaps → Today's Entry

import yahooFinance from 'yahoo-finance2'
import { scanGapContinuation, runGapBacktest, preGapGate } from '@/lib/strategy/gap-continuation'
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
        startDate.setFullYear(endDate.getFullYear() - 1)
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        // ── 1. Nifty 50 ──
        send('status', { message: 'Fetching Nifty 50 data...' })
        let niftyCandles: any[] = []
        try {
          const nr = await yf.chart('^NSEI', { period1, period2, interval: '1d' } as any) as any
          if (nr?.quotes) {
            niftyCandles = nr.quotes.filter((q: any) => q.close !== null && q.open !== null)
              .map((q: any) => ({ date: new Date(q.date).toISOString().split('T')[0], open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume || 0 }))
          }
        } catch { /* continue */ }

        // ── 2. India VIX ──
        let indiaVix: number | null = null
        try {
          const vr = await yf.chart('^INDIAVIX', { period1: new Date(endDate.getTime() - 7 * 86400000).toISOString().split('T')[0], period2, interval: '1d' } as any) as any
          if (vr?.quotes?.length > 0) { const lv = vr.quotes.filter((q: any) => q.close !== null).pop(); if (lv) indiaVix = Math.round(lv.close * 100) / 100 }
        } catch { /* skip */ }

        // ── 3. Risk Gate ──
        const riskGate = preGapGate({ indiaVix })
        send('riskGate', riskGate)

        // ── 4. Scan stocks ──
        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)
        send('status', { message: `Scanning ${allSymbols.length} stocks for gap continuation setups...` })

        const allStockCandles: Record<string, any[]> = {}
        let scannedCount = 0, errorCount = 0

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)
          const results = await Promise.allSettled(
            batch.map(async (symbol: string) => {
              const ns = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
              const clean = symbol.replace('.NS', '')
              const cr = await yf.chart(ns, { period1, period2, interval: '1d' } as any) as any
              if (!cr?.quotes || cr.quotes.length < 80) throw new Error('Insufficient')
              const quotes = cr.quotes.filter((q: any) => q.open !== null && q.close !== null && q.volume !== null)
              const candles = quotes.map((q: any) => ({ date: new Date(q.date).toISOString().split('T')[0], open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }))
              allStockCandles[clean] = candles
              return clean
            })
          )
          for (const r of results) { scannedCount++; if (r.status === 'rejected') errorCount++ }
          send('progress', { scanned: scannedCount, total: allSymbols.length, errors: errorCount, batch: batchIdx + 1, totalBatches })
        }

        // ── 5. Live scan ──
        send('status', { message: 'Running gap continuation analysis...' })
        const stocksForScan = Object.entries(allStockCandles).map(([sym, candles]) => ({ symbol: sym, dailyCandles: candles }))
        const scanResult = scanGapContinuation(stocksForScan, niftyCandles, indiaVix)

        // ── 6. Backtest ──
        send('status', { message: 'Running backtest...' })
        const btResult = runGapBacktest(allStockCandles, niftyCandles, { vix: indiaVix ?? 14 })

        // ── 7. Per-stock stats for enrichment ──
        const stockMap: Record<string, any[]> = {}
        for (const t of btResult.trades) { if (!stockMap[t.symbol]) stockMap[t.symbol] = []; stockMap[t.symbol].push(t) }
        const stockStats: Record<string, { trades: number; winRate: number; avgPnl: number }> = {}
        for (const [sym, tds] of Object.entries(stockMap)) {
          const wins = tds.filter(t => t.result === 'WIN').length
          stockStats[sym] = { trades: tds.length, winRate: Math.round((wins / tds.length) * 10000) / 100, avgPnl: Math.round(tds.reduce((s, t) => s + t.pnlPercent, 0) / tds.length * 100) / 100 }
        }

        const topStocks = Object.entries(stockStats)
          .filter(([, s]) => s.trades >= 2)
          .map(([sym, s]) => ({ symbol: sym, ...s }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 15)

        // enrich candidates
        const enrich = (c: any) => {
          const hist = stockStats[c.symbol]
          const gradeBoost = hist && hist.winRate > 60 ? 5 : 0
          const newScore = c.combinedScore + gradeBoost
          const grade = newScore >= 55 ? 'A' : newScore >= 40 ? 'B' : 'C'
          return {
            symbol: c.symbol, direction: c.direction, gapType: c.gapType,
            action: c.direction === 'LONG' ? 'BUY' : 'SELL',
            entryType: c.gapType === 'YESTERDAY_GAP_ENTRY'
              ? (c.direction === 'LONG' ? `BUY at ₹${c.entryPrice}` : `SELL at ₹${c.entryPrice}`)
              : 'Watchlist — enter tomorrow if pullback',
            entryPrice: c.entryPrice, stopLoss: c.stopLoss, slPct: c.slPct,
            target1: c.target1, tgt1Pct: c.tgt1Pct, target2: c.target2, tgt2Pct: c.tgt2Pct,
            riskReward: c.riskReward,
            gapPercent: c.gapData.gapPercent, absGap: c.gapData.absGap,
            closePosition: c.gapData.closePosition, idealClose: c.gapData.idealClose,
            gapExtended: c.gapData.gapExtended, gapFilled: c.gapData.gapFilledIntraday,
            isMarubozu: c.gapData.isMarubozu, hasRejection: c.gapData.hasRejection,
            volRatio: c.volRatio, rsi14: c.rsi14,
            above50SMA: c.trend?.above50SMA, above200SMA: c.trend?.above200SMA,
            nearATH: c.trend?.nearATH, wasConsolidating: c.trend?.wasConsolidating,
            d2OpenType: c.day2?.openType || null, d2Continuation: c.day2?.d2Continuation || null,
            heldGapLow: c.day2?.heldGapDayLow || null,
            gapDayScore: c.gapDayScore, combinedScore: newScore, grade,
            btWinRate: hist?.winRate ?? null, btTrades: hist?.trades ?? 0, btAvgPnl: hist?.avgPnl ?? null,
            gapHistUp: c.gapHistory?.gapUp || null, gapHistDown: c.gapHistory?.gapDown || null,
          }
        }

        send('result', {
          market: { indiaVix },
          riskGate,
          todayGaps: scanResult.todayGaps.slice(0, 15).map(enrich),
          yesterdayEntry: scanResult.yesterdayEntry.slice(0, 10).map(enrich),
          backtest: btResult.summary,
          analysis: btResult.analysis,
          topStocks,
          meta: scanResult.meta,
          totalStocksScanned: scannedCount, totalErrors: errorCount,
        })

        send('done', { total: scannedCount, errors: errorCount })
      } catch (err: any) {
        send('error', { message: err.message || 'Unknown error' })
      } finally { controller.close() }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
