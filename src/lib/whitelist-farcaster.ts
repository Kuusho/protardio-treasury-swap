import sdk from '@farcaster/miniapp-sdk';
import type { FarcasterUser } from '~/types/whitelist';

/**
 * Initializes the Farcaster MiniApp SDK and dismisses the splash screen.
 * This should be called once when the app mounts.
 */
export async function initializeSdk(): Promise<void> {
  try {
    // Calling ready() signals to Warpcast that the app has loaded
    // and dismisses the loading splash screen
    await sdk.actions.ready();
  } catch (error) {
    console.error('Failed to initialize Farcaster SDK:', error);
  }
}

/**
 * Retrieves the current Farcaster user from the SDK context.
 * In MiniApps, the user is typically pre-authenticated via Warpcast.
 * Falls back to explicit sign-in if user isn't available in context.
 * 
 * Note: custodyAddress and verifiedAddresses are populated later via Neynar API
 * since the SDK context doesn't include wallet information.
 */
export async function signInWithFarcaster(): Promise<FarcasterUser | null> {
  try {
    // First, check if user is already available in the MiniApp context
    // (this is the normal case when opened from Warpcast)
    const context = await sdk.context;
    const user = context?.user;

    if (user) {
      return {
        fid: user.fid,
        username: user.username || `fid:${user.fid}`,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        custodyAddress: '', // Populated later via Neynar API
        verifiedAddresses: [], // Populated later via Neynar API
      };
    }

    // Fallback: If context doesn't have user (rare), trigger explicit sign-in
    const result = await sdk.actions.signIn({
      nonce: crypto.randomUUID(),
    });

    if (!result) {
      return null;
    }

    // Re-fetch context after sign-in to get user data
    const updatedContext = await sdk.context;
    const signedInUser = updatedContext?.user;

    if (!signedInUser) {
      return null;
    }

    return {
      fid: signedInUser.fid,
      username: signedInUser.username || `fid:${signedInUser.fid}`,
      displayName: signedInUser.displayName,
      pfpUrl: signedInUser.pfpUrl,
      custodyAddress: '',
      verifiedAddresses: [],
    };
  } catch (error) {
    console.error('Sign in failed:', error);
    throw error;
  }
}

/**
 * Opens the Warpcast cast composer with pre-filled text and an embed URL.
 * 
 * Uses the SDK's native composeCast action as the primary method, which opens
 * a composer modal within Warpcast without navigating away from the MiniApp.
 * Falls back to URL-based methods if the native action isn't available.
 */
export async function composeCast(text: string, embedUrl: string): Promise<void> {
  try {
    // Primary method: Use SDK's native composeCast action
    // This opens an in-app composer modal without leaving the MiniApp
    if (sdk.actions.composeCast) {
      await sdk.actions.composeCast({
        text,
        embeds: [embedUrl],
      });
      return;
    }
  } catch {
    // Native composeCast failed, try fallbacks
  }

  // Fallback: Use openUrl to open Warpcast composer (may navigate away)
  try {
    await sdk.actions.openUrl(
      `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`
    );
  } catch {
    // Final fallback: Open in new tab (only for non-Warpcast contexts)
    window.open(
      `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`,
      '_blank'
    );
  }
}

/**
 * Opens an external URL, typically used for follow links or external resources.
 * Falls back to window.open if SDK method fails.
 */
export async function openUrl(url: string): Promise<void> {
  try {
    await sdk.actions.openUrl(url);
  } catch {
    window.open(url, '_blank');
  }
}

/**
 * Retrieves the current user from SDK context without triggering sign-in.
 * Returns null if no user is authenticated.
 */
export async function getCurrentUser(): Promise<FarcasterUser | null> {
  try {
    const context = await sdk.context;
    const user = context?.user;
    
    if (!user) {
      return null;
    }
    
    return {
      fid: user.fid,
      username: user.username || `fid:${user.fid}`,
      displayName: user.displayName,
      pfpUrl: user.pfpUrl,
      custodyAddress: '',
      verifiedAddresses: [],
    };
  } catch {
    return null;
  }
}

/**
 * Checks if the app is running inside a Farcaster client (e.g., Warpcast).
 * Useful for conditionally enabling Farcaster-specific features.
 */
export function isInFarcasterClient(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { farcaster?: unknown }).farcaster;
}
