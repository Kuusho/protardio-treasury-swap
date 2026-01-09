/**
 * Supabase Client Factory for Treasury Swap
 *
 * Server-side only - uses service role key for full database access.
 * All swap database operations should go through this module.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  TreasuryInventoryRow,
  RarityScoresRow,
  SwapIntentsRow,
  SwapsRow,
  RefundsRow,
  TreasuryNFT,
  RarityScore,
  SwapIntent,
  CompletedSwap,
  Refund,
  SwapStatus,
  RarityTier,
} from '@/types/swap';

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Creates a Supabase client with service role privileges.
 *
 * WARNING: Only use in API routes (server-side).
 * Never import this module in client components.
 */
export const createSwapClient = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// =============================================================================
// Row to Model Converters
// =============================================================================

export function treasuryRowToModel(row: TreasuryInventoryRow): TreasuryNFT {
  return {
    id: row.id,
    tokenId: row.token_id,
    name: row.name,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    attributes: row.attributes,
    rarityTier: row.rarity_tier,
    rarityScore: row.rarity_score,
    isAvailable: row.is_available,
    reservedForSwapId: row.reserved_for_swap_id,
    reservedUntil: row.reserved_until,
    addedAt: row.added_at,
    lastSyncedAt: row.last_synced_at,
  };
}

export function rarityRowToModel(row: RarityScoresRow): RarityScore {
  return {
    id: row.id,
    tokenId: row.token_id,
    traitCounts: row.trait_counts,
    rarityScore: row.rarity_score,
    rarityTier: row.rarity_tier,
    percentile: row.percentile,
    calculatedAt: row.calculated_at,
  };
}

export function intentRowToModel(row: SwapIntentsRow): SwapIntent {
  return {
    id: row.id,
    userFid: row.user_fid,
    userAddress: row.user_address,
    userUsername: row.user_username,
    userTokenId: row.user_token_id,
    treasuryTokenId: row.treasury_token_id,
    userRarityTier: row.user_rarity_tier,
    treasuryRarityTier: row.treasury_rarity_tier,
    feeAmountWei: row.fee_amount_wei,
    feeAmountEth: row.fee_amount_eth,
    status: row.status,
    userNftTxHash: row.user_nft_tx_hash,
    userFeeTxHash: row.user_fee_tx_hash,
    treasurySendTxHash: row.treasury_send_tx_hash,
    createdAt: row.created_at,
    nftReceivedAt: row.nft_received_at,
    feeReceivedAt: row.fee_received_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  };
}

