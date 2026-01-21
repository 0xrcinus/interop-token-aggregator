# Token Aggregator

**Live Demo**: [token-aggregator.wonderland.xyz](https://token-aggregator.wonderland.xyz)

**Problem**: Blockchain interoperability providers (bridges, DEX aggregators, cross-chain protocols) each maintain their own token lists. No single provider has complete coverage, and their data often conflicts - the same token symbol may have different addresses, decimals, or metadata across providers.

**Solution**: This application aggregates token data from 12 major providers, normalizes it into a unified database, and surfaces coverage gaps and conflicts through a web interface and REST API.

## What It Does

Fetches token data from 12 interoperability providers and answers questions like:

- **Coverage**: Which providers support USDC? On which chains?
- **Conflicts**: Does "WETH" have different addresses on Ethereum across providers?
- **Gaps**: Which chains have the most provider support? Which have the least?
- **Metadata**: Where can I find block explorers, logos, and RPC endpoints for each chain?

### Current Dataset

- **34,221 tokens** across **217 chains**
- Data from **12 providers**: Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter
- Tokens categorized into 8 types: wrapped, stablecoin, liquidity-pool, governance, bridged, yield-bearing, rebasing, native
- Chain metadata enriched from Chainlist API (logos, explorers, RPC endpoints)
- Both EVM and non-EVM chains (Solana, Bitcoin, etc.) with proper address normalization

### Key Features

- **Conflict Detection**: Identifies when the same token symbol has different addresses or decimals on the same chain across providers
- **Provider Health Tracking**: Monitors fetch success rates and data freshness for each provider
- **Multi-Chain Support**: Handles 217+ chains including Ethereum, Arbitrum, Optimism, Polygon, Solana, and more
- **Fast Updates**: Fetches all 12 providers in parallel (~3.2 seconds), with automatic page revalidation
- **Modern UI**: Responsive design with client-side filtering, search, and pagination using TanStack Query
- **SEO Optimized**: OpenGraph and Twitter card support for social sharing
- **Automatic Syncing**: Vercel Cron Job fetches fresh data every 12 hours automatically

## Example Use Cases

**Q: Which providers support USDC on Arbitrum?**
Visit `/tokens/USDC` to see all instances grouped by chain. Find Arbitrum (chain ID 42161) and see which providers list it.

**Q: Are there conflicts for WETH on Ethereum?**
The token detail page shows when multiple providers report different addresses for the same symbol on the same chain.

**Q: Which chains have the best cross-provider support?**
Visit `/chains` to see chains sorted by provider count. Ethereum typically has 10+ providers, while niche chains may only have 1-2.

---

## Quick Start

### Option 1: DevContainer (Recommended)

The easiest way to get started is using the devcontainer with native PostgreSQL:

```bash
# Clone the repository with submodules
git clone --recurse-submodules <repo-url>
cd interop-token-aggregator

# Open in VS Code with Dev Containers extension
code .
# Command Palette: "Dev Containers: Reopen in Container"

# Wait for automatic setup to complete (~2-5 minutes)
# - PostgreSQL 16 starts on port 5433
# - pnpm and dependencies auto-install
# - Database schema auto-applied

# Fetch initial data from all 12 providers
pnpm fetch:providers

# Start the development server
pnpm dev
```

**What's automated**:
- ✅ PostgreSQL 16 native installation (port 5433)
- ✅ pnpm installation
- ✅ Dependencies installation
- ✅ Database schema creation
- ✅ Firewall configuration for all provider APIs

**Firewall Customization**:
The devcontainer includes a security firewall that only allows whitelisted domains. To add custom domains (like Neon database):

1. Copy `.devcontainer/custom-domains.txt.example` to `.devcontainer/custom-domains.txt`
2. Add your domain (one per line)
3. Rebuild the devcontainer

See [DEVCONTAINER_SETUP.md](DEVCONTAINER_SETUP.md#adding-custom-domains-to-firewall) for details.

**Note**: Database data is not persisted across container restarts (by design for fresh testing). Just run `pnpm fetch:providers` again after restart (~3-5 seconds).

---

### Option 2: Local Docker Setup

For local development with Docker Compose:

**Prerequisites**:
- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose

```bash
# Clone the repository with submodules
git clone --recurse-submodules <repo-url>
cd interop-token-aggregator

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Start PostgreSQL (port 5433)
docker-compose up -d

# Apply database migrations
pnpm db:push

# Fetch initial data from all providers
./scripts/reset-and-fetch.sh

# Start the development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

---

## Project Structure

```
interop-token-aggregator/
├── src/
│   ├── app/                          # Next.js 16 App Router
│   │   ├── api/                      # REST API routes
│   │   │   ├── admin/fetch/          # POST/GET /api/admin/fetch (trigger data fetch)
│   │   │   ├── chains/               # GET /api/chains (chain list with metadata)
│   │   │   ├── providers/            # GET /api/providers (provider health)
│   │   │   └── tokens/               # GET /api/tokens (aggregated token list)
│   │   ├── chains/                   # Chains UI pages with client-side filtering
│   │   ├── providers/                # Providers UI pages
│   │   ├── tokens/                   # Tokens UI pages with client-side search
│   │   ├── icon.tsx                  # App icon/favicon generator
│   │   ├── opengraph-image.tsx       # OpenGraph social image
│   │   ├── twitter-image.tsx         # Twitter card image
│   │   └── page.tsx                  # Home dashboard
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── chain-icon.tsx            # Chain logo component with fallback
│   │   ├── query-provider.tsx        # TanStack Query provider wrapper
│   │   └── support-matrix.tsx        # Provider support visualization
│   ├── lib/
│   │   ├── api/                      # Effect-TS API service layer
│   │   ├── aggregation/              # Address normalization, categorization, chain mapping
│   │   ├── chains/                   # Chain metadata enrichment (Chainlist API)
│   │   ├── db/                       # Drizzle ORM schema and layers
│   │   └── providers/                # Provider implementations (12 total)
│   │       ├── factory.ts            # Shared provider fetch pipeline
│   │       ├── storage.ts            # Batch insert utilities
│   │       ├── relay.ts              # Relay provider (EVM + non-EVM)
│   │       ├── lifi.ts               # LiFi provider (largest dataset)
│   │       ├── across.ts             # Across protocol
│   │       └── ...                   # 9 more providers
│   └── jobs/
│       └── fetch-providers.ts        # CLI job runner (alternative to API trigger)
├── migrations/                       # Drizzle migration files
├── repos/                            # Git submodules (Effect-TS and Cheffect for reference)
├── scripts/
│   └── reset-and-fetch.sh            # Database reset + fetch utility
├── docker-compose.yml                # PostgreSQL 16 configuration
├── drizzle.config.ts                 # Drizzle migration config
├── CLAUDE.md                         # Development guide for Claude Code
├── PLAN.md                           # Technical roadmap and implementation reference
├── DEVCONTAINER_SETUP.md             # Devcontainer configuration guide
└── README.md                         # This file
```

---

## Database Schema

PostgreSQL 16 with 4 core tables:

### `chains`
Normalized chain data with enriched metadata from Chainlist API.

**Key fields**:
- `chain_id` (bigint) - Chain ID (supports IDs > 2 billion like Across's 34268394551451)
- `name`, `short_name`, `chain_type` (mainnet/testnet)
- `vm_type` (evm/svm/bvm/lvm) - Stored from provider data
- `native_currency_*` (name, symbol, decimals)
- `icon`, `explorers`, `rpc`, `faucets` (JSONB)

### `tokens`
Token instances from providers with categorization.

**Key fields**:
- `chain_id`, `address` (preserves case for non-EVM chains)
- `symbol`, `name`, `decimals` (optional - null when provider doesn't supply)
- `provider_name`
- `tags` (JSONB) - Array of category tags
- `raw_data` (JSONB) - Original provider response for debugging

### `chain_provider_support`
M:N relationship tracking which providers support which chains.

### `provider_fetches`
Audit log of all fetch attempts with success/error tracking.

---

## How It Works

### Data Collection

1. **Parallel Fetching**: Queries all 12 provider APIs concurrently (~3.2 seconds total)
2. **Normalization**: Converts each provider's data format into a unified schema
3. **Storage**: Saves chains, tokens, and provider relationships to PostgreSQL
4. **Enrichment**: Fetches chain metadata (logos, explorers) from Chainlist API
5. **Categorization**: Tags tokens automatically (stablecoin, wrapped, LP, etc.)

### Address Normalization

Handles both EVM and non-EVM chains correctly:
- **EVM chains** (Ethereum, Polygon, etc.): Addresses lowercased (`0xabc...`) since they're case-insensitive
- **Non-EVM chains** (Solana, etc.): Addresses preserve original case since they use case-sensitive encoding (base58)

### Chain ID Mapping

Some providers use different IDs for the same chain. For example, Solana:
- Relay uses: `792703809`
- GasZip uses: `501474`
- Across uses: `34268394551451`

The system normalizes these to a canonical ID (Across's `34268394551451`) so tokens from all providers appear under one unified Solana chain.

### Conflict Detection

The application identifies conflicts when:
- Same token symbol has different addresses on the same chain across providers
- Same token symbol has different decimal values on the same chain

**Current status**: Conflicts are detected and surfaced in the UI, but not automatically resolved. The application shows all conflicting instances and lets users decide which provider's data to trust.

**Example conflict**: If Provider A says USDC on Ethereum is `0xabc...` and Provider B says it's `0xdef...`, both are shown with a conflict warning.

---

## API Reference

Base URL: `http://localhost:3000/api`

### GET `/tokens`

List aggregated tokens grouped by symbol.

**Query parameters**:
- `limit` (default: 100, max: 1000) - Tokens per page
- `offset` (default: 0) - Pagination offset
- `symbol` (optional) - Filter by symbol (case-insensitive partial match)
- `tag` (optional) - Filter by category tag

**Response**:
```json
{
  "tokens": [
    {
      "symbol": "USDC",
      "providerCount": 8,
      "chainCount": 45,
      "totalInstances": 127
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 3421
  }
}
```

### GET `/tokens/:symbol`

Detailed view of a specific token showing all instances across chains/providers.

**Response**:
```json
{
  "symbol": "USDC",
  "totalInstances": 127,
  "chainCount": 45,
  "providerCount": 8,
  "byChain": [
    {
      "chainId": 1,
      "chainName": "Ethereum Mainnet",
      "instances": [
        {
          "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "name": "USD Coin",
          "decimals": 6,
          "providerName": "relay",
          "tags": ["stablecoin"]
        }
      ],
      "hasConflict": false
    }
  ]
}
```

### GET `/chains`

List all chains with provider support and token counts.

**Response**:
```json
{
  "chains": [
    {
      "chainId": 1,
      "name": "Ethereum Mainnet",
      "shortName": "eth",
      "chainType": "mainnet",
      "vmType": "evm",
      "icon": "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
      "providerCount": 10,
      "tokenCount": 2847,
      "explorers": [{"name": "Etherscan", "url": "https://etherscan.io"}]
    }
  ],
  "summary": {
    "totalChains": 217,
    "totalTokens": 34228
  }
}
```

### GET `/providers`

Provider health status and fetch history.

**Response**:
```json
{
  "providers": [
    {
      "providerName": "debridge",
      "totalFetches": 5,
      "successfulFetches": 5,
      "successRate": 100,
      "lastFetch": {
        "fetchedAt": "2026-01-19T10:30:00Z",
        "success": true,
        "chainsCount": 24,
        "tokensCount": 16712
      },
      "isHealthy": true
    }
  ]
}
```

### GET `/providers/:provider`

Provider detail page showing all tokens with chain support.

**Query parameters**:
- `limit` (default: 50) - Tokens per page
- `offset` (default: 0) - Pagination offset
- `symbol` (optional) - Filter by symbol

### POST `/admin/fetch`

Trigger background fetch job for all providers.

**Authentication**: Requires `x-admin-secret` header matching `ADMIN_SECRET` env var.

**Response**: `202 Accepted` (job runs asynchronously)

```bash
curl -X POST http://localhost:3000/api/admin/fetch \
  -H "x-admin-secret: your-secret-here"
```

---

## Commands

### Development
```bash
pnpm dev                    # Start Next.js dev server (port 3000)
pnpm build                  # Build for production
pnpm start                  # Start production server
pnpm lint                   # Run ESLint
npx tsc --noEmit           # Type check (should show 0 errors)
```

### Database
```bash
pnpm db:studio              # Open Drizzle Studio (database GUI)
pnpm db:generate            # Generate new migration
pnpm db:push                # Apply migrations to database
docker-compose up -d        # Start PostgreSQL
docker-compose down         # Stop PostgreSQL
docker logs token-aggregator-db  # View database logs
```

### Data Management
```bash
./scripts/reset-and-fetch.sh     # Clean DB + trigger fresh fetch
pnpm fetch:providers             # Run CLI job runner (alternative to API)
```

### Database Access
```bash
# PostgreSQL CLI (port 5433, not 5432!)
docker exec -it token-aggregator-db psql -U dev -d tokendb

# Example queries
SELECT provider_name, COUNT(*) FROM tokens GROUP BY provider_name;
SELECT * FROM provider_fetches ORDER BY fetched_at DESC LIMIT 5;
```

---

## Environment Variables

Create `.env.local` with the following variables (using Neon-compatible naming):

```env
# PostgreSQL Configuration (Neon-compatible variable names)
# For local Docker development:
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DATABASE=tokendb
POSTGRES_USER=dev
POSTGRES_PASSWORD=dev
POSTGRES_SSL=false

# For Neon production, copy these from your Neon dashboard:
# POSTGRES_HOST=<your-project>.aws.neon.tech
# POSTGRES_PORT=5432
# POSTGRES_USER=<your-username>
# POSTGRES_DATABASE=<your-database>
# POSTGRES_PASSWORD=<your-password>
# POSTGRES_SSL=true

# Alternative: Use DATABASE_URL connection string
# DATABASE_URL=postgresql://dev:dev@localhost:5433/tokendb

# Admin API Secret (for POST /api/admin/fetch)
ADMIN_SECRET=change-this-in-production
```

**Important**:
- **Local development**: Database runs on **port 5433** with SSL disabled to avoid conflicts with local PostgreSQL installations
- **Neon production**: Database runs on **port 5432** with SSL enabled (required for cloud connections)
- Environment variable names use `POSTGRES_*` prefix to match Neon's standard naming, making production deployment seamless
- When deploying to Neon, you can copy the environment variables directly from your Neon dashboard
- Set `POSTGRES_SSL=true` for Neon or any cloud PostgreSQL database

**DevContainer Firewall**:
- The devcontainer uses a security firewall that only allows whitelisted domains
- To connect to external databases (Neon, Supabase, etc.) or custom APIs, edit `.devcontainer/custom-domains.txt`
- Add one domain per line, then rebuild the container
- See [DEVCONTAINER_SETUP.md](DEVCONTAINER_SETUP.md#adding-custom-domains-to-firewall) for full documentation

---

## Production Deployment

The application is deployed to [Vercel](https://vercel.com) with the following setup:

**Live URL**: [token-aggregator.wonderland.xyz](https://token-aggregator.wonderland.xyz)

### Deployment Configuration

1. **Database**: Neon PostgreSQL (serverless Postgres)
   - Copy connection details from Neon dashboard to Vercel environment variables
   - Set `POSTGRES_SSL=true` for cloud database
   - Enable connection pooling for optimal performance

2. **Environment Variables** (Vercel Dashboard → Settings → Environment Variables):
   ```
   POSTGRES_HOST=<your-neon-host>.aws.neon.tech
   POSTGRES_PORT=5432
   POSTGRES_DATABASE=<your-database>
   POSTGRES_USER=<your-username>
   POSTGRES_PASSWORD=<your-password>
   POSTGRES_SSL=true
   ADMIN_SECRET=<random-secret-for-manual-fetch>
   CRON_SECRET=<auto-generated-by-vercel>
   ```

3. **Automatic Data Syncing**:
   - Vercel Cron Job runs every 12 hours (configured in [vercel.json](vercel.json))
   - Automatically fetches fresh data from all 12 providers
   - Triggers Next.js ISR revalidation for all pages
   - No manual intervention required

4. **Monitoring**:
   - Check `/providers` page for provider health status
   - View recent fetch history and success rates
   - All failed fetches are logged in the `provider_fetches` table

### Initial Setup

After deploying to Vercel:

1. Deploy the application (Vercel auto-detects Next.js configuration)
2. Set environment variables in Vercel dashboard
3. Trigger initial data fetch manually:
   ```bash
   curl -X POST https://token-aggregator.wonderland.xyz/api/admin/fetch \
     -H "x-admin-secret: your-secret-here"
   ```
4. Wait for cron job to handle subsequent updates automatically

---

## Provider Coverage

This shows how much data each provider contributes to the aggregated dataset:

| Provider | Tokens | Chains | Notable Coverage |
|----------|--------|--------|------------------|
| **DeBridge** | 16,712 | 24 | Largest token catalog, strong Ethereum/BSC support |
| **LiFi** | 12,692 | 58 | Widest chain coverage, excellent for multi-chain tokens |
| **Stargate** | 2,157 | 96 | Most chains supported, focused on LayerZero ecosystem |
| **Across** | 1,333 | 23 | Optimistic rollups (Optimism, Arbitrum, Base) |
| **Mayan** | 468 | 7 | Solana-focused bridge with SVM/EVM pairs |
| **Butter** | 200 | 14 | Curated token list for major chains |
| **Relay** | 166 | 80 | Both EVM and non-EVM chains |
| **GasZip** | 161 | 161 | Native gas tokens only (one per chain) |
| **Meson** | 138 | 72 | Stablecoin-focused |
| **Aori** | 92 | 8 | Minimal metadata |
| **Rhino.fi** | 78 | 31 | Layer 2 focused |
| **Eco** | 24 | 10 | Small curated set |

**Total**: 34,221 tokens across 217 chains (fetched in ~3.2 seconds)

**For complete API endpoints and implementation details**, see [PLAN.md](PLAN.md#provider-api-endpoints--implementation-details) which includes:
- Exact API URLs for all 12 providers
- Request/response structures
- Special handling requirements (Wormhole mappings, hex parsing, etc.)
- Provider-specific constants and exclusions

### Provider-Specific Highlights

**Relay**:
- Filters `vmType === "evm"` to exclude non-EVM chains
- Handles missing `nativeCurrency` with fallbacks
- Stores `vmType` field in database

**LiFi**:
- Must sanitize null bytes: `str?.replace(/\0/g, "")`
- Infers chains from token `chainId`s (no chains endpoint)
- Largest dataset requiring batch inserts

**Across**:
- Fetches chains and tokens in parallel from separate endpoints
- Uses `logoUrl` instead of `logoURI`

**Stargate**:
- Maps `chainKey` strings to numeric `chainId`s
- Provides `chainType` as `vmType`

**DeBridge**:
- Fetches tokens per-chain (not all at once)
- Filters tokens missing required fields

**Mayan**:
- Maps Wormhole chain IDs to EVM equivalents
- Filters out non-EVM chains

---

## Technical Architecture

### Technology Stack

- **Next.js 16**: Web framework with App Router for API routes and UI
- **React 19**: Latest React with Server Components and improved client-side interactivity
- **PostgreSQL 16**: Database with JSONB support for flexible metadata storage
- **Drizzle ORM**: Type-safe database access with migration support
- **Effect-TS 3.x**: Functional programming framework for error handling and dependency injection
- **TanStack Query 5**: Client-side data fetching and caching for interactive UI features
- **shadcn/ui + Tailwind CSS 4**: Modern component library with utility-first styling

### Key Technical Decisions

**1. Preserve Raw Provider Data**
All tokens store the original provider response in a `raw_data` JSONB field. This enables debugging provider discrepancies without refetching from APIs.

**2. Null for Missing Data**
When providers don't supply decimals, we store `null` instead of defaulting to 18. This makes missing data transparent rather than hiding it with assumptions.

**3. Bigint for Chain IDs**
Some chains have IDs > 2 billion (e.g., Across's Solana: 34268394551451). The database uses `bigint` instead of `integer` to handle these.

**4. Chain-Aware Address Handling**
EVM addresses are lowercased for consistency, but non-EVM addresses (Solana, etc.) preserve their original case to prevent breaking block explorer links.

**5. VM Type Storage**
Instead of hardcoding chain types, the system stores `vm_type` from provider data (evm, svm, bvm, etc.). This makes it extensible to new VM types without code changes.

**6. Batch Inserts for Performance**
Large token lists are inserted in batches of 500 records to prevent stack overflow and improve database performance.

### Effect-TS Architecture

The application uses Effect-TS for functional error handling and dependency injection. Key patterns:

- **Layer Composition**: Providers share database and HTTP client dependencies via `Layer.provideMerge`
- **Tagged Errors**: All errors extend `Data.TaggedError` for type-safe error handling
- **Parallel Execution**: All 12 providers fetch concurrently using `Effect.all` with unbounded concurrency

See [CLAUDE.md](CLAUDE.md) for detailed architectural patterns and implementation guidelines.

---

## Token Categorization System

Automatic tag assignment using pattern-based detection:

**8 Categories**:
1. **wrapped**: WETH, wBTC, wrapped tokens
2. **stablecoin**: USDC, DAI, USDT
3. **liquidity-pool**: LP tokens, pool shares
4. **governance**: Governance/voting tokens
5. **bridged**: Cross-chain bridged variants (.e suffix, etc.)
6. **yield-bearing**: Yield/interest-bearing tokens
7. **rebasing**: Rebasing tokens (stETH, etc.)
8. **native**: Native chain tokens (ETH, SOL, etc.)

**Distribution** (34,221 tokens):
- 628 wrapped tokens
- 520 stablecoins
- 478 rebasing tokens
- 327 liquidity pool tokens
- 239 yield-bearing tokens
- 156 governance tokens
- 132 native tokens
- 117 bridged tokens

---

## Data Freshness & Revalidation

The application uses **Next.js Incremental Static Regeneration (ISR)** with a two-tier revalidation strategy to keep pages fresh:

### 1. On-Demand Revalidation (Primary)

When you trigger `POST /api/admin/fetch`, all static pages automatically revalidate:

```bash
# Fetch new data and trigger revalidation
curl -X POST http://localhost:3000/api/admin/fetch \
  -H "x-admin-secret: your-secret-here"

# Or use the CLI (doesn't trigger revalidation automatically)
pnpm fetch:providers
```

**How it works**:
- After successful data fetch, the API calls `revalidatePath()` for all key routes
- Next request to those pages regenerates them with fresh database data
- Ensures UI reflects newly fetched data immediately

**Implementation**: See [src/app/api/admin/fetch/route.ts](src/app/api/admin/fetch/route.ts#L52-L57)

### 2. Time-Based Revalidation (Fallback)

Pages revalidate every 5 minutes (300 seconds) as a safety net:

```typescript
// Hardcoded in each page file
export const revalidate = 300
```

**How it works**:
- If a page hasn't been regenerated in 5 minutes, Next.js automatically regenerates it on the next request
- User gets the cached version, then the page regenerates in the background
- Ensures data is never more than 5 minutes stale

**To adjust the interval**: Edit the `revalidate` constant in each page file:
- `300` (5 min): Current default, good for most use cases
- `600` (10 min): For lower database load
- `3600` (1 hour): For very low-traffic sites

### Benefits

✅ **Fast**: Static pages served from CDN (10-50ms)
✅ **Fresh**: Automatic updates when data changes
✅ **Simple**: No configuration needed, works out of the box
✅ **Flexible**: Adjust per page if needed

### 3. Automatic Scheduled Fetches (Production)

The application includes a Vercel Cron Job that automatically fetches fresh data every 12 hours:

**Configuration**: See [vercel.json](vercel.json)
```json
{
  "crons": [{
    "path": "/api/admin/fetch",
    "schedule": "0 */12 * * *"
  }]
}
```

**Cron Schedule**: `0 */12 * * *` = Every 12 hours at the top of the hour (12:00 AM, 12:00 PM UTC)

**How it Works**:
- Vercel automatically calls `GET /api/admin/fetch` on the defined schedule
- Vercel sets the `Authorization: Bearer <CRON_SECRET>` header automatically
- The endpoint triggers a fresh data fetch from all 12 providers
- All static pages are automatically revalidated after the fetch completes

**Customizing the Schedule**:
To change the frequency, edit the `schedule` field in [vercel.json](vercel.json):
- `0 */6 * * *` = Every 6 hours
- `0 */12 * * *` = Every 12 hours (current)
- `0 0 * * *` = Once per day at midnight UTC
- `0 0 * * 0` = Once per week on Sunday at midnight UTC

See [Vercel Cron documentation](https://vercel.com/docs/cron-jobs) for more schedule options.

**Note**: The `CRON_SECRET` environment variable is automatically set by Vercel in production. You don't need to configure it manually.

### Alternative: Dynamic Rendering

If you need always-fresh data at the cost of slower page loads:

```typescript
// Add to any page for real-time data
export const dynamic = 'force-dynamic'
```

**Trade-off**: Query database on every request (~500-2000ms) vs. serve static HTML (~10-50ms)

---

## Known Limitations

1. **No Materialized Views**: Currently using standard SQL queries, not optimized with materialized views for frequently computed aggregations.

2. **Conflict Detection Only**: Conflicts (same token, same chain, different addresses/decimals) are detected but not automatically resolved. No provider priority system yet.

3. **No Staleness Deletion**: Old tokens not yet pruned. Need to implement `updated_at` tracking and cleanup logic.

4. **No Scheduled Jobs**: Manual trigger only. See "Production: Automatic Scheduled Fetches" section above for Vercel Cron setup.

5. **Limited Non-EVM Support**: Only Solana properly consolidated. Other non-EVM chains (Starknet, Bitcoin, Cosmos, etc.) need mapping additions.

---

## Development Guide

### Adding a New Provider

1. Create `src/lib/providers/{name}.ts`:

```typescript
import { Effect, Schema } from "effect"
import { createProviderFetch } from "./factory"
import type { Chain, Token } from "./types"

const PROVIDER_NAME = "newprovider"
const API_URL = "https://api.newprovider.com/tokens"

// Define API response schema using @effect/schema
const ResponseSchema = Schema.Struct({
  tokens: Schema.Array(Schema.Struct({
    address: Schema.String,
    symbol: Schema.String,
    // ... other fields
  }))
})

export class NewProvider extends Context.Tag("NewProvider")<
  NewProvider,
  {
    readonly fetch: Effect.Effect<
      ProviderResponse,
      ProviderError,
      HttpClient.HttpClient | Scope.Scope
    >
  }
>() {}

const make = Effect.gen(function* () {
  yield* Pg.PgDrizzle

  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      const data = yield* fetchJson(API_URL, ResponseSchema)

      // Transform to normalized format
      const chains: Chain[] = // ... extract chains
      const tokens: Token[] = // ... extract tokens with categorization

      return { chains, tokens }
    })
  )

  return { fetch }
})

export const NewProviderLive = Layer.effect(NewProvider, make)
```

2. Add to `src/lib/providers/index.ts`:

```typescript
const NewLive = NewProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))

export const AllProvidersLive = Layer.mergeAll(
  // ... existing providers,
  NewLive
)
```

3. Add to job runner and admin API.

4. Test:
```bash
./scripts/reset-and-fetch.sh
```

### Effect-TS Patterns

**Always use `Effect.gen` for async operations**:
```typescript
const result = yield* Effect.gen(function* () {
  const data = yield* fetchSomething()
  const processed = yield* processSomething(data)
  return processed
})
```

**Handle errors with tagged types**:
```typescript
Effect.gen(function* () {
  // ... code that might fail
}).pipe(
  Effect.mapError((error) =>
    new ProviderError({ provider: "name", message: "...", cause: error })
  )
)
```

**Use `Effect.scoped` for HttpClient**:
```typescript
const fetch = Effect.gen(function* () {
  const data = yield* fetchJson(url)
  // ...
}).pipe(Effect.scoped) // Consumes Scope requirement
```

---

## Testing & Verification

### Database Queries

**Check token counts per provider**:
```sql
SELECT provider_name, COUNT(*) as token_count
FROM tokens
GROUP BY provider_name
ORDER BY token_count DESC;
```

**Find multi-provider chains**:
```sql
SELECT chain_id, COUNT(DISTINCT provider_name) as provider_count
FROM chain_provider_support
GROUP BY chain_id
HAVING COUNT(DISTINCT provider_name) > 1
ORDER BY provider_count DESC
LIMIT 10;
```

**Recent fetch status**:
```sql
SELECT provider_name, fetched_at, success, chains_count, tokens_count
FROM provider_fetches
ORDER BY fetched_at DESC
LIMIT 10;
```

**VM type distribution**:
```sql
SELECT vm_type, COUNT(*) as chain_count
FROM chains
GROUP BY vm_type
ORDER BY chain_count DESC;
```

### Type Checking

The project should have **zero TypeScript errors**:

```bash
npx tsc --noEmit
# Expected output: no errors
```

---

## Documentation

### For Developers
- **[README.md](README.md)** (this file): User-facing documentation, API reference, quick start
- **[CLAUDE.md](CLAUDE.md)**: Development guide for Claude Code (architectural patterns, commands, critical decisions)
- **[PLAN.md](PLAN.md)**: Technical roadmap with all 12 provider API endpoints, implementation details, and Phase 10 next steps
- **[DEVCONTAINER_SETUP.md](DEVCONTAINER_SETUP.md)**: Devcontainer setup guide and troubleshooting

### For Reference
- **[.env.example](.env.example)**: Environment variable template
- **[repos/effect/](repos/effect/)**: Official Effect-TS source code (submodule, read-only)
- **[repos/cheffect/](repos/cheffect/)**: Production Effect app examples (submodule, read-only)

---

## Reference Repositories

The project includes two Git submodules for reference (NOT dependencies):

- **`repos/effect/`**: Official Effect-TS source code
  - Layer composition patterns: `packages/sql-drizzle/test/utils.ts`
  - HTTP client examples: `packages/platform/src/HttpClient.ts`

- **`repos/cheffect/`**: Production Effect application by Tim Smart
  - Real-world service architecture examples
  - Practical `Effect.gen` usage patterns

**Note**: These are read-only references. Do NOT modify or import from them.

---

## Contributing

### Before Committing
```bash
# Type check
npx tsc --noEmit

# Lint
pnpm lint

# Build
pnpm build

# Test data fetch
./scripts/reset-and-fetch.sh
```

---

## License

MIT License - Copyright (c) 2023 Wonder LTD

See [LICENSE](LICENSE) for full license text.

---

## Acknowledgments

- **[Wonderland](https://wonderland.xyz)**: Project development and maintenance
- **Effect-TS Team**: For the excellent functional programming framework
- **Drizzle Team**: For the type-safe ORM
- **Chainlist API**: For chain metadata enrichment
- **Provider Teams**: Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter

---

**Current Status**: Phase 9 Complete (All 12 Providers Operational)
**Next Phase**: Phase 10 - Conflict Resolution & Materialized Views
**Production**: Deployed at [token-aggregator.wonderland.xyz](https://token-aggregator.wonderland.xyz)

Last Updated: 2026-01-20
