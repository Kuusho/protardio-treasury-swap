import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

/**
 * Check Discord verification status
 * GET /api/discord/status?fid={fid}
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json(
      { error: 'Missing fid parameter' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();

    const { data: verification, error } = await supabase
      .from('discord_verifications')
      .select('*')
      .eq('fid', parseInt(fid))
      .single();

    if (error || !verification) {
      return NextResponse.json({
        verified: false,
        message: 'Not verified'
      });
    }

    return NextResponse.json({
      verified: true,
      discord_username: verification.discord_username,
      nft_balance: verification.nft_balance,
      verified_at: verification.verified_at
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
