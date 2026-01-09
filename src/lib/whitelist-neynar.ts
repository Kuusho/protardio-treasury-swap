import axios from 'axios';
import type { NeynarUser } from '~/types/whitelist';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';

/**
 * Pre-configured axios instance for Neynar API calls.
 * API key is passed per-request for flexibility.
 */
const neynarApi = axios.create({
  baseURL: NEYNAR_API_BASE,
  headers: {
    'accept': 'application/json',
  },
});

/**
 * Fetches a Farcaster user's profile data from Neynar by their FID.
 * 
 * @param fid - The Farcaster ID of the user to fetch
 * @param apiKey - Neynar API key for authentication
 * @param viewerFid - Optional FID to get viewer-relative context (e.g., follow status)
 * @returns User data or null if not found
 */
export async function getUserByFid(
  fid: number, 
  apiKey: string,
  viewerFid?: number
): Promise<NeynarUser | null> {
  try {
    const params: Record<string, number> = { fids: fid };
    if (viewerFid) {
      params.viewer_fid = viewerFid;
    }
    
    const response = await neynarApi.get('/user/bulk', {
      params,
      headers: { 'x-api-key': apiKey },
    });
    
    const users = response.data?.users;
    if (users && users.length > 0) {
      return users[0] as NeynarUser;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user from Neynar:', error);
    throw error;
  }
}

/**
 * Retrieves a user's Neynar reputation score (0.0 to 1.0).
 * The score indicates the user's credibility on Farcaster.
 * 
 * Falls back to approximation if the experimental score field isn't available:
 * - Power badge holders get a score of 1.0
 * - Others get a score based on follower count (max 0.9)
 * 
 * @param fid - The Farcaster ID of the user
 * @param apiKey - Neynar API key
 * @returns Score between 0.0 and 1.0
 */
export async function getNeynarScore(fid: number, apiKey: string): Promise<number> {
  try {
    const user = await getUserByFid(fid, apiKey);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Primary: Use official Neynar score from experimental field
    if (user.experimental?.neynar_user_score !== undefined) {
      return user.experimental.neynar_user_score;
    }
    
    // Fallback: Power badge holders are considered fully verified
    if (user.power_badge) {
      return 1.0;
    }
    
    // Last resort: Approximate score based on follower count (capped at 0.9)
    const followerScore = Math.min(user.follower_count / 10000, 0.9);
    return Math.round(followerScore * 100) / 100;
  } catch (error) {
    console.error('Error getting Neynar score:', error);
    throw error;
  }
}

/**
 * Checks if one user follows another using Neynar's viewer_context.
 * This is the recommended approach as it requires only one API call.
 * 
 * @param viewerFid - FID of the user who might be following
 * @param targetFid - FID of the user being followed
 * @param apiKey - Neynar API key
 * @returns true if viewerFid follows targetFid
 */
export async function checkFollowStatus(
  viewerFid: number,
  targetFid: number,
  apiKey: string
): Promise<boolean> {
  try {
    // Fetch target user with viewer_fid to get relationship context
    const response = await neynarApi.get('/user/bulk', {
      params: { 
        fids: targetFid,
        viewer_fid: viewerFid 
      },
      headers: { 'x-api-key': apiKey },
    });
    
    const users = response.data?.users;
    if (users && users.length > 0) {
      const user = users[0];
      // viewer_context.following indicates if the viewer follows this user
      return user.viewer_context?.following === true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking follow status:', error);
    throw error;
  }
}

/**
 * Alternative method to check follow status by iterating through the following list.
 * More reliable but slower than viewer_context method.
 * Use this as a fallback if viewer_context returns inconsistent results.
 * 
 * @param fid - FID of the user whose following list to check
 * @param targetFid - FID to look for in the following list
 * @param apiKey - Neynar API key
 * @returns true if fid follows targetFid
 */
export async function checkFollowStatusByList(
  fid: number,
  targetFid: number,
  apiKey: string
): Promise<boolean> {
  try {
    let cursor: string | null = null;
    const limit = 150; // Maximum allowed by Neynar API
    let pageCount = 0;
    const maxPages = 20; // Safety limit to prevent infinite loops
    
    // Paginate through the user's following list until we find the target or exhaust pages
    while (pageCount < maxPages) {
      const params: Record<string, string | number> = { fid, limit };
      if (cursor) params.cursor = cursor;
      
      const response = await neynarApi.get('/following/', {
        params,
        headers: { 'x-api-key': apiKey },
      });
      
      const users = response.data?.users || [];
      pageCount++;
      
      // Check if target FID exists in this page
      const found = users.find((u: NeynarUser) => u.fid === targetFid);
      if (found) {
        return true;
      }
      
      // Get next page cursor, or exit if no more pages
      cursor = response.data?.next?.cursor;
      if (!cursor || users.length < limit) {
        break;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking follow status by list:', error);
    throw error;
  }
}

/**
 * Looks up a Farcaster ID by username.
 * Useful for resolving handles like @protardio to their numeric FID.
 * 
 * @param username - Farcaster username (without @ prefix)
 * @param apiKey - Neynar API key
 * @returns The user's FID or null if not found
 */
export async function getFidByUsername(username: string, apiKey: string): Promise<number | null> {
  try {
    const response = await neynarApi.get('/user/by_username', {
      params: { username },
      headers: { 'x-api-key': apiKey },
    });
    
    return response.data?.user?.fid || null;
  } catch (error) {
    console.error('Error fetching FID by username:', error);
    return null;
  }
}
