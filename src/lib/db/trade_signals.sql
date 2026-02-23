-- Live Trade Signals Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trade_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(50) NOT NULL,
  stock_name VARCHAR(200),
  
  -- Signal details
  signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('BUY', 'SELL')),
  entry_price DECIMAL(12,2) NOT NULL,
  target_price DECIMAL(12,2) NOT NULL,
  stop_loss DECIMAL(12,2) NOT NULL,
  score INTEGER,
  confidence DECIMAL(3,2),
  reasons TEXT[],
  timeframe VARCHAR(10),
  
  -- Outcome tracking
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TARGET_HIT', 'STOP_LOSS', 'EXPIRED', 'CANCELLED')),
  exit_price DECIMAL(12,2),
  exit_date TIMESTAMPTZ,
  return_pct DECIMAL(8,4),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_signals_user ON trade_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_status ON trade_signals(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_symbol ON trade_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_signals_created ON trade_signals(created_at DESC);

-- Enable RLS
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own signals" ON trade_signals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals" ON trade_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals" ON trade_signals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own signals" ON trade_signals
  FOR DELETE USING (auth.uid() = user_id);
