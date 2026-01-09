import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

/**
 * NFT collections that grant whitelist eligibility.
 * Users must hold at least one NFT from any of these collections.
 */
export const ELIGIBLE_NFT_COLLECTIONS = [
  {
    name: 'FIDPUNKS',
    address: '0x8d7f95370e1d1e78ff3ee2faec42eef057fbb310' as Address,
  },
  {
    name: 'Warplets',
    address: '0x699727f9e01a822efdcf7333073f0461e5914b4e' as Address,
  },
  {
    name: 'World Computer Club',
    address: '0x374dbb1d574fcc80938e1673e8ac18847f70fb3a' as Address,
  },
  {
    name: 'ICCM Syndicate Collection',
    address: '0x02935Cd0EF30Cca32aBBD6F8cA417704629039Ed' as Address,
  },
] as const;

/**
 * Minimal ERC-721 ABI containing only the balanceOf function.
 * This is all we need to check if a wallet holds any NFTs from a collection.
 */
const ERC721_BALANCE_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Creates a viem public client configured for Base chain.
 * Uses BASE_RPC_URL env var if available, otherwise falls back to public RPC.
 */
function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  });
}

export interface NftHolding {
  name: string;
  address: Address;
  balance: number;
}

export interface NftVerificationResult {
  holds: boolean;
  totalBalance: number;
  holdings: NftHolding[];
}

/**
 * Verifies if a wallet holds at least one NFT from any eligible collection.
 * Checks all collections in parallel for better performance.
 * 
 * @param walletAddress - The Ethereum wallet address to check
 * @returns Verification result with holdings details
 */
export async function verifyNftHolding(walletAddress: string): Promise<NftVerificationResult> {
  const client = createBaseClient();
  const address = walletAddress as Address;

  // Check all collections in parallel for performance
  const results = await Promise.all(
    ELIGIBLE_NFT_COLLECTIONS.map(async (collection) => {
      try {
        const balance = await client.readContract({
          address: collection.address,
          abi: ERC721_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [address],
        });

        return {
          name: collection.name,
          address: collection.address,
          balance: Number(balance),
        };
      } catch (error) {
        console.error(`Error checking ${collection.name} balance:`, error);
        // Return 0 balance on error so we don't block the user unnecessarily
        return {
          name: collection.name,
          address: collection.address,
          balance: 0,
        };
      }
    })
  );

  const holdings = results.filter((r) => r.balance > 0);
  const totalBalance = results.reduce((sum, r) => sum + r.balance, 0);

  return {
    holds: totalBalance >= 1,
    totalBalance,
    holdings,
  };
}

/**
 * Formats NFT holdings into a human-readable string.
 * Example: "2 FIDPUNKS, 1 Warplets"
 * 
 * @param holdings - Array of NFT holdings to format
 * @returns Formatted string or 'None' if no holdings
 */
export function formatHoldings(holdings: NftHolding[]): string {
  if (holdings.length === 0) return 'None';
  
  return holdings
    .map((h) => `${h.balance} ${h.name}`)
    .join(', ');
}

/**
 * Returns a comma-separated list of all eligible NFT collection names.
 * Useful for displaying requirements to users.
 */
export function getEligibleCollectionNames(): string {
  return ELIGIBLE_NFT_COLLECTIONS.map((c) => c.name).join(', ');
}
