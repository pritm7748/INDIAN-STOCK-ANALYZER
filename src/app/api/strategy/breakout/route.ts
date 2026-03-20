import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { analyzeBreakout, detectConsolidationBase, detectVCP, r2 } from '@/lib/strategy/breakout'

const MIDCAP_SYMBOLS = [
  'TATAMOTORS.NS','HINDALCO.NS','TATAPOWER.NS','IRCTC.NS','POLYCAB.NS',
  'ASTRAL.NS','DEEPAKNTR.NS','PERSISTENT.NS','COFORGE.NS','ATUL.NS',
  'SYNGENE.NS','AUROPHARMA.NS','MUTHOOTFIN.NS','FEDERALBNK.NS','CUMMINSIND.NS',
  'TRENT.NS','OBEROIRLTY.NS','MAXHEALTH.NS','SUNDRMFAST.NS','BSE.NS',
  'CONCOR.NS','LINDEINDIA.NS','ESCORTS.NS','MRF.NS','PAGEIND.NS',
  'JUBLFOOD.NS','VOLTAS.NS','HONAUT.NS','AIAENG.NS','CROMPTON.NS',
]

export async function GET() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: any) => {
        ctrl.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send('status', { message: 'Fetching stock data for breakout scan...' })

        const allSignals: any[] = []
        const watchlist: any[] = []
        let succeeded = 0, failed = 0

        for (let i = 0; i < MIDCAP_SYMBOLS.length; i++) {
          const sym = MIDCAP_SYMBOLS[i]
          send('progress', { scanned: i + 1, total: MIDCAP_SYMBOLS.length, pct: Math.round(((i + 1) / MIDCAP_SYMBOLS.length) * 100) })

          try {
            const endDate = new Date()
            const startDate = new Date()
            startDate.setMonth(startDate.getMonth() - 12)

            const result: any[] = await (yahooFinance as any).historical(sym, {
              period1: startDate.toISOString().slice(0, 10),
              period2: endDate.toISOString().slice(0, 10),
            })

            if (!result || result.length < 230) { failed++; continue }

            const opens = result.map((r: any) => r.open)
            const highs = result.map((r: any) => r.high)
            const lows = result.map((r: any) => r.low)
            const closes = result.map((r: any) => r.close)
            const volumes = result.map((r: any) => r.volume)

            const stock = {
              symbol: sym.replace('.NS', ''),
              opens, highs, lows, closes, volumes,
              avgDailyTurnoverCr: r2((volumes.slice(-20).reduce((s: number, v: number) => s + v, 0) / 20 * closes[closes.length - 1]) / 10000000),
            }

            const signal = analyzeBreakout(stock, endDate.toISOString().slice(0, 10))

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
            succeeded++
          } catch {
            failed++
          }
        }

        allSignals.sort((a, b) => b.qualityScore - a.qualityScore)

        send('result', {
          signals: allSignals,
          watchlist: watchlist.slice(0, 15),
          totalScanned: MIDCAP_SYMBOLS.length,
          fetchStats: { totalSymbols: MIDCAP_SYMBOLS.length, successfulFetches: succeeded, failedFetches: failed },
        })

        send('done', {})
      } catch (err: any) {
        ctrl.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`))
      }
      ctrl.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