export function swapRowToModel(row: SwapsRow): CompletedSwap {
  return {
    id: row.id,
    intentId: row.intent_id,
    userFid: row.user_fid,
    userAddress: row.user_address,
    userUsername: row.user_username,
    userTokenId: row.user_token_id,
    treasuryTokenId: row.treasury_token_id,
    userRarityTier: row.user_rarity_tier,
    treasuryRarityTier: row.treasury_rarity_tier,
    feeAmountEth: row.fee_amount_eth,
    userNftTxHash: row.user_nft_tx_hash,
    treasurySendTxHash: row.treasury_send_tx_hash,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function refundRowToModel(row: RefundsRow): Refund {
  return {
    id: row.id,
    intentId: row.intent_id,
    refundType: row.refund_type,
    nftTokenId: row.nft_token_id,
    feeAmountEth: row.fee_amount_eth,
    userAddress: row.user_address,
    refundTxHash: row.refund_tx_hash,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

// =============================================================================
// Treasury Inventory Operations
// =============================================================================

/**
 * Get available treasury NFTs with pagination and filtering
 */
export async function getTreasuryInventory(
  client: SupabaseClient,
  options: {
    page?: number;
    pageSize?: number;
    rarityTier?: RarityTier;
    sortBy?: 'rarity-asc' | 'rarity-desc' | 'token-asc' | 'token-desc';
    availableOnly?: boolean;
  } = {}
): Promise<{ items: TreasuryNFT[]; total: number }> {
  const {
    page = 1,
    pageSize = 20,
    rarityTier,
    sortBy = 'rarity-desc',
    availableOnly = true,
  } = options;

  const offset = (page - 1) * pageSize;

  // Build query
  let query = client.from('treasury_inventory').select('*', { count: 'exact' });

  // Filter by availability
  if (availableOnly) {
    query = query.eq('is_available', true);
  }

  // Filter by rarity tier
  if (rarityTier) {
    query = query.eq('rarity_tier', rarityTier);
  }

  // Apply sorting
  switch (sortBy) {
    case 'rarity-asc':
      query = query.order('rarity_score', { ascending: true });
      break;
    case 'rarity-desc':
      query = query.order('rarity_score', { ascending: false });
      break;
    case 'token-asc':
      query = query.order('token_id', { ascending: true });
      break;
    case 'token-desc':
      query = query.order('token_id', { ascending: false });
      break;
  }

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch treasury inventory: ${error.message}`);
  }

  return {
    items: (data || []).map(treasuryRowToModel),
    total: count || 0,
  };
}

/**
 * Get a single treasury NFT by token ID
 */
export async function getTreasuryNftByTokenId(
  client: SupabaseClient,
  tokenId: number
): Promise<TreasuryNFT | null> {
  const { data, error } = await client
    .from('treasury_inventory')
    .select('*')
    .eq('token_id', tokenId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch treasury NFT: ${error.message}`);
  }

  return data ? treasuryRowToModel(data) : null;
}

/**
 * Reserve a treasury NFT for a swap
 */
export async function reserveTreasuryNft(
  client: SupabaseClient,
  tokenId: number,
  swapId: string,
  reserveUntil: Date
): Promise<boolean> {
  const { error } = await client
    .from('treasury_inventory')
    .update({
      is_available: false,
      reserved_for_swap_id: swapId,
      reserved_until: reserveUntil.toISOString(),
    })
    .eq('token_id', tokenId)
    .eq('is_available', true); // Only reserve if still available

  return !error;
}

/**
 * Release a treasury NFT reservation
 */
export async function releaseTreasuryNft(
  client: SupabaseClient,
  tokenId: number
): Promise<void> {
  await client
    .from('treasury_inventory')
    .update({
      is_available: true,
      reserved_for_swap_id: null,
      reserved_until: null,
    })
    .eq('token_id', tokenId);
}

// =============================================================================
// Rarity Score Operations
// =============================================================================

/**
 * Get rarity score for a token
 */
export async function getRarityScore(
  client: SupabaseClient,
  tokenId: number
): Promise<RarityScore | null> {
  const { data, error } = await client
    .from('rarity_scores')
    .select('*')
    .eq('token_id', tokenId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch rarity score: ${error.message}`);
  }

  return data ? rarityRowToModel(data) : null;
}

/**
 * Upsert rarity score for a token
 */
export async function upsertRarityScore(
  client: SupabaseClient,
  tokenId: number,
  score: number,
  tier: RarityTier,
  traitCounts: Record<string, Record<string, number>>,
  percentile?: number
): Promise<void> {
  const { error } = await client.from('rarity_scores').upsert(
    {
      token_id: tokenId,
      rarity_score: score,
      rarity_tier: tier,
      trait_counts: traitCounts,
      percentile,
      calculated_at: new Date().toISOString(),
    },
    { onConflict: 'token_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert rarity score: ${error.message}`);
  }
}

// =============================================================================
// Swap Intent Operations
// =============================================================================

/**
 * Create a new swap intent
 */
export async function createSwapIntent(
  client: SupabaseClient,
  intent: Omit<SwapIntentsRow, 'id' | 'created_at' | 'status'>
): Promise<SwapIntent> {
  const { data, error } = await client
    .from('swap_intents')
    .insert({
      ...intent,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create swap intent: ${error.message}`);
  }

  return intentRowToModel(data);
}

/**
 * Get a swap intent by ID
 */
export async function getSwapIntent(
  client: SupabaseClient,
  intentId: string
): Promise<SwapIntent | null> {
  const { data, error } = await client
    .from('swap_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch swap intent: ${error.message}`);
  }

  return data ? intentRowToModel(data) : null;
}

/**
 * Update swap intent status
 */
export async function updateSwapIntentStatus(
  client: SupabaseClient,
  intentId: string,
  status: SwapStatus,
  updates?: Partial<SwapIntentsRow>
): Promise<void> {
  const { error } = await client
    .from('swap_intents')
    .update({ status, ...updates })
    .eq('id', intentId);

  if (error) {
    throw new Error(`Failed to update swap intent: ${error.message}`);
  }
}

/**
 * Get pending intents for a treasury token (to check availability)
 */
export async function getPendingIntentsForToken(
  client: SupabaseClient,
  treasuryTokenId: number
): Promise<SwapIntent[]> {
  const { data, error } = await client
    .from('swap_intents')
    .select('*')
    .eq('treasury_token_id', treasuryTokenId)
    .in('status', ['pending', 'nft_received', 'fee_received', 'executing']);

  if (error) {
    throw new Error(`Failed to fetch pending intents: ${error.message}`);
  }

  return (data || []).map(intentRowToModel);
}

/**
 * Get user's swap intents
 */
export async function getUserSwapIntents(
  client: SupabaseClient,
  userFid: number
): Promise<SwapIntent[]> {
  const { data, error } = await client
    .from('swap_intents')
    .select('*')
    .eq('user_fid', userFid)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user intents: ${error.message}`);
  }

  return (data || []).map(intentRowToModel);
}

/**
 * Expire old pending intents
 */
export async function expireOldIntents(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from('swap_intents')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    throw new Error(`Failed to expire intents: ${error.message}`);
  }

  return data?.length || 0;
}

// =============================================================================
// Completed Swaps Operations
// =============================================================================

/**
 * Create a completed swap record
 */
export async function createCompletedSwap(
  client: SupabaseClient,
  swap: Omit<SwapsRow, 'id' | 'created_at'>
): Promise<CompletedSwap> {
  const { data, error } = await client
    .from('swaps')
    .insert(swap)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create completed swap: ${error.message}`);
  }

  return swapRowToModel(data);
}

