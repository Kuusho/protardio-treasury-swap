/**
 * Protardio Treasury Swap Configuration
 *
 * Constants and configuration for the swap feature.
 * Values can be overridden via environment variables.
 */

import { RarityTier } from '@/types/swap';
import { parseEther } from 'viem';

// =============================================================================
// Contract & Chain Configuration
// =============================================================================

export const PROTARDIO_CONTRACT = '0x5d38451841Ee7A2E824A88AFE47b00402157b08d' as const;
export const CHAIN_ID = 8453; // Base mainnet
export const CHAIN_NAME = 'Base';

// Treasury wallet address (set via environment variable)
export const TREASURY_WALLET = (
  process.env.NEXT_PUBLIC_TREASURY_WALLET ||
  process.env.TREASURY_WALLET_ADDRESS ||
  ''
) as `0x${string}`;

// RPC URL
export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// =============================================================================
// Fee Configuration
// =============================================================================

// Flat fee in ETH for MVP (Phase 1: Defect Swap)
// Will be upgraded to tiered fees in Phase 2: Trait Shop
export const SWAP_FEE_ETH = parseFloat(
  process.env.NEXT_PUBLIC_SWAP_FEE || '0.002'
);

// Fee in wei
export const SWAP_FEE_WEI = parseEther(SWAP_FEE_ETH.toString());

// Legacy aliases for compatibility
export const SWAP_BASE_FEE_ETH = SWAP_FEE_ETH;
export const SWAP_BASE_FEE_WEI = SWAP_FEE_WEI;

/**
 * Tier premium values (in ETH)
 * Reserved for Phase 2: Trait Shop with tiered fees
 * Currently unused - all swaps use flat fee
 */
export const TIER_VALUES: Record<RarityTier, number> = {
  common: 0,
  uncommon: 0.0005,
  rare: 0.001,
  legendary: 0.002,
};

/**
 * Calculate swap fee
 *
 * Phase 1 (MVP): Flat fee for all swaps
 * Phase 2 (Trait Shop): Will add tiered fees based on rarity differential
 */
export function calculateSwapFeeEth(
  userTier: RarityTier,
  treasuryTier: RarityTier
): number {
  // Phase 1: Flat fee for all swaps
  return SWAP_FEE_ETH;

  // Phase 2: Uncomment for tiered fees
  // const userValue = TIER_VALUES[userTier];
  // const treasuryValue = TIER_VALUES[treasuryTier];
  // const differential = Math.max(0, treasuryValue - userValue);
  // return SWAP_BASE_FEE_ETH + differential;
}

// =============================================================================
// Rarity Scoring Configuration
// =============================================================================

/**
 * Rarity tier thresholds (based on score 0-100)
 * Higher score = rarer
 */
export const RARITY_THRESHOLDS = {
  legendary: 80, // Score >= 80 = Legendary (top 5%)
  rare: 60,      // Score >= 60 = Rare (top 20%)
  uncommon: 40,  // Score >= 40 = Uncommon (top 50%)
  common: 0,     // Score < 40 = Common (bottom 50%)
} as const;

/**
 * Get rarity tier from score
 */
export function getTierFromScore(score: number): RarityTier {
  if (score >= RARITY_THRESHOLDS.legendary) return 'legendary';
  if (score >= RARITY_THRESHOLDS.rare) return 'rare';
  if (score >= RARITY_THRESHOLDS.uncommon) return 'uncommon';
  return 'common';
}

/**
 * Total supply for rarity calculations
 */
export const TOTAL_SUPPLY = 5000;

// =============================================================================
// Swap Intent Configuration
// =============================================================================

// Intent TTL in minutes (default: 30 minutes)
export const SWAP_INTENT_TTL_MINUTES = parseInt(
  process.env.SWAP_INTENT_TTL_MINUTES || '30',
  10
);

// Intent TTL in milliseconds
export const SWAP_INTENT_TTL_MS = SWAP_INTENT_TTL_MINUTES * 60 * 1000;

// =============================================================================
// Soft Reservation Configuration
// =============================================================================

// Soft reservation duration in seconds (default: 60 seconds)
// NFT is held for this duration when user initiates swap
export const SOFT_RESERVATION_SECONDS = parseInt(
  process.env.SOFT_RESERVATION_SECONDS || '60',
  10
);

// Soft reservation duration in milliseconds
export const SOFT_RESERVATION_MS = SOFT_RESERVATION_SECONDS * 1000;

// =============================================================================
// Polling Configuration
// =============================================================================

// Treasury inventory refresh interval (ms)
export const TREASURY_POLL_INTERVAL = 15000; // 15 seconds

// Swap status poll interval (ms)
export const SWAP_STATUS_POLL_INTERVAL = 5000; // 5 seconds

// =============================================================================
// Rate Limiting
// =============================================================================

// Max swap intents per user per hour
export const SWAP_RATE_LIMIT_PER_HOUR = parseInt(
  process.env.SWAP_RATE_LIMIT_PER_HOUR || '5',
  10
);

// =============================================================================
// UI Configuration
// =============================================================================

// Items per page in treasury gallery
export const TREASURY_PAGE_SIZE = 20;
export const TREASURY_MAX_PAGE_SIZE = 50;

// Rarity tier display colors (Tailwind classes)
export const TIER_COLORS: Record<RarityTier, string> = {
  common: 'text-gray-400 bg-gray-400/20',
  uncommon: 'text-green-400 bg-green-400/20',
  rare: 'text-blue-400 bg-blue-400/20',
  legendary: 'text-yellow-400 bg-yellow-400/20',
};

// Rarity tier display names
export const TIER_NAMES: Record<RarityTier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

// Rarity tier icons/emojis
export const TIER_ICONS: Record<RarityTier, string> = {
  common: '',
  uncommon: '',
  rare: '',
  legendary: '',
};

// =============================================================================
// Error Messages
// =============================================================================

export const ERROR_MESSAGES = {
  SNIPED: "Someone else grabbed that Protardio first. Your NFT and fee have been returned.",
  WRONG_NFT: "You sent a different NFT than selected. It's been returned to you.",
  INSUFFICIENT_FEE: "The fee was too low. Your NFT has been returned.",
  NOT_YOUR_NFT: "You don't own the NFT you're trying to swap.",
  NOT_AVAILABLE: "This Protardio is no longer available in the treasury.",
  INTENT_EXPIRED: "Your swap request expired. Please try again.",
  ALREADY_SWAPPED: "You've already completed this swap.",
  RATE_LIMITED: "Too many swap attempts. Please wait a few minutes.",
  TREASURY_EMPTY: "The treasury has no available NFTs for swapping.",
  INVALID_TOKEN_ID: "Invalid token ID provided.",
  WALLET_NOT_CONNECTED: "Please connect your wallet to continue.",
  NOT_AUTHENTICATED: "Please sign in with Farcaster to continue.",
} as const;

// =============================================================================
// API Endpoints (for frontend)
// =============================================================================

export const API_ROUTES = {
  TREASURY: '/api/swap/treasury',
  CALCULATE_FEE: '/api/swap/calculate-fee',
  INTENTS: '/api/swap/intents',
  HISTORY: '/api/swap/history',
} as const;

// =============================================================================
// ERC-721 ABI (minimal for swap operations)
// =============================================================================

export const ERC721_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
] as const;
