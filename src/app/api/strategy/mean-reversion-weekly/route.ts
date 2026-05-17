// src/app/api/strategy/mean-reversion-weekly/route.ts
// SSE route for Strategy 9: Short-Term Mean Reversion (1-Week Hold)
// 3 sub-strategies + confluence, decline typing, multi-TF, prior bounce

import yahooFinance from 'yahoo-finance2'
import { scanMRWeekly, runMRWBacktest, preMRGate } from '@/lib/strategy/mean-reversion-weekly'
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
        const riskGate = preMRGate({ indiaVix })
        send('riskGate', riskGate)

        // ── 4. Scan stocks ──
        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)
        send('status', { message: `Scanning ${allSymbols.length} stocks for mean reversion setups...` })

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
        send('status', { message: 'Running mean reversion analysis (3 sub-strategies)...' })
        const stocksForScan = Object.entries(allStockCandles).map(([sym, candles]) => ({ symbol: sym, dailyCandles: candles }))
        const scanResult = scanMRWeekly(stocksForScan, niftyCandles, indiaVix)

        // ── 6. Backtest ──
        send('status', { message: 'Running backtest...' })
        const btResult = runMRWBacktest(allStockCandles, niftyCandles, { vix: indiaVix ?? 14 })

        // ── 7. Top stocks ──
        const stockMap: Record<string, any[]> = {}
        for (const t of btResult.trades) { if (!stockMap[t.symbol]) stockMap[t.symbol] = []; stockMap[t.symbol].push(t) }
        const topStocks = Object.entries(stockMap)
          .filter(([, trades]) => trades.length >= 3)
          .map(([sym, trades]) => ({
            symbol: sym, trades: trades.length,
            winRate: Math.round((trades.filter(t => t.result === 'WIN').length / trades.length) * 10000) / 100,
            avgPnl: Math.round(trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length * 100) / 100,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 15)

        // per-stock stats for enrichment
        const stockStats: Record<string, { trades: number; winRate: number; avgPnl: number }> = {}
        for (const [sym, tds] of Object.entries(stockMap)) {
          const wins = tds.filter(t => t.result === 'WIN').length
          stockStats[sym] = { trades: tds.length, winRate: Math.round((wins / tds.length) * 10000) / 100, avgPnl: Math.round(tds.reduce((s, t) => s + t.pnlPct, 0) / tds.length * 100) / 100 }
        }

        const formatCandidate = (c: any) => {
          const hist = stockStats[c.symbol]
          const entry = c.entryType === 'STOP_BUY' && c.triggerPrice ? c.triggerPrice : c.scanClose
          const sl = c.stopLoss, t1 = c.target1 || c.scanClose, t2 = c.target2 || c.scanClose
          const risk = Math.abs(entry - sl)
          const rr1 = risk > 0 ? Math.round(Math.abs(t1 - entry) / risk * 100) / 100 : 0
          const rr2 = risk > 0 ? Math.round(Math.abs(t2 - entry) / risk * 100) / 100 : 0
          const slPct = entry > 0 ? Math.round(((entry - sl) / entry) * 10000) / 100 : 0
          const tgtPct = entry > 0 ? Math.round(((t1 - entry) / entry) * 10000) / 100 : 0
          const s = c.compositeScore + (hist && hist.winRate > 60 ? 10 : 0)
          const grade = s >= 80 ? 'A' : s >= 60 ? 'B' : 'C'
          return {
            symbol: c.symbol, compositeScore: c.compositeScore, primary: c.primary,
            strategies: c.strategies, isConfluence: c.isConfluence,
            action: 'BUY', entryType: c.entryType === 'STOP_BUY' ? `BUY above \u20b9${c.triggerPrice}` : 'BUY at market open',
            entryPrice: entry, triggerPrice: c.triggerPrice,
            scanClose: c.scanClose, stopLoss: sl, target1: t1, target2: t2,
            riskReward1: rr1, riskReward2: rr2, slPct, tgtPct, grade,
            btWinRate: hist?.winRate ?? null, btTrades: hist?.trades ?? 0, btAvgPnl: hist?.avgPnl ?? null,
            rsi2: c.indicators.rsi2, rsi14: c.indicators.rsi14, atr14: c.indicators.atr14,
            volRatio: c.indicators.volRatio, downDays: c.indicators.downDays,
            avgVolume: c.indicators.avgVolume,
            declineType: c.decline?.type, declineSafe: c.decline?.safe,
            multiTFBoth: c.multiTF?.bothOversold, priorSupport: c.priorBounce?.isProvenSupport,
            atKeyMA: c.maPattern?.atKeyMA, nearestMA: c.maPattern?.nearest?.ma,
            bounceReliable: c.bounceHistory?.isReliable, bounceWR: c.bounceHistory?.winRate,
            patternType: c.patternType, patternScore: c.patternScore,
            bb: c.bb, dist200: c.dist200, above200: c.above200,
            regime: c.regime?.regime,
            exitRules: c.exitRules || null,
            gapRisk: c.gapRisk || null,
          }
        }

        send('result', {
          market: { regime: scanResult.regime, indiaVix },
          riskGate,
          strategyA: scanResult.strategyA.slice(0, 10).map(formatCandidate),
          strategyB: scanResult.strategyB.slice(0, 10).map(formatCandidate),
          strategyC: scanResult.strategyC.slice(0, 10).map(formatCandidate),
          confluence: scanResult.confluence.slice(0, 10).map(formatCandidate),
          backtest: btResult.summary,
          analysis: btResult.analysis,
          strategyComparison: btResult.strategyComparison,
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
