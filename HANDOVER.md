# Token Aggregator MVP - Handover Note

**Date**: 2026-01-19
**Status**: Phase 9 Complete - All 12 Providers + Non-EVM Chain Support
**Next Phase**: Phase 10 - Conflict Detection & Materialized Views

---

## Project Overview

Building an MVP token aggregation application that fetches blockchain token data from multiple interoperability providers, stores it in PostgreSQL, and exposes it via REST API. The project uses **Effect-TS** for functional error handling, **Drizzle ORM** for type-safe database access, and **Next.js 16** for the web framework.

### Current MVP Scope
- **12 Providers**: Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter (all operational)
- **Database**: PostgreSQL 16 running natively in devcontainer on port 5433 with enhanced chain metadata + token tags
- **API Endpoints**: Full REST API with Effect-TS services including tag filtering and provider detail pages
- **UI**: Next.js 16 with shadcn/ui components showing chains, tokens (with tags), providers (compact table + detail pages), and conflicts
- **Chain Enrichment**: Automatic metadata enrichment from Chainlist API (logos, explorers, types)
- **Token Categorization**: 8 categories (wrapped, stablecoin, liquidity-pool, governance, bridged, yield-bearing, rebasing, native)
- **Data Quality**: Optional decimals field (providers without decimals return null instead of defaulting to 18)
- **Chain Consolidation**: Non-EVM chains (Solana) consolidated via chain ID normalization system
- **VM Type Support**: Automatic VM type detection from providers (EVM, SVM, BVM, LVM) with case-sensitive address handling
- **Data**: 34,228 tokens across 217 chains with categorization tags

---

## Architecture Overview

### Technology Stack
- **Effect-TS 3.x**: Functional effect system with Context/Layer pattern
- **Drizzle ORM 0.38**: Type-safe SQL with PostgreSQL
- **Next.js 16**: App Router for API and UI (fully implemented)
- **TypeScript**: ES2022 target with strict mode
- **PostgreSQL 16**: Running natively in devcontainer on port 5433

### Key Architectural Decisions

1. **Effect Layer Composition** (Critical Pattern)
   - `AllProvidersLive` layer includes all dependencies via `Layer.provideMerge`
   - Pattern: `ProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))`
   - Reference: `/repos/effect/packages/sql-drizzle/test/utils.ts:7-8`

2. **Tagged Errors** (Effect Best Practice)
   - `ProviderError`: For fetch/API failures with provider context
   - `DatabaseError`: For database operation failures
   - Both extend `Data.TaggedError` for type safety

3. **Database Schema** (4 Tables with Enhanced Chain Metadata + Token Tags)
   - `provider_fetches`: Tracks each fetch attempt with status
   - `chains`: Normalized chain data with enriched metadata (10 new fields from Chainlist)
     - Basic: `chain_id` (bigint), `name`, `native_currency_*`
     - Enhanced: `short_name`, `chain_type`, `icon`, `info_url`, `explorers` (jsonb), `rpc` (jsonb), `faucets` (jsonb), `ens` (jsonb), `features` (jsonb)
   - `chain_provider_support`: M-N relationship, chains ↔ providers
   - `tokens`: Token instances with `raw_data` JSONB for debugging and `tags` JSONB for categorization

4. **Batch Inserts with Deduplication** (Performance & Data Quality)
   - 500 records per batch to prevent stack overflow on large datasets
   - Deduplicates chains and tokens within batches to prevent "ON CONFLICT DO UPDATE" errors
   - Critical for providers like Across that return duplicate data

---

## Project Structure

```
interop-token-aggregator/
├── .env.local                      # Database credentials (gitignored)
├── .env.example                    # Template for environment variables
├── docker-compose.yml              # PostgreSQL 16 on port 5433
├── tsconfig.json                   # ES2022, downlevelIteration: true
├── drizzle.config.ts               # Drizzle migration config
├── package.json                    # Effect 3.x, Drizzle 0.38
├── repos/                          # Git submodules (effect, cheffect)
│   ├── effect/                     # Reference for Effect patterns
│   └── cheffect/                   # Reference for practical examples
├── scripts/
│   └── reset-and-fetch.sh          # ✅ Database reset + refetch utility
├── src/
│   ├── app/
│   │   ├── api/                    # ✅ REST API routes (Phase 6)
│   │   │   ├── admin/fetch/        # POST /api/admin/fetch (trigger job)
│   │   │   ├── chains/             # GET /api/chains (with metadata)
│   │   │   ├── conflicts/          # GET /api/conflicts (token conflicts)
│   │   │   ├── providers/          # GET /api/providers (health status)
│   │   │   └── tokens/             # GET /api/tokens, /api/tokens/:symbol
│   │   ├── chains/                 # ✅ Chains UI page (Phase 7)
│   │   ├── conflicts/              # ✅ Conflicts UI page (Phase 7)
│   │   ├── providers/              # ✅ Providers UI page (Phase 7)
│   │   ├── tokens/                 # ✅ Tokens UI pages (Phase 7)
│   │   └── page.tsx                # ✅ Home page with summary cards
│   ├── components/
│   │   ├── ui/                     # ✅ shadcn/ui components
│   │   └── chain-icon.tsx          # ✅ Client component for chain logos
│   ├── lib/
│   │   ├── api/                    # ✅ Effect-TS API service layer
│   │   │   ├── admin.ts            # AdminApiService (trigger fetch)
│   │   │   ├── chains.ts           # ChainApiService (with metadata)
│   │   │   ├── providers.ts        # ProviderApiService (health)
│   │   │   ├── tokens.ts           # TokenApiService (list + detail)
│   │   │   └── index.ts            # ApiServicesLive layer
│   │   ├── chains/                 # ✅ Chain metadata services
│   │   │   ├── registry.ts         # ChainRegistry (Chainlist API)
│   │   │   ├── enrichment.ts       # Chain enrichment logic
│   │   │   └── canonical-metadata.ts # ✅ Canonical metadata (non-EVM chains)
│   │   ├── db/
│   │   │   ├── schema.ts           # 4 tables with enhanced chain metadata
│   │   │   └── layer.ts            # SqlLive, DrizzleLive, DatabaseLive
│   │   ├── providers/
│   │   │   ├── types.ts            # ProviderError, DatabaseError
│   │   │   ├── http.ts             # Effect HttpClient wrapper
│   │   │   ├── factory.ts          # createProviderFetch utility
│   │   │   ├── storage.ts          # Batch inserts with deduplication
│   │   │   ├── relay.ts            # EVM filtering, nested tokens
│   │   │   ├── lifi.ts             # Chain inference, null byte sanitization
│   │   │   ├── across.ts           # Parallel endpoints, chain deduplication
│   │   │   └── index.ts            # AllProvidersLive layer
│   │   └── aggregation/
│   │       ├── normalize.ts        # Address normalization
│   │       ├── categorize.ts       # ✅ Token categorization (8 categories)
│   │       └── chain-mapping.ts    # ✅ Chain ID normalization (non-EVM chains)
│   └── jobs/
│       └── fetch-providers.ts      # CLI job runner (now superseded by API)
└── migrations/                     # Drizzle migration files
    ├── 0001_*                      # Initial schema
    ├── 0002_*                      # Provider fetches tracking
    ├── 0003_*                      # Chain metadata enhancement
    └── 0004_*                      # Token tags JSONB field
```

