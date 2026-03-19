import { NextRequest } from 'next/server'
import { STOCK_LIST } from '@/lib/stockList'
import yahooFinance from 'yahoo-finance2'
import {
  scanUniverse,
  MRStockData,
  DEFAULT_MR_CONFIG,
} from '@/lib/strategy/mean-reversion'

export const dynamic = 'force-dynamic'

async function fetchOHLCV(symbol: string) {
  try {
    const ticker = `${symbol}.NS`
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 12) // 12 months for 200-SMA + buffer
    const result: any = await yahooFinance.chart(ticker, {
      period1: start,
      period2: end,
      interval: '1d',
    })
    if (!result?.quotes?.length) return null
    const quotes = result.quotes.filter(
      (q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null
    )
    if (quotes.length < 50) return null
    return {
      opens: quotes.map((q: any) => q.open),
      highs: quotes.map((q: any) => q.high),
      lows: quotes.map((q: any) => q.low),
      closes: quotes.map((q: any) => q.close),
      volumes: quotes.map((q: any) => q.volume),
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  const abortController = new AbortController()

  req.signal.addEventListener('abort', () => abortController.abort())

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: any) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        const allStocks = STOCK_LIST
        const total = allStocks.length
        let scanned = 0
        let signalCount = 0
        let watchlistCount = 0
        let filteredCount = 0

        send({ type: 'status', message: 'Starting Mean Reversion scan...', total })

        // Fetch Nifty 50 data for market regime check
        let niftyCloses: number[] = []
        try {
          const niftyData = await fetchOHLCV('^NSEI'.replace('.NS', ''))
          if (niftyData) niftyCloses = niftyData.closes
        } catch {
          // If Nifty fetch fails, use empty array — regime = UNKNOWN
        }

        // Try fetching Nifty directly
        if (niftyCloses.length === 0) {
          try {
            const end = new Date()
            const start = new Date()
            start.setMonth(start.getMonth() - 12)
            const result: any = await yahooFinance.chart('^NSEI', { period1: start, period2: end, interval: '1d' })
            if (result?.quotes?.length) {
              niftyCloses = result.quotes.filter((q: any) => q.close != null).map((q: any) => q.close)
            }
          } catch { /* continue without Nifty data */ }
        }

        const BATCH_SIZE = 8
        const stockDataList: MRStockData[] = []

        for (let i = 0; i < total; i += BATCH_SIZE) {
          if (abortController.signal.aborted) break

          const batch = allStocks.slice(i, i + BATCH_SIZE)
          const results = await Promise.allSettled(
            batch.map(async (stock) => {
              const ohlcv = await fetchOHLCV(stock.symbol)
              if (!ohlcv) return null
              return {
                symbol: stock.symbol,
                name: stock.name,
                sector: stock.sector || '',
                ...ohlcv,
              } as MRStockData
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
              stockDataList.push(r.value)
            }
          }

          scanned = Math.min(i + BATCH_SIZE, total)
          const pct = Math.round((scanned / total) * 100)

          send({
            type: 'progress',
            scanned,
            total,
            pct,
            message: `Scanning ${scanned}/${total} stocks...`,
          })
        }

        // Run the scan
        const currentDate = new Date().toISOString().slice(0, 10)
        const scanResult = scanUniverse(stockDataList, niftyCloses, currentDate)

        signalCount = scanResult.signalCount
        watchlistCount = scanResult.watchlist.length
        filteredCount = scanResult.totalFiltered

        send({
          type: 'result',
          data: scanResult,
          summary: {
            totalScanned: scanResult.totalScanned,
            signalCount,
            watchlistCount,
            filteredCount,
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
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