/**
 * Get user's completed swaps
 */
export async function getUserSwaps(
  client: SupabaseClient,
  userFid: number
): Promise<CompletedSwap[]> {
  const { data, error } = await client
    .from('swaps')
    .select('*')
    .eq('user_fid', userFid)
    .order('completed_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user swaps: ${error.message}`);
  }

  return (data || []).map(swapRowToModel);
}

// =============================================================================
// Refund Operations
// =============================================================================

/**
 * Create a refund record
 */
export async function createRefund(
  client: SupabaseClient,
  refund: Omit<RefundsRow, 'id' | 'created_at' | 'status'>
): Promise<Refund> {
  const { data, error } = await client
    .from('refunds')
    .insert({
      ...refund,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create refund: ${error.message}`);
  }

  return refundRowToModel(data);
}

/**
 * Get user's refunds
 */
export async function getUserRefunds(
  client: SupabaseClient,
  userAddress: string
): Promise<Refund[]> {
  const { data, error } = await client
    .from('refunds')
    .select('*')
    .ilike('user_address', userAddress)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user refunds: ${error.message}`);
  }

  return (data || []).map(refundRowToModel);
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Get treasury statistics
 */
export async function getTreasuryStats(client: SupabaseClient): Promise<{
  total: number;
  available: number;
  byTier: Record<RarityTier, number>;
  lastSyncedAt: string | null;
}> {
  // Get counts by tier
  const { data: tierData, error: tierError } = await client
    .from('treasury_inventory')
    .select('rarity_tier, is_available');

  if (tierError) {
    throw new Error(`Failed to fetch treasury stats: ${tierError.message}`);
  }

  const byTier: Record<RarityTier, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    legendary: 0,
  };

  let available = 0;
  let lastSyncedAt: string | null = null;

  for (const item of tierData || []) {
    byTier[item.rarity_tier as RarityTier]++;
    if (item.is_available) available++;
  }

  // Get last synced time
  const { data: lastSync } = await client
    .from('treasury_inventory')
    .select('last_synced_at')
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .single();

  if (lastSync) {
    lastSyncedAt = lastSync.last_synced_at;
  }

  return {
    total: tierData?.length || 0,
    available,
    byTier,
    lastSyncedAt,
  };
}
