// User data from Farcaster SIWF
export interface FarcasterUser {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  custodyAddress: string;
  verifiedAddresses: string[];
}

// Neynar API user response
export interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
    primary?: {
      eth_address?: string;
      sol_address?: string;
    };
  };
  follower_count: number;
  following_count: number;
  power_badge: boolean;
  experimental?: {
    neynar_user_score?: number;
  };
  // viewer_context is only present when viewer_fid is passed to the API
  viewer_context?: {
    following: boolean;      // Does the viewer follow this user?
    followed_by: boolean;    // Does this user follow the viewer?
    blocking: boolean;       // Is the viewer blocking this user?
    blocked_by: boolean;     // Is this user blocking the viewer?
  };
}

// Registration data stored in Supabase
export interface Registration {
  id?: string;
  fid: number;
  username: string;
  wallet_address: string;
  neynar_score: number;
  follows_protardio: boolean;
  has_shared: boolean;
  registered_at: string;
  tier: 'phase1_tier1' | 'phase1_tier2' | 'phase1_tier3' | 'phase2_tier1';
  status: 'pending' | 'approved' | 'rejected';
  verification_notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Verification states
export type VerificationState = 'idle' | 'checking' | 'passed' | 'failed';

// App state
export interface AppState {
  user: FarcasterUser | null;
  neynarScore: number | null;
  followsProtardio: boolean | null;
  hasShared: boolean;
  isRegistered: boolean;
  registrationId?: string;
}

// API responses
export interface VerifyScoreResponse {
  success: boolean;
  score: number;
  meetsThreshold: boolean;
  error?: string;
}

export interface VerifyFollowResponse {
  success: boolean;
  isFollowing: boolean;
  error?: string;
}

export interface RegisterResponse {
  success: boolean;
  registration?: Registration;
  error?: string;
  alreadyRegistered?: boolean;
}

// NFT verification types
export interface NftHolding {
  name: string;
  address: string;
  balance: number;
}

export interface VerifyNftResponse {
  success: boolean;
  holds: boolean;
  totalBalance: number;
  holdings: NftHolding[];
  eligibleCollections: string;
  error?: string;
}
