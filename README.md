# Protardio Treasury Swap

A Farcaster Mini App for swapping Protardio NFTs with the treasury on Base.

## Overview

This system allows Protardio holders to swap their NFTs with the treasury. Users select one of their Protardios, receive 3 weighted-random options from the treasury, pick one, and complete the swap by sending their NFT + fee to the treasury wallet.

**Current Status:** MVP Implementation Complete (Phase 1)

---

## Developer Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Alchemy account (for webhooks)
- Vercel account (for deployment)

### 1. Clone and Install

```bash
git clone git@github.com:Kuusho/protardio-treasury-swap.git
cd protardio-treasury-swap
npm install

cd Protardio
npm install
```

### 2. Supabase Setup

#### Create Database Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration file: `supabase/migrations/20260109000001_swap_tables_final.sql`

This creates the following tables:
- `treasury_inventory` - NFTs available for swapping
- `rarity_scores` - Pre-calculated rarity data for all tokens
- `swap_intents` - Pending swap requests
- `swaps` - Completed swap history
- `refunds` - Refund tracking

#### Get Credentials

From Supabase Dashboard → Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)

### 3. Environment Variables

Create `Protardio/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Treasury
NEXT_PUBLIC_TREASURY_ADDRESS=0xCc688b935Cf7B434f823c9B53c97C917d81763C1

# Blockchain
BASE_RPC_URL=https://mainnet.base.org

# Alchemy (for webhooks)
ALCHEMY_WEBHOOK_SECRET=your_webhook_signing_key

# API Keys (for protected endpoints)
SYNC_API_KEY=generate_a_secure_random_key
EXECUTE_API_KEY=generate_a_secure_random_key

# NextAuth
NEXTAUTH_SECRET=generate_a_secure_random_key
NEXTAUTH_URL=http://localhost:3000

# Neynar (Farcaster)
NEYNAR_API_KEY=your_neynar_api_key
NEYNAR_CLIENT_ID=your_neynar_client_id
```

### 4. Seed Rarity Data

The `ASCII_FINAL/` folder contains metadata JSON files with rarity scores. Run the seed script to populate the database:

```bash
cd Protardio
npx tsx scripts/seed_treasury.ts
```

This populates both `rarity_scores` and `treasury_inventory` tables.

### 5. Sync Treasury from Chain

After seeding, sync the treasury to mark which NFTs are actually available:

```bash
# Local
curl -X POST http://localhost:3000/api/treasury/sync

# Or with API key in production
curl -X POST https://your-app.vercel.app/api/treasury/sync \
  -H "Authorization: Bearer YOUR_SYNC_API_KEY"
```

### 6. Configure Alchemy Webhook

1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com/) → Webhooks
2. Create new webhook:
   - **Type:** Address Activity
   - **Network:** Base Mainnet
   - **Address:** `0xCc688b935Cf7B434f823c9B53c97C917d81763C1`
   - **Webhook URL:** `https://your-app.vercel.app/api/webhook/alchemy`
3. Copy the signing key to `ALCHEMY_WEBHOOK_SECRET`

### 7. Run Development Server

```bash
cd Protardio
npm run dev
```

Open http://localhost:3000/swap

---

## Credentials Checklist