---

## Critical Files & Patterns

### 1. Layer Composition Pattern
**File**: `src/lib/providers/index.ts`

```typescript
// Base dependencies for all providers
const ProvidersBaseLive = Layer.mergeAll(
  DatabaseLive,
  NodeHttpClient.layerUndici
)

// Each provider gets dependencies via provideMerge
const RelayLive = RelayProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const LifiLive = LifiProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const AcrossLive = AcrossProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
// ... 9 more providers

// Final composed layer with all 12 providers
export const AllProvidersLive = Layer.mergeAll(
  RelayLive, LifiLive, AcrossLive, StargateLive, DebridgeLive,
  MayanLive, RhinoLive, GasZipLive, AoriLive, EcoLive, MesonLive, ButterLive
)
```

**Why**: This pattern ensures `HttpClient` and `PgDrizzle` requirements are satisfied at the layer level, not in the service interface.

### 2. Provider Service Pattern
**File**: `src/lib/providers/relay.ts` (example)

```typescript
// Service declares requirements in fetch Effect
export class RelayProvider extends Context.Tag("RelayProvider")<
  RelayProvider,
  {
    readonly fetch: Effect.Effect<
      ProviderResponse,
      ProviderError,
      HttpClient.HttpClient | Scope.Scope
    >
  }
>() {}

// Implementation uses Effect.gen with yield*
const make = Effect.gen(function* () {
  const drizzle = yield* Pg.PgDrizzle

  const fetch = Effect.gen(function* () {
    const rawResponse = yield* fetchJson(API_URL)
    // ... transformation logic
    return { chains, tokens }
  }).pipe(
    Effect.catchAll((error) =>
      new ProviderError({ provider: PROVIDER_NAME, message: "...", cause: error })
    )
  )

  return { fetch }
})

export const RelayProviderLive = Layer.effect(RelayProvider, make)
```

### 3. Database Schema (Bigint for Chain IDs)
**File**: `src/lib/db/schema.ts`

```typescript
export const chains = pgTable("chains", {
  chainId: bigint("chain_id", { mode: "number" }).primaryKey(),
  // ... other fields
})
```

**Why**: Some chains (e.g., Across) have chain IDs > 2 billion (34268394551451), which exceed PostgreSQL's integer max.

### 4. Job Runner Entry Point
**File**: `src/jobs/fetch-providers.ts`

```typescript
const program = Effect.gen(function* () {
  const relay = yield* RelayProvider
  const lifi = yield* LifiProvider
  const across = yield* AcrossProvider

  const results = yield* Effect.all([
    relay.fetch,
    lifi.fetch,
    across.fetch,
  ], { concurrency: "unbounded", mode: "either" })

  // ... process results
})

Effect.runPromise(
  program.pipe(Effect.provide(AllProvidersLive), Effect.scoped)
)
```

**Run**: `pnpm fetch:providers`

---

## Completed Phases

### ✅ Phase 1: Foundation Setup
- Git repository initialized with Effect/Cheffect submodules
- Docker PostgreSQL 16 on port 5433 (local postgres on 5432)
- Dependencies: Effect 3.x, Drizzle 0.38, Next.js 16

### ✅ Phase 2: Database Schema
- 4 tables: `provider_fetches`, `chains`, `chain_provider_support`, `tokens`
- Bigint chain IDs to support large numbers (34T+)
- JSONB `raw_data` field in tokens for debugging
- Migrations applied via `drizzle-kit` and docker exec

### ✅ Phase 3: Effect-TS Infrastructure
- `DatabaseLive` layer with SQL + Drizzle
- `HttpClient` wrapper with retry logic
- Tagged errors: `ProviderError`, `DatabaseError`
- Address normalization utilities

### ✅ Phase 4: Provider Implementations (Initial 3 Providers)
- **Relay**: EVM filtering, nested `solverCurrencies`, handles missing `nativeCurrency`
- **LiFi**: Chain inference from tokens, null byte sanitization (`\0` removal)
- **Across**: Parallel endpoint fetching (chains + tokens)
- All use 500-record batch inserts to prevent stack overflow

### ✅ Phase 9: Additional 9 Providers
- **Stargate**: chainKey to chainId mapping, EVM filtering
- **DeBridge**: Per-chain token fetching, excludes non-EVM chains [7565164, 100000026, 100000027, 100000029]
- **Mayan**: Wormhole chain ID to EVM mapping, filters non-EVM chains
- **Rhino.fi**: Nested token structure with symbol from object keys
- **GasZip**: Native tokens only, mainnet filtering
- **Aori**: Minimal metadata, decimals not provided (now null)
- **Eco**: Static data provider with hardcoded addresses
- **Meson**: Hex and decimal chain ID parsing, decimals not provided (now null)
- **Butter**: Paginated API with concurrency control
- All providers use `categorizeToken()` for automatic tag assignment
- Optional decimals field: `undefined` when provider doesn't supply the data

### ✅ Phase 5: Job Runner
- CLI script: `pnpm fetch:providers`
- Parallel execution with `Effect.all` (concurrency: "unbounded")
- Error handling with fallback logging to database
- **Current Results** (All 12 Providers):
  - DeBridge: 24 chains, 16,712 tokens ✅ (fixed schema issue)
  - LiFi: 58 chains, 12,692 tokens
  - Stargate: 96 chains, 2,157 tokens
  - Across: 23 chains, 1,333 tokens
  - Mayan: 7 chains, 468 tokens
  - Butter: 14 chains, 200 tokens
  - Relay: 80 chains, 166 tokens
  - GasZip: 161 chains, 161 tokens
  - Meson: 72 chains, 138 tokens
  - Aori: 8 chains, 92 tokens
  - Rhino.fi: 31 chains, 78 tokens
  - Eco: 10 chains, 24 tokens
  - **Total**: 34,221 tokens across 216 chains (fetch time: ~3.2s)

### ✅ Phase 6: API Endpoints
- **Effect-TS Service Layer**: All APIs use Effect Context.Tag pattern for dependency injection
- **6 Core Endpoints**:
  1. `GET /api/tokens` - List tokens with aggregation (provider count, chain count)
  2. `GET /api/tokens/:symbol` - Token details showing all instances across chains/providers
  3. `GET /api/chains` - List chains with metadata, provider support, token counts
  4. `GET /api/conflicts` - Detect tokens with conflicting data (addresses, decimals, names)
  5. `GET /api/providers` - Provider health status from fetch history
  6. `GET /api/providers/:provider` - Provider detail page showing all tokens with chain pills
  7. `POST /api/admin/fetch` - Trigger fetch job (requires `x-admin-secret` header)
- **Error Handling**: Tagged errors with proper HTTP status codes (404, 500)
- **Scoped Effects**: All routes use `Effect.scoped` for proper resource cleanup

### ✅ Phase 7: UI & Chain Metadata Enrichment
- **shadcn/ui Integration**: Card, Table, Badge components with lucide-react icons
- **5 UI Pages**:
  1. **Home** (`/`) - Summary cards with key metrics
  2. **Chains** (`/chains`) - Table with logos, types (mainnet/testnet), explorer links
  3. **Tokens** (`/tokens`) - Paginated list, detail pages showing conflicts
  4. **Providers** (`/providers`) - Compact table view with health status, success rates, fetch history
  5. **Provider Detail** (`/providers/:provider`) - Token table with tag pills and clickable chain badges
  6. **Conflicts** (`/conflicts`) - Token conflicts detection UI
