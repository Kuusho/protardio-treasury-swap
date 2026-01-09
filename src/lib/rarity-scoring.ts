/**
 * Protardio Rarity Scoring System
 *
 * Calculates rarity scores from on-chain trait metadata.
 * Uses statistical rarity formula based on trait frequency.
 */

import {
  RarityTier,
  TraitData,
  RarityResult,
  FeeCalculation,
  FeeBreakdown,
} from '@/types/swap';
import {
  TOTAL_SUPPLY,
  RARITY_THRESHOLDS,
  SWAP_BASE_FEE_ETH,
  TIER_VALUES,
  getTierFromScore,
} from './swap-config';
import { parseEther, formatEther } from 'viem';

// =============================================================================
// Trait Frequency Data
// =============================================================================

/**
 * Trait frequency map - stores count of each trait value
 * This should be populated from the database or calculated from all NFT metadata
 *
 * Structure: { "Background": { "Blue": 500, "Red": 200, ... } }
 */
let TRAIT_FREQUENCIES: Record<string, Record<string, number>> = {};

/**
 * Set the trait frequency data
 * This should be called once at startup with data from the database
 */
export function setTraitFrequencies(
  frequencies: Record<string, Record<string, number>>
): void {
  TRAIT_FREQUENCIES = frequencies;
}

/**
 * Get current trait frequencies
 */
export function getTraitFrequencies(): Record<string, Record<string, number>> {
  return TRAIT_FREQUENCIES;
}

// =============================================================================
// Rarity Score Calculation
// =============================================================================

/**
 * Calculate rarity score for a single trait
 *
 * Formula: TOTAL_SUPPLY / frequency
 * Rarer traits (lower frequency) get higher scores
 *
 * @param traitType - The trait category (e.g., "Background")
 * @param value - The trait value (e.g., "Blue")
 * @returns Rarity score for this trait (higher = rarer)
 */
export function calculateTraitRarity(traitType: string, value: string): number {
  const frequency = TRAIT_FREQUENCIES[traitType]?.[value];

  if (!frequency || frequency === 0) {
    // Unknown trait - assume very rare (1 of 1)
    return TOTAL_SUPPLY;
  }

  return TOTAL_SUPPLY / frequency;
}

/**
 * Calculate overall rarity score from NFT attributes
 *
 * The score is the average of all trait rarity scores, normalized to 0-100.
 *
 * @param attributes - Array of trait data from NFT metadata
 * @returns RarityResult with score, tier, and breakdown
 */
export function calculateRarityScore(attributes: TraitData[]): RarityResult {
  if (!attributes || attributes.length === 0) {
    return {
      score: 0,
      tier: 'common',
      percentile: 100,
      traitScores: {},
    };
  }

  const traitScores: Record<string, number> = {};
  let totalScore = 0;

  for (const trait of attributes) {
    const traitScore = calculateTraitRarity(trait.trait_type, trait.value);
    traitScores[trait.trait_type] = traitScore;
    totalScore += traitScore;
  }

  // Average score across all traits
  const averageScore = totalScore / attributes.length;

  // Normalize to 0-100 scale
  // Assuming average trait score of ~10 is common, ~50 is legendary
  // This scaling factor should be tuned based on actual data
  const normalizedScore = Math.min(100, (averageScore / 5) * 10);

  // Determine tier from normalized score
  const tier = getTierFromScore(normalizedScore);

  // Calculate percentile (placeholder - should be calculated from all tokens)
  const percentile = calculatePercentile(normalizedScore);

  return {
    score: Math.round(normalizedScore * 100) / 100, // Round to 2 decimals
    tier,
    percentile,
    traitScores,
  };
}

/**
 * Calculate percentile ranking for a given score
 *
 * This is a placeholder implementation. In production, this should
 * compare against actual score distribution from all tokens.
 *
 * @param score - Normalized rarity score (0-100)
 * @returns Percentile (0-100, where 100 = most common)
 */
export function calculatePercentile(score: number): number {
  // Simple linear mapping for now
  // In production, use actual distribution data
  if (score >= RARITY_THRESHOLDS.legendary) {
    // Top 5%
    return 5 - ((score - RARITY_THRESHOLDS.legendary) / 20) * 5;
  }
  if (score >= RARITY_THRESHOLDS.rare) {
    // 5-20%
    return 5 + ((RARITY_THRESHOLDS.legendary - score) / 20) * 15;
  }
  if (score >= RARITY_THRESHOLDS.uncommon) {
    // 20-50%
    return 20 + ((RARITY_THRESHOLDS.rare - score) / 20) * 30;
  }
  // 50-100%
  return 50 + ((RARITY_THRESHOLDS.uncommon - score) / 40) * 50;
}

// =============================================================================
// Fee Calculation
// =============================================================================

/**
 * Calculate swap fee based on rarity differential
 *
 * Formula: baseFee + max(0, treasuryTierValue - userTierValue)
 *
 * @param userRarity - User's NFT rarity result
 * @param treasuryRarity - Treasury NFT rarity result
 * @returns Complete fee calculation with breakdown
 */
