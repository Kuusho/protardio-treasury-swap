
-- Migration: Add Treasury Swap Tables
-- Date: 2024-01-09
-- Description: Adds treasury_inventory, swap_intents, and swaps tables.

-- 1. Treasury Inventory Table
-- Stores the pool of NFTs available for swapping
CREATE TABLE IF NOT EXISTS treasury_inventory (
  token_id TEXT PRIMARY KEY,               -- The Token ID (e.g. "44")
  valid BOOLEAN DEFAULT TRUE,              -- Is this a valid Protardio?
  rarity_score NUMERIC NOT NULL,           -- Cache of the rarity score
  metadata JSONB NOT NULL,                 -- Full JSON metadata cache
  available BOOLEAN DEFAULT FALSE,         -- Is it currently in the treasury wallet?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE treasury_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view available inventory (for the Gallery)
CREATE POLICY "Public can view available inventory" 
  ON treasury_inventory FOR SELECT 
  USING (available = TRUE);

-- Policy: Service role can do everything (InternalAdmin)
-- Note: Service role bypasses RLS, but explicit policy is good practice/documentation
CREATE POLICY "Service role full access inventory" 
  ON treasury_inventory FOR ALL 
  USING (auth.role() = 'service_role');


-- 2. Swap Intents Table
-- Stores the temporary state of a user wanting to swap
CREATE TABLE IF NOT EXISTS swap_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_fid INTEGER NOT NULL,               -- Farcaster ID of user
  user_address TEXT NOT NULL,              -- Wallet address of user
  offered_token_id TEXT NOT NULL,          -- What they are giving
  wanted_token_id TEXT NOT NULL,           -- What they selected
  fee_amount_eth NUMERIC DEFAULT 0.001,    -- Fee expected
  status TEXT DEFAULT 'pending',           -- pending, completed, failed, expired
  deposit_address TEXT NOT NULL,           -- Where they should send ETH/NFT (Treasury)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Enable RLS
ALTER TABLE swap_intents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own intents (if we link FID to auth.uid() in future, 
-- but for now rely on service role or anon if public API returns it)
-- For now, Service Role only for creation/updates to be safe.
CREATE POLICY "Service role full access intents" 
  ON swap_intents FOR ALL 
  USING (auth.role() = 'service_role');


-- 3. Swaps History Table
-- Permanent record of successful swaps
CREATE TABLE IF NOT EXISTS swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_id UUID REFERENCES swap_intents(id),
  user_fid INTEGER NOT NULL,
  offered_token_id TEXT NOT NULL,
  received_token_id TEXT NOT NULL,
  tx_hash_inbound TEXT,                    -- User -> Treasury hash
  tx_hash_outbound TEXT,                   -- Treasury -> User hash
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE swaps ENABLE ROW LEVEL SECURITY;

-- Policy: Public read for history? Or just Service Role?
-- Let's make it public read for "Recent Swaps" component
CREATE POLICY "Public read swaps" 
  ON swaps FOR SELECT 
  TO anon, authenticated 
  USING (true);
