// src/lib/data.ts
import yahooFinance from 'yahoo-finance2';
import Parser from 'rss-parser';
import { NewsItem } from './types';

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
// ENHANCED NEWS SENTIMENT WITH RECENCY WEIGHTING
// ============================================================
export async function fetchNewsData(symbol: string): Promise<{ news: NewsItem[], score: number }> {
  try {
    const query = symbol.replace('.NS', '');
    const feedUrl = `https://news.google.com/rss/search?q=${query}+stock+india&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(feedUrl);

    const keywords = {
      positive: [
        // Strong signals (weight 5)
        { word: 'surge', weight: 5 }, { word: 'breakout', weight: 5 }, 
        { word: 'target raised', weight: 5 }, { word: 'outperform', weight: 5 },
        { word: 'beats estimates', weight: 5 }, { word: 'record high', weight: 5 },
        // Medium signals (weight 4)
        { word: 'jump', weight: 4 }, { word: 'rally', weight: 4 },
        { word: 'upgrade', weight: 4 }, { word: 'profit', weight: 4 },
        { word: 'record', weight: 4 }, { word: 'beats', weight: 4 },
        // Weak signals (weight 2-3)
        { word: 'buy', weight: 3 }, { word: 'growth', weight: 3 },
        { word: 'bull', weight: 3 }, { word: 'dividend', weight: 3 },
        { word: 'strong', weight: 2 }, { word: 'positive', weight: 2 },
        { word: 'gains', weight: 2 }, { word: 'rises', weight: 2 }
      ],
      negative: [
        // Strong signals (weight 5)
        { word: 'crash', weight: 5 }, { word: 'plunge', weight: 5 },
        { word: 'scam', weight: 5 }, { word: 'fraud', weight: 5 },
        { word: 'investigation', weight: 5 }, { word: 'bankruptcy', weight: 5 },
        // Medium signals (weight 4)
        { word: 'loss', weight: 4 }, { word: 'downgrade', weight: 4 },
        { word: 'slump', weight: 4 }, { word: 'warning', weight: 4 },
        { word: 'misses', weight: 4 }, { word: 'cuts', weight: 4 },
        // Weak signals (weight 2-3)
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

      // Keyword scoring
      keywords.positive.forEach(k => {
        if (titleLower.includes(k.word)) itemScore += k.weight;
      });
      keywords.negative.forEach(k => {
        if (titleLower.includes(k.word)) itemScore -= k.weight;
      });

      // RECENCY WEIGHTING
      const pubDate = new Date(item.pubDate);
      const hoursAgo = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
      
      let recencyMultiplier = 1.0;
      if (hoursAgo <= 6) recencyMultiplier = 2.5;        // Last 6 hours: 2.5x
      else if (hoursAgo <= 12) recencyMultiplier = 2.0;  // Last 12 hours: 2x
      else if (hoursAgo <= 24) recencyMultiplier = 1.5;  // Last day: 1.5x
      else if (hoursAgo <= 72) recencyMultiplier = 1.0;  // Last 3 days: normal
      else if (hoursAgo <= 168) recencyMultiplier = 0.5; // Last week: half
      else recencyMultiplier = 0.2;                      // Older: minimal

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

    // Cap the score
    const finalScore = Math.max(Math.min(Math.round(totalScore), 30), -30);
    return { news: items, score: finalScore };
  } catch (error) {
    console.error("News Fetch Error:", error);
    return { news: [], score: 0 };
  }
}