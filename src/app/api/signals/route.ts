// src/app/api/signals/route.ts
// API endpoints for trade signals
// NOTE: Run trade_signals.sql migration before using this API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSignal } from '@/lib/signals/generator';
import { TradeSignal, SignalStats } from '@/lib/signals/types';

// GET - Fetch user's signals
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        // Use 'as any' until types are regenerated after SQL migration
        let query = (supabase as any)
            .from('trade_signals')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status === 'ACTIVE') {
            query = query.eq('status', 'ACTIVE');
        } else if (status === 'CLOSED') {
            query = query.neq('status', 'ACTIVE');
        }

        const { data: signals, error } = await query;

        if (error) throw error;

        // Calculate stats
        const allSignals = (signals || []) as TradeSignal[];
        const closedSignals = allSignals.filter(s => s.status !== 'ACTIVE');
        const wins = closedSignals.filter(s => s.status === 'TARGET_HIT');
        const losses = closedSignals.filter(s => s.status === 'STOP_LOSS');

        const stats: SignalStats = {
            total_signals: allSignals.length,
            active_signals: allSignals.filter(s => s.status === 'ACTIVE').length,
            closed_signals: closedSignals.length,
            wins: wins.length,
            losses: losses.length,
            win_rate: closedSignals.length > 0 ? (wins.length / closedSignals.length) * 100 : 0,
            avg_return: closedSignals.length > 0
                ? closedSignals.reduce((acc, s) => acc + (s.return_pct || 0), 0) / closedSignals.length
                : 0,
            total_return: closedSignals.reduce((acc, s) => acc + (s.return_pct || 0), 0),
            best_trade: closedSignals.length > 0
                ? Math.max(...closedSignals.map(s => s.return_pct || 0))
                : 0,
            worst_trade: closedSignals.length > 0
                ? Math.min(...closedSignals.map(s => s.return_pct || 0))
                : 0,
        };

        return NextResponse.json({ signals: allSignals, stats });

    } catch (error: any) {
        console.error('Error fetching signals:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Generate and store a new signal
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { analysis, timeframe } = body;

        if (!analysis || !analysis.price || analysis.score === undefined) {
            return NextResponse.json({ error: 'Invalid analysis data' }, { status: 400 });
        }

        // Generate signal from analysis
        const result = generateSignal({
            symbol: analysis.symbol,
            stock_name: analysis.stock_name,
            price: analysis.price,
            score: analysis.score,
            confidence: analysis.confidence,
            details: analysis.details || [],
            recommendation: analysis.recommendation,
            timeframe: timeframe || '1M',
            risk: {
                volatility: analysis.risk?.volatility,
                beta: analysis.risk?.beta,
                marketTrend: analysis.risk?.marketTrend,
                atr: analysis.risk?.atr,  // Pass ATR for precise targets
            },
            technicals: analysis.technicals,  // Pass RSI, ADX, trend
        });

        if (!result.shouldGenerate || !result.signal) {
            return NextResponse.json({
                generated: false,
                reason: result.rejection_reason
            });
        }

        // Check for duplicate active signal
        const { data: existing } = await (supabase as any)
            .from('trade_signals')
            .select('id')
            .eq('user_id', user.id)
            .eq('symbol', analysis.symbol)
            .eq('status', 'ACTIVE')
            .single();

        if (existing) {
            return NextResponse.json({
                generated: false,
                reason: 'Active signal already exists for this stock'
            });
        }

        // Store the signal
        // Ensure confidence is in 0-1 range (not percentage)
        const confidenceValue = result.signal.confidence > 1
            ? result.signal.confidence / 100
            : result.signal.confidence;

        const { data: signal, error } = await (supabase as any)
            .from('trade_signals')
            .insert({
                user_id: user.id,
                symbol: analysis.symbol,
                stock_name: analysis.stock_name,
                signal_type: result.signal.signal_type,
                entry_price: result.signal.entry_price,
                target_price: result.signal.target_price,
                stop_loss: result.signal.stop_loss,
                score: result.signal.score,
                confidence: Math.min(0.99, Math.max(0, confidenceValue)),  // Clamp to valid range
                reasons: result.signal.reasons,
                timeframe: timeframe || '1M',
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            generated: true,
            signal,
            risk_reward: result.signal.risk_reward
        });

    } catch (error: any) {
        console.error('Error generating signal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Cancel an active signal
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const signalId = searchParams.get('id');

        if (!signalId) {
            return NextResponse.json({ error: 'Signal ID required' }, { status: 400 });
        }

        const { error } = await (supabase as any)
            .from('trade_signals')
            .update({ status: 'CANCELLED', exit_date: new Date().toISOString() })
            .eq('id', signalId)
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE');

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error cancelling signal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
