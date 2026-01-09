import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';
import { getDiscordAuthUrl } from '~/lib/discord';
import crypto from 'crypto';

/**
 * Start Discord linking flow
 * GET /api/discord/link?fid={fid}&wallet={wallet}
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  const wallet = searchParams.get('wallet');

  if (!fid || !wallet) {
    return NextResponse.json(
      { error: 'Missing fid or wallet parameter' },
      { status: 400 }
    );
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: 'Invalid wallet address format' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();

    // Generate session ID for state parameter
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Store pending verification in Supabase
    const { error } = await supabase
      .from('discord_pending_verifications')
      .upsert({
        session_id: sessionId,
        fid: parseInt(fid),
        wallet: wallet.toLowerCase(),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing pending verification:', error);
      return NextResponse.json(
        { error: 'Failed to initiate verification' },
        { status: 500 }
      );
    }

    // Redirect to Discord OAuth
    const discordAuthUrl = getDiscordAuthUrl(sessionId);
    return NextResponse.redirect(discordAuthUrl);
  } catch (error) {
    console.error('Error in Discord link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
