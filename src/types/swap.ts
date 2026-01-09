/**
 * Protardio Treasury Swap Types
 *
 * Type definitions for the swap feature including:
 * - Treasury inventory
 * - Rarity scoring
 * - Swap intents and completed swaps
 * - API request/response types
 */

// =============================================================================
// Rarity Types
// =============================================================================

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface TraitData {
  trait_type: string;
  value: string;
}

export interface RarityScore {
  id: string;
  tokenId: number;
  traitCounts: Record<string, Record<string, number>>;
  rarityScore: number;
  rarityTier: RarityTier;
  percentile: number | null;
  calculatedAt: string;
}

export interface RarityResult {
  score: number;
  tier: RarityTier;
  percentile: number;
  traitScores: Record<string, number>;
}

// =============================================================================
// Treasury Types
// =============================================================================

export interface TreasuryNFT {
  id: string;
  tokenId: number;
  name: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  attributes: TraitData[] | null;
  rarityTier: RarityTier;
  rarityScore: number;
  isAvailable: boolean;
  reservedForSwapId: string | null;
  reservedUntil: string | null;
  addedAt: string;
  lastSyncedAt: string;
}

export interface TreasuryStats {
  total: number;
  available: number;
  reserved: number;
  byTier: Record<RarityTier, number>;
  lastSyncedAt: string;
}

// =============================================================================
// Swap Intent Types
// =============================================================================

export type SwapStatus =
  | 'pending'
  | 'nft_received'
  | 'fee_received'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'refunded';

export interface SwapIntent {
  id: string;
  userFid: number;
  userAddress: string;
  userUsername: string | null;
  userTokenId: number;
  treasuryTokenId: number;
  userRarityTier: RarityTier;
  treasuryRarityTier: RarityTier;
  feeAmountWei: string;
  feeAmountEth: number;
  status: SwapStatus;
  userNftTxHash: string | null;
  userFeeTxHash: string | null;
  treasurySendTxHash: string | null;
  createdAt: string;
  nftReceivedAt: string | null;
  feeReceivedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
}

export interface CompletedSwap {
  id: string;
  intentId: string;
  userFid: number;
  userAddress: string;
  userUsername: string | null;
  userTokenId: number;
  treasuryTokenId: number;
  userRarityTier: RarityTier;
  treasuryRarityTier: RarityTier;
  feeAmountEth: number;
  userNftTxHash: string;
  treasurySendTxHash: string;
  createdAt: string;
  completedAt: string;
}

// =============================================================================
// Refund Types
// =============================================================================