- **Provider UI Improvements**:
  - Replaced large cards with compact single table view
  - Added status icons (CheckCircle2/XCircle) for health status
  - Color-coded success rate badges (green 100%, yellow 80%+, red <80%)
  - Clickable "View" links to provider detail pages
  - Provider detail pages show all tokens grouped by symbol
  - Chain availability shown as clickable badges linking to chain details
  - Tag pills with color coding (8 categories)
  - Null decimals displayed as "—" for data transparency
- **Chain Metadata Enrichment**:
  - **ChainRegistry Service**: Fetches from Chainlist API (chainid.network)
  - **10 New Chain Fields**: `short_name`, `chain_type`, `icon`, `info_url`, `explorers`, `rpc`, `faucets`, `ens`, `features`, `updated_at`
  - **Automatic Enrichment**: Runs after each provider fetch, enriches existing chains
  - **Chain Icons**: Client component with error handling for missing logos
  - **Explorer Links**: Clickable links to block explorers from enriched data

---

## Key Issues Resolved

### 1. HttpClient Layer Not Found
**Problem**: `Service not found: @effect/platform/HttpClient`

**Solution**: Use `Layer.provideMerge` instead of `Layer.provide` for nested dependencies. Pattern from `repos/effect/packages/sql-drizzle/test/utils.ts`.

### 2. Chain ID Out of Range
**Problem**: `value "34268394551451" is out of range for type integer`

**Solution**: Changed `chain_id` from `integer` to `bigint("chain_id", { mode: "number" })` in schema.

### 3. LiFi Stack Overflow
**Problem**: Inserting 12,597 tokens caused `RangeError: Maximum call stack size exceeded`

**Solution**: Batch inserts in groups of 500 records.

### 4. PostgreSQL Invalid Byte Sequence
**Problem**: `invalid byte sequence for encoding "UTF8": 0x00`

**Solution**: Sanitize LiFi token strings: `str?.replace(/\0/g, "")`

### 5. Relay Schema Validation Failures
**Problem**: API returns `id` as both string and number, some chains missing `nativeCurrency`

**Solution**:
- `id: Schema.Union(Schema.String, Schema.Number)`
- `nativeCurrency: Schema.optional(RelayNativeCurrencySchema)` with fallback

### 6. TypeScript Iteration Errors
**Problem**: `can only be iterated through when using '--downlevelIteration'`

**Solution**: Added to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "dom", "dom.iterable"],
    "downlevelIteration": true
  }
}
```

### 7. Effect Language Service Warnings
**Problem**: "Effect.fail is called with the global Error type"

**Solution**: Created tagged errors using `Data.TaggedError`:
- `ProviderError` for fetch failures
- `DatabaseError` for database operations

### 8. Across Provider Duplicate Token Error (Phase 7)
**Problem**: `ON CONFLICT DO UPDATE command cannot affect row a second time` - Across provider returning duplicate tokens in same batch

**Solution**: Added deduplication in `batchInsertTokens`:
```typescript
const uniqueTokens = Array.from(
  new Map(
    batch.map((token) => [`${token.chainId}-${token.address}`, token])
  ).values()
)
```

### 9. TypeScript Compilation Errors (Phase 7)
**Problem**: Multiple TS errors after adding chain enrichment:
- Missing `chainName` field in tokens schema (used in conflicts query)
- Layer.effect type mismatches - requirements leaking from services
- ChainRegistry Scope leaking into return type
- Error handling union type mismatches

**Solution**:
- Fixed conflicts route to join with `chains` table for chain names
- Updated Provider Tag definitions to include all requirements (HttpClient, Scope, PgDrizzle)
- Added `Effect.scoped` to ChainRegistry's `fetchAll` to consume Scope internally
- Fixed error handler return types with explicit `Effect.Effect<ErrorResponse, never>` annotations

### 10. Provider Query Errors (Phase 6)
**Problem**: Correlated subqueries failing with "column not part of query" errors

**Solution**: Changed to two-query approach:
1. Get aggregated stats with GROUP BY
2. Use raw SQL with `DISTINCT ON` for latest fetch per provider
3. Combine results in application code

### 11. Schema.Record API Issues (Phase 9)
**Problem**: `TypeError: Cannot read properties of undefined (reading 'ast')` on Schema.Record calls

**Solution**: Updated to explicit key/value syntax:
```typescript
// Before: Schema.Record(Schema.String, ValueSchema)
// After: Schema.Record({ key: Schema.String, value: ValueSchema })
```
Affected: debridge.ts, mayan.ts, rhino.ts

### 12. Rhino.fi networkId Type Mismatch (Phase 9)
**Problem**: networkId could be string or number in API response

**Solution**: Changed schema to `Schema.Union(Schema.Number, Schema.String)` and added parsing logic

### 13. Optional Fields in Provider APIs (Phase 9)
**Problem**: Multiple providers missing required fields (addr, decimals, symbol, name)

**Solution**: Made fields optional in schemas, filtered incomplete data, or set to undefined when not provided

### 14. Provider Detail API SQL Error (Phase 9)
**Problem**: SQL orderBy failing with `array_length` on JSONB field

**Solution**: Changed to `COALESCE(jsonb_array_length(${tokens.tags}), 0)` for PostgreSQL JSONB arrays

### 15. Incorrect Decimals Data Quality (Phase 9)
**Problem**: Aori and Meson showing 18 decimals for USDC instead of 6 (APIs don't provide decimals)

**Solution**: Made decimals optional in schema and Token interface:
- Changed from `.notNull()` to optional field
- Set to `undefined` when provider doesn't supply data
- UI displays "—" for null decimals
- Maintains data integrity by not guessing missing values

### 16. Solana Chain ID Fragmentation (2026-01-19)
**Problem**: Multiple providers using different chain IDs for Solana mainnet causing data fragmentation:
- GasZip: 501474
- Relay: 792703809
- Across: 34268394551451
- Butter: 1360108768460801

**Solution**: Created chain ID normalization system:
- `src/lib/aggregation/chain-mapping.ts` - Maps provider-specific IDs to canonical IDs
- `src/lib/chains/canonical-metadata.ts` - Provides authoritative metadata for non-EVM chains
- Integrated into `factory.ts` provider pipeline for automatic normalization
- All Solana chains now consolidated to Across's ID (34268394551451)
- Result: Single Solana chain with 38 tokens from 3 providers

### 17. DeBridge Provider Returning 0 Tokens (2026-01-19)
**Problem**: DeBridge provider successfully fetching but returning 0 tokens due to schema mismatch

**Root Cause**: API returns `{ tokens: { "0xAddress": {...} } }` but schema expected tokens object directly

**Solution**: Updated DeBridge schema in `src/lib/providers/debridge.ts`:
```typescript
// Wrapped schema with tokens field
const DebridgeTokensResponseSchema = Schema.Struct({
  tokens: Schema.Record({
    key: Schema.String,
    value: DebridgeTokenSchema
  })
})

