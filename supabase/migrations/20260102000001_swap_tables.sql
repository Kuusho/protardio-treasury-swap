-- Migration: Create Swap Tables
-- Description: Core tables for the treasury swap feature
-- Created: 2026-01-02

-- Treasury Inventory: Cache of NFTs held by treasury wallet
CREATE TABLE treasury_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(255),
  image_url TEXT,
  thumbnail_url TEXT,
  attributes JSONB,  -- Array of {trait_type, value}
  rarity_tier VARCHAR(20) NOT NULL DEFAULT 'common',
  rarity_score DECIMAL(10,4) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  reserved_for_swap_id UUID,
  reserved_until TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rarity_tier CHECK (rarity_tier IN ('common', 'uncommon', 'rare', 'legendary'))
);

-- Rarity Scores: Pre-calculated rarity data for all tokens
CREATE TABLE rarity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL UNIQUE,
  trait_counts JSONB NOT NULL,
  rarity_score DECIMAL(10,4) NOT NULL,
  rarity_tier VARCHAR(20) NOT NULL,
  percentile DECIMAL(5,2),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rarity_tier CHECK (rarity_tier IN ('common', 'uncommon', 'rare', 'legendary'))
);

-- Swap Intents: Pending swap requests
CREATE TABLE swap_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_username VARCHAR(100),
  user_token_id INTEGER NOT NULL,
  treasury_token_id INTEGER NOT NULL,
  user_rarity_tier VARCHAR(20) NOT NULL,
  treasury_rarity_tier VARCHAR(20) NOT NULL,
  fee_amount_wei VARCHAR(78) NOT NULL,
  fee_amount_eth DECIMAL(18,8) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  user_nft_tx_hash VARCHAR(66),
  user_fee_tx_hash VARCHAR(66),
  treasury_send_tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT now(),
  nft_received_at TIMESTAMPTZ,
  fee_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'nft_received', 'fee_received', 'executing',
    'completed', 'failed', 'expired', 'refunded'
  ))
);

-- Completed Swaps: Permanent record
CREATE TABLE swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_username VARCHAR(100),
  user_token_id INTEGER NOT NULL,
  treasury_token_id INTEGER NOT NULL,
  user_rarity_tier VARCHAR(20) NOT NULL,
  treasury_rarity_tier VARCHAR(20) NOT NULL,
  fee_amount_eth DECIMAL(18,8) NOT NULL,
  user_nft_tx_hash VARCHAR(66) NOT NULL,
  treasury_send_tx_hash VARCHAR(66) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL
);

-- Refunds: Track refunded transactions
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

-- Add comment for documentation
COMMENT ON TABLE treasury_inventory IS 'Cache of NFTs held by treasury wallet for swaps';
COMMENT ON TABLE rarity_scores IS 'Pre-calculated rarity data for all Protardio tokens';
COMMENT ON TABLE swap_intents IS 'Pending swap requests awaiting completion';
COMMENT ON TABLE swaps IS 'Permanent record of completed swaps';
COMMENT ON TABLE refunds IS 'Track refunded transactions for failed swaps';
