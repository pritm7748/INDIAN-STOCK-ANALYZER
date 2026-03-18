// src/app/api/strategy/momentum/route.ts
// Runs the Momentum Trading Strategy on a curated set of liquid NSE stocks

import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'
import { generateMomentumPortfolio, StockData, DEFAULT_CONFIG } from '@/lib/strategy/momentum'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()

// Use a subset of highly liquid large-cap + mid-cap stocks to keep API fast
// Pick ~50 diverse, liquid stocks from the list
const MOMENTUM_UNIVERSE_SYMBOLS = [
  // Large-cap blue chips
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
  'BHARTIARTL.NS', 'SBIN.NS', 'LT.NS', 'ITC.NS', 'HINDUNILVR.NS',
  'KOTAKBANK.NS', 'BAJFINANCE.NS', 'MARUTI.NS', 'ASIANPAINT.NS', 'TITAN.NS',
  'SUNPHARMA.NS', 'HCLTECH.NS', 'AXISBANK.NS', 'WIPRO.NS', 'ULTRACEMCO.NS',
  // Mid-cap momentum candidates
  'TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDALCO.NS', 'ADANIENT.NS', 'ADANIPORTS.NS',
  'BAJAJFINSV.NS', 'TECHM.NS', 'DRREDDY.NS', 'CIPLA.NS', 'DIVISLAB.NS',
  'TATAPOWER.NS', 'POWERGRID.NS', 'NTPC.NS', 'BPCL.NS', 'ONGC.NS',
  'COALINDIA.NS', 'GRASIM.NS', 'NESTLEIND.NS', 'BRITANNIA.NS', 'EICHERMOT.NS',
  'HEROMOTOCO.NS', 'TRENT.NS', 'HAL.NS', 'BEL.NS', 'TATACONSUM.NS',
  'INDIGO.NS', 'APOLLOHOSP.NS', 'DLF.NS', 'SHRIRAMFIN.NS', 'PERSISTENT.NS',
  'POLYCAB.NS', 'DIXON.NS', 'PIDILITIND.NS', 'GODREJCP.NS', 'DABUR.NS',
  'CHOLAFIN.NS', 'IRCTC.NS', 'VBL.NS', 'SRF.NS', 'KEI.NS',
]

export async function GET() {
  try {
    // Fetch 1 year of data (need at least 132 trading days + buffer for 6M lookback)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(endDate.getMonth() - 10) // ~10 months
    const period1 = startDate.toISOString().split('T')[0]

    // Fetch Nifty 50 benchmark
    let niftyPrices: number[] = []
    try {
      const niftyResult = await yf.chart('^NSEI', { period1, interval: '1d' } as any) as any
      if (niftyResult?.quotes) {
        niftyPrices = niftyResult.quotes
          .filter((q: any) => q.close !== null)
          .map((q: any) => q.close)
      }
    } catch (e) {
      console.error('Failed to fetch Nifty:', e)
    }

    // Fetch all stocks in parallel (batched to avoid rate limits)
    const BATCH_SIZE = 10
    const universe: StockData[] = []
    const errors: string[] = []

    for (let i = 0; i < MOMENTUM_UNIVERSE_SYMBOLS.length; i += BATCH_SIZE) {
      const batch = MOMENTUM_UNIVERSE_SYMBOLS.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any
            if (!chartResult?.quotes || chartResult.quotes.length < 50) {
              throw new Error(`Insufficient data for ${symbol}`)
            }

            const quotes = chartResult.quotes.filter((q: any) => q.close !== null && q.volume !== null)
            const prices = quotes.map((q: any) => q.close as number)
            const volumes = quotes.map((q: any) => q.volume as number)

            // Estimate avg daily turnover = avg(close * volume) / 1e7 (to get in Cr)
            const last20 = quotes.slice(-20)
            const avgTurnover = last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7

            const stockInfo = STOCK_LIST.find(s => s.symbol === symbol)

            return {
              symbol,
              name: stockInfo?.name || symbol.replace('.NS', ''),
              sector: stockInfo?.sector || 'Unknown',
              prices,
              volumes,
              avgDailyTurnoverCr: avgTurnover,
            } as StockData
          } catch (err: any) {
            throw new Error(`${symbol}: ${err.message}`)
          }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          universe.push(result.value)
        } else {
          errors.push(result.reason?.message || 'Unknown error')
        }
      }
    }

    if (universe.length < 10) {
      return NextResponse.json(
        { error: `Only ${universe.length} stocks fetched successfully. Need at least 10.`, errors },
        { status: 500 }
      )
    }

    // Run the momentum strategy
    const portfolio = generateMomentumPortfolio(universe, niftyPrices, DEFAULT_CONFIG)

    return NextResponse.json({
      ...portfolio,
      fetchStats: {
        totalSymbols: MOMENTUM_UNIVERSE_SYMBOLS.length,
        successfulFetches: universe.length,
        failedFetches: errors.length,
        errors: errors.slice(0, 5),
      },
    })
  } catch (error: any) {
    console.error('Momentum Strategy API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Strategy analysis failed' },
      { status: 500 }
    )
  }
}
