// src/app/api/screener/route.ts

import { NextResponse } from 'next/server'
import {
  initializeCache,
  filterStocks,
  getCacheStats,
  getScanProgress,
  startFullScan,
  ScreenerFilters
} from '@/lib/screener/screener-cache'
import { SCREENER_PRESETS } from '@/lib/screener/types'

// ============================================================
// POST - Run screener with filters (uses cache)
// ============================================================
export async function POST(request: Request) {
  try {
    // Initialize cache (loads from file if exists)
    await initializeCache()

    const body = await request.json()
    const filters: ScreenerFilters = body.filters || {}
    const limit = Math.min(body.limit || 50, 100)
    const offset = body.offset || 0
    const sortBy = body.sortBy || 'changePercent'
    const sortOrder = body.sortOrder || 'desc'

    console.log('📊 Screener request with filters:', filters)

    // Get cache stats
    const cacheStats = getCacheStats()
    const scanProgress = getScanProgress()

    // If cache is empty, trigger a scan and return early
    if (cacheStats.cachedStocks === 0) {
      await startFullScan()
      return NextResponse.json({
        results: [],
        total: 0,
        cache: cacheStats,
        scan: getScanProgress(),
        message: 'Scan started - please wait for initial data load',
        timestamp: new Date().toISOString()
      })
    }

    // Filter stocks from cache (instant!)
    let results = filterStocks(filters)

    // Sort results
    results.sort((a, b) => {
      let aVal: number = 0
      let bVal: number = 0

      switch (sortBy) {
        case 'changePercent':
          aVal = a.changePercent
          bVal = b.changePercent
          break
        case 'rsi':
          aVal = a.rsi
          bVal = b.rsi
          break
        case 'pe':
          aVal = a.pe || 999
          bVal = b.pe || 999
          break
        case 'marketCap':
          aVal = a.marketCap
          bVal = b.marketCap
          break
        case 'volume':
          aVal = a.volumeRatio
          bVal = b.volumeRatio
          break
        default:
          aVal = a.changePercent
          bVal = b.changePercent
      }

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })

    const total = results.length

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit)

    // Map to expected format
    const mappedResults = paginatedResults.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      price: stock.price,
      change: stock.change,
      changePercent: stock.changePercent,
      rsi: stock.rsi,
      sma50: stock.sma50,
      sma200: stock.sma200,
      macdSignal: stock.macdSignal,
      pe: stock.pe,
      marketCap: stock.marketCap,
      volume: stock.volume,
      avgVolume: stock.avgVolume,
      volumeRatio: stock.volumeRatio,
      fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stock.fiftyTwoWeekLow,
      distanceFrom52High: stock.distanceFrom52High,
      distanceFrom52Low: stock.distanceFrom52Low,
      goldenCross: stock.goldenCross,
      deathCross: stock.deathCross,
      aboveSMA50: stock.aboveSMA50,
      aboveSMA200: stock.aboveSMA200,
      matchedFilters: generateMatchedFilters(stock, filters)
    }))

    return NextResponse.json({
      results: mappedResults,
      total,
      hasMore: total > offset + limit,
      cache: {
        ...cacheStats,
        ageMinutes: Math.round(cacheStats.cacheAge / 60000)
      },
      scan: scanProgress,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Screener error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================================
// GET - Get presets or trigger refresh
// ============================================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const preset = searchParams.get('preset')

  try {
    await initializeCache()

    // Trigger refresh
    if (action === 'refresh') {
      const progress = await startFullScan()
      return NextResponse.json({
        message: 'Scan started',
        scan: progress,
        cache: getCacheStats()
      })
    }

    // Get cache status
    if (action === 'status') {
      return NextResponse.json({
        scan: getScanProgress(),
        cache: getCacheStats(),
        timestamp: new Date().toISOString()
      })
    }

    // Get specific preset filters
    if (preset) {
      const presetData = SCREENER_PRESETS.find(p => p.id === preset)
      if (presetData) {
        return NextResponse.json({ preset: presetData })
      }
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    // Return all presets
    return NextResponse.json({
      presets: SCREENER_PRESETS,
      cache: getCacheStats()
    })
  } catch (error: any) {
    console.error('Screener GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================================
// HELPERS
// ============================================================

function generateMatchedFilters(stock: any, filters: ScreenerFilters): string[] {
  const matched: string[] = []

  if (filters.rsiMin !== undefined || filters.rsiMax !== undefined) {
    matched.push(`RSI: ${stock.rsi.toFixed(1)}`)
  }
  if (filters.aboveSMA50 && stock.aboveSMA50) matched.push('Above SMA50')
  if (filters.aboveSMA200 && stock.aboveSMA200) matched.push('Above SMA200')
  if (filters.goldenCross && stock.goldenCross) matched.push('Golden Cross')
  if (filters.deathCross && stock.deathCross) matched.push('Death Cross')
  if (filters.macdBullish && stock.macdSignal === 'BULLISH') matched.push('MACD Bullish')
  if (filters.macdBearish && stock.macdSignal === 'BEARISH') matched.push('MACD Bearish')
  if (filters.near52WeekHigh) matched.push('Near 52W High')
  if (filters.near52WeekLow) matched.push('Near 52W Low')
  if (filters.volumeSpike && stock.volumeRatio >= 2) matched.push('Volume Spike')
  if (stock.sector && filters.sectors?.includes(stock.sector)) matched.push(`Sector: ${stock.sector}`)
  if ((filters.peMin || filters.peMax) && stock.pe) matched.push(`P/E: ${stock.pe.toFixed(1)}`)

  return matched
}