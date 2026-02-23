// src/lib/data.ts
import yahooFinance from 'yahoo-finance2';
import Parser from 'rss-parser';
import { NewsItem } from './types';
import { analyzeNewsSentimentAI, AISentimentResult } from './ai-sentiment';

// Force Initialization
const yf = new (yahooFinance as any)();
const parser = new Parser();

export async function fetchMarketData(symbol: string) {
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 5);
  const period1 = pastDate.toISOString().split('T')[0];

  try {
    const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any;
    const quote = await yf.quote(symbol) as any;

    if (!chartResult?.quotes || chartResult.quotes.length < 180) {
      throw new Error("Insufficient data (Market might be closed or symbol invalid)");
    }

    const quotes = chartResult.quotes.filter((c: any) =>
      c.close !== null && c.date !== null && c.volume !== null
    );
    return { quotes, quote };
  } catch (error) {
    console.error(`Market Data Error for ${symbol}:`, error);
    throw new Error(`Failed to fetch data for ${symbol}`);
  }
}

export async function fetchIndexData() {
  const symbol = '^NSEI';
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 2);
  const period1 = pastDate.toISOString().split('T')[0];

  try {
    const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any;
    return chartResult?.quotes?.filter((c: any) => c.close !== null && c.date !== null) || [];
  } catch (error) {
    console.error("Index Data Error:", error);
    return [];
  }
}

// ============================================================
// SECTOR INDEX DATA (NEW - for Phase 3)
// ============================================================
const SECTOR_INDICES: Record<string, string> = {
  'Banking': '^NSEBANK',
  'IT': '^CNXIT',
  'Pharma': '^CNXPHARMA',
  'Auto': '^CNXAUTO',
  'Metal': '^CNXMETAL',
  'Energy': '^CNXENERGY',
  'FMCG': '^CNXFMCG',
  'Realty': '^CNXREALTY',
  'Infrastructure': '^CNXINFRA',
  'Financial Services': '^CNXFIN',
};

export async function fetchSectorIndexData(sector: string): Promise<any[]> {
  const indexSymbol = SECTOR_INDICES[sector];
  if (!indexSymbol) return [];

  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 1);
  const period1 = pastDate.toISOString().split('T')[0];

  try {
    const chartResult = await yf.chart(indexSymbol, { period1, interval: '1d' } as any) as any;
    return chartResult?.quotes?.filter((c: any) => c.close !== null && c.date !== null) || [];
  } catch (error) {
    console.error(`Sector Index Data Error for ${sector}:`, error);
    return [];
  }
}

// ============================================================
// ENHANCED NEWS DATA WITH AI SENTIMENT
// ============================================================
export interface EnhancedNewsData {
  news: NewsItem[];
  score: number;                    // Legacy score for backwards compatibility
  aiSentiment: AISentimentResult;   // New AI-powered analysis
}

export async function fetchNewsData(
  symbol: string,
  stockName?: string
): Promise<EnhancedNewsData> {
  try {
    const query = symbol.replace('.NS', '').replace('.BO', '');
    const feedUrl = `https://news.google.com/rss/search?q=${query}+stock+india&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(feedUrl);

    // Legacy keyword-based scoring (for backwards compatibility)
    const keywords = {
      positive: [
        { word: 'surge', weight: 5 }, { word: 'breakout', weight: 5 },
        { word: 'target raised', weight: 5 }, { word: 'outperform', weight: 5 },
        { word: 'beats estimates', weight: 5 }, { word: 'record high', weight: 5 },
        { word: 'jump', weight: 4 }, { word: 'rally', weight: 4 },
        { word: 'upgrade', weight: 4 }, { word: 'profit', weight: 4 },
        { word: 'buy', weight: 3 }, { word: 'growth', weight: 3 },
        { word: 'bull', weight: 3 }, { word: 'dividend', weight: 3 },
        { word: 'strong', weight: 2 }, { word: 'positive', weight: 2 },
        { word: 'gains', weight: 2 }, { word: 'rises', weight: 2 }
      ],
      negative: [
        { word: 'crash', weight: 5 }, { word: 'plunge', weight: 5 },
        { word: 'scam', weight: 5 }, { word: 'fraud', weight: 5 },
        { word: 'investigation', weight: 5 }, { word: 'bankruptcy', weight: 5 },
        { word: 'loss', weight: 4 }, { word: 'downgrade', weight: 4 },
        { word: 'slump', weight: 4 }, { word: 'warning', weight: 4 },
        { word: 'sell', weight: 3 }, { word: 'bear', weight: 3 },
        { word: 'fall', weight: 3 }, { word: 'decline', weight: 3 },
        { word: 'weak', weight: 2 }, { word: 'negative', weight: 2 },
        { word: 'drops', weight: 2 }, { word: 'concerns', weight: 2 }
      ]
    };

    const now = new Date();
    let totalScore = 0;

    const items: NewsItem[] = feed.items.slice(0, 8).map((item: any) => {
      const titleLower = item.title.toLowerCase();
      let itemScore = 0;

      keywords.positive.forEach(k => {
        if (titleLower.includes(k.word)) itemScore += k.weight;
      });
      keywords.negative.forEach(k => {
        if (titleLower.includes(k.word)) itemScore -= k.weight;
      });

      // Recency weighting
      const pubDate = new Date(item.pubDate);
      const hoursAgo = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);

      let recencyMultiplier = 1.0;
      if (hoursAgo <= 6) recencyMultiplier = 2.5;
      else if (hoursAgo <= 12) recencyMultiplier = 2.0;
      else if (hoursAgo <= 24) recencyMultiplier = 1.5;
      else if (hoursAgo <= 72) recencyMultiplier = 1.0;
      else if (hoursAgo <= 168) recencyMultiplier = 0.5;
      else recencyMultiplier = 0.2;

      const weightedScore = itemScore * recencyMultiplier;
      totalScore += weightedScore;

      let sentiment: NewsItem['sentiment'] = 'Neutral';
      if (itemScore > 0) sentiment = 'Positive';
      if (itemScore < 0) sentiment = 'Negative';

      return {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        sentiment,
        recencyWeight: recencyMultiplier
      };
    });

    // Cap the legacy score
    const legacyScore = Math.max(Math.min(Math.round(totalScore), 30), -30);

    // Run AI sentiment analysis in parallel (non-blocking)
    const aiSentiment = await analyzeNewsSentimentAI(items, symbol, stockName);

    return {
      news: items,
      score: legacyScore,
      aiSentiment
    };
  } catch (error) {
    console.error("News Fetch Error:", error);
    return {
      news: [],
      score: 0,
      aiSentiment: {
        overallScore: 0,
        confidence: 0,
        reasoning: 'Failed to fetch news data.',
        newsAnalysis: [],
        marketMood: 'NEUTRAL'
      }
    };
  }
}