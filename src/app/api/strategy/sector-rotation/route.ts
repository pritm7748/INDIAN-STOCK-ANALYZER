// src/app/api/strategy/sector-rotation/route.ts
// Streams sector rotation analysis via SSE

import yahooFinance from 'yahoo-finance2'
import { rankSectors, buildPortfolio, SECTORS, DEFAULT_SR_CONFIG } from '@/lib/strategy/sector-rotation'
import { STOCK_LIST } from '@/lib/stockList'

const yf = new (yahooFinance as any)()
const BATCH_SIZE = 8

// Yahoo Finance tickers for NSE sectoral indices
const SECTOR_INDEX_TICKERS: Record<string, string> = {
  BANK: '^NSEBANK',
  IT: '^CNXIT',
  PHARMA: '^CNXPHARMA',
  FMCG: '^CNXFMCG',
  METAL: '^CNXMETAL',
  REALTY: '^CNXREALTY',
  AUTO: '^CNXAUTO',
  ENERGY: '^CNXENERGY',
  FINANCIAL: '^CNXFIN',
  PSU_BANK: '^CNXPSUBANK',
  MEDIA: '^CNXMEDIA',
  INFRA: '^CNXINFRA',
}

// Map STOCK_LIST sectors to our sector keys
const SECTOR_NAME_MAP: Record<string, string> = {
  'Financial Services': 'FINANCIAL',
  'Information Technology': 'IT',
  'Healthcare': 'PHARMA',
  'Pharmaceutical': 'PHARMA',
  'Fast Moving Consumer Goods': 'FMCG',
  'Consumer Staples': 'FMCG',
  'Metals & Mining': 'METAL',
  'Metal': 'METAL',
  'Real Estate': 'REALTY',
  'Realty': 'REALTY',
  'Automobile and Auto Components': 'AUTO',
  'Automobile': 'AUTO',
  'Auto': 'AUTO',
  'Oil Gas & Consumable Fuels': 'ENERGY',
  'Energy': 'ENERGY',
  'Power': 'ENERGY',
  'Media Entertainment & Publication': 'MEDIA',
  'Media': 'MEDIA',
  'Construction': 'INFRA',
  'Capital Goods': 'INFRA',
  'Services': 'FINANCIAL',
  'Consumer Services': 'FMCG',
  'Telecommunication': 'IT',
  'Textiles': 'FMCG',
  'Chemicals': 'METAL',
  'Diversified': 'INFRA',
  'Forest Materials': 'FMCG',
  'Construction Materials': 'INFRA',
}