// Updated token extraction to access tokens field
return Object.values(tokensResponse.tokens)
```
- Result: Now fetching 16,712 tokens (largest provider by token count)

### 18. Admin API Only Fetching 3 of 12 Providers (2026-01-19)
**Problem**: Admin API endpoint only fetching Relay, LiFi, and Across despite having 12 providers implemented

**Solution**: Updated `src/lib/api/admin.ts` to include all providers:
- Added imports for all 9 missing providers (Stargate, DeBridge, Mayan, Rhino, GasZip, Aori, Eco, Meson, Butter)
- Added yield statements to get all provider services
- Updated parallel fetch execution to include all 12 providers
- Result: All providers now fetching in parallel, total tokens increased from 17,497 to 34,221

---

## Environment Setup

### 1. Prerequisites
```bash
node >= 18
pnpm >= 8
docker & docker-compose
```

### 2. Initial Setup
```bash
# Clone and install
git clone <repo>
cd interop-token-aggregator
pnpm install

# Initialize submodules
git submodule update --init --recursive

# Start database
docker-compose up -d

# Apply migrations
pnpm db:push

# Run fetch job
pnpm fetch:providers
```

### 3. Environment Variables
**File**: `.env.local`
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DATABASE=tokendb
POSTGRES_USER=dev
POSTGRES_PASSWORD=dev
ADMIN_SECRET=change-this-in-production
```

### 4. Useful Commands
```bash
# Development
pnpm dev                          # Start Next.js dev server (http://localhost:3000)
pnpm build                        # Build for production
pnpm start                        # Start production server

# Database
pnpm db:studio                    # Open Drizzle Studio (database GUI)
pnpm db:generate                  # Generate new migration
pnpm db:push                      # Apply migrations
docker-compose up -d              # Start PostgreSQL
docker-compose down               # Stop PostgreSQL

# Data Management
./scripts/reset-and-fetch.sh      # Clean DB and trigger fresh fetch
pnpm fetch:providers              # Run CLI job runner (legacy, use API instead)

# Code Quality
npx tsc --noEmit                  # Type check (should be 0 errors)
pnpm lint                         # Run ESLint

# API Testing
curl http://localhost:3000/api/tokens
curl http://localhost:3000/api/chains
curl http://localhost:3000/api/providers
curl http://localhost:3000/api/conflicts
curl -X POST http://localhost:3000/api/admin/fetch \
  -H "x-admin-secret: dev-secret-token"
```

---

## Next Steps: Phase 8 - Conflict Resolution & Optimization

### 1. Materialized Views (Performance)
Create materialized views for expensive aggregations that are computed frequently:

```sql
-- Token aggregation view
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

-- Refresh strategy: After each provider fetch
REFRESH MATERIALIZED VIEW mv_token_summary;
```

### 2. Conflict Resolution Strategy
Currently conflicts are detected but not resolved. Implement resolution logic:

**Symbol Variants** (Not Actually Conflicts):
- WETH vs wETH vs Weth (case variants)
- USDC.e vs USDC (bridged variants)
- Decision: Normalize symbols, track variants

**True Errors** (Need Resolution):
- Same symbol, same chain, different addresses
- Same symbol, same chain, different decimals
- Decision: Priority system (trust certain providers more)

**Implementation**:
```typescript
// src/lib/aggregation/resolution.ts
export const resolveConflicts = (tokens: TokenInstance[]) => {
  // 1. Normalize symbols (uppercase, remove special chars)
  // 2. Group by normalized symbol + chain
  // 3. If addresses differ, apply priority rules
  // 4. Store resolution in new table: token_resolutions
}
```

### 3. Staleness Detection & Cleanup
Remove tokens that haven't been seen in recent fetches:

```sql
-- Mark stale tokens (not seen in last 7 days)
UPDATE tokens
SET is_stale = true
WHERE updated_at < NOW() - INTERVAL '7 days';

-- Or hard delete
DELETE FROM tokens
WHERE updated_at < NOW() - INTERVAL '7 days';
```

### 4. Additional Providers
Add remaining 9 providers from SPEC.md:
- Squid Router
- Socket
- Hop Protocol
- Stargate
- Synapse Protocol
- Connext
- Celer cBridge
- Multichain
- Axelar

Each provider follows the same pattern:
1. Create `src/lib/providers/{name}.ts`
2. Implement fetch logic with schema validation
3. Add to `AllProvidersLive` layer
4. Test with `./scripts/reset-and-fetch.sh`

### 5. Scheduled Jobs (Vercel Cron)
Set up automatic fetches:

```typescript
// src/app/api/cron/fetch/route.ts
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Trigger fetch
  // ...
}
```

**vercel.json**:
```json
{
  "crons": [{
    "path": "/api/cron/fetch",
    "schedule": "0 */6 * * *"
  }]
}
```

---

## Database Verification Queries

### Check Token Counts
```sql
SELECT provider_name, COUNT(*) as token_count
FROM tokens
GROUP BY provider_name
ORDER BY provider_name;
```

### Multi-Provider Chains
```sql
SELECT chain_id, COUNT(DISTINCT provider_name) as provider_count
FROM chain_provider_support
GROUP BY chain_id
HAVING COUNT(DISTINCT provider_name) > 1
ORDER BY provider_count DESC, chain_id
LIMIT 10;
```

### Recent Fetch Status
```sql
SELECT provider_name, fetched_at, success, chains_count, tokens_count, error_message
FROM provider_fetches
ORDER BY fetched_at DESC
LIMIT 10;
```

---

## Reference Documentation

### Effect-TS Patterns
- **Layer Composition**: `repos/effect/packages/sql-drizzle/test/utils.ts`
- **Context.Tag Services**: `repos/effect/packages/sql-drizzle/src/Pg.ts`
- **Effect.gen Usage**: `repos/effect/packages/effect/src/Effect.ts`

### Cheffect Examples
- **Practical Effect Usage**: `repos/cheffect/src/`
- **Router Patterns**: `repos/cheffect/src/Router.ts`

### Project Documentation
- **Full Spec**: `SPEC.md` (1594 lines, comprehensive requirements)
- **Plan**: `.claude/plans/frolicking-wishing-tide.md` (implementation plan)
- **This Handover**: `HANDOVER.md`

---

## Known Limitations (Remaining Work)

1. **No Materialized Views**: Using basic SQL queries, not optimized with materialized views
2. **Conflict Detection Only**: Conflicts are detected but not automatically resolved
3. **No Staleness Deletion**: Old tokens not yet pruned (need updated_at tracking)
4. **No Scheduled Jobs**: Manual trigger only via API, no Vercel Cron
5. **No Provider Priority System**: All providers treated equally for conflict resolution
6. **Limited Non-EVM Chain Support**: Only Solana consolidated; other non-EVM chains (Starknet, Bitcoin, etc.) need mapping

---

## Success Metrics

✅ **Architecture Validated**
- Effect-TS layer composition working correctly
- Tagged errors provide type safety
- Batch inserts handle large datasets
- All TypeScript compilation clean (0 errors, 0 warnings)

✅ **Data Quality**
- All 12 providers operational (Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter)
- 34,221 tokens stored with raw JSONB and categorization tags
- 216 unique chains with metadata enrichment from Chainlist
- Database constraints enforced (foreign keys, indexes, unique constraints)
- Deduplication prevents duplicate insertion errors
- Optional decimals field maintains data integrity (null when not provided)
- Non-EVM chains (Solana) consolidated via chain ID normalization

