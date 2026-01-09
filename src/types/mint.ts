/**
 * Types for Protardio NFT minting and gallery features
 */

/**
 * Database record for a minted Protardio NFT
 */
export interface ProtardioMint {
  id: string;
  token_id: number;
  minter_fid: number;
  minter_wallet: string;
  minter_username: string | null;
  name: string;
  image_url: string;
  thumbnail_url: string | null;
  tx_hash: string | null;
  minted_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request payload for saving a mint
 * Note: name, imageUrl, thumbnailUrl are optional - server will poll Scatter API for these
 */
export interface SaveMintRequest {
  tokenId: number;
  minterFid: number;
  minterWallet: string;
  minterUsername?: string;
  txHash: string; // Required for tracking
  // These are fetched server-side by polling Scatter API
  name?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

/**
 * Response from save mint API
 */
export interface SaveMintResponse {
  success: boolean;
  message: string;
  data?: ProtardioMint;
  alreadyExists?: boolean;
  error?: string;
  details?: string;
}

/**
 * Friend who has minted (for social display)
 */
export interface FriendWhoMinted {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  tokenId: number;
  protardioName: string;
  protardioImage: string;
  mintedAt: string;
}

/**
 * Response for friends who minted API
 */
export interface FriendsWhoMintedResponse {
  friends: FriendWhoMinted[];
  totalCount: number;
  previewCount: number;
}

/**
 * Gallery item for public display
 */
export interface GalleryItem {
  tokenId: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  minterFid: number;
  minterUsername?: string;
  mintedAt: string;
  // Current owner (fetched on demand)
  currentOwner?: {
    wallet: string;
    fid?: number;
    username?: string;
    pfpUrl?: string;
  };
}

/**
 * Paginated gallery response
 */
export interface GalleryResponse {
  items: GalleryItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * NFT Attribute (trait)
 */
export interface NFTAttribute {
  trait_type: string;
  value: string;
}

/**
 * Trait with rarity info
 */
export interface TraitWithRarity extends NFTAttribute {
  rarity: number; // 0-1, percentage of holders with this trait
  holderCount: number;
}

/**
 * Trait twin match
 */
export interface TraitTwin {
  tokenId: number;
  name: string;
  imageUrl: string;
  ownerFid?: number;
  ownerUsername?: string;
  matchScore: number; // 0-1, how similar they are
  matchingTraits: string[]; // trait values that match
  totalTraits: number;
}

/**
 * Response from trait-twins API
 */
export interface TraitTwinsResponse {
  yourToken: {
    tokenId: number;
    name: string;
    imageUrl: string;
  };
  yourTraits: TraitWithRarity[];
  exactTwins: TraitTwin[]; // 100% match (very rare)
  closeTwins: TraitTwin[]; // 80%+ match
  traitSiblings: TraitTwin[]; // 60%+ match
  rarestTrait: {
    trait_type: string;
    value: string;
    holderCount: number;
    otherHolders: Array<{
      tokenId: number;
      ownerUsername?: string;
      imageUrl: string;
    }>;
  } | null;
  totalProtardios: number;
}
