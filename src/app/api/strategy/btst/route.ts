// src/app/api/strategy/btst/route.ts
// Streams BTST/STBT analysis across ~500 stocks via SSE
// Uses 1y daily data (single API call per stock) + Nifty 50 for market context

import yahooFinance from 'yahoo-finance2'
import {
  runBTSTBacktest, scanBTST, scoreBTST, preTradeGate, evaluateBTST, evaluateSTBT,
  BTST_CONFIG, FNO_SYMBOLS, gapHistory,
} from '@/lib/strategy/btst'
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
        // 1y daily data
        const endDate = new Date()
        const startDate = new Date()
        startDate.setFullYear(endDate.getFullYear() - 1)
        const period1 = startDate.toISOString().split('T')[0]
        const period2 = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0]

        // ── Step 1: Fetch Nifty 50 ──
        send('status', { message: 'Fetching Nifty 50 data for market context...' })
        let niftyCandles: any[] = []
        let niftyCloses: number[] = []
        let niftyChangePercent = 0
        let niftyPositive = true

        try {
          const niftyResult = await yf.chart('^NSEI', { period1, period2, interval: '1d' } as any) as any
          if (niftyResult?.quotes) {
            niftyCandles = niftyResult.quotes
              .filter((q: any) => q.close !== null && q.open !== null)
              .map((q: any) => ({
                date: new Date(q.date).toISOString().split('T')[0],
                open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume || 0,
              }))
            niftyCloses = niftyCandles.map((c: any) => c.close)
            if (niftyCandles.length >= 2) {
              const last = niftyCandles[niftyCandles.length - 1]
              const prev = niftyCandles[niftyCandles.length - 2]
              // P1: Use open-to-close (consistent with backtest)
              niftyChangePercent = ((last.close - last.open) / last.open) * 100
              niftyPositive = niftyChangePercent > 0
            }
          }
        } catch { /* continue without Nifty */ }

        // ── Step 2: Fetch India VIX (optional) ──
        let indiaVix: number | null = null
        try {
          const vixResult = await yf.chart('^INDIAVIX', { period1: new Date(endDate.getTime() - 7 * 86400000).toISOString().split('T')[0], period2, interval: '1d' } as any) as any
          if (vixResult?.quotes?.length > 0) {
            const lastVix = vixResult.quotes.filter((q: any) => q.close !== null).pop()
            if (lastVix) indiaVix = Math.round(lastVix.close * 100) / 100
          }
        } catch { /* VIX not available */ }

        const market = { niftyPositive, niftyChangePercent: Math.round(niftyChangePercent * 100) / 100, indiaVix, niftyCloses }

        // ── Step 3: Risk Gate ──
        const riskGate = preTradeGate(market)
        send('riskGate', riskGate)

        // ── Step 4: Scan all stocks ──
        const allSymbols = STOCK_LIST.map((s: any) => typeof s === 'string' ? s : s.symbol)
        const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE)
        send('status', { message: `Scanning ${allSymbols.length} stocks for BTST/STBT setups (daily data)...` })

        const stockResults: any[] = []
        const allStockCandles: Record<string, any[]> = {}
        let scannedCount = 0
        let errorCount = 0

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = allSymbols.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (symbol: string) => {
              const nsSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
              const cleanSymbol = symbol.replace('.NS', '')

              const chartResult = await yf.chart(nsSymbol, { period1, period2, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 60) throw new Error('Insufficient data')

              const quotes = chartResult.quotes.filter((q: any) =>
                q.open !== null && q.close !== null && q.volume !== null
              )
              const candles = quotes.map((q: any) => ({
                date: new Date(q.date).toISOString().split('T')[0],
                open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume,
              }))

              allStockCandles[cleanSymbol] = candles
              const isFnO = FNO_SYMBOLS.has(cleanSymbol)
              const lastPrice = candles[candles.length - 1]?.close ?? 0

              // Today's BTST/STBT evaluation
              let candidate: any = null
              if (candles.length >= BTST_CONFIG.LOOKBACK_DAILY + 2) {
                if (market.niftyPositive) {
                  const result = evaluateBTST(cleanSymbol, candles, isFnO, market)
                  if (result.passed) candidate = result
                } else {
                  const result = evaluateSTBT(cleanSymbol, candles, isFnO, market)
                  if (result.passed) candidate = result
                }
              }

              // Gap history for display
              const gaps = candles.length >= 60 ? gapHistory(candles, 120) : null

              return {
                symbol: cleanSymbol,
                lastPrice: Math.round(lastPrice * 100) / 100,
                isFnO,
                candidate,
                gapHistory: gaps ? {
                  avgGap: gaps.overall.avg,
                  gapUpProb: gaps.afterBullishDay.upProb,
                  gapDownProb: gaps.afterBearishDay?.upProb ?? 0,
                  bullishDayCount: gaps.afterBullishDay.count,
                } : null,
                totalCandles: candles.length,
              }
            })
          )

          for (const r of results) {
            scannedCount++
            if (r.status === 'fulfilled') { stockResults.push(r.value) }
            else { errorCount++ }
          }

          send('progress', {
            scanned: scannedCount, total: allSymbols.length, errors: errorCount,
            batch: batchIdx + 1, totalBatches,
            message: `Scanned ${scannedCount}/${allSymbols.length} stocks...`,
          })
        }

        // ── Step 5: Score and rank candidates ──
        const rawCandidates = stockResults.filter(s => s.candidate !== null).map(s => s.candidate)
        const scoredCandidates = scoreBTST(rawCandidates)

        // ── Step 6: Run aggregate backtest on stocks that had candidates ──
        send('status', { message: 'Running backtest simulation...' })
        const backtestResult = runBTSTBacktest(allStockCandles, niftyCandles, { exitMode: 'OPEN' })

        // ── Step 7: Compile results ──
        // Per-stock backtest win rates
        const stockTradeMap: Record<string, any[]> = {}
        for (const t of backtestResult.trades) {
          if (!stockTradeMap[t.symbol]) stockTradeMap[t.symbol] = []
          stockTradeMap[t.symbol].push(t)
        }
        const topStocksByWinRate = Object.entries(stockTradeMap)
          .filter(([, trades]) => trades.length >= 3)
          .map(([symbol, trades]) => {
            const wins = trades.filter(t => t.result === 'WIN').length
            return {
              symbol, trades: trades.length,
              winRate: Math.round((wins / trades.length) * 10000) / 100,
              avgPnl: Math.round(trades.reduce((s, t) => s + t.pnlPercent, 0) / trades.length * 100) / 100,
              isFnO: FNO_SYMBOLS.has(symbol),
            }
          })
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 15)

        send('result', {
          market: {
            niftyChange: market.niftyChangePercent,
            niftyPositive: market.niftyPositive,
            indiaVix: market.indiaVix,
            scanDirection: market.niftyPositive ? 'BTST (Long)' : 'STBT (Short)',
          },
          riskGate,
          candidates: scoredCandidates.slice(0, 20).map(c => ({
            rank: c.rank,
            symbol: c.symbol,
            direction: c.direction,
            grade: c.scoring?.grade,
            score: c.compositeScore,
            action: c.scoring?.recommendation.action,
            confidence: c.scoring?.recommendation.confidence,
            dayChange: c.indicators.dayChange,
            closingStrength: c.indicators.closingStrength,
            volumeRatio: c.indicators.volumeRatio,
            rsi14: c.indicators.rsi14,
            ema20: c.indicators.ema20,
            atr14: c.indicators.atr14,
            close: c.indicators.close,
            deliveryEst: c.indicators.deliveryEstimate,
            gapUpProb: c.gapHistory?.afterBullishDay?.upProb ?? null,
            isFnO: FNO_SYMBOLS.has(c.symbol),
            // P0: Exit rules / trade management
            stopLoss: c.indicators.atr14
              ? Math.round((c.direction === 'LONG'
                ? c.indicators.close - c.indicators.atr14 * BTST_CONFIG.SL_ATR_MULTIPLE
                : c.indicators.close + c.indicators.atr14 * BTST_CONFIG.SL_ATR_MULTIPLE) * 100) / 100
              : Math.round((c.direction === 'LONG'
                ? c.indicators.close * (1 - BTST_CONFIG.FALLBACK_SL_PCT / 100)
                : c.indicators.close * (1 + BTST_CONFIG.FALLBACK_SL_PCT / 100)) * 100) / 100,
            slPct: c.indicators.atr14
              ? Math.round((c.indicators.atr14 * BTST_CONFIG.SL_ATR_MULTIPLE / c.indicators.close) * 10000) / 100
              : BTST_CONFIG.FALLBACK_SL_PCT,
            target: c.indicators.atr14
              ? Math.round((c.direction === 'LONG'
                ? c.indicators.close + c.indicators.atr14 * BTST_CONFIG.TARGET_ATR_MULTIPLE
                : c.indicators.close - c.indicators.atr14 * BTST_CONFIG.TARGET_ATR_MULTIPLE) * 100) / 100
              : Math.round((c.direction === 'LONG' ? c.indicators.close * 1.025 : c.indicators.close * 0.975) * 100) / 100,
            exitRules: {
              primary: 'Sell at next day open',
              stopLoss: c.indicators.atr14 ? `${BTST_CONFIG.SL_ATR_MULTIPLE}× ATR below entry` : `${BTST_CONFIG.FALLBACK_SL_PCT}% below entry`,
              target: c.indicators.atr14 ? `${BTST_CONFIG.TARGET_ATR_MULTIPLE}× ATR above entry` : '2.5% above entry',
              riskPerTrade: `${BTST_CONFIG.MAX_RISK_PER_TRADE * 100}% of capital`,
            },
          })),
          backtest: backtestResult.summary,
          drawdown: backtestResult.drawdown,
          topStocksByWinRate,
          totalStocksScanned: scannedCount,
          totalErrors: errorCount,
          totalCandidates: rawCandidates.length,
        })

        send('done', { total: scannedCount, errors: errorCount })
      } catch (err: any) {
        send('error', { message: err.message || 'Unknown error' })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
