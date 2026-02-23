// src/lib/ai-sentiment.ts
// AI-powered news sentiment analysis using Gemini

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NewsItem } from './types';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AISentimentResult {
    overallScore: number;        // -10 to +10
    confidence: number;          // 0 to 1
    reasoning: string;           // Human-readable explanation
    newsAnalysis: {
        title: string;
        sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        relevance: number;         // 0 to 1 (how relevant to the stock)
        impact: 'HIGH' | 'MEDIUM' | 'LOW';
    }[];
    marketMood: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
}

// Cache to avoid redundant API calls
const sentimentCache = new Map<string, { result: AISentimentResult; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Analyze news sentiment using Gemini AI
 */
export async function analyzeNewsSentimentAI(
    newsItems: NewsItem[],
    stockSymbol: string,
    stockName?: string
): Promise<AISentimentResult> {
    // Check cache first
    const cacheKey = `${stockSymbol}-${newsItems.map(n => n.title).join('|').slice(0, 200)}`;
    const cached = sentimentCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }

    // If no news, return neutral
    if (!newsItems || newsItems.length === 0) {
        return {
            overallScore: 0,
            confidence: 0.5,
            reasoning: 'No recent news available for analysis.',
            newsAnalysis: [],
            marketMood: 'NEUTRAL'
        };
    }

    // If no API key or placeholder key, fall back to keyword-based analysis
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.length < 20) {
        // Silently fall back - only warn once
        if (typeof global !== 'undefined' && !(global as any).__geminiWarned) {
            console.log('ℹ️ AI Sentiment: Using keyword-based analysis (set GEMINI_API_KEY for AI analysis)');
            (global as any).__geminiWarned = true;
        }
        return fallbackSentimentAnalysis(newsItems, stockSymbol);
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const cleanSymbol = stockSymbol.replace('.NS', '').replace('.BO', '');
        const newsText = newsItems
            .slice(0, 8) // Limit to 8 news items
            .map((item, i) => `${i + 1}. "${item.title}" (${item.pubDate || 'Recent'})`)
            .join('\n');

        const prompt = `You are a financial sentiment analyst for Indian stock markets. Analyze these news headlines for ${cleanSymbol}${stockName ? ` (${stockName})` : ''}.

NEWS HEADLINES:
${newsText}

Analyze each headline and provide:
1. Is it directly relevant to ${cleanSymbol} or just mentions it tangentially?
2. What is the sentiment (BULLISH/BEARISH/NEUTRAL)?
3. What is the potential market impact (HIGH/MEDIUM/LOW)?

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "overallScore": <number from -10 to 10>,
  "confidence": <number from 0.0 to 1.0>,
  "reasoning": "<1-2 sentence explanation of the overall sentiment>",
  "newsAnalysis": [
    {
      "title": "<shortened headline>",
      "sentiment": "BULLISH|BEARISH|NEUTRAL",
      "relevance": <0.0 to 1.0>,
      "impact": "HIGH|MEDIUM|LOW"
    }
  ],
  "marketMood": "BULLISH|BEARISH|NEUTRAL|MIXED"
}

Scoring Guide:
- +8 to +10: Very bullish (earnings beat, major contract, upgrade)
- +4 to +7: Moderately bullish (positive outlook, expansion)
- +1 to +3: Slightly bullish (minor positive news)
- -3 to +3: Neutral (routine updates, no clear direction)
- -3 to -1: Slightly bearish (minor concerns)
- -7 to -4: Moderately bearish (profit warnings, downgrades)
- -10 to -8: Very bearish (scandal, major loss, investigation)

Be conservative with extreme scores. Most news is neutral or mildly directional.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid JSON response from Gemini');
        }

        const parsed = JSON.parse(jsonMatch[0]) as AISentimentResult;

        // Validate and clamp values
        const validatedResult: AISentimentResult = {
            overallScore: Math.max(-10, Math.min(10, parsed.overallScore || 0)),
            confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
            reasoning: parsed.reasoning || 'Analysis completed.',
            newsAnalysis: (parsed.newsAnalysis || []).map(item => ({
                title: item.title || '',
                sentiment: ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(item.sentiment)
                    ? item.sentiment
                    : 'NEUTRAL',
                relevance: Math.max(0, Math.min(1, item.relevance || 0.5)),
                impact: ['HIGH', 'MEDIUM', 'LOW'].includes(item.impact)
                    ? item.impact
                    : 'MEDIUM'
            })),
            marketMood: ['BULLISH', 'BEARISH', 'NEUTRAL', 'MIXED'].includes(parsed.marketMood)
                ? parsed.marketMood
                : 'NEUTRAL'
        };

        // Cache the result
        sentimentCache.set(cacheKey, { result: validatedResult, timestamp: Date.now() });

        return validatedResult;

    } catch (error) {
        console.error('Gemini sentiment analysis error:', error);
        // Fallback to keyword-based analysis
        return fallbackSentimentAnalysis(newsItems, stockSymbol);
    }
}

/**
 * Fallback keyword-based sentiment analysis
 * Used when Gemini API is unavailable
 */
function fallbackSentimentAnalysis(
    newsItems: NewsItem[],
    stockSymbol: string
): AISentimentResult {
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

    let totalScore = 0;
    const newsAnalysis: AISentimentResult['newsAnalysis'] = [];

    for (const item of newsItems.slice(0, 8)) {
        const titleLower = item.title.toLowerCase();
        let itemScore = 0;

        keywords.positive.forEach(k => {
            if (titleLower.includes(k.word)) itemScore += k.weight;
        });
        keywords.negative.forEach(k => {
            if (titleLower.includes(k.word)) itemScore -= k.weight;
        });

        // Recency weighting
        const now = new Date();
        const pubDate = item.pubDate ? new Date(item.pubDate) : now;
        const hoursAgo = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);

        let recencyMultiplier = 1.0;
        if (hoursAgo <= 6) recencyMultiplier = 2.0;
        else if (hoursAgo <= 12) recencyMultiplier = 1.5;
        else if (hoursAgo <= 24) recencyMultiplier = 1.2;
        else if (hoursAgo > 168) recencyMultiplier = 0.3;

        const weightedScore = itemScore * recencyMultiplier;
        totalScore += weightedScore;

        newsAnalysis.push({
            title: item.title.slice(0, 80),
            sentiment: itemScore > 0 ? 'BULLISH' : itemScore < 0 ? 'BEARISH' : 'NEUTRAL',
            relevance: 0.7, // Assume moderate relevance in fallback
            impact: Math.abs(itemScore) >= 4 ? 'HIGH' : Math.abs(itemScore) >= 2 ? 'MEDIUM' : 'LOW'
        });
    }

    // Normalize score to -10 to +10 range
    const normalizedScore = Math.max(-10, Math.min(10, Math.round(totalScore / 2)));

    let marketMood: AISentimentResult['marketMood'] = 'NEUTRAL';
    if (normalizedScore >= 4) marketMood = 'BULLISH';
    else if (normalizedScore <= -4) marketMood = 'BEARISH';
    else if (newsAnalysis.some(n => n.sentiment === 'BULLISH') &&
        newsAnalysis.some(n => n.sentiment === 'BEARISH')) {
        marketMood = 'MIXED';
    }

    return {
        overallScore: normalizedScore,
        confidence: 0.5, // Lower confidence for keyword-based
        reasoning: `Keyword-based analysis detected ${normalizedScore > 0 ? 'positive' : normalizedScore < 0 ? 'negative' : 'neutral'
            } sentiment from ${newsItems.length} news items.`,
        newsAnalysis,
        marketMood
    };
}

/**
 * Clear the sentiment cache
 */
export function clearSentimentCache(): void {
    sentimentCache.clear();
}
