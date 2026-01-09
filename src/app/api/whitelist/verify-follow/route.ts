import { NextRequest, NextResponse } from 'next/server';
import { checkFollowStatus, checkFollowStatusByList, getFidByUsername } from '~/lib/whitelist-neynar';

export const dynamic = 'force-dynamic';

/**
 * Cached FID for @protardio to avoid repeated API lookups.
 * Falls back to env var or API lookup if not cached.
 */
let cachedProtardioFid: number | null = null;

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
    
    // Resolve @protardio's FID: first check env, then cache, then API lookup
    let protardioFid = parseInt(process.env.NEXT_PUBLIC_PROTARDIO_FID || '1118370');
    
    if (!protardioFid || protardioFid === 0) {
      if (!cachedProtardioFid) {
        cachedProtardioFid = await getFidByUsername('protardio', apiKey);
      }
      protardioFid = cachedProtardioFid || 0;
    }
    
    if (!protardioFid) {
      return NextResponse.json(
        { success: false, error: 'Could not find @protardio' },
        { status: 500 }
      );
    }
    
    // Check if the user follows @protardio using Neynar's viewer_context
    const isFollowing = await checkFollowStatus(fid, protardioFid, apiKey);
    
    return NextResponse.json({
      success: true,
      isFollowing,
      protardioFid,
      viewerFid: fid,
    });
  } catch (error) {
    console.error('Verify follow error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify follow status' },
      { status: 500 }
    );
  }
}
