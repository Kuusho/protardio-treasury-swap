import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';
import {
  exchangeDiscordCode,
  getDiscordUser,
  checkProtardioOwnership,
  getProtardioBalance,
  assignCitizenRole
} from '~/lib/discord';

/**
 * Discord OAuth callback
 * GET /api/discord/callback?code={code}&state={sessionId}
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return new NextResponse(renderErrorPage('Missing code or state parameter'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    const supabase = createServerClient();

    // Get pending verification from Supabase
    const { data: pending, error: pendingError } = await supabase
      .from('discord_pending_verifications')
      .select('*')
      .eq('session_id', state)
      .single();

    if (pendingError || !pending) {
      return new NextResponse(renderErrorPage('Invalid or expired session'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Exchange code for access token
    const tokenData = await exchangeDiscordCode(code);
    if (!tokenData) {
      return new NextResponse(renderErrorPage('Failed to authenticate with Discord'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Get Discord user info
    const discordUser = await getDiscordUser(tokenData.access_token);
    if (!discordUser) {
      return new NextResponse(renderErrorPage('Failed to get Discord user info'), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Check if wallet holds Protardio NFT
    console.log(`Checking NFT ownership for wallet: ${pending.wallet}`);
    const holdsNFT = await checkProtardioOwnership(pending.wallet);

    if (holdsNFT) {
      const balance = await getProtardioBalance(pending.wallet);
      console.log(`Wallet holds ${balance} Protardio NFT(s)`);

      // Assign Discord role
      const roleAssigned = await assignCitizenRole(discordUser.id);

      if (roleAssigned) {
        // Store verification in Supabase
        await supabase
          .from('discord_verifications')
          .upsert({
            fid: pending.fid,
            wallet: pending.wallet,
            discord_id: discordUser.id,
            discord_username: discordUser.username,
            nft_balance: balance,
            verified_at: new Date().toISOString(),
            last_checked: new Date().toISOString()
          }, {
            onConflict: 'discord_id'
          });

        // Clean up pending verification
        await supabase
          .from('discord_pending_verifications')
          .delete()
          .eq('session_id', state);

        return new NextResponse(
          renderSuccessPage(discordUser.username, balance),
          { headers: { 'Content-Type': 'text/html' } }
        );
      } else {
        return new NextResponse(
          renderErrorPage('Failed to assign Discord role. Make sure you\'ve joined the server first!'),
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    } else {
      // User doesn't hold NFT
      await supabase
        .from('discord_pending_verifications')
        .delete()
        .eq('session_id', state);

      return new NextResponse(
        renderNoNFTPage(pending.wallet),
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
  } catch (error) {
    console.error('Verification error:', error);
    return new NextResponse(
      renderErrorPage('An error occurred during verification'),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

function renderSuccessPage(username: string, balance: number): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Verification Successful</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 600px;
          margin: 100px auto;
          text-align: center;
          padding: 20px;
          background: #0f0f0f;
          color: #fff;
        }
        .success { color: #10b981; font-size: 64px; }
        .title { font-size: 24px; font-weight: bold; margin: 20px 0; }
        .info { color: #999; margin: 10px 0; }
        .button {
          display: inline-block;
          background: #9333ea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: 500;
        }
        .button:hover { background: #7c22ce; }
      </style>
    </head>
    <body>
      <div class="success">&#10003;</div>
      <div class="title">Verification Successful!</div>
      <div class="info">Discord: ${username}</div>
      <div class="info">Protardios Held: ${balance}</div>
      <div class="info">You've been assigned the Protardio Citizen role</div>
      <p style="margin-top: 30px; color: #666;">You can close this window now.</p>
    </body>
    </html>
  `;
}

function renderNoNFTPage(wallet: string): string {
  const truncatedWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Verification Failed</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 600px;
          margin: 100px auto;
          text-align: center;
          padding: 20px;
          background: #0f0f0f;
          color: #fff;
        }
        .error { color: #ef4444; font-size: 64px; }
        .title { font-size: 24px; font-weight: bold; margin: 20px 0; }
        .info { color: #999; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="error">&#10007;</div>
      <div class="title">No Protardio NFTs Found</div>
      <div class="info">Wallet: ${truncatedWallet}</div>
      <div class="info">You need to hold at least 1 Protardio NFT to verify</div>
      <p style="margin-top: 30px; color: #666;">You can close this window now.</p>
    </body>
    </html>
  `;
}

function renderErrorPage(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Verification Error</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 600px;
          margin: 100px auto;
          text-align: center;
          padding: 20px;
          background: #0f0f0f;
          color: #fff;
        }
        .error { color: #ef4444; font-size: 64px; }
        .title { font-size: 24px; font-weight: bold; margin: 20px 0; }
        .info { color: #999; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="error">&#10007;</div>
      <div class="title">Verification Error</div>
      <div class="info">${message}</div>
      <p style="margin-top: 30px; color: #666;">You can close this window now.</p>
    </body>
    </html>
  `;
}
