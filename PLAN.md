# Token Aggregator - Development Plan

**Status**: Phase 9 Complete - All 12 Providers Operational
**Next Phase**: Phase 10 - Conflict Resolution & Materialized Views
**Last Updated**: 2026-01-20

---

## Project Overview

A production-grade blockchain token aggregation application that fetches token data from 12 interoperability providers, stores it in PostgreSQL with comprehensive metadata enrichment, and exposes it via REST API and web interface.

**Tech Stack**: Effect-TS 3.x, Drizzle ORM 0.38, Next.js 16, PostgreSQL 16, TypeScript 5

**Current Data**: 34,221 tokens across 217 chains from 12 providers (fetch time: ~3.2s)

---

## Architecture Overview

### Core Architectural Patterns

#### 1. Effect Layer Composition (CRITICAL)
```typescript
// src/lib/providers/index.ts
const ProvidersBaseLive = Layer.mergeAll(
  DatabaseLive,              // PostgreSQL + Drizzle
  NodeHttpClient.layerUndici // HTTP client with retry
)

// Each provider receives dependencies via Layer.provideMerge
const RelayLive = RelayProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))

export const AllProvidersLive = Layer.mergeAll(
  RelayLive, LifiLive, AcrossLive, StargateLive, DebridgeLive,
  MayanLive, RhinoLive, GasZipLive, AoriLive, EcoLive, MesonLive, ButterLive
)
```

**Why `Layer.provideMerge` is critical**: Using `Layer.provide` will cause "Service not found: @effect/platform/HttpClient" errors. Only `provideMerge` properly resolves nested dependencies.

**Reference**: `repos/effect/packages/sql-drizzle/test/utils.ts:7-8`

#### 2. Tagged Errors (Required by Effect Language Service)
```typescript
// src/lib/providers/types.ts
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly provider: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}> {}
```

**Never use global `Error` type** - Effect language service enforces tagged errors.

#### 3. Chain-Aware Address Normalization (CRITICAL)
```typescript
// src/lib/aggregation/normalize.ts
import { isEvmChain } from "../aggregation/chain-mapping"

export const normalizeAddress = (address: string, isEvm: boolean = true): string => {
  if (!isEvm) {
    return address.trim() // Preserve case for Solana (base58), Starknet, etc.
  }
  return address.toLowerCase().trim() // EVM addresses to lowercase
}

// In provider code:
const isEvm = isEvmChain(chainId)
const address = normalizeAddress(token.address, isEvm)
```

**Why**: Solana addresses use case-sensitive base58 encoding. EVM addresses use case-insensitive hex. Breaking this causes invalid block explorer links.

**Example**: `2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv` (PENGU on Solana) must preserve capitalization.

#### 4. Batch Inserts with Deduplication
```typescript
// src/lib/providers/storage.ts
const BATCH_SIZE = 500

// Deduplicate within batch to prevent "ON CONFLICT DO UPDATE" errors
const uniqueTokens = Array.from(
  new Map(
    batch.map((token) => [`${token.chainId}-${token.address}`, token])
  ).values()
)

for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
  const batch = uniqueTokens.slice(i, i + BATCH_SIZE)
  yield* drizzle.insert(db.tokens).values(batch).onConflictDoUpdate(...)
}
```

**Why**: Prevents stack overflow on large datasets (LiFi has 12,692 tokens) and handles duplicate data from providers.

---

## Database Schema

### 4 Core Tables

#### `chains`
```sql
chains
  - chain_id: bigint (PK, supports IDs > 2 billion like Across's 34268394551451)
  - name, short_name, chain_type (mainnet/testnet)
  - vm_type: text (evm/svm/bvm/lvm - from provider data)
  - native_currency_name, native_currency_symbol, native_currency_decimals
  - icon, info_url: text
  - explorers, rpc, faucets, ens, features: jsonb
  - created_at, updated_at: timestamp
```

