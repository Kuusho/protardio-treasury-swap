/**
 * Calculate Fee API Route
 *
 * POST /api/swap/calculate-fee - Calculate swap fee for a token pair
 *
 * Phase 1 (MVP): Returns flat fee for all swaps
 * Phase 2 (Trait Shop): Will return tiered fees based on rarity
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSwapClient, getRarityScore } from '@/lib/swap-supabase';
import { ApiResponse, FeeCalculation, CalculateFeeRequest } from '@/types/swap';
import {
  SWAP_FEE_ETH,
  SWAP_FEE_WEI,
  getTierFromScore,
} from '@/lib/swap-config';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CalculateFeeRequest;
    const { userTokenId, treasuryTokenId } = body;

    // Validate input
    if (!userTokenId || !treasuryTokenId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: userTokenId, treasuryTokenId',
        },
        { status: 400 }
      );
    }

    if (userTokenId === treasuryTokenId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Cannot swap NFT with itself',
        },
        { status: 400 }
      );
    }

    // Create Supabase client
    const client = createSwapClient();

    // Get rarity scores (for display purposes, fee is flat in Phase 1)
    const [userRarity, treasuryRarity] = await Promise.all([
      getRarityScore(client, userTokenId),
      getRarityScore(client, treasuryTokenId),
    ]);

    // Default to common tier if no rarity data
    const userTier = userRarity?.rarityTier || 'common';
    const userScore = userRarity?.rarityScore || 0;
    const treasuryTier = treasuryRarity?.rarityTier || 'common';
    const treasuryScore = treasuryRarity?.rarityScore || 0;

    // Phase 1: Flat fee for all swaps
    const feeCalculation: FeeCalculation = {
      userRarity: {
        tier: userTier,
        score: userScore,
      },
      treasuryRarity: {
        tier: treasuryTier,
        score: treasuryScore,
      },
      feeAmountWei: SWAP_FEE_WEI.toString(),
      feeAmountEth: SWAP_FEE_ETH.toString(),
      breakdown: {
        baseFee: SWAP_FEE_ETH.toString(),
        rarityPremium: '0', // No premium in Phase 1
        totalFee: SWAP_FEE_ETH.toString(),
      },
    };

    return NextResponse.json<ApiResponse<FeeCalculation>>({
      success: true,
      data: feeCalculation,
    });
  } catch (error) {
    console.error('[Calculate Fee API] Error:', error);

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to calculate fee',
      },
      { status: 500 }
    );
  }
}
