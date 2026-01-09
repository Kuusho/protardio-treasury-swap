/**
 * Script to fetch NFT owners from the 3 eligible collections
 * Run with: npx tsx scripts/fetch-nft-owners.ts
 */

import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

const NFT_CONTRACTS = [
  {
    name: 'FIDPUNKS',
    address: '0x8d7f95370e1d1e78ff3ee2faec42eef057fbb310' as Address,
    totalSupply: 5593,
  },
  {
    name: 'Warplets', 
    address: '0x699727f9e01a822efdcf7333073f0461e5914b4e' as Address,
    totalSupply: 49152,
  },
  {
    name: 'World Computer Club',
    address: '0x374dbb1d574fcc80938e1673e8ac18847f70fb3a' as Address,
    totalSupply: 10000,
  },
];

// ERC721 ABI for ownerOf
const ERC721_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function fetchOwners(contract: typeof NFT_CONTRACTS[0], count: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 ${contract.name}`);
  console.log(`   Contract: ${contract.address}`);
  console.log(`${'='.repeat(60)}`);

  const owners: { tokenId: number; owner: string }[] = [];
  const uniqueOwners = new Set<string>();
  
  // Fetch owners for first `count` tokens (starting from token ID 1 or 0)
  const batchSize = 50;
  const startTokenId = contract.name === 'Warplets' ? 0 : 1; // Some collections start at 0
  
  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const promises: Promise<{ tokenId: number; owner: string | null }>[] = [];
    
    for (let i = 0; i < batchSize && batch * batchSize + i < count; i++) {
      const tokenId = startTokenId + batch * batchSize + i;
      
      promises.push(
        client.readContract({
          address: contract.address,
          abi: ERC721_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        })
        .then(owner => ({ tokenId, owner: owner as string }))
        .catch(() => ({ tokenId, owner: null })) // Token might not exist
      );
    }
    
    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.owner) {
        owners.push({ tokenId: result.tokenId, owner: result.owner });
        uniqueOwners.add(result.owner.toLowerCase());
      }
    }
    
    // Progress indicator
    const progress = Math.min((batch + 1) * batchSize, count);
    process.stdout.write(`\r   Fetched ${progress}/${count} tokens...`);
  }
  
  console.log(`\n\n   Found ${owners.length} tokens with ${uniqueOwners.size} unique owners\n`);
  
  // Print first 20 owners for this collection
  console.log('   Sample owners (first 20):');
  owners.slice(0, 20).forEach(({ tokenId, owner }) => {
    console.log(`   Token #${tokenId}: ${owner}`);
  });
  
  return { owners, uniqueOwners: Array.from(uniqueOwners) };
}

async function main() {
  console.log('\n🔍 Fetching NFT owners from eligible collections...\n');
  console.log('This will fetch ~500 tokens total (split across collections)\n');
  
  const allUniqueOwners = new Set<string>();
  
  // Fetch ~166 from each collection (500 total)
  const tokensPerCollection = Math.floor(500 / NFT_CONTRACTS.length);
  
  for (const contract of NFT_CONTRACTS) {
    try {
      const { uniqueOwners } = await fetchOwners(contract, tokensPerCollection);
      uniqueOwners.forEach(o => allUniqueOwners.add(o));
    } catch (error) {
      console.error(`\n   Error fetching ${contract.name}:`, error);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total unique owners across all collections: ${allUniqueOwners.size}`);
  
  // Print 10 random owners for testing
  const ownersArray = Array.from(allUniqueOwners);
  console.log('\n🧪 TEST ADDRESSES (copy one to test the API):');
  console.log('-'.repeat(60));
  
  for (let i = 0; i < Math.min(10, ownersArray.length); i++) {
    console.log(`${i + 1}. ${ownersArray[i]}`);
  }
  
  console.log('\n');
  console.log('📝 TO TEST THE API:');
  console.log('-'.repeat(60));
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Use curl or your browser console:');
  console.log('\ncurl -X POST http://localhost:3000/api/whitelist/verify-nft \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '{"walletAddress": "${ownersArray[0] || '0x...'}"}'`);
  console.log('\n');
}

main().catch(console.error);