function mapSectorKey(sectorName: string | undefined): string | null {
  if (!sectorName) return null
  if (SECTOR_NAME_MAP[sectorName]) return SECTOR_NAME_MAP[sectorName]
  // Try partial match
  const lower = sectorName.toLowerCase()
  if (lower.includes('bank')) return 'BANK'
  if (lower.includes('pharma') || lower.includes('health')) return 'PHARMA'
  if (lower.includes('it') || lower.includes('tech') || lower.includes('software')) return 'IT'
  if (lower.includes('auto')) return 'AUTO'
  if (lower.includes('metal') || lower.includes('mining') || lower.includes('steel')) return 'METAL'
  if (lower.includes('energy') || lower.includes('oil') || lower.includes('gas') || lower.includes('power')) return 'ENERGY'
  if (lower.includes('realty') || lower.includes('real estate')) return 'REALTY'
  if (lower.includes('fmcg') || lower.includes('consumer')) return 'FMCG'
  if (lower.includes('media')) return 'MEDIA'
  if (lower.includes('infra') || lower.includes('capital') || lower.includes('construct')) return 'INFRA'
  if (lower.includes('financ') || lower.includes('insurance') || lower.includes('nbfc')) return 'FINANCIAL'
  return null
}

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
        startDate.setMonth(endDate.getMonth() - 12)
        const period1 = startDate.toISOString().split('T')[0]

        const total = STOCK_LIST.length
        send('status', { phase: 'sectors', message: 'Fetching sector indices & Nifty data...', total })

        // 1. Fetch Nifty 50
        let niftyCloses: number[] = []
        try {
          const niftyResult = await yf.chart('^NSEI', { period1, interval: '1d' } as any) as any
          if (niftyResult?.quotes) niftyCloses = niftyResult.quotes.filter((q: any) => q.close !== null).map((q: any) => q.close)
        } catch { /* no Nifty data */ }

        // 2. Fetch 12 sector indices
        const sectorData: Record<string, { prices: number[] }> = {}
        let sectorsFetched = 0
        for (const [sectorKey, ticker] of Object.entries(SECTOR_INDEX_TICKERS)) {
          try {
            const result = await yf.chart(ticker, { period1, interval: '1d' } as any) as any
            if (result?.quotes) {
              const closes = result.quotes.filter((q: any) => q.close !== null).map((q: any) => q.close as number)
              if (closes.length > 50) { sectorData[sectorKey] = { prices: closes }; sectorsFetched++ }
            }
          } catch { /* skip sector */ }
        }

        send('status', { phase: 'sectors_done', message: `Fetched ${sectorsFetched}/12 sector indices`, sectorsFetched })

        // 3. Fetch all stocks and group by sector
        const stocksBySector: Record<string, any[]> = {}
        let scannedCount = 0, errorCount = 0, fetchedCount = 0

        send('status', { phase: 'scanning', message: `Scanning ${total} stocks...`, total })

        for (let batchIdx = 0; batchIdx < Math.ceil(total / BATCH_SIZE); batchIdx++) {
          const batch = STOCK_LIST.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

          const results = await Promise.allSettled(
            batch.map(async (stock) => {
              const chartResult = await yf.chart(stock.symbol, { period1, interval: '1d' } as any) as any
              if (!chartResult?.quotes || chartResult.quotes.length < 50) throw new Error('Insufficient data')

              const quotes = chartResult.quotes.filter((q: any) => q.open !== null && q.high !== null && q.low !== null && q.close !== null && q.volume !== null)
              if (quotes.length < 50) throw new Error('Insufficient valid quotes')

              const last20 = quotes.slice(-20)
              const avgTurnover = last20.length > 0 ? last20.reduce((s: number, q: any) => s + (q.close * q.volume), 0) / last20.length / 1e7 : 0

              const sectorKey = mapSectorKey(stock.sector)
              if (!sectorKey) return null

              return {
                symbol: stock.symbol, name: stock.name, sector: sectorKey,
                prices: quotes.map((q: any) => q.close as number),
                volumes: quotes.map((q: any) => q.volume as number),
                avgDailyTurnoverCr: avgTurnover,
              }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
              const stock = r.value
              if (!stocksBySector[stock.sector]) stocksBySector[stock.sector] = []
              stocksBySector[stock.sector].push(stock)
              fetchedCount++
            } else { errorCount++ }
          }

          scannedCount += batch.length
          send('progress', { scanned: scannedCount, total, fetched: fetchedCount, errors: errorCount, pct: Math.round((scannedCount / total) * 100), sectorsFetched })
        }

        // 4. Run sector rotation analysis
        send('status', { phase: 'analyzing', message: `Analyzing ${Object.keys(sectorData).length} sectors, ${fetchedCount} stocks...` })

        const sectorRanking = rankSectors(sectorData, niftyCloses)
        const currentDate = new Date().toISOString().slice(0, 10)
        const portfolio = buildPortfolio(sectorData, stocksBySector, niftyCloses, 10000000, null, currentDate)

        send('result', {
          sectorRanking: sectorRanking.allSectors,
          topSectors: sectorRanking.topSectors,
          bottomSectors: sectorRanking.bottomSectors,
          economicPhase: sectorRanking.economicPhase,
          portfolio,
          config: DEFAULT_SR_CONFIG,
          sectorDefinitions: SECTORS,
          fetchStats: { totalSymbols: total, successfulFetches: fetchedCount, failedFetches: errorCount, sectorsFetched, stocksBySectorCount: Object.fromEntries(Object.entries(stocksBySector).map(([k, v]) => [k, v.length])) },
        })

        send('done', { success: true })
      } catch (err: any) {
        send('error', { message: err.message || 'Sector rotation scan failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
  })
}
