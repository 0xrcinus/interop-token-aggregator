# Token Aggregator

A production-grade blockchain token aggregation application that fetches and normalizes token data from 12+ interoperability providers (bridges/protocols), stores it in PostgreSQL with comprehensive metadata enrichment, and exposes it via a modern REST API and web interface.

Built with **Effect-TS** for functional error handling, **Drizzle ORM** for type-safe database access, and **Next.js 16** for the web framework.

---

## Features

### Data Aggregation
- **12 Integrated Providers**: Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter
- **34,000+ Tokens** across **217+ Chains** with automatic deduplication
- **Non-EVM Chain Support**: Proper handling of Solana (SVM), Bitcoin (BVM), and other non-EVM chains with case-sensitive addresses
- **Chain Metadata Enrichment**: Automatic enrichment from Chainlist API (logos, explorers, RPC endpoints, chain types)
- **Token Categorization**: 8 categories (wrapped, stablecoin, liquidity-pool, governance, bridged, yield-bearing, rebasing, native)

### Architecture
- **Effect-TS 3.x**: Functional effect system with Context/Layer dependency injection pattern
- **Type Safety**: Full TypeScript with strict mode, zero `any` types, tagged errors throughout
- **Performance**: Parallel provider execution (~3.2s for all 12 providers), batch inserts (500 records/batch)
- **Data Integrity**: Optional decimals field (null when provider doesn't supply data), JSONB storage for raw provider data

### API & UI
- **REST API**: 6 endpoints for tokens, chains, providers, and admin operations
- **Modern UI**: shadcn/ui components with Tailwind CSS v4, lucide-react icons
- **Rich Metadata**: Chain logos, explorer links, provider health status, conflict detection
- **Tag Filtering**: Server-side filtering by token categories with URL-based state management

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

**Note**: Database data is not persisted across container restarts (by design for fresh testing). Just run `pnpm fetch:providers` again after restart (~3-5 seconds).

See [DEVCONTAINER_SETUP.md](DEVCONTAINER_SETUP.md) for details.

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
│   │   │   ├── admin/fetch/          # POST /api/admin/fetch (trigger data fetch)
│   │   │   ├── chains/               # GET /api/chains (chain list with metadata)
│   │   │   ├── providers/            # GET /api/providers (provider health)
│   │   │   └── tokens/               # GET /api/tokens (aggregated token list)
│   │   ├── chains/                   # Chains UI pages
│   │   ├── providers/                # Providers UI pages
│   │   ├── tokens/                   # Tokens UI pages
│   │   └── page.tsx                  # Home dashboard
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── chain-icon.tsx            # Chain logo component with fallback
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

## Architecture Deep Dive

### Effect-TS Layer Composition

The project uses Effect-TS 3.x's Context/Layer pattern for dependency injection. This is **critical** and must not be broken.

**Pattern**: All providers share base dependencies via `Layer.provideMerge`:

```typescript
// src/lib/providers/index.ts
const ProvidersBaseLive = Layer.mergeAll(
  DatabaseLive,              // PostgreSQL + Drizzle
  NodeHttpClient.layerUndici // HTTP client with retry logic
)

// Each provider receives dependencies automatically
const RelayLive = RelayProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))

// Final composed layer with all 12 providers
export const AllProvidersLive = Layer.mergeAll(
  RelayLive, LifiLive, AcrossLive, StargateLive, DebridgeLive,
  MayanLive, RhinoLive, GasZipLive, AoriLive, EcoLive, MesonLive, ButterLive
)
```

**Why `Layer.provideMerge` matters**: Using `Layer.provide` instead will cause "Service not found: @effect/platform/HttpClient" errors. `provideMerge` properly resolves nested dependencies.

### Tagged Errors

All errors extend `Data.TaggedError` for type safety (required by Effect language service):

```typescript
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly provider: string
  readonly message: string
  readonly cause?: unknown
}> {}
```

### Address Normalization (Chain-Aware)

**Critical for Non-EVM Chains**: Solana addresses are case-sensitive (base58), EVM addresses are case-insensitive (hex).

```typescript
import { normalizeAddress } from "@/lib/aggregation/normalize"
import { isEvmChain } from "@/lib/aggregation/chain-mapping"

const isEvm = isEvmChain(chainId)
const address = normalizeAddress(token.address, isEvm)

// EVM: 0xABC... → 0xabc... (lowercase)
// Solana: 2zMMh... → 2zMMh... (preserved case)
```

### Chain ID Normalization

Non-EVM chains like Solana have different IDs across providers. The system normalizes them to canonical IDs:

```typescript
// src/lib/aggregation/chain-mapping.ts
export const CHAIN_ID_MAPPINGS: Record<string, Record<number, number>> = {
  "relay": { 792703809: 34268394551451 },      // Relay's Solana → Across's Solana
  "gaszip": { 501474: 34268394551451 },        // GasZip's Solana → Across's Solana
  "butter": { 1360108768460801: 34268394551451 } // Butter's Solana → Across's Solana
}
```

**Result**: Single unified Solana chain (ID: 34268394551451) with tokens from 3 providers.

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

Create `.env.local` with the following variables:

```env
# Database Configuration (PostgreSQL on port 5433)
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=tokendb
DATABASE_USER=dev
DATABASE_PASSWORD=dev

# Optional: Full connection string (overrides individual vars)
# DATABASE_URL=postgresql://dev:dev@localhost:5433/tokendb

# Admin API Secret (for POST /api/admin/fetch)
ADMIN_SECRET=change-this-in-production
```

**Important**: The database runs on **port 5433** (not the default 5432) to avoid conflicts with local PostgreSQL installations.

---

## Provider Implementations

### Implemented Providers (12)

| Provider | Tokens | Chains | Notes |
|----------|--------|--------|-------|
| **DeBridge** | 16,712 | 24 | Largest token count, per-chain fetching |
| **LiFi** | 12,692 | 58 | Null byte sanitization required |
| **Stargate** | 2,157 | 96 | chainKey → chainId mapping |
| **Across** | 1,333 | 23 | Parallel endpoint fetching |
| **Mayan** | 468 | 7 | Wormhole chain ID mapping |
| **Butter** | 200 | 14 | Paginated API with concurrency control |
| **Relay** | 166 | 80 | EVM + non-EVM chains, vmType detection |
| **GasZip** | 161 | 161 | Native tokens only, mainnet filtering |
| **Meson** | 138 | 72 | Hex and decimal chain ID parsing |
| **Aori** | 92 | 8 | Minimal metadata, no decimals |
| **Rhino.fi** | 78 | 31 | Nested token structure |
| **Eco** | 24 | 10 | Static hardcoded data |

**Total**: 34,221 tokens across 217 chains (fetch time: ~3.2s)

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

## Key Technical Decisions

### 1. Bigint Chain IDs
Some chains have IDs > 2 billion (e.g., Across's Solana: 34268394551451). The database uses `bigint` instead of `integer`.

### 2. Optional Decimals Field
When providers don't supply decimals data, we store `null` instead of defaulting to 18. This maintains data integrity and makes missing data transparent.

### 3. JSONB Raw Data Storage
All tokens store the original provider response in `raw_data` JSONB field. This enables debugging provider discrepancies without refetching.

### 4. Batch Inserts with Deduplication
Inserts are batched (500 records/batch) with within-batch deduplication to prevent "ON CONFLICT DO UPDATE" errors from duplicate data.

### 5. Chain-Aware Address Normalization
EVM addresses are lowercased, non-EVM addresses (Solana, etc.) preserve case. This prevents breaking block explorer links for case-sensitive encodings.

### 6. VM Type Storage
Instead of manual chain ID mapping, the system stores `vm_type` from provider data (Relay's `vmType`, Stargate's `chainType`). This makes the system extensible to new VM types.

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

## Known Limitations

1. **No Materialized Views**: Currently using standard SQL queries, not optimized with materialized views for frequently computed aggregations.

2. **Conflict Detection Only**: Conflicts (same token, same chain, different addresses/decimals) are detected but not automatically resolved. No provider priority system yet.

3. **No Staleness Deletion**: Old tokens not yet pruned. Need to implement `updated_at` tracking and cleanup logic.

4. **No Scheduled Jobs**: Manual trigger only via API. Vercel Cron or similar not yet configured.

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

### Code Style
- Use Effect-TS patterns (no raw Promises in provider code)
- All errors must extend `Data.TaggedError`
- TypeScript strict mode (zero `any` types)
- Functional programming style (immutability, pure functions)

### Before Committing
```bash
# Type check
npx tsc --noEmit

# Lint
pnpm lint

# Test data fetch
./scripts/reset-and-fetch.sh
```

---

## License

MIT

---

## Acknowledgments

- **Effect-TS Team**: For the excellent functional programming framework
- **Drizzle Team**: For the type-safe ORM
- **Chainlist API**: For chain metadata enrichment
- **Provider Teams**: Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter

---

**Current Status**: Phase 9 Complete (All 12 Providers Operational)
**Next Phase**: Phase 10 - Conflict Resolution & Materialized Views

Last Updated: 2026-01-20 (Documentation reviewed and verified)
