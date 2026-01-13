// src/lib/data.ts
import yahooFinance from 'yahoo-finance2';
import Parser from 'rss-parser';
import { NewsItem } from './types';

// Force Initialization
const yf = new (yahooFinance as any)();
const parser = new Parser();

export async function fetchMarketData(symbol: string) {
  // Always fetch 5 years
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

    const quotes = chartResult.quotes.filter((c: any) => c.close !== null && c.date !== null);
    return { quotes, quote };
  } catch (error) {
    console.error(`Market Data Error for ${symbol}:`, error);
    throw new Error(`Failed to fetch data for ${symbol}`);
  }
}

// NEW: Fetch Nifty 50 Index Data
export async function fetchIndexData() {
  const symbol = '^NSEI'; // Nifty 50 Symbol
  const today = new Date();
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 2); // 2 years is enough for Beta
  const period1 = pastDate.toISOString().split('T')[0];

  try {
    const chartResult = await yf.chart(symbol, { period1, interval: '1d' } as any) as any;
    // Filter and clean
    return chartResult?.quotes?.filter((c: any) => c.close !== null && c.date !== null) || [];
  } catch (error) {
    console.error("Index Data Error:", error);
    return []; // Return empty if failed (we will handle graceful degradation)
  }
}

export async function fetchNewsData(symbol: string): Promise<{ news: NewsItem[], score: number }> {
  try {
    const query = symbol.replace('.NS', '');
    const feedUrl = `https://news.google.com/rss/search?q=${query}+stock+india&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(feedUrl);

    const keywords = {
      positive: [
        { word: 'surge', weight: 5 }, { word: 'jump', weight: 4 }, 
        { word: 'profit', weight: 4 }, { word: 'buy', weight: 3 }, 
        { word: 'growth', weight: 3 }, { word: 'bull', weight: 3 }, 
        { word: 'upgrade', weight: 4 }, { word: 'target raised', weight: 5 },
        { word: 'record', weight: 4 }, { word: 'dividend', weight: 3 }
      ],
      negative: [
        { word: 'plunge', weight: 5 }, { word: 'crash', weight: 5 }, 
        { word: 'loss', weight: 4 }, { word: 'sell', weight: 3 }, 
        { word: 'bear', weight: 3 }, { word: 'downgrade', weight: 4 }, 
        { word: 'fall', weight: 3 }, { word: 'miss', weight: 3 },
        { word: 'scam', weight: 5 }, { word: 'investigation', weight: 5 }
      ]
    };

    let totalScore = 0;
    
    const items: NewsItem[] = feed.items.slice(0, 5).map((item: any) => {
      const titleLower = item.title.toLowerCase();
      let sentiment: NewsItem['sentiment'] = 'Neutral';
      let itemScore = 0;

      keywords.positive.forEach(k => {
        if (titleLower.includes(k.word)) itemScore += k.weight;
      });

      keywords.negative.forEach(k => {
        if (titleLower.includes(k.word)) itemScore -= k.weight;
      });

      if (itemScore > 0) sentiment = 'Positive';
      if (itemScore < 0) sentiment = 'Negative';

      totalScore += itemScore;

      return {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        sentiment
      };
    });

    const finalScore = Math.max(Math.min(totalScore, 20), -20);
    return { news: items, score: finalScore };
  } catch (error) {
    console.error("News Fetch Error:", error);
    return { news: [], score: 0 };
  }
}