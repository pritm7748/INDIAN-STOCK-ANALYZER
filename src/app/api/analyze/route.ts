// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import { analyzeStock, TimeFrame } from '@/lib/analyzer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const timeframe = searchParams.get('timeframe') as TimeFrame;

  console.log(`🔍 Analyzing: ${symbol} over ${timeframe}...`); // Log the attempt

  if (!symbol || !timeframe) {
    return NextResponse.json({ error: 'Missing symbol or timeframe' }, { status: 400 });
  }

  try {
    const data = await analyzeStock(symbol, timeframe);
    console.log("✅ Analysis successful"); // Log success
    return NextResponse.json(data);
  } catch (error: any) {
    // CRITICAL: Log the actual error to the VS Code terminal
    console.error("❌ ANALYSIS ERROR:", error); 
    console.error("DETAILS:", error.message || error);
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}