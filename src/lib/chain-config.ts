import { base } from "wagmi/chains";

// ⚠️ CHANGE THIS TO SWITCH CHAINS
// Options: base, sepolia
export const ACTIVE_CHAIN = base; // Change to 'sepolia' for testnet

// Chain-specific settings
export const CHAIN_CONFIG = {
  chain: ACTIVE_CHAIN,
  chainId: ACTIVE_CHAIN.id,
  chainName: ACTIVE_CHAIN.name,
  isTestnet: ACTIVE_CHAIN.testnet || false,
};