export function calculateSwapFee(
  userRarity: RarityResult,
  treasuryRarity: RarityResult
): FeeCalculation {
  const userTierValue = TIER_VALUES[userRarity.tier];
  const treasuryTierValue = TIER_VALUES[treasuryRarity.tier];

  // Calculate premium (only pay extra when trading up)
  const rarityPremium = Math.max(0, treasuryTierValue - userTierValue);
  const totalFeeEth = SWAP_BASE_FEE_ETH + rarityPremium;

  // Convert to wei
  const totalFeeWei = parseEther(totalFeeEth.toString());

  const breakdown: FeeBreakdown = {
    baseFee: SWAP_BASE_FEE_ETH.toString(),
    rarityPremium: rarityPremium.toString(),
    totalFee: totalFeeEth.toString(),
  };

  return {
    userRarity: {
      tier: userRarity.tier,
      score: userRarity.score,
    },
    treasuryRarity: {
      tier: treasuryRarity.tier,
      score: treasuryRarity.score,
    },
    feeAmountWei: totalFeeWei.toString(),
    feeAmountEth: totalFeeEth.toString(),
    breakdown,
  };
}

/**
 * Calculate fee from just token IDs (requires database lookup)
 * This is a helper for API routes that receive token IDs
 *
 * @param userScore - User's NFT rarity score
 * @param userTier - User's NFT rarity tier
 * @param treasuryScore - Treasury NFT rarity score
 * @param treasuryTier - Treasury NFT rarity tier
 * @returns FeeCalculation
 */
export function calculateFeeFromScores(
  userScore: number,
  userTier: RarityTier,
  treasuryScore: number,
  treasuryTier: RarityTier
): FeeCalculation {
  return calculateSwapFee(
    { score: userScore, tier: userTier, percentile: 50, traitScores: {} },
    { score: treasuryScore, tier: treasuryTier, percentile: 50, traitScores: {} }
  );
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Calculate rarity scores for multiple NFTs
 *
 * @param nfts - Array of NFTs with their attributes
 * @returns Map of tokenId to RarityResult
 */
export function batchCalculateRarity(
  nfts: Array<{ tokenId: number; attributes: TraitData[] }>
): Map<number, RarityResult> {
  const results = new Map<number, RarityResult>();

  for (const nft of nfts) {
    results.set(nft.tokenId, calculateRarityScore(nft.attributes));
  }

  return results;
}

// =============================================================================
// Trait Frequency Calculation
// =============================================================================

/**
 * Build trait frequency map from all NFT metadata
 *
 * This should be run once to populate the TRAIT_FREQUENCIES map.
 * Call setTraitFrequencies() with the result.
 *
 * @param allAttributes - Array of attribute arrays from all NFTs
 * @returns Trait frequency map
 */
export function buildTraitFrequencies(
  allAttributes: TraitData[][]
): Record<string, Record<string, number>> {
  const frequencies: Record<string, Record<string, number>> = {};

  for (const attributes of allAttributes) {
    for (const trait of attributes) {
      if (!frequencies[trait.trait_type]) {
        frequencies[trait.trait_type] = {};
      }
      if (!frequencies[trait.trait_type][trait.value]) {
        frequencies[trait.trait_type][trait.value] = 0;
      }
      frequencies[trait.trait_type][trait.value]++;
    }
  }

  return frequencies;
}

/**
 * Get statistics about trait distribution
 */
export function getTraitStats(): {
  totalTraitTypes: number;
  traitCounts: Record<string, number>;
  rarestTraits: Array<{ type: string; value: string; count: number }>;
} {
  const traitCounts: Record<string, number> = {};
  const allTraits: Array<{ type: string; value: string; count: number }> = [];

  for (const [traitType, values] of Object.entries(TRAIT_FREQUENCIES)) {
    traitCounts[traitType] = Object.keys(values).length;

    for (const [value, count] of Object.entries(values)) {
      allTraits.push({ type: traitType, value, count });
    }
  }

  // Sort by rarity (lowest count = rarest)
  allTraits.sort((a, b) => a.count - b.count);

  return {
    totalTraitTypes: Object.keys(TRAIT_FREQUENCIES).length,
    traitCounts,
    rarestTraits: allTraits.slice(0, 10), // Top 10 rarest traits
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format rarity score for display
 */
export function formatRarityScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Format fee for display (ETH)
 */
export function formatFeeEth(feeWei: string): string {
  return formatEther(BigInt(feeWei));
}

/**
 * Check if a tier upgrade requires premium fee
 */
export function requiresPremium(
  fromTier: RarityTier,
  toTier: RarityTier
): boolean {
  return TIER_VALUES[toTier] > TIER_VALUES[fromTier];
}

/**
 * Get tier comparison (upgrade, downgrade, or same)
 */
export function compareTiers(
  fromTier: RarityTier,
  toTier: RarityTier
): 'upgrade' | 'downgrade' | 'same' {
  const fromValue = TIER_VALUES[fromTier];
  const toValue = TIER_VALUES[toTier];

  if (toValue > fromValue) return 'upgrade';
  if (toValue < fromValue) return 'downgrade';
  return 'same';
}
