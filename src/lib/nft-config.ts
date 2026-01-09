import { ACTIVE_CHAIN } from "./chain-config";

// NFT Collection Configuration
export const NFT_CONFIG = {
  // Contract address for Protardio-citizens NFT collection
  contractAddress: "0x5d38451841Ee7A2E824A88AFE47b00402157b08d" as `0x${string}`,
  
  // Static wallet address to fetch NFTs from (change this as needed)
  staticWalletAddress: "0x93fA0E828Ab8b72EEEE42747DE3f9C66D1B43a5c" as `0x${string}`,
  
  // Chain info from centralized config
  chain: ACTIVE_CHAIN,
  chainId: ACTIVE_CHAIN.id,
  
  // Collection details
  collectionName: "protardio-citizens",
  collectionSlug: "protardio-citizens",
};

// Scatter API configuration
export const SCATTER_CONFIG = {
  apiUrl: "https://api.scatter.art/v1",
  collectionSlug: NFT_CONFIG.collectionSlug,
};