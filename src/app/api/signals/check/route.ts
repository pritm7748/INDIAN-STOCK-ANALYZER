// src/app/api/signals/check/route.ts
// Check and update signal outcomes
// NOTE: Run trade_signals.sql migration before using this API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkSignalOutcome } from '@/lib/signals/generator';
import { TradeSignal } from '@/lib/signals/types';
import yahooFinance from 'yahoo-finance2';

// GET - Check all active signals for target/stop-loss hits
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all active signals (use 'as any' until types regenerated)
        const { data: activeSignals, error: fetchError } = await (supabase as any)
            .from('trade_signals')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE');

        if (fetchError) throw fetchError;

        const signals = (activeSignals || []) as TradeSignal[];

        if (signals.length === 0) {
            return NextResponse.json({ checked: 0, updated: 0 });
        }

        const updates: any[] = [];

        // Group signals by symbol to minimize API calls
        const symbolGroups = signals.reduce((acc, signal) => {
            if (!acc[signal.symbol]) acc[signal.symbol] = [];
            acc[signal.symbol].push(signal);
            return acc;
        }, {} as Record<string, TradeSignal[]>);

        // Check each symbol
        for (const [symbol, symbolSignals] of Object.entries(symbolGroups)) {
            try {
                // Fetch current price and recent high/low
                const quote = await yahooFinance.quote(symbol) as any;
                const currentPrice = quote?.regularMarketPrice;
                const dayHigh = quote?.regularMarketDayHigh || currentPrice;
                const dayLow = quote?.regularMarketDayLow || currentPrice;

                if (!currentPrice) continue;

                for (const signal of symbolSignals) {
                    // Check if signal has expired
                    if (signal.expires_at && new Date(signal.expires_at) < new Date()) {
                        const return_pct = signal.signal_type === 'BUY'
                            ? ((currentPrice - signal.entry_price) / signal.entry_price) * 100
                            : ((signal.entry_price - currentPrice) / signal.entry_price) * 100;

                        updates.push({
                            id: signal.id,
                            status: 'EXPIRED',
                            exit_price: currentPrice,
                            exit_date: new Date().toISOString(),
                            return_pct
                        });
                        continue;
                    }

                    // Check for target/stop-loss hit
                    const outcome = checkSignalOutcome(
                        {
                            signal_type: signal.signal_type,
                            entry_price: signal.entry_price,
                            target_price: signal.target_price,
                            stop_loss: signal.stop_loss
                        },
                        currentPrice,
                        dayHigh,
                        dayLow
                    );

                    if (outcome) {
                        updates.push({
                            id: signal.id,
                            status: outcome.status,
                            exit_price: outcome.exit_price,
                            exit_date: new Date().toISOString(),
                            return_pct: outcome.return_pct
                        });
                    }
                }
            } catch (err) {
                console.error(`Error checking ${symbol}:`, err);
                // Continue with other symbols
            }
        }

        // Apply updates
        for (const update of updates) {
            const { id, ...data } = update;
            await (supabase as any)
                .from('trade_signals')
                .update(data)
                .eq('id', id);
        }

        return NextResponse.json({
            checked: signals.length,
            updated: updates.length,
            updates: updates.map(u => ({ id: u.id, status: u.status, return_pct: u.return_pct }))
        });

    } catch (error: any) {
        console.error('Error checking signals:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