✅ **Performance**
- Parallel provider execution (~1.1s total fetch time for all 12 providers)
- Batch inserts with deduplication handle large datasets
- PostgreSQL bigint supports large chain IDs (up to 34 trillion)
- Effect.scoped ensures proper resource cleanup

✅ **User Experience**
- Full REST API with Effect-TS service layer
- Modern, compact UI with shadcn/ui components and lucide-react icons
- Chain logos, explorer links, chain type badges
- Provider pages with compact table view and detailed token/chain information
- Tag pills for token categorization (8 categories)
- Clickable chain badges on provider detail pages
- Null decimals displayed transparently as "—"
- Conflict detection for data quality monitoring
- Provider health dashboard with color-coded success rates

---

## Important Notes for Next Session

1. **Don't Break Effect Patterns**: The layer composition with `Layer.provideMerge` is critical. Changing it will break HttpClient resolution.

2. **Database Port**: PostgreSQL is on **5433**, not 5432 (local postgres conflict).

3. **Batch Inserts with Deduplication**: All providers need batching (500 per batch) AND deduplication within batches to prevent "ON CONFLICT DO UPDATE" errors.

4. **Null Byte Sanitization**: LiFi data contains `\0` bytes - must sanitize before inserting.

5. **Chain ID Type**: Must use `bigint` mode "number" - some IDs exceed 2 billion.

6. **Tagged Errors**: Always use `ProviderError`, `DatabaseError`, or other `Data.TaggedError` types, not global `Error`.

7. **Effect.scoped for HttpClient**: When using HttpClient in services, wrap effects with `Effect.scoped` to prevent Scope from leaking into return types.

8. **Provider Tag Requirements**: Provider Tags must declare ALL requirements (HttpClient, Scope, PgDrizzle) that their effects need, even if provided by layer.

9. **Chain Enrichment**: Runs automatically after each provider fetch. ChainRegistry caches data with 30s timeout and 2 retries.

10. **Reset Script**: Use `./scripts/reset-and-fetch.sh` to clean database and trigger fresh fetch via API (not CLI job).

11. **Submodules**: Effect and Cheffect repos are for reference only - don't modify them.

12. **TypeScript Config**: `downlevelIteration: true` and `target: ES2022` are required for Effect.

---

## Quick Start for New Session

```bash
# Verify environment
docker ps | grep token-aggregator-db   # Should show running postgres
pnpm dev                              # Start Next.js dev server

# Test the application
open http://localhost:3000             # View UI (home, chains, tokens, providers, conflicts)
curl http://localhost:3000/api/tokens  # Test API

# Clean database and refetch
./scripts/reset-and-fetch.sh          # Clean + fetch via API
# Or manually:
curl -X POST http://localhost:3000/api/admin/fetch \
  -H "x-admin-secret: dev-secret-token"

# Check database
pnpm db:studio                        # Open Drizzle Studio
# or
docker exec -it token-aggregator-db psql -U dev -d tokendb

# Type check
npx tsc --noEmit                      # Should show 0 errors
```

---

## Contact Points

- **Plan File**: `.claude/plans/frolicking-wishing-tide.md`
- **Spec File**: `SPEC.md` (source of truth for requirements)
- **Effect Reference**: `repos/effect/` (official Effect repo)
- **Cheffect Reference**: `repos/cheffect/` (practical examples)

---

**End of Handover Note**

Last Updated: 2026-01-20 (Documentation review completed)
Phase Status: 9/10 Complete - All 12 Providers Operational + UI Enhancements
Next Action: Begin Phase 10 - Conflict Resolution & Optimization (Materialized Views)

## Session Summary (2026-01-19 - Initial)

This session completed Phases 6 and 7:

**Phase 6 - API Endpoints**:
- Created Effect-TS service layer for all APIs
- Implemented 6 REST endpoints (tokens, chains, providers, conflicts, admin/fetch)
- Fixed multiple TypeScript compilation errors
- All routes use Effect.scoped for proper resource management

**Phase 7 - UI & Chain Enrichment**:
- Integrated shadcn/ui components (Card, Table, Badge)
- Built 5 UI pages (home, chains, tokens, providers, conflicts)
- Added ChainRegistry service fetching from Chainlist API
- Enhanced database schema with 10 new chain metadata fields
- Implemented automatic chain enrichment after each fetch
- Created chain icon component with error handling
- Added explorer links and chain type badges
- Fixed Across provider duplicate token errors with deduplication

**Key Achievements**:
- All 3 providers working (Relay, LiFi, Across)
- 14,173 tokens across 89 chains
- 84/89 chains enriched with metadata
- Full-stack application operational with modern UI
- TypeScript compilation: 0 errors
- Database reset script for easy testing

## Session Summary (2026-01-19 - Continued)

This session enhanced the token categorization system and improved UX:

**Token Categorization System**:
- Created comprehensive categorization logic in `src/lib/aggregation/categorize.ts`
- Added `tags` JSONB field to tokens table (migration 0004_material_blur.sql)
- Implemented 8 token categories: wrapped, stablecoin, liquidity-pool, governance, bridged, yield-bearing, rebasing, native
- Pattern-based detection using regex for symbol and name matching
- Removed EVM filtering from Relay provider (increased chains from 73 to 80)
- Removed derivative tag due to false positives
- Tagged 3,775 tokens (26.6% of dataset) with categorization

**Tag Distribution** (14,185 tokens across 95 chains):
- Wrapped: 628 tokens
- Stablecoin: 520 tokens
- Rebasing: 478 tokens
- Liquidity Pool: 327 tokens
- Yield-Bearing: 239 tokens
- Governance: 156 tokens
- Native: 132 tokens
- Bridged: 117 tokens

**UI Enhancements**:
- Added tags display to tokens list page with filter dropdown
- Added tags display to individual token detail pages
- Implemented server-side search and tag filtering
- Added pagination with URL state management (shareable/bookmarkable URLs)
- Fixed case-sensitivity issue for token symbol lookup
- Active filter badges with clear functionality

**API Improvements**:
- Extended `TokenListQuery` with `tag` parameter
- Implemented server-side tag filtering using JSONB queries
- Made symbol search case-insensitive (ILIKE)
- Fixed token detail lookup to be case-insensitive
- Total count query now respects both symbol and tag filters

**Effect-TS Code Quality**:
- Fixed all Effect language service warnings
- Changed `Effect.catchAll + Effect.fail` to `Effect.mapError` pattern
- Fixed yieldable error handling (direct yield instead of `Effect.fail`)
- Updated 7 files: tokens.ts, chains.ts, providers.ts, admin.ts, registry.ts, factory.ts
- Zero TypeScript errors or warnings

**Key Technical Improvements**:
1. **JSONB Storage**: Fixed double-encoding issue with proper `::jsonb` casting
2. **SQL Correlation**: Fixed GROUP BY subquery correlation for tags aggregation
3. **URL State Management**: Filters and pagination now in URL for shareability
4. **Case-Insensitive Lookups**: All token symbol queries now case-insensitive
5. **Server-Side Filtering**: Search and tags filter across all tokens, not just current page

**Data Quality**:
- Database reset script working correctly
- Tags automatically applied during provider fetch
- All 3 providers updated with categorization logic
- Consistent tagging across all providers

