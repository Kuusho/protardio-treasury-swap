# Protardio Swap - Technical Specification

> **Version:** 0.1.0  
> **Last Updated:** January 2026  
> **Status:** Draft  
> **Author:** Protardio Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Goals & Non-Goals](#goals--non-goals)
4. [Architecture Approaches](#architecture-approaches)
5. [Recommended Approach: Semi-Custodial](#recommended-approach-semi-custodial)
6. [User Experience](#user-experience)
7. [Rarity-Based Swap Mechanics](#rarity-based-swap-mechanics)
8. [Technical Architecture](#technical-architecture)
9. [Database Design](#database-design)
10. [API Specification](#api-specification)
11. [Smart Contract Approach (Phase 2)](#smart-contract-approach-phase-2)
12. [Security Considerations](#security-considerations)
13. [Edge Cases & Error Handling](#edge-cases--error-handling)
14. [Design Considerations](#design-considerations)
15. [Simplification Opportunities](#simplification-opportunities)
16. [On-Chain Components & Security Analysis](#on-chain-components--security-analysis)
17. [Future Enhancements](#future-enhancements)
18. [Open Questions](#open-questions)
19. [Appendix](#appendix)

---

## Executive Summary

Protardio Swap is a treasury swap application that allows Protardio NFT holders to exchange their NFTs with ones held in the project treasury. The primary use cases are:

- **Defect resolution:** Holders with defective Protardios can swap for non-defective ones
- **Trait shopping:** Holders can browse treasury and swap for preferred traits
- **Treasury activation:** Prevents treasury NFTs from sitting idle, creates liquidity events

The system charges a flat 0.001 ETH fee per swap, generating revenue while keeping the barrier low.

---

## Problem Statement

### Current Situation
- Protardio treasury accumulates NFTs through sweeps and trading
- When holders discover defects, the only solution is manual airdrops
- Treasury NFTs sit idle with no utility
- No mechanism for holders to "upgrade" or change their Protardio

### Desired Outcome
- Self-service swap system requiring minimal team intervention
- Treasury becomes active liquidity pool
- Revenue generation through swap fees
- Foundation for open-source protocol other collections can fork

---

## Goals & Non-Goals

### Goals
- [ ] Ship MVP in 1-2 weeks
- [ ] Enable treasury-to-holder swaps with 0.001 ETH fee
- [ ] Farcaster-native authentication
- [ ] Real-time availability (no stale listings)
- [ ] Work as standalone app AND embedded mini app
- [ ] Clean, intuitive UX that feels like a game
- [ ] Lay groundwork for open-source release

### Non-Goals (Phase 1)
- P2P swaps between holders
- Multi-treasury support
- Variable/dynamic fees
- On-chain trustless contract
- Cross-collection swaps
- Auction or bidding mechanics

---

## Architecture Approaches

### Approach A: Semi-Custodial (Recommended for Phase 1)

```
User sends NFT + fee → Backend detects → Backend sends treasury NFT back
```

**How it works:**
1. User creates swap intent via API
2. User sends their NFT + 0.001 ETH to treasury wallet
3. Backend event listener detects incoming transfer
4. Backend matches transfer to pending intent
5. Backend triggers treasury wallet to send requested NFT
6. Swap complete

**Pros:**
- Ship in days, not weeks
- No smart contract risk
- Full control over swap logic
- Easy to pause/modify/debug
- Lower gas (no contract interaction overhead)

**Cons:**
- Requires user trust in team
- Two-step transaction (user sends, treasury sends)
- Backend is single point of failure
- Not forkable without backend infrastructure

**Best for:** Getting to market fast, validating demand, iterating on UX

---

### Approach B: Simple Swap Contract

```
User calls contract.swap(theirTokenId, wantedTokenId) → Atomic exchange
```

**How it works:**
1. Deploy swap contract
2. Treasury approves contract to transfer its NFTs
3. User approves contract to transfer their NFT
4. User calls `swap()` with both token IDs + fee
5. Contract atomically:
   - Transfers user's NFT to treasury
   - Transfers treasury's NFT to user
   - Collects fee

**Pros:**
- Trustless, atomic swaps
- Single transaction for user (after approval)
- Fully on-chain, auditable
- Forkable by other projects
- No backend required for core swap logic

**Cons:**
- 1-2 weeks development + testing
- Smart contract risk (bugs, exploits)
- Approval UX friction (extra transaction)
- Gas overhead from contract execution
- Harder to modify post-deployment

**Best for:** Long-term product, open-source release, trust-minimized UX

---

### Approach C: Hybrid (Recommended Long-term)

```
Phase 1: Semi-custodial (ship fast)
Phase 2: Deploy contract, migrate (trustless)
```

**How it works:**
1. Launch with semi-custodial (Approach A)
2. Gather user feedback, iterate on UX
3. Develop and audit swap contract
4. Migrate to on-chain swaps
5. Open source as "Treasury Swap Protocol"

**Pros:**
- Best of both worlds
- De-risks contract development
- Real user data informs contract design
- Protardio becomes reference implementation

**Cons:**
- Two development cycles
- Migration complexity
- Users may need to re-learn flow

**Best for:** Protardio's specific situation (ship fast + open source vision)

---

### Approach D: Seaport/0x Integration

```
Use existing NFT swap infrastructure (OpenSea's Seaport protocol)
```

**How it works:**
1. Create Seaport orders for each treasury NFT
2. User fulfills order with their NFT + fee
3. Seaport handles atomic swap

**Pros:**
- Battle-tested infrastructure
- No custom contract needed
- Familiar to NFT traders

**Cons:**
- Complex integration
- Less control over UX
- Overkill for single-collection swaps
- Dependency on external protocol

**Best for:** Projects wanting maximum security with minimal contract work

---

## Recommended Approach: Semi-Custodial

For Phase 1, we recommend the semi-custodial approach with the following architecture:

### Why Semi-Custodial?

1. **Speed to market:** Can ship in days
2. **Iteration speed:** Easy to modify swap logic
3. **Risk profile:** No smart contract bugs to worry about
4. **Trust context:** Protardio team is known, trusted by holders
5. **Validation:** Prove demand before investing in contract

### Trust Model

Users trust that:
- Treasury will send the NFT they selected
- Refunds will happen if something goes wrong
- Team won't rug with deposited NFTs

This trust is reasonable because:
- Team is doxxed/known in Farcaster ecosystem
- All transactions are on-chain and auditable
- Reputation risk far outweighs potential gain from rugging

---

## User Experience

### Core Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   CONNECT    │───▶│    BROWSE    │───▶│    SELECT    │      │
│  │  (Farcaster) │    │  (Treasury)  │    │ (Both NFTs)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                 │               │
│                                                 ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   COMPLETE   │◀───│   CONFIRM    │◀───│    SWAP      │      │
│  │  (Success!)  │    │  (Backend)   │    │ (Send + Fee) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed User Journey

#### Step 1: Connect
- User opens app (standalone or mini app)
- Clicks "Connect with Farcaster"
- App fetches user's linked wallet address
- App queries user's Protardio holdings

#### Step 2: Browse Treasury
- User sees grid of available treasury Protardios
- Each card shows: Image, Token ID, Key traits
- Filter options: Trait type, trait value, rarity
- Real-time availability indicators
- "Find Similar" feature (from existing mini app)

#### Step 3: Select NFTs
- User clicks treasury NFT they want → highlighted as "WANT"
- User clicks their NFT they'll trade → highlighted as "GIVE"
- Side-by-side comparison view appears
- Clear display of fee: 0.001 ETH

#### Step 4: Initiate Swap
- User clicks "Swap Now"
- Wallet prompt appears for:
  - NFT transfer to treasury address
  - 0.001 ETH fee (bundled or separate based on implementation)
- User confirms transaction

#### Step 5: Processing
- UI shows "Waiting for confirmation..."
- Backend detects incoming NFT + fee
- Backend validates against swap intent
- Backend triggers outbound transfer

#### Step 6: Completion
- User receives treasury NFT
- UI shows success state with:
  - Before/after comparison
  - Transaction hashes (in, out)
  - "Share on Farcaster" button
- Swap logged to history

### Race Condition UX

Since there are no reservations:

```
┌─────────────────────────────────────────────────────────┐
│                  RACE SCENARIO                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User A selects Protardio #420                         │
│  User B selects Protardio #420 (same one)              │
│                                                         │
│  User A sends transaction... pending                   │
│  User B sends transaction... pending                   │
│                                                         │
│  User A's tx confirms first                            │
│    → User A receives #420 ✓                            │
│    → #420 removed from treasury                        │
│                                                         │
│  User B's tx confirms second                           │
│    → Backend detects #420 no longer available          │
│    → User B's NFT returned                             │
│    → User B's fee returned                             │
│    → User B sees "Sniped! NFT returned."               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**UX for race losers:**
- Clear messaging: "Someone got there first!"
- Automatic refund (no action needed)
- Suggestion to try another NFT
- Transaction links for transparency

---

## Rarity-Based Swap Mechanics

### Loop Mechanics: "The Selection of 10"

The core swap loop is designed to be gamified and fair, leveraging the rarity of the holder's Protardio to influence their potential upgrade paths.

```
User pays fee + selects their Protardio → System presents 10 Random Treasury Protardios → User picks 1
```

### 1. The Fee & Input
- **Fee:** Flat fee (e.g., 0.001 ETH) - *To be confirmed*.
- **Input:** User selects one of their owned Protardios to swap.
- **Rarity Data:** The system calculates the rarity score of the input Protardio using our accurate, full-collection rarity data located in the `ASCII_FINAL` directory.
- **Data Source:** Each Protardio's metadata and rarity score is stored in `ASCII_FINAL/<token_id>.json`. The `attributes` array contains a `trait_type: "Rarity Score"` which holds the specific float value (e.g., `155.08`) used for weighting.

### 2. The Selection Algorithm
Once the fee is paid, the system generates a "Selection of 10" from the treasury. This selection is **random but weighted** by the rarity of the input Protardio.

**Rarity Influence Logic:**
The goal is to give users a chance at an upgrade while maintaining treasury health.
- **Better Input = Better Selection:** If you send a Rare Protardio, your selection of 10 will contain a higher probability of Rare or Legendary items.
- **Gambler's Chance:** Even if you send a Common, there is always a small, non-zero chance to see a Rare/Legendary in your selection.

**Example Probabilities (Conceptual):**

| Input Rarity | Slots in Selection (approx.) |
| :--- | :--- |
| **Common** | 9 Common / 1 Rare (Low chance of Jackpot) |
| **Rare** | 5 Common / 4 Rare / 1 Legendary |
| **Legendary** | 2 Common / 3 Rare / 5 Legendary |

*Note: exact weights to be tuned during implementation.*

### 3. The Choice
- The user is presented with the 10 Protardios using high-fidelity ASCII representations (or standard images if preferred).
- They act as a "booster pack" or "draft pick".
- The user must select **ONE** to complete the swap.
- The rejected 9 return to the pool.
- The input Protardio enters the treasury.

### Data Assets
- **Rarity Calculations:** We utilize the pre-calculated JSON files in `ASCII_FINAL/`. A setup script must parse these files to populate the database with `token_id` and `rarity_score`.
- **ASCII Files:** The `image` property in the JSON (e.g., `https://protardio.com/ascii/44.png`) or the directory content itself can be used. The JSON also contains `trait_encoding_key` helping to decipher the `Trait Code` if needed.
- **Implementation Note:** The backend should ingest all `*.json` files from `ASCII_FINAL` into the `treasury_inventory` table (or a separate `metadata` table) on startup or via a seed script.

### Edge Cases
- **Treasury Depletion:** If < 10 items in treasury, show all available.
- **Timeout:** If user doesn't pick within X minutes, is the fee forfeit? (Proposed: Auto-refund if no selection made in 1 hour).
- **Race Conditions:** If one of the 10 is swapped by another user while this user is deciding? (Reserve the 10 for X minutes).

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         Next.js App                              │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │   │
│  │  │  Auth     │ │ Treasury  │ │   User    │ │    Swap       │   │   │
│  │  │  Context  │ │  Gallery  │ │  Gallery  │ │   Interface   │   │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ REST + WebSocket                   │
│                                    ▼                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                              BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Node.js / Bun                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │   │
│  │  │   API     │ │  Event    │ │   Swap    │ │   Treasury    │   │   │
│  │  │  Server   │ │ Listener  │ │  Engine   │ │   Manager     │   │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                 ┌──────────────────┼──────────────────┐                │
│                 ▼                  ▼                  ▼                │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐   │
│  │     Database      │ │    Base RPC       │ │  Treasury Wallet  │   │
│  │   (PostgreSQL)    │ │   (Alchemy/etc)   │ │    (Private)      │   │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `AuthProvider` | Farcaster authentication | Session management, wallet linking |
| `TreasuryGallery` | Display available NFTs | Grid view, filters, real-time updates |
| `UserGallery` | Display user's NFTs | Grid view, selection state |
| `SwapInterface` | Swap execution UI | Selection summary, fee display, CTA |
| `SwapConfirmation` | Transaction flow | Wallet prompts, status updates |
| `SwapHistory` | Past swaps | Transaction links, before/after |
| `TraitFilter` | Filter by traits | Reuse from existing mini app |

#### Backend Services

| Service | Purpose | Key Responsibilities |
|---------|---------|---------------------|
| `API Server` | Handle HTTP requests | REST endpoints, WebSocket connections |
| `Event Listener` | Monitor blockchain | NFT transfers, ETH receipts to treasury |
| `Swap Engine` | Execute swap logic | Intent matching, validation, execution |
| `Treasury Manager` | Manage treasury wallet | Send NFTs, track holdings |
| `Cache Manager` | Maintain state | Treasury inventory, availability |

### Technology Stack

#### Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend Framework** | Next.js 14 (App Router) | SSR, API routes, Vercel deployment |
| **Styling** | Tailwind CSS | Rapid iteration, consistent design |
| **State Management** | Zustand or Jotai | Lightweight, good for real-time state |
| **Wallet Connection** | wagmi + viem | Modern, type-safe, Base support |
| **Farcaster Auth** | @farcaster/auth-kit | Official SDK |
| **Backend Runtime** | Node.js or Bun | Bun for speed if team familiar |
| **API Framework** | Hono or Express | Hono for edge, Express for familiarity |
| **Database** | PostgreSQL | Reliable, good for relational data |
| **ORM** | Drizzle or Prisma | Type-safe queries |
| **Event Listener** | viem + WebSocket RPC | Real-time event monitoring |
| **Queue (optional)** | BullMQ + Redis | If swap execution needs queuing |
| **Hosting** | Vercel + Railway | Vercel for frontend, Railway for backend |

#### Alternative Stack Options

**Simpler (if existing mini app uses):**
- Stick with whatever framework the mini app uses
- Reuse existing auth, components, API patterns

**More Robust:**
- Add Redis for caching and pub/sub (real-time updates)
- Add job queue for reliable swap execution
- Separate services for listener vs API

---

## Database Design

### Schema

```sql
-- Users table (optional, can derive from Farcaster)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  fid INTEGER UNIQUE NOT NULL,          -- Farcaster ID
  address VARCHAR(42) NOT NULL,          -- Linked wallet
  username VARCHAR(255),                 -- Farcaster username
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW()
);

-- Swap intents (created when user initiates swap)
CREATE TABLE swap_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  wanted_token_id INTEGER NOT NULL,      -- Treasury NFT they want
  offered_token_id INTEGER NOT NULL,     -- Their NFT they're sending
  fee_amount NUMERIC(18, 8) NOT NULL,    -- Expected fee (0.001 ETH)
  status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed, expired
  failure_reason TEXT,                   -- If failed, why
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,                  -- Optional: auto-expire old intents
  processed_at TIMESTAMP
);

-- Completed swaps (permanent record)
CREATE TABLE swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  sent_token_id INTEGER NOT NULL,        -- What user sent
  received_token_id INTEGER NOT NULL,    -- What user received
  fee_collected NUMERIC(18, 8) NOT NULL,
  tx_hash_in VARCHAR(66) NOT NULL,       -- User's transfer tx
  tx_hash_out VARCHAR(66) NOT NULL,      -- Treasury's transfer tx
  completed_at TIMESTAMP DEFAULT NOW()
);

-- Treasury cache (denormalized for fast queries)
CREATE TABLE treasury_inventory (
  token_id INTEGER PRIMARY KEY,
  metadata JSONB,                        -- Cached traits, image URL, etc.
  available BOOLEAN DEFAULT TRUE,
  locked_by UUID REFERENCES swap_intents(id), -- Optional: soft lock
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Refunds (when swaps fail)
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  user_address VARCHAR(42) NOT NULL,
  refunded_token_id INTEGER,             -- NFT returned (if any)
  refunded_fee NUMERIC(18, 8),           -- ETH returned (if any)
  tx_hash_nft VARCHAR(66),               -- NFT refund tx
  tx_hash_fee VARCHAR(66),               -- Fee refund tx
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_intents_status ON swap_intents(status);
CREATE INDEX idx_intents_user ON swap_intents(user_fid);
CREATE INDEX idx_intents_wanted ON swap_intents(wanted_token_id);
CREATE INDEX idx_treasury_available ON treasury_inventory(available);
CREATE INDEX idx_swaps_user ON swaps(user_fid);
```

### State Machine: Swap Intent

```
                    ┌─────────┐
                    │ PENDING │ (Intent created, waiting for tx)
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐  ┌────────────┐  ┌─────────┐
    │ EXPIRED  │  │ PROCESSING │  │ FAILED  │
    │(Timeout) │  │(Tx detected)│  │(Invalid)│
    └──────────┘  └─────┬──────┘  └─────────┘
                        │
             ┌──────────┼──────────┐
             │                     │
             ▼                     ▼
      ┌───────────┐         ┌──────────┐
      │ COMPLETED │         │  FAILED  │
      │ (Success) │         │ (Sniped) │
      └───────────┘         └──────────┘
```

---

## API Specification

### Endpoints

#### Authentication

```
POST /api/auth/farcaster
  - Verify Farcaster signature
  - Create/update user record
  - Return session token

GET /api/auth/me
  - Return current user info
  - Requires auth
```

#### Treasury

```
GET /api/treasury
  - List all available treasury NFTs
  - Query params: trait filters, pagination
  - Response: { nfts: [...], total: number }

GET /api/treasury/:tokenId
  - Get single treasury NFT details
  - Response: { tokenId, metadata, available }

GET /api/treasury/stats
  - Treasury statistics
  - Response: { total, available, swappedToday, swappedAllTime }
```

#### User

```
GET /api/user/nfts
  - List authenticated user's Protardios
  - Requires auth
  - Response: { nfts: [...] }

GET /api/user/swaps
  - User's swap history
  - Requires auth
  - Response: { swaps: [...] }

GET /api/user/pending
  - User's pending swap intents
  - Requires auth
  - Response: { intents: [...] }
```

#### Swap

```
POST /api/swap/intent
  - Create swap intent
  - Requires auth
  - Body: { wantedTokenId, offeredTokenId }
  - Response: { intentId, treasuryAddress, fee, expiresAt }

GET /api/swap/intent/:intentId
  - Get intent status
  - Response: { intent, status }

DELETE /api/swap/intent/:intentId
  - Cancel pending intent (if not yet processed)
  - Requires auth

GET /api/swap/:swapId
  - Get completed swap details
  - Response: { swap }
```

#### WebSocket

```
WS /api/ws
  - Real-time updates
  - Events:
    - treasury:update (NFT availability changed)
    - swap:processing (user's swap being processed)
    - swap:completed (user's swap done)
    - swap:failed (user's swap failed)
```

### API Response Formats

```typescript
// Success response
{
  success: true,
  data: { ... }
}

// Error response
{
  success: false,
  error: {
    code: "SWAP_FAILED",
    message: "The NFT you wanted was claimed by someone else",
    details: { ... }
  }
}
```

---

## Smart Contract Approach (Phase 2)

### Contract Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ProtardioSwap is Ownable, ReentrancyGuard {
    IERC721 public immutable protardio;
    address public treasury;
    uint256 public swapFee;
    bool public paused;
    
    event Swapped(
        address indexed user,
        uint256 sentTokenId,
        uint256 receivedTokenId,
        uint256 fee
    );
    
    constructor(
        address _protardio,
        address _treasury,
        uint256 _swapFee
    ) {
        protardio = IERC721(_protardio);
        treasury = _treasury;
        swapFee = _swapFee;
    }
    
    function swap(
        uint256 userTokenId,
        uint256 treasuryTokenId
    ) external payable nonReentrant {
        require(!paused, "Swaps paused");
        require(msg.value >= swapFee, "Insufficient fee");
        
        // Verify ownership
        require(
            protardio.ownerOf(userTokenId) == msg.sender,
            "Not your NFT"
        );
        require(
            protardio.ownerOf(treasuryTokenId) == treasury,
            "Not in treasury"
        );
        
        // Execute atomic swap
        protardio.transferFrom(msg.sender, treasury, userTokenId);
        protardio.transferFrom(treasury, msg.sender, treasuryTokenId);
        
        // Refund excess fee
        if (msg.value > swapFee) {
            payable(msg.sender).transfer(msg.value - swapFee);
        }
        
        emit Swapped(msg.sender, userTokenId, treasuryTokenId, swapFee);
    }
    
    // Admin functions
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
    
    function setSwapFee(uint256 _fee) external onlyOwner {
        swapFee = _fee;
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
```

### Deployment Considerations

1. **Approval Flow:**
   - Treasury must call `setApprovalForAll(swapContract, true)`
   - Each user must approve before first swap

2. **Gas Optimization:**
   - Consider batch approvals
   - Minimize storage operations

3. **Upgrade Path:**
   - Deploy as non-upgradeable (simpler)
   - Or use proxy pattern if anticipate changes

4. **Audit:**
   - Get professional audit before mainnet
   - Or rely on simplicity + extensive testing

---

## Security Considerations

### Semi-Custodial Risks

| Risk | Mitigation |
|------|------------|
| Treasury wallet compromise | Hardware wallet, multisig, limited hot wallet |
| Backend compromise | Separate signing service, rate limits |
| Replay attacks | Unique intent IDs, nonce tracking |
| Front-running | Minimal MEV exposure (simple transfers) |

### Operational Security

1. **Treasury Wallet:**

### Dependency Requirements
-   **Supabase:** Uses `@supabase/supabase-js`.
-   **Auth:** Uses `next-auth` configured in `src/auth.ts`.
-   **State:** `zustand` (install if missing).
-   **Root Location:** `/home/kuusho/solSociety/protardio-treasury-swap/Protardio`

---

## Implementation Prompts for Claude Code

> **NOTE TO AGENT:** A reference implementation (Scaffold) has been generated for you in the codebase. Use these files as a starting point. Validate them, fix any integration issues, and ensure they match the spec.

### Prompt 0: Environment Setup & Reference Check

```text
We are integrating the Swap feature into the existing `Protardio` folder.
1. Inspect the `Protardio/` directory to understand the Next.js 15 + Supabase structure.
2. Run `./install_dependencies.sh` in the root (this installs `zustand` and root tools).
3. Review `tools/` folder for data inspection tools.
4. **Identify Reference Files:** Locate the following files already created for you:
   - `supabase/migrations/20240109000000_add_swap_tables.sql`
   - `Protardio/scripts/seed_treasury.ts`
   - `Protardio/src/app/api/swap/` (quote and intent routes)
   - `Protardio/src/components/swap/` (TreasuryGallery and SwapInterface)
   - `Protardio/src/app/swap/page.tsx`
```

### Prompt 1: Database Schema & Migration

```text
1. Review the existing migration file: `supabase/migrations/20240109000000_add_swap_tables.sql`.
2. Ensure it correctly defines `treasury_inventory` (with rarity_score, metadata), `swap_intents`, and `swaps`.
3. If it looks correct, instruct the user to apply it (or apply it if you have access).
```

### Prompt 2: Metadata Seeding

```text
1. Review the reference script: `Protardio/scripts/seed_treasury.ts`.
2. This script uses a "streaming" approach to handle the large `ASCII_FINAL` dataset without crashing memory.
3. Verify it imports `createServerClient` correctly (check relative paths).
4. Run the script: `npx tsx Protardio/scripts/seed_treasury.ts`.
5. Verify data in Supabase (count rows).
```

### Prompt 3: Backend API Validation

```text
1. Inspect `Protardio/src/app/api/swap/quote/route.ts`:
   - Verify it selects 10 random available tokens from `treasury_inventory`.
   - Improve the logic if needed (e.g., ensure `valid=true` and `available=true`).
2. Inspect `Protardio/src/app/api/swap/intent/route.ts`:
   - Verify it uses `src/auth.ts` to get the session/FID.
   - Verify it creates a record in `swap_intents`.
3. Test these endpoints (using curl or a test script) if possible.
```

### Prompt 4: Frontend Component Integration

```text
1. Review `Protardio/src/components/swap/TreasuryGallery.tsx` and `SwapInterface.tsx`.
2. Ensure they import `zustand` if state management is complex (current reference might use local state `useState`, which is fine for MVP).
3. Check styling consistency with the rest of the app (Tailwind usage).
```

### Prompt 5: Final Verification

```text
1. Run `npm run dev` in `Protardio`.
2. Visit `/swap` (defined in `Protardio/src/app/swap/page.tsx`).
3. Walk through the mock flow:
   - "Select" a token (enter ID manually for now).
   - "Get Quote" (should show 10 options).
   - "Select Upgrade".
   - "Confirm" (should show deposit address).
```



---

## Edge Cases & Error Handling

### Edge Case Matrix

| Scenario | Detection | Response |
|----------|-----------|----------|
| User sends wrong NFT | Compare token ID to intent | Refund NFT, mark failed |
| User sends to wrong address | Won't be detected by listener | N/A (user error) |
| Fee too low | Check msg.value / ETH received | Refund NFT, mark failed |
| NFT already claimed (race) | Treasury no longer owns | Refund NFT + fee |
| User sends NFT but no fee | Partial detection | Hold NFT, notify user, timeout refund |
| User sends fee but no NFT | Detect ETH without NFT | Refund fee after timeout |
| Transaction reverts | No event emitted | No action needed |
| Backend down during swap | User's tx confirms, backend offline | Process on restart (idempotent) |
| Double-spend attempt | Unique intent ID | Reject duplicate |
| Intent expires mid-transaction | Tx confirms after expiry | Process anyway (user's tx is source of truth) |

### Error Messages (User-Facing)

```typescript
const ERROR_MESSAGES = {
  SNIPED: "Oops! Someone else grabbed that Protardio. Your NFT and fee have been returned.",
  WRONG_NFT: "You sent a different NFT than selected. It's been returned to you.",
  INSUFFICIENT_FEE: "The fee was too low. Your NFT has been returned.",
  NOT_YOUR_NFT: "You don't own the NFT you're trying to swap.",
  NOT_AVAILABLE: "This Protardio is no longer available.",
  INTENT_EXPIRED: "Your swap request expired. Please try again.",
  ALREADY_SWAPPED: "You've already completed this swap.",
  RATE_LIMITED: "Too many swap attempts. Please wait a few minutes.",
};
```

---

## Design Considerations

### Visual Design Principles

1. **Gallery-First:**
   - NFTs are the star, minimize chrome
   - Large, high-quality images
   - Smooth hover states and transitions

2. **Two-Panel Selection:**
   - Clear visual distinction: "WANT" vs "GIVE"
   - Side-by-side comparison before confirming
   - Trait diff highlighting (what you're gaining/losing)

3. **Status Clarity:**
   - Available NFTs clearly distinguished from unavailable
   - Real-time "just claimed" animations
   - Progress indicators during swap

4. **Mobile-First:**
   - Swipe between treasury/user galleries
   - Bottom sheet for swap confirmation
   - Touch-friendly selection

### Color & Theming

Consider using Protardio's existing brand:
- Primary action color for swap CTA
- Success/failure states with clear colors
- Dark mode support (Farcaster native)

### Animation Ideas

- NFT "flies" from treasury to user on completion
- Shake/pulse when NFT gets sniped
- Confetti on successful swap
- Skeleton loading states

---

## Simplification Opportunities

### Things That Could Be Cut (MVP)

| Feature | Complexity | Cut? | Rationale |
|---------|------------|------|-----------|
| Trait filtering | Medium | Keep | Already exists in mini app |
| Swap history | Low | Keep | Simple, adds trust |
| WebSocket real-time | Medium | Maybe | Polling acceptable for MVP |
| Find similar | Medium | Cut | Nice-to-have, not core |
| Refund automation | High | Simplify | Manual refunds acceptable initially |
| Admin dashboard | Medium | Cut | Use database directly |

### Simplified MVP Flow

```
1. Connect Farcaster
2. See treasury NFTs (grid)
3. See your NFTs (grid)
4. Click one from each
5. Click "Swap" → wallet prompt
6. Wait for confirmation
7. Done (or error message)
```

No real-time updates, no fancy animations, no filtering—just the core swap.

### Simplest Possible Backend

```typescript
// Entire backend could be ~200 lines

// 1. Endpoint to create intent
app.post('/intent', async (req, res) => {
  const { wantedId, offeredId, userAddress } = req.body;
  const intent = await db.createIntent({ wantedId, offeredId, userAddress });
  return res.json({ intentId: intent.id, treasuryAddress: TREASURY });
});

// 2. Event listener (runs separately)
const listener = async () => {
  // Watch for Transfer events to treasury
  // Match to pending intents
  // Execute swap
};

// 3. Endpoint to check status
app.get('/intent/:id', async (req, res) => {
  const intent = await db.getIntent(req.params.id);
  return res.json(intent);
});
```

---

## Future Enhancements

### Phase 2: On-Chain Contract
- Deploy trustless swap contract
- Migrate from semi-custodial
- Open source as protocol

### Phase 3: P2P Swaps
- Holder-to-holder trading
- Order book or request-based
- Escrow mechanics

### Phase 4: Multi-Collection
- Support other NFT collections
- Generic treasury swap protocol
- Fee structure for protocol usage

### Other Ideas
- **Trait-specific queues:** "Notify me when a gold background enters treasury"
- **Swap streaks:** Gamification, rewards for frequent swappers
- **Treasury stats:** Public dashboard of swap activity
- **Farcaster frames:** Swap directly from a cast
- **Auction mode:** Bid on rare treasury pieces

---

## Open Questions

### Business
- [ ] What percentage of treasury should remain "reserved" (not swappable)?
- [ ] Should defective NFTs be flagged in metadata?
- [ ] Will there be swap limits per user?
- [ ] How will this be announced to holders?

### Technical
- [ ] What's the existing mini app stack? (Framework, hosting)
- [ ] Where is metadata currently hosted/indexed?
- [ ] What's the treasury wallet address?
- [ ] Is there an existing backend, or is the mini app fully client-side?
- [ ] What RPC provider is currently used?

### UX
- [ ] Should users be able to swap multiple NFTs in one session?
- [ ] How prominently should the fee be displayed?
- [ ] Should there be a "preview" of what the Protardio looks like in your collection?

---

## On-Chain Components & Security Analysis

### Core On-Chain Components

#### Component 1: Protardio NFT Contract (Existing)

```
Address: 0x5d38451841ee7a2e824a88afe47b00402157b08d
Chain: Base
Standard: ERC-721
```

**Interactions Required:**
| Function | Purpose | Called By |
|----------|---------|-----------|
| `ownerOf(tokenId)` | Verify ownership | Frontend, Backend, Contract |
| `transferFrom(from, to, tokenId)` | Execute transfers | User wallet, Treasury wallet |
| `setApprovalForAll(operator, bool)` | Approve swap contract | User (Phase 2), Treasury |
| `isApprovedForAll(owner, operator)` | Check approvals | Frontend, Contract |
| `balanceOf(owner)` | Count holdings | Frontend |

**Security Considerations:**
- Contract is immutable (no admin functions that could rug)
- Standard ERC-721, well-audited pattern
- No unusual transfer restrictions

---

#### Component 2: Treasury Wallet

```
Type: EOA (Externally Owned Account) or Multisig
Role: Holds treasury NFTs, executes outbound swaps
```

**Phase 1 (Semi-Custodial):**
```
┌─────────────────────────────────────────────────┐
│              TREASURY WALLET                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Responsibilities:                              │
│  • Receive incoming NFTs from users             │
│  • Receive swap fees (ETH)                      │
│  • Send requested NFTs to users                 │
│  • Process refunds when swaps fail              │
│                                                 │
│  Controlled By:                                 │
│  • Backend service (automated)                  │
│  • Team multisig (manual override)              │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Recommended Setup:**
```
Option A: Hot Wallet + Cold Storage
┌──────────────┐     ┌──────────────┐
│  Hot Wallet  │     │ Cold Storage │
│  (Automated) │     │  (Multisig)  │
├──────────────┤     ├──────────────┤
│ 50-100 NFTs  │◀────│ Bulk of      │
│ For swaps    │     │ treasury     │
│ Limited ETH  │     │ Team-held    │
└──────────────┘     └──────────────┘
        │
        │ Refill when low
        │
```

**Option B: Smart Contract Treasury (Phase 2)**
```solidity
// Treasury held by swap contract itself
// Reduces trust assumptions
// Adds complexity
```

---

#### Component 3: Swap Contract (Phase 2)

```solidity
// Core state variables
address public protardioContract;
address public treasury;
address public feeRecipient;
uint256 public baseFee;
bool public paused;
mapping(uint256 => uint256) public rarityScores;

// Core functions
function pickSwap(uint256 userTokenId, uint256 treasuryTokenId) external payable;
function luckySwap(uint256 userTokenId, uint8 tier) external payable;
function setRarityScore(uint256 tokenId, uint256 score) external onlyOwner;
function pause() external onlyOwner;
function withdrawFees() external onlyOwner;
```

**Contract Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROTARDIO SWAP CONTRACT                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   SwapCore.sol  │  │  RarityFees.sol │  │  LuckySwap.sol  │ │
│  │                 │  │                 │  │                 │ │
│  │ • pickSwap()    │  │ • calcFee()     │  │ • luckySwap()   │ │
│  │ • validation    │  │ • tierLookup()  │  │ • VRF callback  │ │
│  │ • transfers     │  │ • updateScores()│  │ • randomSelect()│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
│                    ┌───────────▼───────────┐                   │
│                    │    Ownable.sol        │                   │
│                    │    ReentrancyGuard    │                   │
│                    │    Pausable.sol       │                   │
│                    └───────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### Component 4: VRF (Verifiable Random Function) - Lucky Swap Only

```
Provider: Chainlink VRF v2.5
Chain: Base (supported)
```

**Integration Flow:**
```
User calls luckySwap()
        │
        ▼
Contract requests randomness from Chainlink
        │
        ▼
VRF Coordinator generates random number
        │
        ▼
Callback: fulfillRandomWords() executes swap
        │
        ▼
User receives random treasury NFT
```

**Cost Per Request:** ~$0.10-0.25 in LINK

---

#### Component 5: Event Listener Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT LISTENER STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Data Sources:                                                  │
│  ┌─────────────────┐                                           │
│  │ Base RPC (WSS)  │──┐                                        │
│  │ Alchemy/Infura  │  │                                        │
│  └─────────────────┘  │                                        │
│  ┌─────────────────┐  │     ┌─────────────────┐                │
│  │ Backup RPC      │──┼────▶│  Event Parser   │                │
│  │ QuickNode/etc   │  │     │                 │                │
│  └─────────────────┘  │     │ • Transfer evts │                │
│  ┌─────────────────┐  │     │ • ETH receipts  │                │
│  │ The Graph       │──┘     │ • Validation    │                │
│  │ (Indexed data)  │        └────────┬────────┘                │
│  └─────────────────┘                 │                         │
│                                      ▼                         │
│                          ┌─────────────────────┐               │
│                          │   Swap Executor     │               │
│                          │                     │               │
│                          │ • Match to intent   │               │
│                          │ • Trigger treasury  │               │
│                          │ • Update database   │               │
│                          └─────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Events Monitored:**
```solidity
// ERC-721 Transfer to treasury
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

// ETH received (if using receive() function)
event Received(address indexed from, uint256 amount);
```

---

### Security Risks & Worst Case Scenarios

#### Risk Matrix

| Risk | Likelihood | Impact | Severity | Phase |
|------|------------|--------|----------|-------|
| Treasury wallet compromise | Low | Critical | **CRITICAL** | 1 & 2 |
| Smart contract bug | Medium | Critical | **CRITICAL** | 2 |
| Backend compromise | Medium | High | **HIGH** | 1 |
| Rarity data manipulation | Medium | Medium | **MEDIUM** | 1 & 2 |
| VRF manipulation | Low | Medium | **MEDIUM** | 2 |
| DoS/Rate limiting failure | Medium | Low | **LOW** | 1 & 2 |
| Race condition exploits | Medium | Low | **LOW** | 1 |
| Front-running | Low | Low | **LOW** | 2 |

---

#### CRITICAL: Treasury Wallet Compromise

**Scenario:**
```
Attacker gains access to treasury wallet private key
        │
        ▼
Drains all treasury NFTs and ETH
        │
        ▼
Total loss: Entire treasury value + collected fees
```

**Attack Vectors:**
- Compromised server/environment variables
- Social engineering team members
- Malware on team devices
- Insider threat

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Hardware wallet | Ledger/Trezor for treasury | Low |
| Multisig | Gnosis Safe, 2-of-3 or 3-of-5 | Medium |
| Hot/cold split | Limited hot wallet, bulk in cold | Medium |
| Key rotation | Regular rotation schedule | Medium |
| Access logging | Monitor all treasury transactions | Low |
| Geofencing | Restrict access by IP/region | Medium |

**Worst Case Recovery:**
- Immediately pause all swaps
- Notify community transparently
- If using multisig: revoke compromised signer
- Assess losses, consider insurance/recovery fund

---

#### CRITICAL: Smart Contract Bug (Phase 2)

**Scenario:**
```
Vulnerability in swap contract allows:
  • Stealing NFTs without paying
  • Draining contract ETH
  • Manipulating randomness
  • Locking funds permanently
```

**Historical Examples:**
- Reentrancy (The DAO hack)
- Integer overflow (pre-0.8.0)
- Access control failures
- Logic errors in swap execution

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Professional audit | Trail of Bits, OpenZeppelin, etc. | High ($$$) |
| Formal verification | For critical functions | Very High |
| Bug bounty | Immunefi, HackerOne | Medium |
| Timelock | Delay on admin functions | Low |
| Upgrade path | Proxy pattern OR emergency pause | Medium |
| Limited contract balance | Sweep fees regularly | Low |
| Test coverage | >95% with fuzzing | Medium |

**Recommended Contract Security Stack:**
```solidity
// Use battle-tested libraries
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Add emergency functions
function emergencyPause() external onlyOwner {
    _pause();
}

function emergencyWithdrawNFT(uint256 tokenId, address to) external onlyOwner {
    require(paused(), "Must be paused");
    protardio.transferFrom(address(this), to, tokenId);
}
```

**Worst Case Recovery:**
- Pause contract immediately
- Assess scope of vulnerability
- If upgradeable: deploy fix
- If not upgradeable: deploy new contract, migrate
- Compensate affected users if possible

---

#### HIGH: Backend Compromise (Phase 1)

**Scenario:**
```
Attacker gains access to backend server
        │
        ▼
Can trigger unauthorized treasury transfers
        │
        ▼
Drains treasury to attacker-controlled addresses
```

**Attack Vectors:**
- Server vulnerability exploitation
- Compromised dependencies (supply chain)
- Exposed API keys/credentials
- SSH key compromise

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Principle of least privilege | Backend can only send to verified addresses | Medium |
| Transaction signing service | Separate from main backend | High |
| Rate limiting | Max swaps per hour | Low |
| Anomaly detection | Alert on unusual patterns | Medium |
| Intent verification | Double-check user actually sent NFT | Low |
| Audit logging | Immutable logs of all actions | Low |

**Architecture Improvement:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Server    │────▶│  Signing Queue  │────▶│ Treasury Signer │
│   (Public)      │     │  (Internal)     │     │ (Air-gapped)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
   Validates             Queues valid              Signs & submits
   requests              swap requests             transactions
```

---

#### MEDIUM: Rarity Data Manipulation

**Scenario:**
```
Attacker manipulates rarity scores to:
  • Undervalue their NFT (pay less fee)
  • Overvalue treasury NFT (get it cheap)
```

**Attack Vectors:**
- Compromise rarity data source
- Exploit stale data window
- Inject false data via API
- Manipulate on-chain metadata (if mutable)

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Multiple data sources | Cross-reference OpenSea, on-chain, custom | Medium |
| Immutable scores | Lock scores after calculation | Low |
| Admin review | Manual approval for large differential swaps | Low |
| Update delays | Time-lock rarity score changes | Low |
| On-chain scoring | Calculate from immutable metadata | High |

---

#### MEDIUM: VRF Manipulation (Lucky Swap)

**Scenario:**
```
Attacker manipulates randomness to:
  • Always receive rare NFTs
  • Predict outcomes before committing
```

**Attack Vectors:**
- Weak randomness source (block hash only)
- VRF provider compromise (unlikely for Chainlink)
- Revert on unfavorable outcome

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Use Chainlink VRF | Gold standard randomness | Medium |
| Commit-reveal backup | If VRF unavailable | Medium |
| No revert on callback | User can't reject bad outcome | Low |
| Request fee | User pays VRF cost upfront | Low |

```solidity
// Prevent revert manipulation
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    // Store result, don't transfer in callback
    pendingResults[requestId] = randomWords[0];
    // User must call claim() separately
}

function claim(uint256 requestId) external {
    require(msg.sender == requestToUser[requestId], "Not your request");
    uint256 randomResult = pendingResults[requestId];
    // Execute swap based on randomResult
}
```

---

#### LOW: Race Condition Exploits

**Scenario:**
```
Attacker exploits the no-reservation model:
  • Monitors mempool for swap intents
  • Front-runs desirable swaps
  • Always snipes rare NFTs
```

**Impact:** Frustrating UX, but no direct financial loss

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Private mempool | Use Flashbots Protect on Base | Low |
| Commit-reveal | Hide target NFT until commit | Medium |
| Soft reservations | Brief hold period (optional) | Low |
| Rate limiting | Per-user swap limits | Low |

---

#### LOW: DoS / Rate Limiting Failure

**Scenario:**
```
Attacker floods system with:
  • Fake swap intents (never completed)
  • Rapid-fire swaps monopolizing treasury
  • API requests crashing backend
```

**Mitigations:**
| Mitigation | Implementation | Effort |
|------------|----------------|--------|
| Intent deposit | Small ETH deposit to create intent | Medium |
| Rate limits | Max 5 intents per user per hour | Low |
| Cooldown | 1 swap per user per 10 minutes | Low |
| Cloudflare/WAF | DDoS protection | Low |
| Queue system | BullMQ for controlled processing | Medium |

---

### Security Checklist by Phase

#### Phase 1 (Semi-Custodial) Launch Checklist

```
Treasury Security:
[ ] Hardware wallet or multisig for treasury
[ ] Private key stored in secure secret manager
[ ] Hot wallet has limited holdings (<20% of treasury)
[ ] Backup recovery procedure documented

Backend Security:
[ ] All endpoints authenticated
[ ] Rate limiting implemented
[ ] Input validation on all parameters
[ ] SQL injection prevention (parameterized queries)
[ ] Audit logging enabled
[ ] Error messages don't leak sensitive info

Infrastructure:
[ ] HTTPS everywhere
[ ] Environment variables secured
[ ] Dependencies audited (npm audit, Snyk)
[ ] Monitoring and alerting configured
[ ] Incident response plan documented

Operational:
[ ] Pause mechanism tested
[ ] Refund procedure documented
[ ] Team roles and permissions defined
[ ] Communication channels for incidents
```

#### Phase 2 (On-Chain) Launch Checklist

```
Contract Security:
[ ] Professional audit completed
[ ] All audit findings addressed
[ ] Testnet deployment tested extensively
[ ] Fuzz testing performed
[ ] Bug bounty program live
[ ] Emergency pause tested
[ ] Upgrade/migration path defined

VRF Integration (if Lucky Swap):
[ ] Chainlink VRF subscription funded
[ ] Callback gas limits tested
[ ] Fallback for VRF failure implemented

Deployment:
[ ] Deployer wallet secured
[ ] Constructor parameters verified
[ ] Contract verified on Basescan
[ ] Admin functions tested
[ ] Ownership transfer to multisig
```

---

### Incident Response Plan

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCIDENT SEVERITY LEVELS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SEV 1 (Critical): Active exploit, funds at risk               │
│  → Immediate pause, all hands on deck                          │
│  → Response time: <15 minutes                                  │
│                                                                 │
│  SEV 2 (High): Vulnerability discovered, not yet exploited     │
│  → Pause if necessary, assess and patch                        │
│  → Response time: <1 hour                                      │
│                                                                 │
│  SEV 3 (Medium): Bug affecting UX, no fund risk                │
│  → Fix in next deployment                                      │
│  → Response time: <24 hours                                    │
│                                                                 │
│  SEV 4 (Low): Minor issue, no user impact                      │
│  → Track in backlog                                            │
│  → Response time: Next sprint                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Response Procedure:**
1. **Detect:** Monitoring alert OR user report
2. **Assess:** Determine severity and scope
3. **Contain:** Pause if funds at risk
4. **Communicate:** Notify team, then community if needed
5. **Resolve:** Deploy fix or workaround
6. **Review:** Post-mortem within 48 hours

---

## Appendix

### A. Protardio Contract Reference

```
Chain: Base
Contract: 0x5d38451841ee7a2e824a88afe47b00402157b08d
Standard: ERC-721
```

Key functions to interact with:
- `ownerOf(tokenId)` - Check ownership
- `transferFrom(from, to, tokenId)` - Transfer NFT
- `setApprovalForAll(operator, approved)` - Approve contract (Phase 2)
- `balanceOf(owner)` - Count user's NFTs
- `tokenOfOwnerByIndex(owner, index)` - Enumerate (if supported)

### B. Fee Economics

At 0.001 ETH per swap (~$2.50 at current prices):

| Swaps/Day | Daily Revenue | Monthly Revenue |
|-----------|---------------|-----------------|
| 10 | 0.01 ETH | 0.3 ETH |
| 50 | 0.05 ETH | 1.5 ETH |
| 100 | 0.1 ETH | 3 ETH |

Revenue goes to treasury, can fund:
- More sweeps (grow treasury)
- Development costs
- Community initiatives

### C. Related Projects / Inspiration

- **Sudoswap:** AMM for NFTs (too complex for this use case)
- **NFTTrader:** P2P NFT swaps (good UX reference)
- **Blur:** Lending/swap mechanics (institutional focus)
- **Tensor:** Solana NFT swaps (fast UX)

### D. Farcaster Mini App Resources

- [Mini App Documentation](https://docs.farcaster.xyz/developers/frames/v2)
- [@farcaster/auth-kit](https://www.npmjs.com/package/@farcaster/auth-kit)
- [Farcaster Hub](https://docs.farcaster.xyz/hubble/intro)

---

## Implementation Decisions (MVP Phase 1)

### Final Architecture Choices

Based on planning discussions, the following decisions have been made for MVP:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Swap Mode** | Pick Swap Only | Simpler to build, validates core UX before adding Lucky Swap |
| **Fee Model** | Tier-Based (4 tiers) | Easy to explain, prevents treasury value bleed |
| **Backend** | Supabase Edge Functions | Pairs with existing Supabase setup, serverless |
| **Real-time Updates** | Polling (15s) | Simpler than WebSocket for MVP |
| **Transaction Flow** | Two-step | User sends NFT + fee separately (or combined) |
| **Rarity Source** | On-chain trait scoring | Automated, no manual data entry needed |

### MVP Scope

**Included:**
- [x] Pick Swap with tier-based fees
- [x] Treasury gallery with filtering by rarity
- [x] User NFT selection
- [x] Swap confirmation modal with fee breakdown
- [x] Progress tracking during swap
- [x] Swap history
- [x] Automatic refunds on race condition loss

**Deferred to Phase 1.5+:**
- [ ] Lucky Swap (random)
- [ ] WebSocket real-time updates
- [ ] "Find Similar" feature
- [ ] Admin dashboard
- [ ] Trait-specific notifications

---

## Database Schema (SQL Ready to Copy)

### Migration 001: Core Swap Tables

```sql
-- Treasury Inventory: Cache of NFTs held by treasury wallet
CREATE TABLE treasury_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(255),
  image_url TEXT,
  thumbnail_url TEXT,
  attributes JSONB,  -- Array of {trait_type, value}
  rarity_tier VARCHAR(20) NOT NULL DEFAULT 'common',
  rarity_score DECIMAL(10,4) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  reserved_for_swap_id UUID,
  reserved_until TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rarity_tier CHECK (rarity_tier IN ('common', 'uncommon', 'rare', 'legendary'))
);

-- Rarity Scores: Pre-calculated rarity data for all tokens
CREATE TABLE rarity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL UNIQUE,
  trait_counts JSONB NOT NULL,
  rarity_score DECIMAL(10,4) NOT NULL,
  rarity_tier VARCHAR(20) NOT NULL,
  percentile DECIMAL(5,2),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_rarity_tier CHECK (rarity_tier IN ('common', 'uncommon', 'rare', 'legendary'))
);

-- Swap Intents: Pending swap requests
CREATE TABLE swap_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_username VARCHAR(100),
  user_token_id INTEGER NOT NULL,
  treasury_token_id INTEGER NOT NULL,
  user_rarity_tier VARCHAR(20) NOT NULL,
  treasury_rarity_tier VARCHAR(20) NOT NULL,
  fee_amount_wei VARCHAR(78) NOT NULL,
  fee_amount_eth DECIMAL(18,8) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  user_nft_tx_hash VARCHAR(66),
  user_fee_tx_hash VARCHAR(66),
  treasury_send_tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT now(),
  nft_received_at TIMESTAMPTZ,
  fee_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'nft_received', 'fee_received', 'executing',
    'completed', 'failed', 'expired', 'refunded'
  ))
);

-- Completed Swaps: Permanent record
CREATE TABLE swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  user_fid INTEGER NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  user_username VARCHAR(100),
  user_token_id INTEGER NOT NULL,
  treasury_token_id INTEGER NOT NULL,
  user_rarity_tier VARCHAR(20) NOT NULL,
  treasury_rarity_tier VARCHAR(20) NOT NULL,
  fee_amount_eth DECIMAL(18,8) NOT NULL,
  user_nft_tx_hash VARCHAR(66) NOT NULL,
  treasury_send_tx_hash VARCHAR(66) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ NOT NULL
);

-- Refunds: Track refunded transactions
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES swap_intents(id),
  refund_type VARCHAR(20) NOT NULL,
  nft_token_id INTEGER,
  fee_amount_eth DECIMAL(18,8),
  user_address VARCHAR(42) NOT NULL,
  refund_tx_hash VARCHAR(66),
  status VARCHAR(20) DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_refund_type CHECK (refund_type IN ('nft', 'fee', 'both'))
);
```

### Migration 002: Indexes

```sql
-- Treasury inventory indexes
CREATE INDEX idx_treasury_available ON treasury_inventory(is_available) WHERE is_available = true;
CREATE INDEX idx_treasury_rarity ON treasury_inventory(rarity_tier);
CREATE INDEX idx_treasury_token_id ON treasury_inventory(token_id);

-- Swap intents indexes
CREATE INDEX idx_swap_intents_status ON swap_intents(status);
CREATE INDEX idx_swap_intents_user ON swap_intents(user_fid);
CREATE INDEX idx_swap_intents_expires ON swap_intents(expires_at) WHERE status = 'pending';
CREATE INDEX idx_swap_intents_treasury_token ON swap_intents(treasury_token_id);

-- Rarity scores indexes
CREATE INDEX idx_rarity_token ON rarity_scores(token_id);
CREATE INDEX idx_rarity_tier ON rarity_scores(rarity_tier);
CREATE INDEX idx_rarity_score ON rarity_scores(rarity_score DESC);

-- Swaps indexes
CREATE INDEX idx_swaps_user ON swaps(user_fid);
CREATE INDEX idx_swaps_completed ON swaps(completed_at DESC);

-- Refunds indexes
CREATE INDEX idx_refunds_intent ON refunds(intent_id);
CREATE INDEX idx_refunds_status ON refunds(status);
```

---

## Supabase Edge Functions Setup Guide

### Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Initialize Supabase in project (if not already):
```bash
supabase init
```

3. Login to Supabase:
```bash
supabase login
```

### Creating Edge Functions

#### 1. Treasury Sync Function

```bash
supabase functions new treasury-sync
```

This function syncs treasury wallet holdings to the database.

**Trigger:** Cron (every 5 minutes) or manual

**Environment Variables Required:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TREASURY_WALLET_ADDRESS`
- `ALCHEMY_API_KEY` (optional, for NFT API)

#### 2. Swap Event Listener

```bash
supabase functions new swap-event-listener
```

Monitors Base chain for NFT and ETH transfers to treasury.

**Trigger:** Cron (every 15 seconds) or Alchemy Webhook

**Key Logic:**
```typescript
// Watch for Transfer events to treasury
const logs = await client.getLogs({
  address: PROTARDIO_CONTRACT,
  event: TRANSFER_EVENT,
  args: { to: TREASURY_WALLET },
  fromBlock: lastBlock,
  toBlock: currentBlock,
});
```

#### 3. Swap Executor

```bash
supabase functions new swap-executor
```

Sends treasury NFTs to users when swap conditions are met.

**Trigger:** Called by event listener or cron

**Security:** Private key stored in Supabase Vault

### Deploying Edge Functions

```bash
# Deploy all functions
supabase functions deploy treasury-sync
supabase functions deploy swap-event-listener
supabase functions deploy swap-executor

# Set secrets
supabase secrets set TREASURY_PRIVATE_KEY=your_key_here
supabase secrets set ALCHEMY_API_KEY=your_key_here
```

### Setting Up Cron Jobs

In Supabase Dashboard → Database → Extensions → Enable `pg_cron`

```sql
-- Treasury sync every 5 minutes
SELECT cron.schedule(
  'treasury-sync',
  '*/5 * * * *',
  $$SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/treasury-sync',
    '{}',
    'application/json'
  )$$
);

-- Event listener every 15 seconds (use external cron service)
-- Supabase pg_cron minimum is 1 minute, use Vercel Cron or similar for 15s
```

---

## API Routes Specification (Detailed)

### GET `/api/swap/treasury`

Returns available treasury NFTs with filtering and pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page (max 50) |
| `rarityTier` | string | - | Filter: common, uncommon, rare, legendary |
| `sortBy` | string | rarity-desc | Sort: rarity-asc, rarity-desc, token-asc, token-desc |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tokenId": 1234,
        "name": "Protardio #1234",
        "imageUrl": "ipfs://...",
        "thumbnailUrl": "https://...",
        "attributes": [{"trait_type": "Background", "value": "Blue"}],
        "rarityTier": "rare",
        "rarityScore": 72.5,
        "isAvailable": true
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8,
    "hasMore": true
  },
  "lastSyncedAt": "2026-01-02T12:00:00Z"
}
```

### POST `/api/swap/calculate-fee`

Calculates swap fee based on rarity differential.

**Request:**
```json
{
  "userTokenId": 5678,
  "treasuryTokenId": 1234
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userRarity": { "tier": "common", "score": 25.3 },
    "treasuryRarity": { "tier": "rare", "score": 72.5 },
    "feeAmountWei": "2000000000000000",
    "feeAmountEth": "0.002",
    "breakdown": {
      "baseFee": "0.001",
      "rarityPremium": "0.001",
      "totalFee": "0.002"
    }
  }
}
```

### POST `/api/swap/intents`

Creates a new swap intent.

**Request:**
```json
{
  "userFid": 12345,
  "userAddress": "0x...",
  "userTokenId": 5678,
  "treasuryTokenId": 1234
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "intentId": "uuid-here",
    "treasuryWallet": "0x...",
    "feeAmountWei": "2000000000000000",
    "feeAmountEth": "0.002",
    "expiresAt": "2026-01-02T12:30:00Z",
    "status": "pending",
    "instructions": {
      "step1": "Send your Protardio #5678 to 0x...",
      "step2": "Send 0.002 ETH to the same address"
    }
  }
}
```

### GET `/api/swap/intents?id={intentId}`

Check status of a swap intent.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "status": "nft_received",
    "userTokenId": 5678,
    "treasuryTokenId": 1234,
    "feeAmountEth": "0.002",
    "transactions": {
      "userNftTx": "0xabc...",
      "userFeeTx": null,
      "treasurySendTx": null
    },
    "timestamps": {
      "created": "2026-01-02T12:00:00Z",
      "nftReceived": "2026-01-02T12:05:00Z",
      "feeReceived": null,
      "completed": null
    }
  }
}
```

### GET `/api/swap/history?fid={fid}`

Get user's swap history.

**Response:**
```json
{
  "success": true,
  "data": {
    "completedSwaps": [
      {
        "id": "uuid",
        "userTokenId": 5678,
        "treasuryTokenId": 1234,
        "feeAmountEth": "0.002",
        "completedAt": "2026-01-02T12:10:00Z",
        "userNftTxHash": "0xabc...",
        "treasurySendTxHash": "0xdef..."
      }
    ],
    "pendingIntents": [],
    "refunds": []
  }
}
```

---

## Environment Variables

### Required for MVP

```bash
# Existing (already in .env)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEYNAR_API_KEY=your_neynar_key

# New for Swap Feature
TREASURY_WALLET_ADDRESS=0x...  # Treasury wallet public address
NEXT_PUBLIC_TREASURY_WALLET=0x...  # Same, for frontend display

# Swap Configuration
NEXT_PUBLIC_SWAP_BASE_FEE=0.001  # Base fee in ETH
SWAP_INTENT_TTL_MINUTES=30  # Intent expiration time

# RPC (may already exist)
BASE_RPC_URL=https://mainnet.base.org
```

### For Edge Functions (Supabase Secrets)

```bash
# Set via: supabase secrets set KEY=value
TREASURY_PRIVATE_KEY=0x...  # NEVER in code or .env
ALCHEMY_API_KEY=your_key  # Optional, for NFT API
```

### Optional Enhancements

```bash
# Alchemy Webhook (for faster event detection)
ALCHEMY_WEBHOOK_SECRET=your_webhook_secret

# Rate Limiting
SWAP_RATE_LIMIT_PER_HOUR=5  # Max swaps per user per hour
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | Jan 2026 | Initial draft |
| 0.2.0 | Jan 2026 | Added implementation decisions, database schema, Edge Functions guide, API specs |

---

*This spec is a living document. Update as decisions are made and implementation progresses.*

## Further Considerations from QT
Good spec. I talked about it with Claude and came back with these:

1. What problem are you actually solving first?
The spec bundles three distinct use cases:
 ∙ Defect resolution (support/remediation)
 ∙ Trait shopping (product/engagement)
 ∙ Treasury activation (financial/liquidity)
These have different success metrics, different UX requirements, and different urgency. Defect resolution is a customer service obligation. Trait shopping is a feature. Treasury activation is a business model.
My read: Start with defect resolution. It’s the clearest value prop, lowest complexity, and builds operational muscle for the harder stuff.
2. What’s your treasury strategy?
The spec assumes the treasury should be “activated” but doesn’t address:
 ∙ What’s the target treasury composition long-term?
 ∙ Are you willing to let it drain to floor pieces if that’s what users want?
 ∙ Is there a reserve that’s never swappable?
 ∙ How do sweeps interact with swap inventory?
The rarity fee model is a mechanism, but it needs to serve a goal. If the goal is “treasury maintains representative distribution,” that’s a different fee curve than “maximize swap volume” or “generate revenue.”
3. Who holds the keys, literally?
The spec handwaves this with “hardware wallet, multisig, limited hot wallet.” But:
 ∙ How many co-founders?
 ∙ What’s the signing threshold?
 ∙ What happens if someone becomes unavailable?
 ∙ Is there a documented recovery procedure?
This isn’t paranoia—it’s operational hygiene. The answer doesn’t need to be in the public spec, but it needs to exist.
4. What’s the commitment horizon?
Semi-custodial means ongoing operational responsibility:
 ∙ Someone monitors the event listener
 ∙ Someone handles failed swaps manually
 ∙ Someone refills the hot wallet
 ∙ Someone responds to user issues
Is that sustainable for 6 months? 2 years? Is there a path to either (a) on-chain trustlessness or (b) sunsetting?
5. What’s the failure mode you’re optimizing against?
Every architecture choice is a tradeoff. The spec optimizes for:
 ∙ Speed to market (semi-custodial over contract)
 ∙ Simplicity (no reservations)
 ∙ Flexibility (off-chain rarity scoring)
But that means accepting:
 ∙ Trust dependency
 ∙ Race condition UX friction
 ∙ Centralized fee manipulation risk
Are those the right tradeoffs for Protardio’s community specifically?

Here are some other key points I talked it through:

1. Add soft reservations. Non-negotiable for UX.User signs transaction → 60-second hold on NFT → Transaction confirms → Swap executes
Implementation: Add locked_until timestamp to treasury_inventory. Check on intent creation. Release on expiry or completion.
Cost: ~4 hours of work. Benefit: Dramatically better user experience.
2. Build the event listener with replay from the start.

// Store last processed block
const checkpoint = await db.getCheckpoint();

// On startup, replay from checkpoint
const missedEvents = await getLogs({
  fromBlock: checkpoint.blockNumber,
  toBlock: 'latest',
  address: PROTARDIO_CONTRACT,
  topics: [TRANSFER_TOPIC, null, TREASURY_ADDRESS]
});

// Process missed events, then switch to live
for (const event of missedEvents) {
  await processTransfer(event);
}
await db.updateCheckpoint(latestBlock);

// Now subscribe to live events

Cost: ~8 hours upfront. Benefit: Reliable recovery, easier debugging, audit trail.
3. Separate the signing from the API.
Even in Phase 1, don’t have the API server hold the treasury key. Instead:

API Server → Queue (Redis/BullMQ) → Signing Worker

The signing worker:
 ∙ Runs on a separate, hardened instance
 ∙ Pulls jobs from queue
 ∙ Validates before signing
 ∙ Has rate limits independent of API
Cost: ~12 hours. Benefit: Significantly reduced blast radius if API is compromised.
4. Defer Lucky Swap entirely.
It’s cool but complicated. The randomness implementation (off-chain vs VRF), the probability balancing, the EV calculations, the “same NFT returned” edge case—all of it is complexity that doesn’t serve the core use case.
Ship Pick Swap with flat fees first. Add rarity-based fees once you have volume data. Add Lucky Swap when users are asking for it.

5. Instrument everything from day one.// Every swap intent
logger.info('intent_created', { 
  intentId, userId, wantedTokenId, offeredTokenId, timestamp 
});

// Every state transition
logger.info('intent_status_changed', { 
  intentId, from: 'pending', to: 'processing', reason: 'transfer_detected' 
});

// Every treasury transaction
logger.info('treasury_transfer', { 
  direction: 'out', tokenId, to: userAddress, txHash, intentId 
});
Cost: Trivial if done upfront. Benefit: You will need this for debugging, for analytics, and for post-mortems.

## The Core Decision: What Are You Building?

There are really three products hiding in this spec. They share infrastructure but serve different purposes and have different complexity profiles.

### Product A: Defect Swap

Purpose: Customer service remedy. Holders with defective Protardios can exchange for non-defective ones.

|Dimension           |Profile                                   |
|--------------------|------------------------------------------|
|User need           |Acute (they have a problem)               |
|Frequency           |Low (finite defective population)         |
|Fee logic           |Flat or free                              |
|Rarity consideration|None (1:1 exchange, defect for non-defect)|
|Treasury risk       |Low (swapping like-for-like)              |
|Complexity          |Low                                       |
|Build time          |1-2 weeks                                 |

Key question: How many defective Protardios exist? Is this a 50-person problem or a 500-person problem?

-----

### Product B: Trait Shop

Purpose: Engagement feature. Holders can browse treasury and swap for different traits they prefer.

|Dimension           |Profile                            |
|--------------------|-----------------------------------|
|User need           |Latent (nice to have)              |
|Frequency           |Ongoing (repeatable behavior)      |
|Fee logic           |Flat or rarity-based               |
|Rarity consideration|Critical (or treasury bleeds value)|
|Treasury risk       |High without fee balancing         |
|Complexity          |Medium-High                        |
|Build time          |3-4 weeks                          |

Key question: Do holders actually want this? Is there pent-up demand, or is this solving a problem nobody has?

-----

### Product C: Lucky Swap

Purpose: Gamification/engagement. Lottery mechanic for variety-seeking or upgrade-hunting.

|Dimension           |Profile                                 |
|--------------------|----------------------------------------|
|User need           |Entertainment                           |
|Frequency           |Depends on EV and vibes                 |
|Fee logic           |Flat (variance is the feature)          |
|Rarity consideration|Embedded in probability weights         |
|Treasury risk       |High if weights favor upgrades          |
|Complexity          |High (randomness, probability balancing)|
|Build time          |+2 weeks on top of B                    |

Key question: Is gambling-adjacent mechanics the right vibe for Protardio? Does it fit the community?

-----

## The Dependency Graph
                    ┌─────────────────┐
                    │  Core Infra     │
                    │                 │
                    │ • Auth          │
                    │ • Treasury view │
                    │ • Intent system │
                    │ • Event listener│
                    │ • Swap execution│
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ Product A   │   │ Product B   │   │ Product C   │
    │ Defect Swap │   │ Trait Shop  │   │ Lucky Swap  │
    │             │   │             │   │             │
    │ + Defect    │   │ + Rarity    │   │ + Randomness│
    │   flagging  │   │   scoring   │   │ + Probability│
    │             │   │ + Fee calc  │   │   weights   │
    │             │   │             │   │ + VRF (P2)  │
    └─────────────┘   └─────────────┘   └─────────────┘

Core infra is ~70% of the work. Once it’s built, adding Product A is trivial. Product B adds rarity/fee complexity. Product C adds randomness complexity.

You can ship A, then layer B, then layer C. You cannot ship C without the infrastructure for B.

-----

## Decision Framework: Three Questions

### Question 1: What’s the minimum that justifies shipping?

|Option                |Justification                                       |Risk                                    |
|----------------------|----------------------------------------------------|----------------------------------------|
|**A only**            |“We promised defect holders a fix”                  |Under-builds; may feel like a non-launch|
|**A + B (flat fee)**  |“Treasury swap is the feature, defects are a subset”|Rarity bleeding if heavily used         |
|**A + B (rarity fee)**|“We want sustainable trait shopping”                |Complexity; fee UX friction             |
|**A + B + C**         |“Full vision, maximum engagement”                   |Scope creep; 2x timeline                |

The honest answer: A + B with flat fees is probably the minimum viable product that feels like a real launch. Pure defect swap is a support tool, not a product.

-----

### Question 2: How worried are you about treasury value?

This determines whether you need rarity-based fees at launch.

Scenario modeling:

If treasury has 200 NFTs with typical rarity distribution:

- ~100 floor tier
- ~60 mid tier
- ~30 rare tier
- ~10 legendary tier

With flat fees, rational users will:

1. Identify the most underpriced rare/legendary pieces
1. Swap floor pieces for them
1. Repeat until treasury is all floor

How fast? Depends on volume. At 10 swaps/day, you could drain the good pieces in a month. At 2 swaps/day, it takes longer but still happens.

If you don’t care: Ship flat fees. Simple, fast, good UX. Accept that treasury composition will shift toward floor.

If you care: You need rarity fees, but they add:

- Complexity (scoring, fee calculation, UI for variable fees)
- UX friction (users see different prices, may feel unfair)
- Maintenance (keeping scores updated)

Middle ground: Flat fees, but exclude top 10-20% of treasury from swapping. “These are not available for swap.” Preserves crown jewels without fee complexity.

-----

### Question 3: What’s your operational capacity?

Be honest about post-launch maintenance.

|Task                                 |Frequency|Who does it?|
|-------------------------------------|---------|------------|
|Monitor event listener health        |Daily    |?           |
|Handle failed swap support tickets   |As needed|?           |
|Refill hot wallet (if using hot/cold)|Weekly?  |?           |
|Update rarity scores (if using)      |Monthly? |?           |
|Respond to exploits/incidents        |As needed|?           |

With a 2-person SAFE, you have two people who can sign. But signing is the easy part. Monitoring, debugging, and support are the ongoing costs.

Semi-custodial is operationally heavier than on-chain. That’s the tradeoff for shipping faster.

-----

## My Read on Your Situation

Given:

- Splits + 2-person SAFE already in place (good operational foundation)
- IPFS metadata (standard, no issues)
- “When it’s ready” timeline (no artificial pressure)
- Need to make the decision confidently (not rushing)

I’d frame the choice as:

### Option 1: Minimal — Defect Resolution Only

Ship in 1-2 weeks. Solve the immediate problem. Learn from operating it. Decide on B/C later with real data.

Choose this if: Defect resolution is genuinely urgent, or you want to validate the infrastructure before committing to more.

### Option 2: Standard — Pick Swap with Flat Fees

Ship in 3-4 weeks. Real product launch. Accept rarity bleeding risk or mitigate with exclusion list.

Choose this if: You want a real launch, believe there’s demand for trait shopping, and are comfortable with treasury composition shifting over time.

### Option 3: Full — Pick Swap with Rarity Fees

Ship in 4-6 weeks. Sustainable long-term. More complex UX and maintenance.

Choose this if: Treasury value preservation is a priority and you’re willing to invest in the scoring/fee infrastructure.

### Option 4: Maximum — Pick + Lucky Swap

Ship in 6-8 weeks. Full spec as written. Significant complexity.

Choose this if: You’re confident in demand, have capacity for the build, and want the gamification angle.

-----

## What Would Help You Decide?

A few things that could de-risk the decision:

1. Defect census: How many defective Protardios exist? Who holds them? This sizes Product A.
1. Community signal: Has anyone asked for trait shopping? A quick Farcaster poll or Discord thread could validate demand for Product B.
1. Treasury audit: What’s actually in there? If it’s already 80% floor pieces, rarity bleeding is less of a concern. If it’s well-distributed, it’s more of a concern.
1. Mini app stack check: 30 minutes with the dev to understand what’s reusable. This affects timeline estimates significantly.
1. Operational assignment: Who’s going to monitor this thing? If it’s “we’ll figure it out,” that’s a flag. If it’s “Alex checks the dashboard every morning,” that’s a plan.

## Pricing Model Analysis

### The Core Problem

Any pricing model has to solve the arbitrage equation:
If: (Value of NFT received) - (Value of NFT sent) - (Swap fee) > 0
Then: Rational user swaps

The treasury bleeds value whenever users can profitably extract the spread. Your fee model either:

- Captures the spread (fee ≈ value differential) — sustainable but complex
- Ignores the spread (flat fee) — simple but bleeds value
- Avoids the spread (restrict what’s swappable) — simple and sustainable but limits utility

### Model Comparison

|Model                |Complexity|UX       |Treasury Protection|Flexibility|
|---------------------|----------|---------|-------------------|-----------|
|Flat fee             |Low       |Excellent|Poor               |Low        |
|Flat fee + exclusions|Low       |Good     |Good               |Medium     |
|Tier-based matrix    |Medium    |Fair     |Good               |Medium     |
|Continuous formula   |High      |Poor     |Excellent          |High       |
|Market-linked dynamic|Very High |Poor     |Excellent          |Very High  |

### Recommended Model: Tiered Flat Fees with Exclusion List

This balances simplicity, UX, and treasury protection. Here’s the full specification:

-----

#### Tier Definitions

Based on rarity score (1 = most rare, 10000 = most common):

|Tier         |Score Range |% of Collection|Description                            |
|-------------|------------|---------------|---------------------------------------|
|**Legendary**|1 - 250     |~2.5%          |Grails, 1/1s, exceptional combinations |
|**Rare**     |251 - 1500  |~12.5%         |Notably desirable, multiple rare traits|
|**Mid**      |1501 - 5000 |~35%           |Solid pieces, one or two good traits   |
|**Floor**    |5001 - 10000|~50%           |Common trait combinations              |

Note: Adjust percentages based on actual Protardio distribution. These are starting points.

-----

#### Fee Structure
┌─────────────────────────────────────────────────────────────────┐
│                        FEE MATRIX (ETH)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        RECEIVING (Treasury NFT)                 │
│                   Floor    Mid      Rare     Legendary          │
│               ┌─────────┬─────────┬─────────┬─────────┐        │
│  Floor       │  0.002  │  0.01   │  0.03   │    —    │        │
│              ├─────────┼─────────┼─────────┼─────────┤        │
│  Mid         │  0.001  │  0.002  │  0.015  │    —    │        │
│  SENDING     ├─────────┼─────────┼─────────┼─────────┤        │
│  (User NFT)  │  0.001  │  0.001  │  0.002  │  0.02   │        │
│  Rare        ├─────────┼─────────┼─────────┼─────────┤        │
│              │  0.001  │  0.001  │  0.001  │  0.002  │        │
│  Legendary   └─────────┴─────────┴─────────┴─────────┘        │
│                                                                 │
│  — = Not available for swap (exclusion list)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

-----

#### Design Rationale

Same-tier swaps (diagonal): 0.002 ETH base

- Low friction for “I want different traits at my level”
- This is the core use case for trait shopping
- Slight premium over absolute minimum to generate revenue

Downgrade swaps (below diagonal): 0.001 ETH minimum

- No reason to penalize; user is giving you value
- Minimum fee covers gas and operational costs
- Encourages “depositing” rare pieces into treasury

Upgrade swaps (above diagonal): Scaled to spread

- Floor → Mid (0.01 ETH): Meaningful but accessible
- Floor → Rare (0.03 ETH): Real cost, deters casual arbitrage
- Mid → Rare (0.015 ETH): Proportional to jump
- Rare → Legendary (0.02 ETH): Premium but possible

Legendary exclusion from Floor/Mid

- Legendaries are too valuable to price correctly with static fees
- Market spread could be 0.

5+ ETH; no flat fee makes sense
- Only Rare holders can access Legendary swaps
- Protects crown jewels without complex pricing

-----

#### Exclusion List (The “Vault”)

Beyond tier restrictions, maintain a manual exclusion list:
VAULT (Never Swappable):
- Token IDs: [specific grails, 1/1s, team pieces]
- Criteria: Top 1% by rarity, or manually flagged
- Review: Monthly, can add/remove based on treasury strategy

Implementation:
const VAULT_TOKEN_IDS = new Set([/* manually curated */]);
const isSwappable = (tokenId: number) => !VAULT_TOKEN_IDS.has(tokenId);

This gives you an escape valve. If something is too valuable to price, just exclude it.

-----

#### Defect Swap Override

Defect swaps bypass the fee matrix:
Defect swap fee: 0.001 ETH (or 0 ETH if you want)
Constraint: Can only swap for same tier OR lower

Implementation:
const DEFECT_TOKEN_IDS = new Set([/* known defects */]);

const getSwapFee = (sendingId: number, receivingId: number): number => {
  if (DEFECT_TOKEN_IDS.has(sendingId)) {
    const sendingTier = getTier(sendingId);
    const receivingTier = getTier(receivingId);
    if (receivingTier <= sendingTier) {
      return 0.001; // Defect discount
    }
    // Defect holders can't use defect discount to upgrade
  }
  return FEE_MATRIX[sendingTier][receivingTier];
};

-----

#### Fee Model Comparison to Spec

Kuusho’s spec proposed several models. Here’s how this recommendation compares:

|Spec Model           |Recommendation                |Rationale                                               |
|---------------------|------------------------------|--------------------------------------------------------|
|Model A (Tier-Based) |**Adopted with modifications**|Added exclusions, adjusted values                       |
|Model B (Continuous) |Rejected                      |Too complex for Phase 1, poor UX                        |
|Model C (Exponential)|Partially adopted             |Legendary exclusion achieves same protection more simply|
|Flat 0.001 ETH       |Rejected for upgrades         |Doesn’t protect treasury                                |

-----

#### Modeling Outcomes

Assumptions:

- Treasury: 200 NFTs (100 floor, 60 mid, 30 rare, 10 legendary)
- 5 legendary in Vault (50% of legendary tier)
- Average 10 swaps/day initially

Scenario 1: No Rarity Awareness (Flat 0.001 ETH)
Day 1-30: Users identify underpriced rare pieces
Day 30-60: Rare tier drains from 30 → 10
Day 60-90: Mid tier erodes
Day 90+: Treasury is 90% floor
Revenue: 0.3 ETH/month
Value lost: Significant (rare pieces worth more than floor)

Scenario 2: Recommended Model
Day 1-30: 
  - Same-tier swaps: 60% of volume (trait shopping)
  - Upgrade swaps: 30% of volume (paying premium)
  - Downgrade swaps: 10% of volume
  
Day 30-90:
  - Rare tier slowly depletes but fees capture ~50% of spread
  - Legendary tier protected by exclusions + tier restriction
  - Floor tier grows but treasury ETH balance also grows

Revenue: ~0.8-1.5 ETH/month (depending on upgrade volume)
Value trajectory: Gradual floor-ward drift, offset by fee revenue

Scenario 3: Same model but with periodic sweeps
Quarterly:
  - Use accumulated fees to sweep mid/rare pieces
  - Rebalance treasury composition
  - Adjust Vault list based on new holdings
  
Result: Sustainable equilibrium

-----

#### Implementation Complexity

Database additions:
-- Add to existing rarity_scores table or create
ALTER TABLE rarity_scores ADD COLUMN tier VARCHAR(20);

-- Vault list
CREATE TABLE vault_tokens (
  token_id INTEGER PRIMARY KEY,
  reason VARCHAR(255),
  added_at TIMESTAMP DEFAULT NOW(),
  added_by VARCHAR(255)
);

-- Defect list
CREATE TABLE defect_tokens (
  token_id INTEGER PRIMARY KEY,
  defect_type VARCHAR(255),
  reported_at TIMESTAMP DEFAULT NOW()
);

Fee calculation:
const FEE_MATRIX: Record<Tier, Record<Tier, number | null>> = {
  floor:     { floor: 0.002, mid: 0.01,  rare: 0.03,  legendary: null },
  mid:       { floor: 0.001, mid: 0.002, rare: 0.015, legendary: null },
  rare:      { floor: 0.001, mid: 0.001, rare: 0.002, legendary: 0.02 },
  legendary: { floor: 0. }

  001, mid: 0.001, rare: 0.001, legendary: 0.002 },
};

const calculateFee = (
  sendingTokenId: number, 
  receivingTokenId: number
): number | 'unavailable' => {
  // Check vault
  if (isVaulted(receivingTokenId)) return 'unavailable';
  
  // Check defect override
  if (isDefect(sendingTokenId)) {
    const sendingTier = getTier(sendingTokenId);
    const receivingTier = getTier(receivingTokenId);
    if (tierRank(receivingTier) <= tierRank(sendingTier)) {
      return 0.001; // Defect discount
    }
  }
  
  // Standard matrix lookup
  const sendingTier = getTier(sendingTokenId);
  const receivingTier = getTier(receivingTokenId);
  const fee = FEE_MATRIX[sendingTier][receivingTier];
  
  return fee ?? 'unavailable';
};

Time to implement: ~4-6 hours on top of base infrastructure

-----

#### Tuning Levers

Once live, you have several adjustment options:

|Lever                        |Effect               |When to Pull                    |
|-----------------------------|---------------------|--------------------------------|
|Raise upgrade fees           |Slow treasury drain  |Rare pieces leaving too fast    |
|Lower same-tier fees         |Increase volume      |Usage lower than expected       |
|Expand Vault                 |Protect more pieces  |High-value pieces being targeted|
|Shrink Vault                 |Increase liquidity   |Treasury feels too restrictive  |
|Add tier (e.g., “Ultra Rare”)|Finer pricing control|Single tier too broad           |
|Defect fee to 0              |Goodwill             |Community pressure              |

Recommendation: Launch with these values, commit to reviewing at 30 days with real data.

-----

### Alternative: Simplest Viable Model

If the above feels like too much for Phase 1, here’s the absolute simplest model that still protects treasury:
Fee: 0.002 ETH flat
Exclusions: Top 15% of treasury by rarity (Rare + Legendary tiers)

That’s it.

- Users can swap freely within Floor and Mid tiers
- Rare and Legendary are “not for swap”
- Zero rarity calculation needed at runtime
- One exclusion list to maintain

Tradeoff: Less utility (can’t swap for rare pieces), but ships faster and protects value.
---

## Implementation Status (Updated: January 9, 2026)

### MVP Implementation Completed

The following components have been implemented for the Phase 1 MVP:

#### Completed Tasks

| Task | Status | Notes |
|------|--------|-------|
| Database schema with soft reservations | ✅ Done | `supabase/migrations/20260109000001_swap_tables_final.sql` |
| Configuration constants | ✅ Done | `Protardio/src/lib/swap-config.ts` |
| Weighted random selection algorithm (3 NFTs) | ✅ Done | Implemented in `/api/swap/quote` |
| Soft reservation logic (60-second locks) | ✅ Done | Implemented in `/api/swap/intent` |
| User NFT fetch from blockchain | ✅ Done | `/api/user/nfts` route |
| Treasury sync from chain | ✅ Done | `/api/treasury/sync` route |
| Alchemy webhook endpoint | ✅ Done | `/api/webhook/alchemy` route |
| SwapInterface component (6-step flow) | ✅ Done | `Protardio/src/components/swap/SwapInterface.tsx` |
| Swap execution endpoint | ✅ Done | `/api/swap/execute` route |
| Intent status checking + UI polling | ✅ Done | GET `/api/swap/intent` + component polling |
| Seed script for rarity data | ✅ Done | `Protardio/scripts/seed_treasury.ts` |

#### Files Created/Modified

```
Protardio/
├── src/
│   ├── lib/
│   │   └── swap-config.ts                    [NEW] Configuration constants
│   ├── app/
│   │   └── api/
│   │       ├── swap/
│   │       │   ├── quote/route.ts            [MODIFIED] Weighted selection
│   │       │   ├── intent/route.ts           [MODIFIED] Soft locks, status check
│   │       │   └── execute/route.ts          [NEW] Swap execution
│   │       ├── user/
│   │       │   └── nfts/route.ts             [NEW] User NFT fetch
│   │       ├── treasury/
│   │       │   └── sync/route.ts             [NEW] Treasury sync
│   │       └── webhook/
│   │           └── alchemy/route.ts          [NEW] Transfer detection
│   └── components/
│       └── swap/
│           └── SwapInterface.tsx             [MODIFIED] Complete 6-step flow
├── scripts/
│   └── seed_treasury.ts                      [MODIFIED] Seeds both tables
│
supabase/
└── migrations/
    └── 20260109000001_swap_tables_final.sql  [NEW] Production schema
```

#### Configuration Applied

| Setting | Value |
|---------|-------|
| Treasury Address | `0xCc688b935Cf7B434f823c9B53c97C917d81763C1` |
| Swap Fee | 0.002 ETH (flat) |
| Selection Count | 3 NFTs (weighted random) |
| Reservation Duration | 60 seconds |
| Intent Expiration | 30 minutes |
| Protardio Contract | `0x5d38451841ee7a2e824a88afe47b00402157b08d` |

---

### Deployment Checklist

#### Pre-Deployment

- [ ] Apply database migration: `supabase db push` or run SQL manually
- [ ] Set environment variables in Vercel/hosting:
  ```
  NEXT_PUBLIC_TREASURY_ADDRESS=0xCc688b935Cf7B434f823c9B53c97C917d81763C1
  ALCHEMY_WEBHOOK_SECRET=<your_webhook_secret>
  BASE_RPC_URL=https://mainnet.base.org
  SYNC_API_KEY=<secure_random_key>
  EXECUTE_API_KEY=<secure_random_key>
  ```
- [ ] Deploy to Vercel

#### Post-Deployment

- [ ] Run seed script: `cd Protardio && npx tsx scripts/seed_treasury.ts`
- [ ] Trigger treasury sync: `POST /api/treasury/sync`
- [ ] Configure Alchemy webhook:
  - Dashboard → Webhooks → Create
  - Type: Address Activity
  - Address: `0xCc688b935Cf7B434f823c9B53c97C917d81763C1`
  - Network: Base Mainnet
  - URL: `https://your-app.vercel.app/api/webhook/alchemy`
- [ ] Test swap flow end-to-end with test transaction

---

### Remaining Work (Phase 1.5+)

| Task | Priority | Notes |
|------|----------|-------|
| Treasury signing service | High | Separate service to sign treasury NFT transfers securely |
| Automated swap execution | High | Cron/service to auto-execute when both received |
| Tier-based fees | Medium | Currently flat fee; spec has tier matrix |
| Vault/exclusion list | Medium | Protect high-value NFTs from swap |
| Defect swap discount | Low | Special pricing for defective NFTs |
| Admin dashboard | Low | Manual swap management UI |
| Swap history page | Low | User's past swaps |
| Rate limiting | Low | Prevent spam intents |

---

### API Reference (Quick)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/swap/quote` | POST | No | Get 3 weighted options for a token |
| `/api/swap/intent` | POST | Farcaster | Create swap intent |
| `/api/swap/intent?id=X` | GET | No | Check intent status |
| `/api/swap/intent?id=X` | DELETE | Farcaster | Cancel pending intent |
| `/api/swap/execute` | GET | API Key | List ready swaps |
| `/api/swap/execute` | POST | API Key | Execute/complete swap |
| `/api/user/nfts` | GET | Farcaster | Get user's Protardios |
| `/api/treasury/sync` | POST | API Key | Sync treasury from chain |
| `/api/treasury/sync` | GET | No | Get treasury stats |
| `/api/webhook/alchemy` | POST | Signature | Receive transfer events |

---

### Known Limitations (MVP)

1. **No automatic treasury sending**: The treasury NFT transfer requires manual execution or a separate signing service with access to the treasury wallet.

2. **Flat fee only**: Tier-based fee matrix from spec not implemented; using 0.002 ETH flat fee.

3. **No vault/exclusions**: All treasury NFTs are swappable; no protection for high-value pieces.

4. **Randomness is off-chain**: Weighted selection runs in backend; waiting for on-chain randomness contract.

5. **Single transaction detection**: Alchemy webhook may need tuning for edge cases (partial payments, etc.).

---

*Last updated: January 9, 2026 by Claude Code*
