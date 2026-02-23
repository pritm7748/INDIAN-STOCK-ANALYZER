// src/lib/screener/screener-cache.ts

import { RSI, SMA, MACD } from 'technicalindicators'
import { STOCK_LIST } from '@/lib/stockList'
import yahooFinance from 'yahoo-finance2'
import fs from 'fs/promises'
import path from 'path'

// Force Initialization (same pattern as data.ts)
const yf = new (yahooFinance as any)()

// ============================================================
// TYPES
// ============================================================

export interface CachedStockData {
  symbol: string
  name: string
  sector?: string
  // Quote data
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  volumeRatio: number
  pe: number | null
  marketCap: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  distanceFrom52High: number
  distanceFrom52Low: number
  // Technical indicators
  rsi: number
  sma50: number
  sma200: number
  ema9: number
  ema21: number
  macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  macdHistogram: number
  goldenCross: boolean
  deathCross: boolean
  aboveSMA50: boolean
  aboveSMA200: boolean
  // Metadata
  cachedAt: number
  hasError?: boolean
}

export interface ScanProgress {
  scanId: string
  status: 'idle' | 'running' | 'completed' | 'error'
  completed: number
  total: number
  startedAt: number
  completedAt?: number
  error?: string
}

// ============================================================
// CACHE STORAGE
// ============================================================

// In-memory cache
const stockCache = new Map<string, CachedStockData>()
let lastFullScanAt: number = 0
let currentScan: ScanProgress | null = null

// Cache TTLs
const QUOTE_TTL = 15 * 60 * 1000  // 15 minutes for quotes
const TECHNICAL_TTL = 60 * 60 * 1000  // 60 minutes for technicals
const CACHE_FILE = path.join(process.cwd(), '.screener-cache.json')

// ============================================================
// CACHE PERSISTENCE
// ============================================================

export async function loadCacheFromFile(): Promise<void> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(data)

    if (parsed.stocks && Array.isArray(parsed.stocks)) {
      stockCache.clear()
      for (const stock of parsed.stocks) {
        stockCache.set(stock.symbol, stock)
      }
      lastFullScanAt = parsed.lastFullScanAt || 0
      console.log(`📦 Loaded ${stockCache.size} stocks from cache file`)
    }
  } catch (error) {
    // File doesn't exist or is invalid - that's okay
    console.log('📦 No existing cache file found, starting fresh')
  }
}

export async function saveCacheToFile(): Promise<void> {
  try {
    const data = {
      lastFullScanAt,
      stocks: Array.from(stockCache.values()),
      savedAt: Date.now()
    }
    await fs.writeFile(CACHE_FILE, JSON.stringify(data), 'utf-8')
    console.log(`💾 Saved ${stockCache.size} stocks to cache file`)
  } catch (error) {
    console.error('Failed to save cache:', error)
  }
}

// ============================================================
// TECHNICAL CALCULATION
// ============================================================

function calculateTechnicals(closes: number[]): {
  rsi: number
  sma50: number
  sma200: number
  macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  macdHistogram: number
  goldenCross: boolean
  deathCross: boolean
} {
  const rsiValues = RSI.calculate({ values: closes, period: 14 })
  const sma50Values = SMA.calculate({ values: closes, period: 50 })
  const sma200Values = SMA.calculate({ values: closes, period: 200 })

  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  })

  const currentRSI = rsiValues[rsiValues.length - 1] || 50
  const currentSMA50 = sma50Values[sma50Values.length - 1] || 0
  const currentSMA200 = sma200Values[sma200Values.length - 1] || 0
  const prevSMA50 = sma50Values[sma50Values.length - 5] || 0
  const prevSMA200 = sma200Values[sma200Values.length - 5] || 0

  const currentMACD = macdValues[macdValues.length - 1]
  let macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
  let macdHistogram = 0

  if (currentMACD?.histogram !== undefined) {
    macdHistogram = currentMACD.histogram
    if (currentMACD.histogram > 0) macdSignal = 'BULLISH'
    else if (currentMACD.histogram < 0) macdSignal = 'BEARISH'
  }

  // Detect crosses
  const goldenCross = currentSMA50 > currentSMA200 && prevSMA50 <= prevSMA200
  const deathCross = currentSMA50 < currentSMA200 && prevSMA50 >= prevSMA200

  return {
    rsi: currentRSI,
    sma50: currentSMA50,
    sma200: currentSMA200,
    macdSignal,
    macdHistogram,
    goldenCross,
    deathCross
  }
}

// ============================================================
// BATCH FETCHING
// ============================================================

