// src/lib/news.ts
import Parser from 'rss-parser';

const parser = new Parser();

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
}

export async function fetchStockNews(symbol: string): Promise<{ news: NewsItem[], sentimentScore: number }> {
  try {
    // 1. Clean Symbol (Remove .NS for better global news search, or keep it for local)
    // For Google News, "Reliance Industries" works better than "RELIANCE.NS"
    // We will try to extract the name or just use the symbol if name isn't available.
    const query = symbol.replace('.NS', ''); 
    
    // 2. Fetch Google News RSS for this stock
    const feedUrl = `https://news.google.com/rss/search?q=${query}+stock+india&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(feedUrl);

    // 3. Analyze Headlines (The "Sentiment Brain")
    const keywords = {
      positive: ['surge', 'jump', 'gain', 'profit', 'high', 'growth', 'buy', 'bull', 'outperform', 'target raised', 'dividend', 'bonus', 'strong'],
      negative: ['fall', 'drop', 'plunge', 'loss', 'crash', 'sell', 'bear', 'weak', 'miss', 'down', 'scam', 'investigation', 'resign']
    };

    let totalScore = 0;
    const newsItems: NewsItem[] = feed.items.slice(0, 5).map((item: any) => {
      const titleLower = item.title.toLowerCase();
      let sentiment: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
      
      // Check for Positive Keywords
      const hasPositive = keywords.positive.some(word => titleLower.includes(word));
      // Check for Negative Keywords
      const hasNegative = keywords.negative.some(word => titleLower.includes(word));

      if (hasPositive && !hasNegative) {
        sentiment = 'Positive';
        totalScore += 5; // Add points to score
      } else if (hasNegative && !hasPositive) {
        sentiment = 'Negative';
        totalScore -= 5; // Subtract points
      }

      return {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        sentiment
      };
    });

    // Cap the score impact (Max +/- 20 points)
    const finalScore = Math.max(Math.min(totalScore, 20), -20);

    return { news: newsItems, sentimentScore: finalScore };

  } catch (error) {
    console.error("News Fetch Error:", error);
    return { news: [], sentimentScore: 0 };
  }
}