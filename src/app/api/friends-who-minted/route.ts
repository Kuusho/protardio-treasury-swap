import { NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

/**
 * GET /api/friends-who-minted?fid={userFid}
 * 
 * Returns a list of the user's friends (people they follow) who have minted Protardios.
 * 
 * Flow:
 * 1. Get user's following list from Neynar
 * 2. Get all minter FIDs from our database
 * 3. Intersect to find friends who minted
 * 4. Fetch friend profiles from Neynar
 * 5. Return with their Protardio info
 */

interface FriendWhoMinted {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  tokenId: number;
  protardioName: string;
  protardioImage: string;
  mintedAt: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!fid) {
    return NextResponse.json(
      { error: 'FID parameter is required' },
      { status: 400 }
    );
  }

  const neynarApiKey = process.env.NEYNAR_API_KEY;
  if (!neynarApiKey) {
    return NextResponse.json(
      { error: 'Neynar API key not configured' },
      { status: 500 }
    );
  }

  try {
    console.log('[friends-who-minted] Starting request for FID:', fid);

    // Step 1: Get all minter FIDs from our database
    const supabase = createServerClient();
    const { data: mints, error: mintsError } = await supabase
      .from('protardio_mints')
      .select('minter_fid, token_id, name, image_url, minted_at, minter_username')
      .order('minted_at', { ascending: false })
      .limit(5000); // Ensure we get all mints, not just Supabase's default 1000

    console.log('[friends-who-minted] DB query result - mints count:', mints?.length ?? 0, 'error:', mintsError);

    if (mintsError) {
      console.error('[friends-who-minted] Failed to fetch mints:', mintsError);
      return NextResponse.json(
        { error: 'Failed to fetch mints' },
        { status: 500 }
      );
    }

    if (!mints || mints.length === 0) {
      console.log('[friends-who-minted] No mints in database, returning empty');
      // No mints yet
      return NextResponse.json({
        friends: [],
        totalCount: 0,
      });
    }

    console.log('[friends-who-minted] Mints in DB:', mints.length);

    // Create a map of FID -> ALL mint data for that user
    const minterMap = new Map<number, (typeof mints[0])[]>();
    for (const mint of mints) {
      const existing = minterMap.get(mint.minter_fid) || [];
      existing.push(mint);
      minterMap.set(mint.minter_fid, existing);
    }

    const minterFids = Array.from(minterMap.keys());
    console.log('[friends-who-minted] Unique minters:', minterFids.length);

    // Step 2: Get user's following list from Neynar
    // We'll paginate through to get all following
    const allFollowing: number[] = [];
    let cursor: string | null = null;
    const maxPages = 10; // Safety limit: 10 pages * 100 = 1000 following max
    let pages = 0;

    console.log('[friends-who-minted] Starting to fetch following list from Neynar...');

    // Convert minterFids to a Set for O(1) lookup
    const minterFidSet = new Set(minterFids);
    const friendsWhoMinted: number[] = [];

    while (pages < maxPages) {
      const url = new URL('https://api.neynar.com/v2/farcaster/following');
      url.searchParams.set('fid', fid);
      url.searchParams.set('limit', '100');
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      console.log('[friends-who-minted] Fetching page', pages + 1);

      const response = await fetch(url.toString(), {
        headers: { 'x-api-key': neynarApiKey },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[friends-who-minted] Neynar following API error:', response.status, response.statusText, errorText);
        break;
      }

      const data = await response.json();

      console.log('[friends-who-minted] Page', pages + 1, 'returned', data.users?.length ?? 0, 'users');

      if (data.users && data.users.length > 0) {
        for (const item of data.users) {
          // Neynar /following endpoint returns { user: { fid, ... } } structure
          const followingFid = item.user?.fid ?? item.fid;
          allFollowing.push(followingFid);

          // Check if this person minted (O(1) lookup with Set)
          if (minterFidSet.has(followingFid)) {
            friendsWhoMinted.push(followingFid);
          }
        }
      }

      // Early exit: if we've found enough friends for display, stop fetching
      // (We need at least `limit` friends to show, plus some buffer)
      if (friendsWhoMinted.length >= limit + 5) {
        console.log('[friends-who-minted] Found enough friends, stopping early');
        break;
      }

      // Check for next page
      if (data.next?.cursor) {
        cursor = data.next.cursor;
        pages++;
      } else {
        break;
      }
    }

    console.log('[friends-who-minted] Following fetched:', allFollowing.length, '| Friends who minted:', friendsWhoMinted.length);

    if (friendsWhoMinted.length === 0) {
      console.log('[friends-who-minted] No friends who minted found, returning empty');
      return NextResponse.json({
        friends: [],
        totalCount: 0,
      });
    }

    // Step 4: Get profiles for friends who minted (limit for response)
    const fidsToFetch = friendsWhoMinted.slice(0, Math.min(limit, 100));
    console.log('[friends-who-minted] Fetching profiles for FIDs:', fidsToFetch);

    const profilesResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fidsToFetch.join(',')}`,
      {
        headers: { 'x-api-key': neynarApiKey },
      }
    );

    if (!profilesResponse.ok) {
      console.error('Neynar bulk users API error:', profilesResponse.statusText);
      // Return what we have without profiles - flatten all mints from all friends
      const allFriendMints: FriendWhoMinted[] = [];
      for (const fid of fidsToFetch) {
        const userMints = minterMap.get(fid) || [];
        for (const mint of userMints) {
          allFriendMints.push({
            fid,
            username: mint.minter_username || `fid:${fid}`,
            displayName: mint.minter_username || `FID ${fid}`,
            pfpUrl: '',
            tokenId: mint.token_id,
            protardioName: mint.name,
            protardioImage: mint.image_url,
            mintedAt: mint.minted_at,
          });
        }
      }
      return NextResponse.json({
        friends: allFriendMints,
        totalCount: allFriendMints.length,
      });
    }

    const profilesData = await profilesResponse.json();
    
    // Step 5: Combine profiles with ALL mint data for each user
    const friends: FriendWhoMinted[] = [];
    
    for (const user of profilesData.users || []) {
      const userMints = minterMap.get(user.fid) || [];
      // Add ALL protardios for this friend
      for (const mint of userMints) {
        friends.push({
          fid: user.fid,
          username: user.username,
          displayName: user.display_name || user.username,
          pfpUrl: user.pfp_url || '',
          tokenId: mint.token_id,
          protardioName: mint.name,
          protardioImage: mint.image_url,
          mintedAt: mint.minted_at,
        });
      }
    }

    console.log('[friends-who-minted] Returning', friends.length, 'protardios from', profilesData.users?.length || 0, 'friends');

    return NextResponse.json({
      friends,
      totalCount: friends.length,
      uniqueFriendsCount: profilesData.users?.length || 0,
    });

  } catch (error) {
    console.error('Error in /api/friends-who-minted:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
