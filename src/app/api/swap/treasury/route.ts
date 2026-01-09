/**
 * Treasury Inventory API Route
 *
 * GET /api/swap/treasury - List available treasury NFTs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSwapClient,
  getTreasuryInventory,
  getTreasuryStats,
} from '@/lib/swap-supabase';
import { RarityTier, TreasuryResponse, ApiResponse } from '@/types/swap';
import { TREASURY_PAGE_SIZE, TREASURY_MAX_PAGE_SIZE } from '@/lib/swap-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const requestedPageSize = parseInt(
      searchParams.get('pageSize') || TREASURY_PAGE_SIZE.toString(),
      10
    );
    const pageSize = Math.min(
      Math.max(1, requestedPageSize),
      TREASURY_MAX_PAGE_SIZE
    );
    const rarityTier = searchParams.get('rarityTier') as RarityTier | null;
    const sortBy = (searchParams.get('sortBy') || 'rarity-desc') as
      | 'rarity-asc'
      | 'rarity-desc'
      | 'token-asc'
      | 'token-desc';

    // Validate rarity tier
    const validTiers = ['common', 'uncommon', 'rare', 'legendary'];
    if (rarityTier && !validTiers.includes(rarityTier)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `Invalid rarity tier. Must be one of: ${validTiers.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate sort
    const validSorts = ['rarity-asc', 'rarity-desc', 'token-asc', 'token-desc'];
    if (!validSorts.includes(sortBy)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `Invalid sort. Must be one of: ${validSorts.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Create Supabase client
    const client = createSwapClient();

    // Fetch treasury inventory
    const { items, total } = await getTreasuryInventory(client, {
      page,
      pageSize,
      rarityTier: rarityTier || undefined,
      sortBy,
      availableOnly: true,
    });

    // Get last synced time
    const stats = await getTreasuryStats(client);

    // Calculate pagination
    const totalPages = Math.ceil(total / pageSize);
    const hasMore = page < totalPages;

    const response: TreasuryResponse = {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasMore,
      lastSyncedAt: stats.lastSyncedAt || new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<TreasuryResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[Treasury API] Error fetching treasury:', error);

    // Handle case where tables don't exist yet
    if (
      error instanceof Error &&
      error.message.includes('relation') &&
      error.message.includes('does not exist')
    ) {
      return NextResponse.json<ApiResponse<TreasuryResponse>>({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: TREASURY_PAGE_SIZE,
          totalPages: 0,
          hasMore: false,
          lastSyncedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch treasury',
      },
      { status: 500 }
    );
  }
}
