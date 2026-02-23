// src/lib/signals/types.ts
// Trade Signal Types

export interface TradeSignal {
    id: string;
    user_id: string;
    symbol: string;
    stock_name?: string;

    signal_type: 'BUY' | 'SELL';
    entry_price: number;
    target_price: number;
    stop_loss: number;
    score?: number;
    confidence?: number;
    reasons?: string[];
    timeframe?: string;

    status: 'ACTIVE' | 'TARGET_HIT' | 'STOP_LOSS' | 'EXPIRED' | 'CANCELLED';
    exit_price?: number;
    exit_date?: string;
    return_pct?: number;

    created_at: string;
    expires_at?: string;
}

export interface SignalGenerationResult {
    shouldGenerate: boolean;
    signal?: {
        signal_type: 'BUY' | 'SELL';
        entry_price: number;
        target_price: number;
        stop_loss: number;
        score: number;
        confidence: number;
        reasons: string[];
        risk_reward: number;
    };
    rejection_reason?: string;
}

export interface SignalStats {
    total_signals: number;
    active_signals: number;
    closed_signals: number;
    wins: number;
    losses: number;
    win_rate: number;
    avg_return: number;
    total_return: number;
    best_trade: number;
    worst_trade: number;
}
