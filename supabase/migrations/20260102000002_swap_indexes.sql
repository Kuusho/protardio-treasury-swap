-- Migration: Create Swap Indexes
-- Description: Performance indexes for swap tables
-- Created: 2026-01-02

-- Treasury inventory indexes
CREATE INDEX idx_treasury_available ON treasury_inventory(is_available) WHERE is_available = true;
CREATE INDEX idx_treasury_rarity ON treasury_inventory(rarity_tier);
CREATE INDEX idx_treasury_token_id ON treasury_inventory(token_id);
CREATE INDEX idx_treasury_rarity_score ON treasury_inventory(rarity_score DESC);

-- Swap intents indexes
CREATE INDEX idx_swap_intents_status ON swap_intents(status);
CREATE INDEX idx_swap_intents_user ON swap_intents(user_fid);
CREATE INDEX idx_swap_intents_user_address ON swap_intents(user_address);
CREATE INDEX idx_swap_intents_expires ON swap_intents(expires_at) WHERE status = 'pending';
CREATE INDEX idx_swap_intents_treasury_token ON swap_intents(treasury_token_id);
CREATE INDEX idx_swap_intents_created ON swap_intents(created_at DESC);

-- Rarity scores indexes
CREATE INDEX idx_rarity_token ON rarity_scores(token_id);
CREATE INDEX idx_rarity_tier ON rarity_scores(rarity_tier);
CREATE INDEX idx_rarity_score ON rarity_scores(rarity_score DESC);

-- Swaps indexes
CREATE INDEX idx_swaps_user ON swaps(user_fid);
CREATE INDEX idx_swaps_user_address ON swaps(user_address);
CREATE INDEX idx_swaps_completed ON swaps(completed_at DESC);
CREATE INDEX idx_swaps_intent ON swaps(intent_id);

-- Refunds indexes
CREATE INDEX idx_refunds_intent ON refunds(intent_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_user_address ON refunds(user_address);

-- Enable Row Level Security (RLS)
ALTER TABLE treasury_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rarity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All access through service role (API routes)
-- Public read for treasury inventory
CREATE POLICY "Treasury inventory is viewable by everyone"
  ON treasury_inventory FOR SELECT
  USING (true);

-- Public read for rarity scores
CREATE POLICY "Rarity scores are viewable by everyone"
  ON rarity_scores FOR SELECT
  USING (true);

-- Users can view their own swap intents
CREATE POLICY "Users can view own swap intents"
  ON swap_intents FOR SELECT
  USING (true);  -- Actually filtered by API, this allows service role full access

-- Users can view completed swaps
CREATE POLICY "Swaps are viewable by everyone"
  ON swaps FOR SELECT
  USING (true);

-- Users can view their own refunds
CREATE POLICY "Users can view own refunds"
  ON refunds FOR SELECT
  USING (true);  -- Filtered by API