async function fetchQuotesBatch(symbols: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>()
  let errorLogged = false

  // Fetch quotes with limited concurrency
  const concurrency = 10

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency)

    const batchResults = await Promise.allSettled(
      batch.map(async (symbol) => {
        try {
          const quote = await yf.quote(symbol)
          return { symbol, quote }
        } catch (error: any) {
          // Log the first error we encounter to understand the issue
          if (!errorLogged) {
            console.error(`   ⚠️ Quote error for ${symbol}:`, error.message || error)
            errorLogged = true
          }
          return { symbol, quote: null }
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.quote) {
        results.set(result.value.symbol, result.value.quote)
      }
    }

    // Small delay between batches
    if (i + concurrency < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

async function fetchHistoricalData(symbol: string): Promise<number[] | null> {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 12)

    const result: any = await yf.chart(symbol, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d'
    } as any)

    if (!result?.quotes || result.quotes.length < 50) {
      return null
    }

    return result.quotes
      .filter((q: any) => q.close !== null)
      .map((q: any) => q.close)
  } catch (error) {
    return null
  }
}

// ============================================================
// SCANNING
// ============================================================

export async function startFullScan(): Promise<ScanProgress> {
  // Check if already scanning
  if (currentScan?.status === 'running') {
    return currentScan
  }

  const scanId = `scan_${Date.now()}`
  const stocks = [...STOCK_LIST]

  currentScan = {
    scanId,
    status: 'running',
    completed: 0,
    total: stocks.length,
    startedAt: Date.now()
  }

  // Run scan in background (don't await)
  runScanInBackground(stocks, scanId)

  return currentScan
}

