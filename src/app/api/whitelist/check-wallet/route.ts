import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

export const dynamic = 'force-dynamic';

/**
 * Check if a wallet address is registered in the whitelist (Tier 3)
 * GET /api/whitelist/check-wallet?address=0x...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');

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

    let supabase;
    try {
      supabase = createServerClient();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if wallet is in registrations table (case-insensitive)
    const { data, error } = await supabase
      .from('registrations')
      .select('id, fid, username, wallet_address, registered_at')
      .ilike('wallet_address', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isRegistered: !!data,
      tier: data ? 3 : null,
      registration: data ? {
        fid: data.fid,
        username: data.username,
        registeredAt: data.registered_at,
      } : null,
    });
  } catch (error) {
    console.error('Check wallet error:', error);
    return NextResponse.json(
      { success: false, error: 'Check failed' },
      { status: 500 }
    );
  }
}