**Why bigint**: Some chains have IDs > 2 billion (Across's Solana: 34268394551451).

**VM Type Storage**: Instead of manual chain ID mapping, stores `vm_type` from provider data (Relay's `vmType`, Stargate's `chainType`). Extensible to new VM types.

#### `tokens`
```sql
tokens
  - id: serial (PK)
  - chain_id: bigint (FK → chains.chain_id)
  - provider_name: text
  - address: text (case-preserved for non-EVM chains)
  - symbol, name: text
  - decimals: integer (optional - null when provider doesn't supply)
  - logo_uri: text
  - tags: jsonb (array of category tags)
  - raw_data: jsonb (original provider response for debugging)
  - fetch_id: integer (FK → provider_fetches.id)
  - created_at, updated_at: timestamp
  - UNIQUE(chain_id, provider_name, address)
```

**Optional Decimals**: When providers don't supply decimals, store `null` instead of defaulting to 18. Maintains data integrity.

**Raw Data Storage**: Complete original API response stored in `raw_data` JSONB field. Enables:
- Debugging provider discrepancies without refetching
- Reconstructing aggregation logic historically
- Accessing provider-specific metadata not in normalized schema
- Analyzing how providers change data over time

#### `chain_provider_support`
```sql
chain_provider_support
  - id: serial (PK)
  - chain_id: bigint (FK → chains.chain_id)
  - provider_name: text
  - fetch_id: integer (FK → provider_fetches.id)
  - created_at: timestamp
  - INDEX(chain_id, provider_name)
```

M:N relationship tracking which providers support which chains.

#### `provider_fetches`
```sql
provider_fetches
  - id: serial (PK)
  - provider_name: text
  - fetched_at: timestamp (default now())
  - success: boolean
  - chains_count, tokens_count: integer
  - error_message: text
```

Audit log of all fetch attempts with success/error tracking.

---

## Provider Implementations

### All 12 Providers Status

| Provider | Status | Tokens | Chains | Notes |
|----------|--------|--------|--------|-------|
| **DeBridge** | ✅ Complete | 16,712 | 24 | Per-chain fetching, excludes non-EVM |
| **LiFi** | ✅ Complete | 12,692 | 58 | Null byte sanitization, infers chains |
| **Stargate** | ✅ Complete | 2,157 | 96 | chainKey → chainId mapping |
| **Across** | ✅ Complete | 1,333 | 23 | Parallel endpoints |
| **Mayan** | ✅ Complete | 468 | 7 | Wormhole chain ID mapping |
| **Butter** | ✅ Complete | 200 | 14 | Paginated API |
| **Relay** | ✅ Complete | 166 | 80 | VM type detection |
| **GasZip** | ✅ Complete | 161 | 161 | Native tokens only |
| **Meson** | ✅ Complete | 138 | 72 | Hex/decimal chain ID parsing |
| **Aori** | ✅ Complete | 92 | 8 | Minimal metadata, no decimals |
| **Rhino.fi** | ✅ Complete | 78 | 31 | Nested token structure |
| **Eco** | ✅ Complete | 24 | 10 | Static hardcoded data |

**Total**: 34,221 tokens across 217 chains

### Provider API Endpoints & Implementation Details

#### 1. Relay
- **API URL**: `https://api.relay.link/chains`
- **Method**: GET, no authentication
- **EVM Filtering**: Filter chains where `vmType === "evm"`
- **Nested Tokens**: Tokens in `solverCurrencies` array within each chain
- **VM Type Storage**: Stores `vmType` field in database (evm/svm/bvm/lvm)
- **Missing Native Currency**: Handles chains without `nativeCurrency` with fallbacks
- **Response Structure**: `{ chains: [{ id, name, vmType, nativeCurrency, solverCurrencies[] }] }`
- **File**: `src/lib/providers/relay.ts`

#### 2. LiFi
- **API URL**: `https://li.quest/v1/tokens`
- **Method**: GET, no authentication
- **Null Byte Sanitization**: MUST sanitize strings: `str?.replace(/\0/g, "")` or PostgreSQL errors
- **Chain Inference**: No chains endpoint - infer from token `chainId`s
- **Batch Inserts**: 12,692 tokens require 500-record batching
- **Response Structure**: `{ tokens: { "1": [], "10": [], ... } }` (chainId as key)
- **File**: `src/lib/providers/lifi.ts`

#### 3. Across
- **API URLs**:
  - Chains: `https://across.to/api/swap/chains`
  - Tokens: `https://across.to/api/swap/tokens`
- **Method**: GET (both), no authentication
- **Parallel Fetching**: Fetches both endpoints concurrently
- **Logo Field**: Uses `logoUrl` (not `logoURI`) - must map to standard field
- **Chain Deduplication**: Must deduplicate chains before insertion
- **File**: `src/lib/providers/across.ts`

#### 4. Stargate
- **API URLs**:
  - Chains: `https://stargate.finance/api/v1/chains`
  - Tokens: `https://stargate.finance/api/v1/tokens`
- **Method**: GET (both), no authentication
- **Chain Key Mapping**: Tokens use `chainKey` (string), must build mapping to numeric `chainId`
- **EVM Filtering**: Filter chains where `chainType === "evm"`
- **VM Type**: Stores `chainType` as `vmType` in database
- **File**: `src/lib/providers/stargate.ts`

#### 5. DeBridge
- **API URLs**:
  - Chains: `https://dln.debridge.finance/v1.0/supported-chains-info`
  - Tokens (per-chain): `https://dln.debridge.finance/v1.0/token-list?chainId={chainId}`
- **Method**: GET, no authentication
- **Per-Chain Fetching**: Must fetch tokens separately for EACH EVM chain
- **Non-EVM Exclusions**: Exclude chain IDs `[7565164, 100000026, 100000027, 100000029]`
  - 7565164 = Solana, 100000026 = Tron, 100000027 = Sei, 100000029 = Injective
- **Address Validation**: Validate `/^0x[a-fA-F0-9]{40}$/` to filter non-EVM tokens
- **Chain ID**: Use `originalChainId` if present, fallback to `chainId`
- **Response Structure**: Tokens wrapped in `{ tokens: { "0xAddress": {...} } }`
- **File**: `src/lib/providers/debridge.ts`

#### 6. Mayan
- **API URL**: `https://price-api.mayan.finance/v3/tokens`
- **Method**: GET, no authentication
- **Wormhole Mapping** (CRITICAL):
  ```typescript
  const WORMHOLE_TO_EVM_CHAIN = {
    2: 1,      // Ethereum
    4: 56,     // BSC
    5: 137,    // Polygon
    6: 43114,  // Avalanche
    10: 250,   // Fantom
    23: 42161, // Arbitrum
    24: 10,    // Optimism
    30: 8453   // Base
  }
  ```
- **Address Field**: Use `contract` (not `mint`) for EVM chains
- **Non-EVM Exclusions**: Exclude chain names: `["solana", "aptos", "sui", "ton", "tron", "cosmos", "osmosis", "injective", "sei"]`
- **Address Validation**: Validate `/^0x[a-fA-F0-9]{40}$/`
- **Response Structure**: `{ "ethereum": [], "polygon": [], ... }` (chain name as key)
- **File**: `src/lib/providers/mayan.ts`

#### 7. Rhino.fi
- **API URL**: `https://api.rhino.fi/bridge/configs`
- **Method**: GET, no authentication
- **Nested Structure**: Object keys are arbitrary, values contain chain config
- **Token Symbol**: Use object key (not `token` field) as symbol
- **Decimals Default**: Default to 18 if not provided
- **Network ID**: Can be number or string, must parse accordingly
- **Response Structure**: `{ "chain_key": { name, networkId, tokens: { "SYMBOL": {...} } } }`
- **File**: `src/lib/providers/rhino.ts`

#### 8. GasZip
- **API URL**: `https://backend.gas.zip/v2/chains`
- **Method**: GET, no authentication
- **Mainnet Filter**: Filter where `mainnet === true`
- **Native Tokens Only**: Only provides native gas tokens (no ERC20s)
- **Native Address**: Use `0x0000000000000000000000000000000000000000`
- **Response Structure**: `{ chains: [{ name, chain, symbol, decimals, mainnet }] }`
- **File**: `src/lib/providers/gaszip.ts`

#### 9. Aori
- **API URLs**:
  - Chains: `https://api.aori.io/chains`
  - Tokens: `https://api.aori.io/tokens`
- **Method**: GET (both), no authentication
- **Missing Metadata**: No token names (use symbol), no decimals (set to `undefined`)
- **Chain Name**: Use `chainKey` as name (no official names)
- **LayerZero**: Includes `eid` field (LayerZero endpoint ID)
- **Response Structure**: Arrays with minimal fields (chainId, chainKey, symbol, address)
- **File**: `src/lib/providers/aori.ts`

#### 10. Eco
- **API**: None - static data only
- **Source**: https://eco.com/docs/getting-started/routes/chain-support
- **Supported Chains**: `[1, 10, 130, 137, 146, 480, 8453, 42161, 42220, 57073]`
  - Ethereum, Optimism, Unichain, Polygon, Sonic, World Chain, Base, Arbitrum, Celo, Ink
- **Tokens**: 6 stablecoins (USDC, USDT, USDCe, USDbC, oUSDT, USDT0)
- **Structure**: Each token has `addresses: Record<chainId, address>`
- **File**: `src/lib/providers/eco.ts`

#### 11. Meson
- **API URL**: `https://relayer.meson.fi/api/v1/list`
- **Method**: GET, no authentication
- **Hex/Decimal Chain ID** (CRITICAL):
  - If `chainId.startsWith("0x")` → parse as hex: `parseInt(chainId, 16)`
  - Otherwise → parse as decimal: `parseInt(chainId, 10)`
- **Missing Metadata**: No names (use uppercase `id`), no decimals (set to `undefined`)
- **Token Address**: Optional `addr` field (skip if missing)
- **Response Structure**: `{ result: [{ id, name, chainId, tokens: [{ id, addr }] }] }`
- **File**: `src/lib/providers/meson.ts`

#### 12. Butter
- **API URLs**:
  - Chains: `https://bs-tokens-api.chainservice.io/api/queryChainList`
  - Tokens: `https://bs-tokens-api.chainservice.io/api/queryTokenList?network={network}&pageSize=100`
- **Method**: GET, no authentication
- **Limited Networks**: Only fetch 5 major networks (rate limiting):
  - `["ethereum", "binance-smart-chain", "polygon", "arbitrum", "optimism"]`
- **Pagination**: `pageSize=100` per network
- **Concurrency Control**: Use `concurrency: 5` for rate limiting
- **Response Structure**: `{ code, data: { chains/results, count } }`
- **Network Mapping**: Build chain name → network slug mapping for token fetches
- **File**: `src/lib/providers/butter.ts`

---

## Chain ID Normalization (Non-EVM Chains)

### Problem
Non-EVM chains like Solana have different IDs across providers, causing data fragmentation.

### Solution
```typescript
// src/lib/aggregation/chain-mapping.ts
export const CHAIN_ID_MAPPINGS: Record<string, Record<number, number>> = {
  "relay": { 792703809: 34268394551451 },      // Relay's Solana → Across's Solana
  "gaszip": { 501474: 34268394551451 },        // GasZip's Solana → Across's Solana
  "butter": { 1360108768460801: 34268394551451 } // Butter's Solana → Across's Solana
}
```

**Canonical Metadata**: `src/lib/chains/canonical-metadata.ts` provides authoritative metadata for non-EVM chains (name, icon, explorers, VM type).

**Integration**: `src/lib/providers/factory.ts` automatically normalizes chain IDs for all providers.

**Result**: Single unified Solana chain (ID: 34268394551451) with tokens from 3 providers.

---

## Token Categorization System

### 8 Categories
```typescript
// src/lib/aggregation/categorize.ts
export type TokenCategory =
  | "wrapped"       // WETH, wBTC, wrapped tokens
  | "stablecoin"    // USDC, DAI, USDT
  | "liquidity-pool" // LP tokens, pool shares
  | "governance"    // Governance/voting tokens
  | "bridged"       // Cross-chain bridged variants (.e suffix)
  | "yield-bearing" // Yield/interest-bearing tokens
  | "rebasing"      // Rebasing tokens (stETH, etc.)
  | "native"        // Native chain tokens (ETH, SOL)
```

**Pattern-Based Detection**: Uses regex matching on symbol and name fields.

**Distribution** (34,221 tokens):
- 628 wrapped | 520 stablecoins | 478 rebasing | 327 liquidity pools
- 239 yield-bearing | 156 governance | 132 native | 117 bridged

---

## API Endpoints

### REST API (6 Endpoints)

1. **GET /api/tokens** - Aggregated token list
   - Query: `limit`, `offset`, `symbol`, `tag`
   - Returns: Tokens grouped by symbol with provider/chain counts

2. **GET /api/tokens/:symbol** - Token detail
   - Returns: All instances across chains/providers, conflict detection

3. **GET /api/chains** - Chain list
   - Returns: Chains with metadata, provider support, token counts

4. **GET /api/providers** - Provider health status
   - Returns: Fetch history, success rates, last fetch status

5. **GET /api/providers/:provider** - Provider detail
   - Query: `limit`, `offset`, `symbol`
   - Returns: All tokens from provider with chain support

6. **POST /api/admin/fetch** - Trigger fetch job
   - Auth: `x-admin-secret` header
   - Response: 202 Accepted (async execution)

---

## Critical Patterns to Preserve

### 1. Effect.gen Usage
```typescript
const make = Effect.gen(function* () {
  const drizzle = yield* Pg.PgDrizzle

  const fetch = Effect.gen(function* () {
    const data = yield* fetchJson(url)
    // ... transformation
    return { chains, tokens }
  })

  return { fetch }
})
```

### 2. Error Handling with mapError
```typescript
Effect.gen(function* () {
  // ... code that might fail
}).pipe(
  Effect.mapError((error) =>
    new ProviderError({ provider: "name", message: "...", cause: error })
  )
)
```

### 3. Effect.scoped for HttpClient
```typescript
const fetch = Effect.gen(function* () {
  const data = yield* fetchJson(url)
  // ...
}).pipe(Effect.scoped) // Consumes Scope requirement
```

### 4. Provider Fetch Pipeline
```typescript
// src/lib/providers/factory.ts
const fetch = createProviderFetch(
  PROVIDER_NAME,
  Effect.gen(function* () {
    // Fetch and transform data
    const chains: Chain[] = ...
    const tokens: Token[] = ...

    return { chains, tokens }
    // Storage, logging, error handling automatic
  })
)
```

---

## Phase 10: Next Steps - Conflict Resolution & Materialized Views

### 1. Materialized Views (Performance Optimization)

**Create aggregated_tokens view**:
```sql
CREATE MATERIALIZED VIEW mv_token_summary AS
SELECT
  symbol,
  COUNT(DISTINCT provider_name) as provider_count,
  COUNT(DISTINCT chain_id) as chain_count,
  COUNT(*) as total_instances,
  ARRAY_AGG(DISTINCT provider_name) as providers,
  ARRAY_AGG(DISTINCT chain_id) as chains
FROM tokens
GROUP BY symbol;

-- Refresh after each provider fetch
REFRESH MATERIALIZED VIEW mv_token_summary;
```

**Benefits**:
- Fast read access for `/api/tokens` endpoint
- No runtime aggregation queries
- Pre-computed provider/chain counts

### 2. Conflict Resolution System

**Current State**: Conflicts detected but not resolved.

**Conflict Types**:
- **Variant** (Not Actually Conflicts): WETH vs wETH vs Weth (case), USDC.e vs USDC (bridged)
- **True Errors**: Same symbol, same chain, different addresses OR decimals

**Resolution Strategy**:
```typescript
// src/lib/aggregation/resolution.ts
export const resolveConflicts = (tokens: TokenInstance[]) => {
  // 1. Normalize symbols (uppercase, remove special chars)
  // 2. Group by normalized symbol + chain
  // 3. If addresses differ, apply priority rules:
  //    - Most provider support wins
  //    - Reliable providers (relay, lifi, across, stargate, debridge) weighted higher
  //    - If tied, first seen chronologically
  // 4. Store resolution in new table: token_resolutions
}
```

**New Table**:
```sql
token_resolutions
  - symbol: text
  - chain_id: bigint
  - primary_address: text
  - primary_decimals: integer
  - primary_providers: text[]
  - conflicts: jsonb (array of {address, decimals, providers, conflictType})
  - last_updated: timestamp
  - (PK: symbol, chain_id)
```

### 3. Native Token Address Equivalence

**Problem**: `0x0000000000000000000000000000000000000000` and `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` both represent native tokens.

**Solution**: Normalize both to `0x0000000000000000000000000000000000000000` for comparison (EVM chains only).

### 4. Staleness Detection & Cleanup

**Current**: Tokens never deleted, database grows indefinitely.

**Implementation**:
```sql
-- Mark stale tokens (not seen in last 7 days)
UPDATE tokens
SET is_stale = true
WHERE updated_at < NOW() - INTERVAL '7 days';

-- Or hard delete
DELETE FROM tokens
WHERE updated_at < NOW() - INTERVAL '7 days';
```

**Recommendation**: Add `is_stale` boolean field, soft delete first, hard delete after 30 days.

### 5. Scheduled Jobs (Vercel Cron)

**Development**: Manual trigger via `POST /api/admin/fetch`

**Production**:
```typescript
// src/app/api/cron/fetch/route.ts
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Trigger fetch job
  // ...
}
```

**vercel.json**:
```json
{
  "crons": [{
    "path": "/api/cron/fetch",
    "schedule": "0 */6 * * *"  // Every 6 hours
  }]
}
```

---

## Known Issues & Solutions

### Issue: "Service not found: @effect/platform/HttpClient"
**Solution**: Use `Layer.provideMerge` instead of `Layer.provide` for nested dependencies.

### Issue: Chain ID out of range for integer
**Solution**: Use `bigint("chain_id", { mode: "number" })` in schema, not `integer`.

### Issue: Stack overflow when inserting large token lists
**Solution**: Batch inserts in groups of 500 records with deduplication.

### Issue: PostgreSQL "invalid byte sequence for encoding UTF8: 0x00"
**Solution**: Sanitize LiFi data: `str?.replace(/\0/g, "")` before inserting.

### Issue: Solana addresses showing lowercase (breaking block explorer links)
**Solution**: Use chain-aware normalization with `normalizeAddress(address, isEvm)`.

### Issue: EVM addresses with different cases treated as different
**Current Trade-off**: Conservative approach (over-report conflicts) safer than under-reporting.
**Future Fix**: Pass `vm_type` to frontend for chain-aware comparison.

---

## Environment Variables

```env
# Database Configuration (PostgreSQL on port 5433)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DATABASE=tokendb
POSTGRES_USER=dev
POSTGRES_PASSWORD=dev

# Optional: Full connection string (overrides individual vars)
DATABASE_URL=postgresql://dev:dev@localhost:5433/tokendb

# Admin API Secret (for POST /api/admin/fetch)
ADMIN_SECRET=change-this-in-production

# Optional: Cron webhook secret
CRON_SECRET=random-secret-key
```

**Critical**: Database runs on port **5433** (not 5432) to avoid conflicts with local PostgreSQL.

---

## File Structure Reference

```
src/
├── app/
│   ├── api/
│   │   ├── admin/fetch/route.ts      # POST trigger fetch job
│   │   ├── chains/[chainId]/tokens/route.ts # GET chain tokens
│   │   ├── providers/[provider]/route.ts    # GET provider detail
│   │   └── tokens/[symbol]/route.ts  # GET token detail
│   ├── chains/[chainId]/
│   │   ├── page.tsx                  # Chain detail page
│   │   └── token-list.tsx            # Client component with pagination
│   ├── providers/[provider]/
│   │   ├── page.tsx                  # Provider detail page
│   │   └── token-list.tsx            # Paginated token list
│   └── tokens/[symbol]/page.tsx      # Token detail page
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── chain-icon.tsx                # Chain logo with fallback
│   └── support-matrix.tsx            # Provider support visualization
├── lib/
│   ├── aggregation/
│   │   ├── categorize.ts             # Token categorization logic
│   │   ├── chain-mapping.ts          # Chain ID normalization
│   │   └── normalize.ts              # Chain-aware address normalization
│   ├── api/
│   │   ├── admin.ts                  # AdminApiService
│   │   ├── chains.ts                 # ChainApiService
│   │   ├── providers.ts              # ProviderApiService
│   │   ├── tokens.ts                 # TokenApiService
│   │   └── index.ts                  # ApiServicesLive layer
│   ├── chains/
│   │   ├── canonical-metadata.ts     # Canonical chain metadata (non-EVM)
│   │   ├── enrichment.ts             # Chain enrichment logic
│   │   └── registry.ts               # ChainRegistry (Chainlist API)
│   ├── db/
│   │   ├── layer.ts                  # SqlLive, DrizzleLive, DatabaseLive
│   │   └── schema.ts                 # 4 tables with enhanced chain metadata
│   └── providers/
│       ├── factory.ts                # createProviderFetch utility
│       ├── http.ts                   # Effect HttpClient wrapper
│       ├── storage.ts                # Batch inserts with deduplication
│       ├── types.ts                  # ProviderError, DatabaseError
│       ├── index.ts                  # AllProvidersLive layer
│       └── [provider].ts             # 12 provider implementations
└── jobs/
    └── fetch-providers.ts            # CLI job runner
```

---

## Development Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server (port 3000)
pnpm build                  # Build for production
pnpm start                  # Start production server

# Database
pnpm db:studio              # Open Drizzle Studio (database GUI)
pnpm db:generate            # Generate new migration
pnpm db:push                # Apply migrations to database
docker-compose up -d        # Start PostgreSQL
docker-compose down         # Stop PostgreSQL

# Data Management
./scripts/reset-and-fetch.sh     # Clean DB + trigger fresh fetch
pnpm fetch:providers             # Run CLI job runner (alternative)

# Quality
npx tsc --noEmit           # Type check (should show 0 errors)
pnpm lint                  # Run ESLint
```

---

## Testing Queries

```sql
-- Token counts per provider
SELECT provider_name, COUNT(*) as token_count
FROM tokens
GROUP BY provider_name
ORDER BY token_count DESC;

-- Multi-provider chains
SELECT chain_id, COUNT(DISTINCT provider_name) as provider_count
FROM chain_provider_support
GROUP BY chain_id
HAVING COUNT(DISTINCT provider_name) > 1
ORDER BY provider_count DESC
LIMIT 10;

-- Recent fetch status
SELECT provider_name, fetched_at, success, chains_count, tokens_count
FROM provider_fetches
ORDER BY fetched_at DESC
LIMIT 10;

-- VM type distribution
SELECT vm_type, COUNT(*) as chain_count
FROM chains
GROUP BY vm_type
ORDER BY chain_count DESC;
```

---

## Success Metrics

✅ **Architecture**: Effect-TS layer composition working, tagged errors, batch inserts, 0 TypeScript errors

✅ **Data Quality**: 34,221 tokens, 217 chains, optional decimals, case-preserved addresses, deduplication

✅ **Performance**: ~3.2s parallel fetch, 500-record batching, Effect.scoped resource cleanup

✅ **UX**: Modern UI, chain logos, provider health, tag filtering, conflict detection

---

## Reference Documentation

- **Effect-TS Patterns**: `repos/effect/packages/sql-drizzle/test/utils.ts` (layer composition)
- **Cheffect Examples**: `repos/cheffect/src/` (practical Effect usage)
- **CLAUDE.md**: Development guide for Claude Code (architectural patterns)
- **README.md**: User-facing documentation and API reference

---

**End of Plan Document**
