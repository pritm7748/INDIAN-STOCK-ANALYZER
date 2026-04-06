// src/app/api/strategy/weekly-breakout/route.ts
// Streams Weekly Breakout/Breakdown analysis via SSE
// Uses 1y daily data → builds weekly candles → weekend scan + backtest

import yahooFinance from 'yahoo-finance2'
import { weekendScan, runWeeklyBacktest, preWeekGate, FNO_SET } from '@/lib/strategy/weekly-breakout'
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
        const riskGate = preWeekGate({ indiaVix, regime: null })
        send('riskGate', riskGate)

        // ── 4. Scan stocks ──
        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)
        send('status', { message: `Scanning ${allSymbols.length} stocks for weekly breakout setups...` })

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

        // ── 5. Weekend scan (today's candidates) ──
        send('status', { message: 'Running weekend scan analysis...' })
        const stocksForScan = Object.entries(allStockCandles).map(([sym, candles]) => ({ symbol: sym, dailyCandles: candles }))
        const scanResult = weekendScan(stocksForScan, niftyCandles)

        // ── 6. Backtest ──
        send('status', { message: 'Running backtest...' })
        const btResult = runWeeklyBacktest(allStockCandles, niftyCandles)

        // ── 7. Per-stock stats ──
        const stockMap: Record<string, any[]> = {}
        for (const t of btResult.trades) { if (!stockMap[t.symbol]) stockMap[t.symbol] = []; stockMap[t.symbol].push(t) }
        const topStocks = Object.entries(stockMap)
          .filter(([, trades]) => trades.length >= 3)
          .map(([sym, trades]) => ({
            symbol: sym, trades: trades.length,
            winRate: Math.round((trades.filter(t => t.result === 'WIN').length / trades.length) * 10000) / 100,
            avgPnl: Math.round(trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length * 100) / 100,
            isFnO: FNO_SET.has(sym),
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 15)

        send('result', {
          market: { niftyTrend: scanResult.niftyTrend, regime: scanResult.regime, indiaVix },
          riskGate,
          breakoutWatch: scanResult.breakoutWatch.slice(0, 15).map((c: any) => ({
            symbol: c.symbol, direction: c.direction, weekendScore: c.weekendScore, isFnO: c.isFnO,
            pwHigh: c.pw.pwHigh, pwLow: c.pw.pwLow, pwRangePct: c.pw.pwRangePct,
            pwClosePos: c.pw.pwClosePos, pwCandleType: c.pw.pwCandleType,
            baseClass: c.base?.classification || 'NONE', baseWeeks: c.base?.baseWeeks || 0,
            rsRank: c.relativeStrength?.rsRank || '-', rsScore: c.relativeStrength?.rsScore || 0,
            volPattern: c.volumePattern?.pattern || '-', accumScore: c.volumePattern?.accumScore || 0,
            w52Position: c.fiftyTwoWeek?.position || 0, nearHighZone: c.fiftyTwoWeek?.nearHighZone || false,
            falseRate: c.falseBreakoutHistory?.falseRate || 0,
            rsi14: c.indicators?.rsi14, atr14: c.indicators?.atr14,
            triggerPrice: c.levels.breakoutTrigger, stopLoss: c.levels.stopLossLong,
            target: c.levels.targetLong,
          })),
          breakdownWatch: scanResult.breakdownWatch.slice(0, 10).map((c: any) => ({
            symbol: c.symbol, direction: c.direction, weekendScore: c.weekendScore, isFnO: c.isFnO,
            pwHigh: c.pw.pwHigh, pwLow: c.pw.pwLow, pwRangePct: c.pw.pwRangePct,
            triggerPrice: c.levels.breakdownTrigger, stopLoss: c.levels.stopLossShort,
            target: c.levels.targetShort, rsi14: c.indicators?.rsi14,
          })),
          backtest: btResult.summary,
          analysis: btResult.analysis,
          topStocks,
          totalStocksScanned: scannedCount, totalErrors: errorCount,
          totalBreakoutCandidates: scanResult.breakoutWatch.length,
          totalBreakdownCandidates: scanResult.breakdownWatch.length,
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
