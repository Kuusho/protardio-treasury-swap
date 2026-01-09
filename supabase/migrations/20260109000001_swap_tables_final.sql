-- Migration: Final Treasury Swap Tables
-- Date: 2026-01-09
-- Description: Complete schema for treasury swap feature with soft reservations

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS swaps CASCADE;
DROP TABLE IF EXISTS swap_intents CASCADE;
DROP TABLE IF EXISTS rarity_scores CASCADE;
DROP TABLE IF EXISTS treasury_inventory CASCADE;

-- 1. Treasury Inventory Table
-- Stores the pool of NFTs available for swapping
CREATE TABLE treasury_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(255),
  image_url TEXT,
  attributes JSONB,
  rarity_score DECIMAL(10,4) DEFAULT 0,
  rarity_tier VARCHAR(20) NOT NULL DEFAULT 'common',
  is_available BOOLEAN DEFAULT true,
  -- Soft reservation fields
  reserved_for_intent_id UUID,
  reserved_until TIMESTAMPTZ,
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rarity_tier CHECK (rarity_tier IN ('common', 'uncommon', 'rare', 'legendary'))
);

-- Enable RLS
ALTER TABLE treasury_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Public read for available inventory
CREATE POLICY "Public can view inventory"
  ON treasury_inventory FOR SELECT
  USING (true);

-- 2. Rarity Scores Table
-- Pre-calculated rarity data for ALL tokens (not just treasury)
CREATE TABLE rarity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL UNIQUE,
  rarity_score DECIMAL(10,4) NOT NULL,
  rarity_tier VARCHAR(20) NOT NULL,
  percentile DECIMAL(5,2),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rarity_tier CHECK (rarity_tier IN ('common', 'uncommon', 'rare', 'legendary'))
);

-- Enable RLS
ALTER TABLE rarity_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Public read for rarity data
CREATE POLICY "Public can view rarity scores"
  ON rarity_scores FOR SELECT
  USING (true);

-- 3. Swap Intents Table
-- Stores pending swap requests
CREATE TABLE swap_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- User info
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_username VARCHAR(100),
  -- Token info
  user_token_id INTEGER NOT NULL,
  treasury_token_id INTEGER NOT NULL,
  user_rarity_tier VARCHAR(20),
  treasury_rarity_tier VARCHAR(20),
  -- Fee info
  fee_amount_wei VARCHAR(78) NOT NULL DEFAULT '2000000000000000',
  fee_amount_eth DECIMAL(18,8) NOT NULL DEFAULT 0.002,
  -- Status tracking
  status VARCHAR(30) DEFAULT 'pending',
  -- Transaction hashes
  user_nft_tx_hash VARCHAR(66),
  user_fee_tx_hash VARCHAR(66),
  treasury_send_tx_hash VARCHAR(66),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  nft_received_at TIMESTAMPTZ,
  fee_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'nft_received', 'fee_received', 'both_received',
    'executing', 'completed', 'failed', 'expired', 'refunded', 'cancelled'
  ))
);

-- Enable RLS
ALTER TABLE swap_intents ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access
CREATE POLICY "Service role access intents"
  ON swap_intents FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Users can view their own intents via anon (API handles FID verification)
CREATE POLICY "Anon read intents"
  ON swap_intents FOR SELECT
  TO anon
  USING (true);

-- 4. Completed Swaps Table
-- Permanent record of successful swaps
CREATE TABLE swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  -- User info
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_username VARCHAR(100),
  -- Token info
  user_token_id INTEGER NOT NULL,
  treasury_token_id INTEGER NOT NULL,
  user_rarity_tier VARCHAR(20),
  treasury_rarity_tier VARCHAR(20),
  -- Fee
  fee_amount_eth DECIMAL(18,8) NOT NULL,
  -- Transaction hashes
  user_nft_tx_hash VARCHAR(66) NOT NULL,
  treasury_send_tx_hash VARCHAR(66) NOT NULL,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE swaps ENABLE ROW LEVEL SECURITY;

-- Policy: Public read for swap history
CREATE POLICY "Public read swaps"
  ON swaps FOR SELECT
  USING (true);

-- 5. Refunds Table
-- Track refunded transactions for failed swaps
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  refund_type VARCHAR(20) NOT NULL,
  nft_token_id INTEGER,
  fee_amount_eth DECIMAL(18,8),
  user_address VARCHAR(42) NOT NULL,
  refund_tx_hash VARCHAR(66),
  status VARCHAR(20) DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_refund_type CHECK (refund_type IN ('nft', 'fee', 'both')),
  CONSTRAINT valid_refund_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Policy: Service role access
CREATE POLICY "Service role access refunds"
  ON refunds FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Create Indexes for Performance
CREATE INDEX idx_treasury_available ON treasury_inventory(is_available) WHERE is_available = true;
CREATE INDEX idx_treasury_rarity ON treasury_inventory(rarity_tier);
CREATE INDEX idx_treasury_token_id ON treasury_inventory(token_id);
CREATE INDEX idx_treasury_reserved ON treasury_inventory(reserved_until) WHERE reserved_until IS NOT NULL;

CREATE INDEX idx_swap_intents_status ON swap_intents(status);
CREATE INDEX idx_swap_intents_user ON swap_intents(user_fid);
CREATE INDEX idx_swap_intents_expires ON swap_intents(expires_at) WHERE status = 'pending';
CREATE INDEX idx_swap_intents_treasury_token ON swap_intents(treasury_token_id);

CREATE INDEX idx_rarity_token ON rarity_scores(token_id);
CREATE INDEX idx_rarity_tier ON rarity_scores(rarity_tier);
CREATE INDEX idx_rarity_score ON rarity_scores(rarity_score DESC);

CREATE INDEX idx_swaps_user ON swaps(user_fid);
CREATE INDEX idx_swaps_completed ON swaps(completed_at DESC);

CREATE INDEX idx_refunds_intent ON refunds(intent_id);
CREATE INDEX idx_refunds_status ON refunds(status);

-- 7. Add Comments
COMMENT ON TABLE treasury_inventory IS 'NFTs held by treasury wallet available for swaps';
COMMENT ON TABLE rarity_scores IS 'Pre-calculated rarity data for all Protardio tokens';
COMMENT ON TABLE swap_intents IS 'Pending swap requests awaiting user transaction';
COMMENT ON TABLE swaps IS 'Permanent record of completed swaps';
COMMENT ON TABLE refunds IS 'Track refunded transactions for failed/cancelled swaps';
