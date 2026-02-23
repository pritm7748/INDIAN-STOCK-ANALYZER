// src/app/api/quote/route.ts

import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

// Initialize the yahoo-finance2 client (required in v3+)
const yahooFinance = new YahooFinance()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }

  try {
    const quote = await yahooFinance.quote(symbol) as any

    if (!quote) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    return NextResponse.json({
      symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      previousClose: quote.regularMarketPreviousClose || 0,
      dayHigh: quote.regularMarketDayHigh || 0,
      dayLow: quote.regularMarketDayLow || 0,
      volume: quote.regularMarketVolume || 0,
      avgVolume: quote.averageDailyVolume10Day || quote.averageVolume || 0,
    })
  } catch (error: any) {
    console.error(`Quote error for ${symbol}:`, error.message)
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
  }
}