| Credential | Where to Get | Environment Variable |
|------------|--------------|---------------------|
| Supabase URL | Supabase Dashboard → Settings → API | `NEXT_PUBLIC_SUPABASE_URL` |
| Supabase Service Key | Supabase Dashboard → Settings → API | `SUPABASE_SERVICE_ROLE_KEY` |
| Neynar API Key | [neynar.com](https://neynar.com) | `NEYNAR_API_KEY` |
| Neynar Client ID | Neynar Dashboard | `NEYNAR_CLIENT_ID` |
| Alchemy Webhook Secret | Alchemy Dashboard → Webhooks | `ALCHEMY_WEBHOOK_SECRET` |
| Base RPC URL | Alchemy/Infura or public | `BASE_RPC_URL` |

---

## Implementation Status

### Completed (Phase 1 MVP)

| Feature | Status | File(s) |
|---------|--------|---------|
| Database schema with soft reservations | Done | `supabase/migrations/20260109000001_swap_tables_final.sql` |
| Swap configuration (fee, selection count) | Done | `Protardio/src/lib/swap-config.ts` |
| Weighted random selection (3 NFTs) | Done | `Protardio/src/app/api/swap/quote/route.ts` |
| Soft reservation (60-second locks) | Done | `Protardio/src/app/api/swap/intent/route.ts` |
| User NFT fetch from blockchain | Done | `Protardio/src/app/api/user/nfts/route.ts` |
| Treasury sync from chain | Done | `Protardio/src/app/api/treasury/sync/route.ts` |
| Alchemy webhook for transfer detection | Done | `Protardio/src/app/api/webhook/alchemy/route.ts` |
| Swap UI (6-step flow) | Done | `Protardio/src/components/swap/SwapInterface.tsx` |
| Swap execution endpoint | Done | `Protardio/src/app/api/swap/execute/route.ts` |
| Intent status polling | Done | GET `/api/swap/intent?id=X` |
| Seed script for rarity data | Done | `Protardio/scripts/seed_treasury.ts` |

### Remaining Work (Phase 1.5+)

| Task | Priority | Notes |
|------|----------|-------|
| Treasury signing service | **High** | Separate secure service to sign NFT transfers from treasury |
| Automated swap execution | **High** | Cron job to auto-execute when both NFT+fee received |
| Tier-based fees | Medium | Currently flat 0.002 ETH; spec has tier matrix |
| Vault/exclusion list | Medium | Protect high-value NFTs from swap |
| Defect swap discount | Low | Special pricing for defective NFTs |
| Admin dashboard | Low | Manual swap management UI |
| Swap history page | Low | User's past swaps |
| Rate limiting | Low | Prevent spam intents |
| On-chain randomness | Blocked | Waiting for randomness contract |

---

## API Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/swap/quote` | POST | None | Get 3 weighted-random treasury options |
| `/api/swap/intent` | POST | Farcaster | Create swap intent |
| `/api/swap/intent?id=X` | GET | None | Check intent status |
| `/api/swap/intent?id=X` | DELETE | Farcaster | Cancel pending intent |
| `/api/swap/execute` | GET | API Key | List swaps ready for execution |
| `/api/swap/execute` | POST | API Key | Complete swap with treasury tx hash |
| `/api/user/nfts` | GET | Farcaster | Get user's Protardios |
| `/api/treasury/sync` | POST | API Key | Sync treasury inventory from chain |
| `/api/treasury/sync` | GET | None | Get treasury stats |
| `/api/webhook/alchemy` | POST | Signature | Receive transfer notifications |

---

## Configuration

Current settings in `Protardio/src/lib/swap-config.ts`:

| Setting | Value |
|---------|-------|
| Treasury Address | `0xCc688b935Cf7B434f823c9B53c97C917d81763C1` |
| Protardio Contract | `0x5d38451841ee7a2e824a88afe47b00402157b08d` |
| Swap Fee | 0.002 ETH (flat) |
| Selection Count | 3 NFTs |
| Reservation Duration | 60 seconds |
| Intent Expiration | 30 minutes |

---

## Architecture

```
User Flow:
1. User selects their Protardio
2. Backend returns 3 weighted-random treasury NFTs
3. User picks one → Intent created → Treasury NFT reserved 60s
4. User sends NFT + 0.002 ETH to treasury address
5. Alchemy webhook detects transfers → Updates intent status
6. When both received → Swap executes → Treasury sends NFT to user
```

```
Key Files:
Protardio/
├── src/
│   ├── lib/swap-config.ts          # Configuration
│   ├── app/api/
│   │   ├── swap/                   # Swap endpoints
│   │   ├── user/nfts/              # User NFT fetch
│   │   ├── treasury/sync/          # Treasury sync
│   │   └── webhook/alchemy/        # Transfer detection
│   └── components/swap/
│       └── SwapInterface.tsx       # Main UI component
├── scripts/
│   └── seed_treasury.ts            # Database seeder
│
supabase/migrations/
└── 20260109000001_swap_tables_final.sql  # Database schema
```

---

## Known Limitations

1. **Manual treasury sending** - NFT transfer from treasury requires manual execution or separate signing service
2. **Flat fee only** - Tier-based fee matrix not yet implemented
3. **No vault/exclusions** - All treasury NFTs are swappable
4. **Off-chain randomness** - Weighted selection runs in backend (on-chain contract pending)

---

## Detailed Spec

See `protardio-swap-spec.md` for the full specification including:
- Product requirements
- Fee matrix design
- Database schema details
- Implementation decisions
- Security considerations

---

## License

MIT
