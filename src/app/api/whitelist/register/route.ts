import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';
import { getUserByFid, getNeynarScore, checkFollowStatus, getFidByUsername } from '~/lib/whitelist-neynar';
import { verifyNftHolding, getEligibleCollectionNames } from '~/lib/whitelist-nft';
import type { Registration } from '~/types/whitelist';

export const dynamic = 'force-dynamic';

// Protardio FID - cached to avoid repeated lookups
let protardioFid: number | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, walletAddress: clientWalletAddress } = body;

    // FID and walletAddress are required from client
    if (!fid || typeof fid !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Valid FID required' },
        { status: 400 }
      );
    }

    if (!clientWalletAddress || typeof clientWalletAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(clientWalletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const walletAddress = clientWalletAddress;

    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (!neynarApiKey) {
      console.error('NEYNAR_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 1: Get user data from Neynar (server-side)
    // ============================================
    const user = await getUserByFid(fid, neynarApiKey);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const username = user.username;
    
    // ============================================
    // STEP 2: Verify Neynar Score (server-side)
    // ============================================
    const minScore = parseFloat(process.env.NEXT_PUBLIC_MINIMUM_NEYNAR_SCORE || '0.6');
    const actualScore = await getNeynarScore(fid, neynarApiKey);
    
    if (actualScore < minScore) {
      return NextResponse.json({
        success: false,
        error: `Neynar score ${actualScore.toFixed(2)} is below the minimum threshold of ${minScore}`,
        scoreVerification: { actual: actualScore, required: minScore }
      }, { status: 403 });
    }
    
    // ============================================
    // STEP 3: Verify NFT Holdings (server-side)
    // ============================================
    const nftResult = await verifyNftHolding(walletAddress);
    
    if (!nftResult.holds) {
      return NextResponse.json({
        success: false,
        error: `Wallet does not hold any eligible NFTs. Must hold at least one from: ${getEligibleCollectionNames()}`,
        nftVerification: { holds: false, checked: walletAddress }
      }, { status: 403 });
    }
    
    const nftHoldings = nftResult.holdings;
    
    // ============================================
    // STEP 4: Verify Follow Status (server-side)
    // ============================================
    // Get @protardio FID (cache it)
    if (!protardioFid) {
      protardioFid = await getFidByUsername('protardio', neynarApiKey);
      if (!protardioFid) {
        console.error('Could not find @protardio FID');
        return NextResponse.json(
          { success: false, error: 'Server configuration error' },
          { status: 500 }
        );
      }
    }
    
    const isFollowing = await checkFollowStatus(fid, protardioFid, neynarApiKey);
    
    if (!isFollowing) {
      return NextResponse.json({
        success: false,
        error: 'Must follow @protardio to register',
        followVerification: { isFollowing: false }
      }, { status: 403 });
    }
    
    // ============================================
    // STEP 5: Check capacity and register
    // ============================================
    const supabase = createServerClient();
    const currentPhase = process.env.NEXT_PUBLIC_CURRENT_PHASE || 'phase1_tier3';
    const cap = parseInt(process.env.REGISTRATION_CAP || '0');
    
    // Check registration cap
    if (cap > 0) {
      const { count, error: countError } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('tier', currentPhase);
      
      if (countError) {
        console.error('Error counting registrations:', countError);
      } else if (count !== null && count >= cap) {
        return NextResponse.json({
          success: false,
          error: 'Allowlist is full',
          isFull: true,
          count: count,
          cap: cap,
        }, { status: 403 });
      }
    }
    
    // Check for existing registration
    const { data: existing } = await supabase
      .from('registrations')
      .select('*')
      .eq('fid', fid)
      .single();
    
    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Already registered',
        alreadyRegistered: true,
        registration: existing,
      });
    }
    
    // Check for duplicate wallet
    const { data: walletExists } = await supabase
      .from('registrations')
      .select('fid')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (walletExists) {
      return NextResponse.json(
        { success: false, error: 'Wallet address already registered' },
        { status: 400 }
      );
    }
    
    // Create registration with SERVER-VERIFIED data
    const registration: Omit<Registration, 'id' | 'created_at' | 'updated_at'> = {
      fid,
      username,
      wallet_address: walletAddress.toLowerCase(),
      neynar_score: actualScore,  // Server-verified score
      follows_protardio: true,     // Server-verified
      has_shared: true,            // Honor system (can't verify)
      registered_at: new Date().toISOString(),
      tier: currentPhase as 'phase1_tier1' | 'phase1_tier2' | 'phase1_tier3' | 'phase2_tier1',
      status: 'pending',
    };
    
    const { data, error } = await supabase
      .from('registrations')
      .insert(registration)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save registration' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      registration: data,
      verification: {
        score: actualScore,
        nftHoldings: nftHoldings,
        isFollowing: true,
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
