import { NextRequest, NextResponse } from 'next/server';
import { getNeynarScore, getUserByFid } from '~/lib/whitelist-neynar';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { fid } = await request.json();
    
    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'FID required' },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API configuration error' },
        { status: 500 }
      );
    }
    
    const minScore = parseFloat(process.env.NEXT_PUBLIC_MINIMUM_NEYNAR_SCORE || '0.3');
    
    // Get user data and score
    const user = await getUserByFid(fid, apiKey);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    const score = await getNeynarScore(fid, apiKey);
    const meetsThreshold = score >= minScore;
    
    return NextResponse.json({
      success: true,
      score,
      meetsThreshold,
      threshold: minScore,
      user: {
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        custodyAddress: user.custody_address,
        verifiedAddresses: user.verified_addresses?.eth_addresses || [],
        primaryAddress: user.verified_addresses?.primary?.eth_address || null,
      },
    });
  } catch (error) {
    console.error('Verify score error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify score' },
      { status: 500 }
    );
  }
}
