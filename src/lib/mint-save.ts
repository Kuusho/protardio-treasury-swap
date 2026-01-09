import { SaveMintRequest, SaveMintResponse } from '~/types/mint';

/**
 * Saves mint data to the database with automatic retry.
 * 
 * This is a fire-and-forget operation - it will retry in the background
 * and never throw errors to the caller. The mint transaction on-chain
 * is the source of truth; this is just for convenience features.
 * 
 * @param data - The mint data to save
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 */
export async function saveMintToDatabase(
  data: SaveMintRequest,
  maxRetries: number = 3
): Promise<SaveMintResponse | null> {
  const delays = [0, 2000, 5000]; // Retry delays: immediate, 2s, 5s
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wait before retry (skip delay on first attempt)
      if (attempt > 0) {
        console.log(`🔄 Retrying save mint (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delays[attempt] || 5000));
      }

      const response = await fetch('/api/mint/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`⚠️ Save mint attempt ${attempt + 1} failed:`, errorData);
        continue; // Try again
      }

      const result: SaveMintResponse = await response.json();
      
      if (result.success) {
        console.log(`✅ Mint saved to database: Token #${data.tokenId}`);
        return result;
      } else {
        console.warn(`⚠️ Save mint returned error:`, result.error);
        continue; // Try again
      }
    } catch (error) {
      console.warn(`⚠️ Save mint attempt ${attempt + 1} error:`, error);
      // Continue to next retry
    }
  }

  // All retries exhausted - log but don't throw
  console.error(
    `❌ Failed to save mint after ${maxRetries} attempts. Token #${data.tokenId}. ` +
    `This won't affect the user - their NFT exists on-chain.`
  );
  
  return null;
}

/**
 * Fire-and-forget version that doesn't await the result.
 * Use this when you don't need to wait for the save to complete.
 */
export function saveMintInBackground(data: SaveMintRequest): void {
  // Don't await - let it run in the background
  saveMintToDatabase(data).catch(() => {
    // Already logged in saveMintToDatabase, nothing more to do
  });
}