async function runScanInBackground(stocks: typeof STOCK_LIST, scanId: string) {
  console.log(`🔍 Starting full scan of ${stocks.length} stocks...`)

  let successCount = 0
  let quoteFailCount = 0
  let historicalFailCount = 0

  try {
    // Process in batches of 40
    const batchSize = 40

    for (let i = 0; i < stocks.length; i += batchSize) {
      // Check if scan was cancelled
      if (!currentScan || currentScan.scanId !== scanId) {
        console.log('Scan cancelled')
        return
      }

      const batch = stocks.slice(i, i + batchSize)
      const symbols = batch.map(s => s.symbol)

      console.log(`📊 Scanning batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocks.length / batchSize)} (${symbols.length} stocks)`)

      // Fetch quotes in batch
      const quotes = await fetchQuotesBatch(symbols)
      console.log(`   📈 Got ${quotes.size}/${symbols.length} quotes`)

      // Fetch historical data and calculate technicals (with concurrency limit)
      const concurrency = 5
      for (let j = 0; j < batch.length; j += concurrency) {
        const subBatch = batch.slice(j, j + concurrency)

        await Promise.all(subBatch.map(async (stock) => {
          try {
            const quote = quotes.get(stock.symbol)
            if (!quote) {
              quoteFailCount++
              return
            }

            // Check if we have recent technical data
            const existing = stockCache.get(stock.symbol)
            let technicals: ReturnType<typeof calculateTechnicals>

            if (existing && Date.now() - existing.cachedAt < TECHNICAL_TTL) {
              // Reuse existing technicals
              technicals = {
                rsi: existing.rsi,
                sma50: existing.sma50,
                sma200: existing.sma200,
                macdSignal: existing.macdSignal,
                macdHistogram: existing.macdHistogram,
                goldenCross: existing.goldenCross,
                deathCross: existing.deathCross
              }
            } else {
              // Fetch fresh historical data
              const closes = await fetchHistoricalData(stock.symbol)
              if (!closes || closes.length < 50) {
                historicalFailCount++
                return
              }
              technicals = calculateTechnicals(closes)
            }

            // Build cached data
            const price = quote.regularMarketPrice || 0
            const avgVolume = quote.averageDailyVolume10Day || quote.averageVolume || 1
            const volume = quote.regularMarketVolume || 0
            const fiftyTwoWeekHigh = quote.fiftyTwoWeekHigh || price
            const fiftyTwoWeekLow = quote.fiftyTwoWeekLow || price

            const cachedData: CachedStockData = {
              symbol: stock.symbol,
              name: stock.name,
              sector: stock.sector,
              price,
              change: quote.regularMarketChange || 0,
              changePercent: quote.regularMarketChangePercent || 0,
              volume,
              avgVolume,
              volumeRatio: volume / avgVolume,
              pe: quote.trailingPE || null,
              marketCap: quote.marketCap || 0,
              fiftyTwoWeekHigh,
              fiftyTwoWeekLow,
              distanceFrom52High: ((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100,
              distanceFrom52Low: ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100,
              rsi: technicals.rsi,
              sma50: technicals.sma50,
              sma200: technicals.sma200,
              ema9: 0, // TODO: Add if needed
              ema21: 0,
              macdSignal: technicals.macdSignal,
              macdHistogram: technicals.macdHistogram,
              goldenCross: technicals.goldenCross,
              deathCross: technicals.deathCross,
              aboveSMA50: price > technicals.sma50,
              aboveSMA200: price > technicals.sma200,
              cachedAt: Date.now()
            }

            stockCache.set(stock.symbol, cachedData)
            successCount++
          } catch (error: any) {
            console.error(`   ❌ Error processing ${stock.symbol}:`, error.message)
          }
        }))

        if (currentScan) {
          currentScan.completed = Math.min(i + j + concurrency, stocks.length)
        }
      }

      // Delay between batches to respect rate limits
      if (i + batchSize < stocks.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Scan completed
    if (currentScan && currentScan.scanId === scanId) {
      currentScan.status = 'completed'
      currentScan.completedAt = Date.now()
      lastFullScanAt = Date.now()

      // Save to file
      await saveCacheToFile()

      console.log(`✅ Scan completed:`)
      console.log(`   ✓ Success: ${successCount} stocks cached`)
      console.log(`   ✗ Quote failures: ${quoteFailCount}`)
      console.log(`   ✗ Historical failures: ${historicalFailCount}`)
      console.log(`   📦 Total cached: ${stockCache.size}`)
    }
  } catch (error: any) {
    console.error('Scan error:', error)
    if (currentScan && currentScan.scanId === scanId) {
      currentScan.status = 'error'
      currentScan.error = error.message
    }
  }
}

// ============================================================
// CACHE ACCESS
// ============================================================

export function getScanProgress(): ScanProgress | null {
  return currentScan
}

export function getCacheStats(): {
  totalStocks: number
  cachedStocks: number
  coverage: number
  lastScanAt: number
  cacheAge: number
  isStale: boolean
} {
  const now = Date.now()
  const cacheAge = lastFullScanAt > 0 ? now - lastFullScanAt : 0

  return {
    totalStocks: STOCK_LIST.length,
    cachedStocks: stockCache.size,
    coverage: stockCache.size / STOCK_LIST.length,
    lastScanAt: lastFullScanAt,
    cacheAge,
    isStale: cacheAge > QUOTE_TTL
  }
}

export function getAllCachedStocks(): CachedStockData[] {
  return Array.from(stockCache.values())
}

export function getCachedStock(symbol: string): CachedStockData | undefined {
  return stockCache.get(symbol)
}

// ============================================================
// FILTERING
// ============================================================

export interface ScreenerFilters {
  rsiMin?: number
  rsiMax?: number
  aboveSMA50?: boolean
  aboveSMA200?: boolean
  belowSMA50?: boolean
  belowSMA200?: boolean
  goldenCross?: boolean
  deathCross?: boolean
  macdBullish?: boolean
  macdBearish?: boolean
  near52WeekHigh?: boolean
  near52WeekLow?: boolean
  priceChangeMin?: number
  priceChangeMax?: number
  volumeSpike?: boolean
  peMin?: number
  peMax?: number
  marketCapMin?: number // in crores
  marketCapMax?: number
  sectors?: string[]
}

export function filterStocks(filters: ScreenerFilters): CachedStockData[] {
  const stocks = getAllCachedStocks()

  return stocks.filter(stock => {
    // Sector filter
    if (filters.sectors && filters.sectors.length > 0) {
      if (!stock.sector || !filters.sectors.includes(stock.sector)) {
        return false
      }
    }

    // RSI filters
    if (filters.rsiMin !== undefined && stock.rsi < filters.rsiMin) return false
    if (filters.rsiMax !== undefined && stock.rsi > filters.rsiMax) return false

    // SMA filters
    if (filters.aboveSMA50 && !stock.aboveSMA50) return false
    if (filters.aboveSMA200 && !stock.aboveSMA200) return false
    if (filters.belowSMA50 && stock.aboveSMA50) return false
    if (filters.belowSMA200 && stock.aboveSMA200) return false

    // Cross filters
    if (filters.goldenCross && !stock.goldenCross) return false
    if (filters.deathCross && !stock.deathCross) return false

    // MACD filters
    if (filters.macdBullish && stock.macdSignal !== 'BULLISH') return false
    if (filters.macdBearish && stock.macdSignal !== 'BEARISH') return false

    // Price change filters
    if (filters.priceChangeMin !== undefined && stock.changePercent < filters.priceChangeMin) return false
    if (filters.priceChangeMax !== undefined && stock.changePercent > filters.priceChangeMax) return false

    // 52-week filters
    if (filters.near52WeekHigh && stock.distanceFrom52High > 5) return false
    if (filters.near52WeekLow && stock.distanceFrom52Low > 10) return false

    // Volume spike
    if (filters.volumeSpike && stock.volumeRatio < 2) return false

    // PE filters
    if (filters.peMin !== undefined && (stock.pe === null || stock.pe < filters.peMin)) return false
    if (filters.peMax !== undefined && (stock.pe === null || stock.pe > filters.peMax)) return false

    // Market cap filters (convert crores to actual value)
    const croreMultiplier = 10000000
    if (filters.marketCapMin !== undefined && stock.marketCap < filters.marketCapMin * croreMultiplier) return false
    if (filters.marketCapMax !== undefined && stock.marketCap > filters.marketCapMax * croreMultiplier) return false

    return true
  })
}

// ============================================================
// INITIALIZATION
// ============================================================

let initialized = false

export async function initializeCache(): Promise<void> {
  if (initialized) return

  await loadCacheFromFile()
  initialized = true

  // Start background scan if cache is empty or stale
  const stats = getCacheStats()
  if (stats.coverage < 0.5 || stats.isStale) {
    console.log('📊 Cache is stale or empty, starting background scan...')
    startFullScan()
  }
}

// Auto-initialize when module loads
initializeCache().catch(console.error)