export type RefundType = 'nft' | 'fee' | 'both';
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Refund {
  id: string;
  intentId: string;
  refundType: RefundType;
  nftTokenId: number | null;
  feeAmountEth: number | null;
  userAddress: string;
  refundTxHash: string | null;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

// =============================================================================
// Fee Calculation Types
// =============================================================================

export interface FeeBreakdown {
  baseFee: string;
  rarityPremium: string;
  totalFee: string;
}

export interface FeeCalculation {
  userRarity: { tier: RarityTier; score: number };
  treasuryRarity: { tier: RarityTier; score: number };
  feeAmountWei: string;
  feeAmountEth: string;
  breakdown: FeeBreakdown;
}

// =============================================================================
// API Request Types
// =============================================================================

export interface TreasuryQueryParams {
  page?: number;
  pageSize?: number;
  rarityTier?: RarityTier;
  sortBy?: 'rarity-asc' | 'rarity-desc' | 'token-asc' | 'token-desc';
}

export interface CalculateFeeRequest {
  userTokenId: number;
  treasuryTokenId: number;
}

export interface CreateSwapIntentRequest {
  userFid: number;
  userAddress: string;
  userTokenId: number;
  treasuryTokenId: number;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TreasuryResponse {
  items: TreasuryNFT[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  lastSyncedAt: string;
}

export interface SwapIntentResponse {
  intentId: string;
  treasuryWallet: string;
  feeAmountWei: string;
  feeAmountEth: string;
  expiresAt: string;
  status: SwapStatus;
  instructions: {
    step1: string;
    step2: string;
  };
}

export interface SwapHistoryResponse {
  completedSwaps: CompletedSwap[];
  pendingIntents: SwapIntent[];
  refunds: Refund[];
}

export interface IntentStatusResponse {
  id: string;
  status: SwapStatus;
  userTokenId: number;
  treasuryTokenId: number;
  feeAmountEth: string;
  transactions: {
    userNftTx: string | null;
    userFeeTx: string | null;
    treasurySendTx: string | null;
  };
  timestamps: {
    created: string;
    nftReceived: string | null;
    feeReceived: string | null;
    completed: string | null;
  };
}

// =============================================================================
// User NFT Types (for selection)
// =============================================================================

export interface UserNFT {
  tokenId: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  attributes: TraitData[];
  rarityTier: RarityTier;
  rarityScore: number;
}

// =============================================================================
// UI State Types
// =============================================================================

export type SwapStep =
  | 'select-treasury'
  | 'select-user-nft'
  | 'confirm'
  | 'send-nft'
  | 'send-fee'
  | 'processing'
  | 'complete'
  | 'failed';

export interface SwapUIState {
  step: SwapStep;
  selectedTreasuryNft: TreasuryNFT | null;
  selectedUserNft: UserNFT | null;
  feeCalculation: FeeCalculation | null;
  activeIntent: SwapIntent | null;
  error: string | null;
}

// =============================================================================
// Database Row Types (for Supabase)
// =============================================================================

export interface TreasuryInventoryRow {
  id: string;
  token_id: number;
  name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  attributes: TraitData[] | null;
  rarity_tier: RarityTier;
  rarity_score: number;
  is_available: boolean;
  reserved_for_swap_id: string | null;
  reserved_until: string | null;
  added_at: string;
  last_synced_at: string;
}

export interface RarityScoresRow {
  id: string;
  token_id: number;
  trait_counts: Record<string, Record<string, number>>;
  rarity_score: number;
  rarity_tier: RarityTier;
  percentile: number | null;
  calculated_at: string;
}

export interface SwapIntentsRow {
  id: string;
  user_fid: number;
  user_address: string;
  user_username: string | null;
  user_token_id: number;
  treasury_token_id: number;
  user_rarity_tier: RarityTier;
  treasury_rarity_tier: RarityTier;
  fee_amount_wei: string;
  fee_amount_eth: number;
  status: SwapStatus;
  user_nft_tx_hash: string | null;
  user_fee_tx_hash: string | null;
  treasury_send_tx_hash: string | null;
  created_at: string;
  nft_received_at: string | null;
  fee_received_at: string | null;
  completed_at: string | null;
  expires_at: string;
}

export interface SwapsRow {
  id: string;
  intent_id: string;
  user_fid: number;
  user_address: string;
  user_username: string | null;
  user_token_id: number;
  treasury_token_id: number;
  user_rarity_tier: RarityTier;
  treasury_rarity_tier: RarityTier;
  fee_amount_eth: number;
  user_nft_tx_hash: string;
  treasury_send_tx_hash: string;
  created_at: string;
  completed_at: string;
}

export interface RefundsRow {
  id: string;
  intent_id: string;
  refund_type: RefundType;
  nft_token_id: number | null;
  fee_amount_eth: number | null;
  user_address: string;
  refund_tx_hash: string | null;
  status: RefundStatus;
  reason: string | null;
  created_at: string;
  completed_at: string | null;
}

// =============================================================================
// Utility Functions Types
// =============================================================================

export type RowToModel<T extends 'treasury' | 'rarity' | 'intent' | 'swap' | 'refund'> =
  T extends 'treasury' ? TreasuryNFT :
  T extends 'rarity' ? RarityScore :
  T extends 'intent' ? SwapIntent :
  T extends 'swap' ? CompletedSwap :
  T extends 'refund' ? Refund : never;
