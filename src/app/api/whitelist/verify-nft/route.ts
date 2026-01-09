import { NextRequest, NextResponse } from 'next/server';
import { verifyNftHolding, getEligibleCollectionNames } from '~/lib/whitelist-nft';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const result = await verifyNftHolding(walletAddress);

    return NextResponse.json({
      success: true,
      holds: result.holds,
      totalBalance: result.totalBalance,
      holdings: result.holdings,
      eligibleCollections: getEligibleCollectionNames(),
    });
  } catch (error) {
    console.error('Verify NFT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify NFT holdings' },
      { status: 500 }
    );
  }
}
