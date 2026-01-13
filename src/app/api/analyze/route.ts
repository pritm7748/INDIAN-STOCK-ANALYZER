// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import { analyzeStock, TimeFrame } from '@/lib/analyzer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const timeframe = searchParams.get('timeframe') as TimeFrame;

  if (!symbol || !timeframe) {
    return NextResponse.json({ error: 'Missing symbol or timeframe' }, { status: 400 });
  }

  try {
    const data = await analyzeStock(symbol, timeframe);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}