## Session Summary (2026-01-19 - Phase 9 Complete)

This session completed Phase 9, implementing all 9 additional providers and improving the UI:

**Phase 9 - All 12 Providers**:
- Implemented 9 new providers: Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter
- Each provider follows unique patterns (chainKey mapping, wormhole IDs, hex parsing, static data, etc.)
- Fixed multiple schema validation issues (Schema.Record API, optional fields, type unions)
- Made decimals field optional for data quality (null when provider doesn't supply data)
- All providers use `categorizeToken()` for automatic tag assignment
- Total: 17,497 tokens across 219 chains from 12 providers in ~1.1s

**Provider UI Enhancements**:
- Redesigned provider list page with compact single table view
- Added status icons (CheckCircle2/XCircle) and color-coded success rate badges
- Created provider detail pages showing all tokens with tag pills
- Implemented clickable chain badges linking to chain details
- Added API endpoint `GET /api/providers/:provider` with JSONB tags parsing
- Fixed SQL orderBy for JSONB arrays with `jsonb_array_length()`
- Installed lucide-react for icon components

**Data Quality Improvements**:
- Made decimals optional in schema (`src/lib/db/schema.ts`)
- Updated Token interface with `decimals?: number`
- Updated Aori and Meson providers to use `decimals: undefined` instead of defaulting to 18
- UI displays "—" for null decimals maintaining transparency
- Generated and applied migration for schema change
- Re-fetched all providers with updated schema

**Key Issues Resolved**:
1. Schema.Record API syntax updated to `{ key, value }` format
2. Rhino.fi networkId handled as union type (number | string)
3. Meson addr field made optional (some tokens missing)
4. DeBridge tokens filtered for missing symbol/name/decimals
5. Provider detail API SQL fixed for JSONB array operations
6. Decimals made optional instead of defaulting to incorrect values

**Current Status**:
- All 12 providers operational
- 17,497 tokens across 219 chains
- 21.55% of tokens have categorization tags
- TypeScript: 0 errors, 0 warnings
- Full-stack application with modern, compact UI
- Data quality maintained through optional fields instead of defaults

## Session Summary (2026-01-19 - Pagination & UI Refinements)

This session improved pagination across all pages and refined the UI with consistent expandable table patterns:

**Provider Page Pagination**:
- Added pagination support to provider detail pages (50 tokens per page)
- Updated `GET /api/providers/:provider` to support limit, offset, symbol search
- Used PostgreSQL MODE() for canonical name selection across chains
- Used json_agg() to embed chain details in single query (1 query instead of 51)
- Created `src/app/providers/[provider]/token-list.tsx` as client component
- Implemented URL-based state management for pagination and search
- Added expandable rows showing chain-specific details (Chain, Name, Address, Decimals)

**Chain Page Improvements**:
- Updated chain token list to use compact nested table format
- Changed from card-based expansion to table-in-table structure
- Added 5 columns in expanded view: Address, Name, Decimals, Providers, Status
- Applied subtle styling with `border-muted/30` and `hover:bg-transparent`
- Moved Canonical and Conflict badges to dedicated Status column
- Improved visual hierarchy with reduced border opacity

**Support Matrix Enhancement**:
- Updated `src/components/support-matrix.tsx` to sort chains by provider count
- Added `chainProviderCounts` Map to track provider support counts
- Sorted chains descending by number of supporting providers
- Added inline provider count display next to each chain name
- Makes the most widely supported chains immediately visible

**Code Cleanup**:
- Removed `/src/app/conflicts/` page and directory
- Removed `/src/app/api/conflicts/` endpoint
- Updated homepage to remove conflicts card
- Conflict information remains available in other views (token detail pages)

**Key Technical Improvements**:
1. **Single-Query Optimization**: Reduced N+1 query problems using SQL aggregation with json_agg()
2. **Compact Table Pattern**: Consistent expandable nested tables across provider and chain pages
3. **Visual Polish**: Subtle borders (opacity `/30`) and disabled hover states for clean UI
4. **Sorting UX**: Support matrix now shows chains ordered by relevance (provider count)
5. **URL State Management**: All filters and pagination parameters in URL for shareability

**Files Modified**:
- `src/app/api/providers/[provider]/route.ts` - Added pagination and aggregation
- `src/app/providers/[provider]/token-list.tsx` - New paginated client component
- `src/app/providers/[provider]/page.tsx` - Simplified to use token list component
- `src/app/chains/[chainId]/token-list.tsx` - Updated to compact table format
- `src/components/support-matrix.tsx` - Added sorting by provider count
- `src/app/page.tsx` - Removed conflicts card

**Current Status**:
- All pages now have consistent pagination (50 items per page)
- Expandable rows use compact nested table pattern throughout
- Support matrix prioritizes most relevant chains
- TypeScript: 0 errors, 0 warnings
- UI is cleaner and more space-efficient

## Session Summary (2026-01-19 - Solana Consolidation & DeBridge Fix)

This session implemented chain ID normalization for non-EVM chains and fixed DeBridge provider:

**Chain ID Normalization System**:
- Created `src/lib/aggregation/chain-mapping.ts` for non-EVM chain ID mapping
- Created `src/lib/chains/canonical-metadata.ts` for authoritative chain metadata
- Integrated normalization into `src/lib/providers/factory.ts` (automatic for all providers)
- Updated `src/lib/providers/storage.ts` to use canonical metadata when available
- Maps provider-specific Solana chain IDs to single canonical ID (Across's 34268394551451)
  - GasZip (501474) → 34268394551451
  - Relay (792703809) → 34268394551451
  - Butter (1360108768460801) → 34268394551451
  - Across (34268394551451) remains canonical

**Solana Consolidation Results**:
- Single unified Solana chain (ID: 34268394551451)
- Proper metadata: name "Solana", short_name "sol", chain_type "mainnet"
- 3 providers contributing: Across, GasZip, Relay
- 38 tokens consolidated under single chain
- Includes proper icon, explorers (Solscan, Solana Explorer), RPC endpoints

**DeBridge Provider Fixed**:
- **Issue**: DeBridge returning 0 tokens due to incorrect schema
- **Root Cause**: API returns `{ tokens: {...} }` but schema expected tokens object directly
- **Solution**: Wrapped schema with `tokens` field and updated code to access `tokensResponse.tokens`
- **Result**: Now fetching 16,712 tokens (was 0) - largest provider by token count
- Updated `src/lib/providers/debridge.ts` schema and token extraction logic

**Admin API Enhancement**:
- Updated `src/lib/api/admin.ts` to fetch all 12 providers (was only fetching 3)
- Added imports and yield statements for all 9 missing providers
- All providers now included in parallel fetch execution

**Final Data Statistics**:
- **Total Tokens**: 34,221 (up from 17,497)
- **Total Chains**: 217
- **Total Providers**: 12 (all operational)
- **Fetch Time**: ~3.2s for all providers

**Token Distribution by Provider**:
1. DeBridge: 16,712 tokens ✅ (fixed)
2. LiFi: 12,692 tokens
3. Stargate: 2,157 tokens
4. Across: 1,333 tokens
5. Mayan: 468 tokens
6. Butter: 200 tokens
7. Relay: 166 tokens
8. GasZip: 161 tokens
9. Meson: 138 tokens
10. Aori: 92 tokens
11. Rhino: 78 tokens
12. Eco: 24 tokens

**New Files Created**:
- `src/lib/aggregation/chain-mapping.ts` - Chain ID normalization mapping
- `src/lib/chains/canonical-metadata.ts` - Canonical chain metadata for non-EVM chains
- `scripts/consolidate-solana.sql` - SQL migration script (not used, kept for reference)

**Key Technical Improvements**:
1. **Extensible Normalization**: System ready for other non-EVM chains (Starknet, Bitcoin, etc.)
2. **Automatic Chain Mapping**: All providers automatically normalize chain IDs via factory
3. **Canonical Metadata Priority**: Authoritative metadata overrides provider data
4. **Debug Logging**: Console logs show when chain normalization occurs
5. **Type Safety**: Full TypeScript support with proper typing for all new functions

**Architecture Benefits**:
- Non-EVM chains now properly consolidated across providers
- Canonical metadata ensures consistency (names, icons, explorers)
- No duplicate chains for the same blockchain
- Extensible pattern for future chain consolidations
- Zero breaking changes to existing provider code

**Files Modified**:
- `src/lib/aggregation/chain-mapping.ts` - Created (normalization logic)
- `src/lib/chains/canonical-metadata.ts` - Created (canonical metadata)
- `src/lib/providers/factory.ts` - Added chain ID normalization step
- `src/lib/providers/storage.ts` - Added canonical metadata support
- `src/lib/providers/debridge.ts` - Fixed schema and token extraction
- `src/lib/api/admin.ts` - Added all 12 providers to fetch execution

**Current Status**:
- All 12 providers operational and fetching successfully
- Solana properly consolidated across 3 providers
- 34,221 tokens across 217 chains (including Eclipse, Soon SVM chains)
- TypeScript: 0 errors, 0 warnings
- System ready for additional non-EVM chain consolidations

### 19. Solana Address Capitalization (2026-01-19)
**Problem**: Solana addresses are case-sensitive (base58 encoding) but were being normalized to lowercase like EVM addresses

**Root Cause**: `normalizeAddress()` function in `src/lib/aggregation/normalize.ts` was applying EVM-style lowercase normalization to all addresses, regardless of chain type

**Solution**: Made address normalization chain-aware:
- Updated `normalizeAddress(address, isEvm)` to accept boolean parameter
- EVM chains: lowercase normalization (checksummed hex addresses are case-insensitive)
- Non-EVM chains: preserve original case (Solana base58 addresses are case-sensitive)
- Created `isEvmChain(chainId)` helper in `src/lib/aggregation/chain-mapping.ts`
- Updated all 12 providers to determine chain type before normalizing addresses
- Deleted existing Solana tokens and re-fetched with correct capitalization

**Example**:
- Before: `2zmmhcvqexdtde6vsfs7s7d5ouodfjhe8vd1gnbouauv` (PENGU - invalid)
- After: `2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv` (PENGU - valid)

**Files Modified**:
- `src/lib/aggregation/normalize.ts` - Added `isEvm` parameter to normalization functions
- `src/lib/aggregation/chain-mapping.ts` - Added `isEvmChain()` helper function
- All 12 provider files - Updated to pass `isEvm` parameter when calling `normalizeAddress()`

### 20. VM Type Storage in Database (2026-01-19)
**Improvement**: Added `vm_type` field to chains table to store provider-supplied VM type information

**Motivation**: Instead of maintaining a manual mapping of chain IDs to determine if a chain is EVM or not, we should use the authoritative data from providers (Relay's `vmType`, Stargate's `chainType`)

**Implementation**:
- Added `vm_type` text field to chains table (migration 0006)
- Updated Chain interface to include optional `vmType` field
- Relay provider: stores `vmType` from API (`"evm"`, `"svm"`, `"bvm"`, `"lvm"`)
- Stargate provider: stores `chainType` as `vmType` (`"evm"`)
- Canonical metadata: includes `vmType: "svm"` for Solana
- Storage layer: saves `vm_type` to database when available

**Current Data** (217 chains):
- 184 chains: vm_type = null (providers don't specify, assumed EVM)
- 28 chains: vm_type = "evm" (Relay + Stargate)
- 3 chains: vm_type = "svm" (Solana, Eclipse, Soon)
- 1 chain: vm_type = "bvm" (Bitcoin)
- 1 chain: vm_type = "lvm" (LayerZero VM)

**Benefits**:
- Uses authoritative provider data instead of manual mapping
- Extensible to new VM types (Starknet, Cosmos, etc.)
- `isEvmChain()` now checks canonical metadata, defaults to true for unknown chains
- Future: Can query database for vm_type in API routes for more accurate detection

**Files Modified**:
- `src/lib/db/schema.ts` - Added `vmType` field to chains table
- `src/lib/providers/types.ts` - Added `vmType?` to Chain interface
- `src/lib/providers/relay.ts` - Store `vmType` from API
- `src/lib/providers/stargate.ts` - Store `chainType` as `vmType`
- `src/lib/providers/storage.ts` - Save `vmType` to database
- `src/lib/chains/canonical-metadata.ts` - Added `vmType: "svm"` for Solana
- `src/lib/aggregation/chain-mapping.ts` - Updated `isEvmChain()` to use canonical metadata

### 21. Frontend & Backend Address Lowercasing Bug (2026-01-19)
**Problem**: Both backend SQL and frontend JavaScript were lowercasing Solana addresses, breaking block explorer links and data integrity

**Root Cause - Multiple Locations**:
1. **Backend API** (`src/app/api/chains/[chainId]/tokens/route.ts:51`): SQL using `LOWER(${tokens.address})` for canonical address calculation
2. **Frontend Components**: JavaScript using `.toLowerCase()` for address grouping and conflict detection
   - Chain token list: line 269 (address grouping)
   - Token detail page: lines 200, 259, 266 (conflict detection)
   - Support matrix: lines 35, 62 (address comparison)

**Impact**:
- API returning lowercased `canonicalAddress` for Solana tokens (e.g., `2zmmhcvqexdtde6vsfs7s7d5ouodfjhe8vd1gnbouauv`)
- Block explorer links broken for Solana (case-sensitive base58 addresses)
- Frontend grouping addresses incorrectly by lowercase version

**Solution - Full Stack Fix**:
1. **Backend**: Removed `LOWER()` from SQL canonical address calculation
   - Changed from `MODE() WITHIN GROUP (ORDER BY LOWER(${tokens.address}))`
   - To: `MODE() WITHIN GROUP (ORDER BY ${tokens.address})`
   - Preserves original case in API responses

2. **Frontend**: Removed all `.toLowerCase()` calls for address comparison
   - Addresses now compared with original case preserved
   - EVM addresses with different cases shown as separate (conservative approach)

**Trade-off**: EVM addresses like `0xABC...` and `0xabc...` now treated as different (over-reporting conflicts), but this is safer than under-reporting or breaking non-EVM chains. Future improvement: pass `vm_type` to frontend for chain-aware comparison.

**Verification**:
```bash
# Before fix
curl .../api/chains/34268394551451/tokens | jq '.tokens[1]'
# canonicalAddress: "2zmmhcvqexdtde6vsfs7s7d5ouodfjhe8vd1gnbouauv" ❌

# After fix
curl .../api/chains/34268394551451/tokens | jq '.tokens[1]'
# canonicalAddress: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" ✓
```

**Files Fixed**:
- `src/app/api/chains/[chainId]/tokens/route.ts` - Removed `LOWER()` from SQL canonical address query
- `src/app/chains/[chainId]/token-list.tsx` - Removed lowercase in address grouping
- `src/app/tokens/[symbol]/page.tsx` - Removed lowercase in conflict detection (2 locations)
- `src/components/support-matrix.tsx` - Removed lowercase in address comparison (2 locations)

---

## Session Summary (2026-01-19 - Non-EVM Chain Support & Address Capitalization)

This session implemented comprehensive support for non-EVM chains with case-sensitive addresses:

### Phase 1: Initial Address Normalization Fix

**Problem Identified**: Solana block explorer links broken due to case-insensitive address normalization
- Solana uses base58 encoding where `2zMMh...` and `2zmmh...` are different addresses
- System was treating all addresses like EVM (case-insensitive hex)

**Initial Solution**: Made `normalizeAddress()` chain-aware
- Added `isEvm` boolean parameter to normalization function
- Updated all 12 providers to pass chain type when normalizing addresses
- Preserved case for non-EVM chains (Solana base58)
- Lowercased for EVM chains (checksummed hex)

### Phase 2: VM Type Storage System

**User Feedback**: "Don't we have VM type from providers? Why maintain manual mapping?"

**Improvement**: Replaced manual chain ID mapping with provider-supplied VM type data
- Added `vm_type` field to chains table (migration 0006)
- Relay provider stores `vmType` from API (`"evm"`, `"svm"`, `"bvm"`, `"lvm"`)
- Stargate provider stores `chainType` as `vmType` (`"evm"`)
- Canonical metadata includes `vmType: "svm"` for Solana
- `isEvmChain()` now checks canonical metadata instead of hardcoded mapping

**VM Type Distribution** (217 chains):
- 184 chains: `vm_type = null` (assumed EVM)
- 28 chains: `vm_type = "evm"` (Relay + Stargate)
- 3 chains: `vm_type = "svm"` (Solana, Eclipse, Soon)
- 1 chain: `vm_type = "bvm"` (Bitcoin)
- 1 chain: `vm_type = "lvm"` (LayerZero VM)

### Phase 3: Full Stack Address Lowercasing Bug

**User Report**: "Frontend still showing lowercase Solana addresses"

**Investigation**: Found the bug existed in **both backend and frontend**:

1. **Backend API Bug** (`src/app/api/chains/[chainId]/tokens/route.ts:51`):
   ```sql
   -- Before (WRONG)
   MODE() WITHIN GROUP (ORDER BY LOWER(${tokens.address}))

   -- After (CORRECT)
   MODE() WITHIN GROUP (ORDER BY ${tokens.address})
   ```
   - API was returning lowercased `canonicalAddress` for all tokens
   - Breaking Solana block explorer links

2. **Frontend Bugs** (4 files, 5 locations):
   - Chain token list: grouping by lowercase addresses
   - Token detail page: conflict detection with lowercase (2 places)
   - Support matrix: address comparison with lowercase (2 places)

**Complete Fix**: Removed all `.toLowerCase()` calls throughout the stack
- Backend: Removed `LOWER()` from SQL canonical address calculation
- Frontend: Removed all JavaScript `.toLowerCase()` for address operations
- Result: Addresses preserved with original case from database → API → UI

### Key Technical Improvements

1. **Provider-Driven Architecture**:
   - Uses authoritative VM type data from providers (Relay, Stargate)
   - No manual chain ID → VM type mapping needed
   - Extensible to new VM types (Starknet, Cosmos, etc.)

2. **Type Safety**:
   - Chain interface includes optional `vmType` field
   - Canonical metadata strongly typed with required `vmType`
   - All address normalization functions properly typed

3. **Data Integrity**:
   - Case-sensitive addresses stored correctly in database
   - API responses preserve original case
   - Block explorer links work for all chain types

4. **Clean Architecture**:
   - VM type stored once in database (single source of truth)
   - Future: Can query `vm_type` from database in API routes
   - Canonical metadata serves as fallback for known chains

### Trade-offs & Future Work

**Current Trade-off**: EVM addresses with different cases (e.g., `0xABC...` vs `0xabc...`) now treated as separate addresses
- These are technically the same (EVM addresses are case-insensitive)
- Conservative approach: over-report conflicts rather than under-report
- Safer for data quality monitoring

**Future Improvement**: Chain-aware address comparison in frontend
- Pass `vm_type` from API to frontend components
- Apply case-insensitive comparison only for EVM chains
- Preserve case-sensitive comparison for non-EVM chains

### Data Verification

**Before Fix**:
```json
{
  "symbol": "PENGU",
  "canonicalAddress": "2zmmhcvqexdtde6vsfs7s7d5ouodfjhe8vd1gnbouauv", // ❌ lowercase
  "instances": [
    {"address": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv"} // ✓ correct case
  ]
}
```

**After Fix**:
```json
{
  "symbol": "PENGU",
  "canonicalAddress": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", // ✓ correct
  "instances": [
    {"address": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv"} // ✓ correct
  ]
}
```

### Files Modified (16 total)

**Database Schema**:
- `src/lib/db/schema.ts` - Added `vm_type` field
- `migrations/0006_*.sql` - Migration for vm_type column

**Provider Layer**:
- `src/lib/providers/types.ts` - Added `vmType?` to Chain interface
- `src/lib/providers/relay.ts` - Store `vmType` from API
- `src/lib/providers/stargate.ts` - Map `chainType` to `vmType`
- `src/lib/providers/storage.ts` - Save `vm_type` to database
- All 12 provider files - Updated to pass `isEvm` parameter

**Chain Management**:
- `src/lib/chains/canonical-metadata.ts` - Added `vmType: "svm"` for Solana
- `src/lib/aggregation/chain-mapping.ts` - Updated `isEvmChain()` logic
- `src/lib/aggregation/normalize.ts` - Changed to `isEvm` boolean parameter

**API Layer**:
- `src/app/api/chains/[chainId]/tokens/route.ts` - Removed `LOWER()` from SQL

**Frontend Components**:
- `src/app/chains/[chainId]/token-list.tsx` - Removed lowercase grouping
- `src/app/tokens/[symbol]/page.tsx` - Removed lowercase conflict detection
- `src/components/support-matrix.tsx` - Removed lowercase comparison

### Current Status

✅ **All Issues Resolved**:
- Solana addresses display with correct capitalization
- Block explorer links work for all chains
- API returns proper case in `canonicalAddress`
- Frontend preserves case in all comparisons
- Database stores addresses with original case

✅ **Architecture Improvements**:
- VM type system extensible to new chain types
- Provider data used as source of truth
- Zero TypeScript errors or warnings
- Clean separation of EVM vs non-EVM logic

✅ **Data Quality**:
- 34,221 tokens across 217 chains
- 3 Solana VM chains properly identified (Solana, Eclipse, Soon)
- Case-sensitive addresses preserved throughout stack
- Block explorer integration working correctly

**Next Steps**: System ready for additional non-EVM chains (Starknet, Bitcoin, Cosmos, etc.) with same pattern
