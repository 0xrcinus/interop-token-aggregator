# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a token aggregation application that fetches blockchain token data from multiple interoperability providers (bridges/protocols) and stores it in PostgreSQL. The project uses **Effect-TS** for functional programming patterns and error handling, **Drizzle ORM** for type-safe database access, and **Next.js 16** for the web framework.

**Current Status**: Phase 9 complete (All 12 Providers Operational). Successfully integrated with Neon cloud database. Implements all 12 providers (Relay, LiFi, Across, Stargate, DeBridge, Mayan, Rhino.fi, GasZip, Aori, Eco, Meson, Butter) with 34,221+ tokens across 217+ chains stored in PostgreSQL.

## Commands

### Development
```bash
# Install dependencies
pnpm install

# Initialize git submodules (Effect and Cheffect for reference)
git submodule update --init --recursive

# Start PostgreSQL via Docker (port 5433, not 5432)
docker-compose up -d

# Apply database migrations
pnpm db:push

# Generate new migration
pnpm db:generate

# Open Drizzle Studio (database GUI)
pnpm db:studio

# Run the provider fetch job (CLI)
pnpm fetch:providers

# Start Next.js dev server (when Phase 6 is complete)
pnpm dev

# Type check
npx tsc --noEmit

# Lint
pnpm lint
```

### Database Management
```bash
# Access PostgreSQL CLI
docker exec -it token-aggregator-db psql -U dev -d tokendb

# Stop database
docker-compose down

# View database logs
docker logs token-aggregator-db
```

## Architecture

### Technology Stack
- **Effect-TS 3.x**: Functional effect system with Context/Layer dependency injection
- **Drizzle ORM 0.38**: Type-safe SQL with PostgreSQL
- **Next.js 16**: App Router (API routes planned for Phase 6)
- **PostgreSQL 16**: Running in Docker on port 5433
- **TypeScript 5**: ES2022 target with strict mode

### Critical Architectural Patterns

#### 1. Effect Layer Composition (CRITICAL - Don't Break!)

The project uses `Layer.provideMerge` for nested dependencies. This pattern is essential and breaking it will cause "Service not found" errors.

**Pattern**: [src/lib/providers/index.ts](src/lib/providers/index.ts)
```typescript
// Base dependencies shared by all providers
const ProvidersBaseLive = Layer.mergeAll(
  DatabaseLive,
  NodeHttpClient.layerUndici
)

// Each provider layer gets dependencies via provideMerge
const RelayLive = RelayProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))

// Final composed layer
export const AllProvidersLive = Layer.mergeAll(RelayLive, LifiLive, AcrossLive)
```

**Why this matters**: `Layer.provide` vs `Layer.provideMerge` - only `provideMerge` properly resolves nested dependencies like `HttpClient` requirements within provider services.

**Reference**: See `repos/effect/packages/sql-drizzle/test/utils.ts:7-8` for the official Effect pattern.

#### 2. Provider Service Pattern

Each provider is implemented as an Effect service with tagged dependencies:

**Pattern**: [src/lib/providers/relay.ts](src/lib/providers/relay.ts) (example)
```typescript
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

const make = Effect.gen(function* () {
  const drizzle = yield* Pg.PgDrizzle

  const fetch = Effect.gen(function* () {
    // Fetch and transform data
    return { chains, tokens }
  })

  return { fetch }
})

export const RelayProviderLive = Layer.effect(RelayProvider, make)
```

#### 3. Tagged Errors (Required by Effect Language Service)

Always use tagged errors, never the global `Error` type:

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

#### 4. Batch Inserts for Large Datasets

Always batch insert operations when dealing with >1000 records to prevent stack overflow:

```typescript
// Example: LiFi has 12,597 tokens that require batching
const BATCH_SIZE = 500

for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
  const batch = tokens.slice(i, i + BATCH_SIZE)
  yield* drizzle.insert(db.tokens).values(batch)
}
```

### Database Access Patterns

The project has two database access methods:

1. **Effect-based (for provider jobs)**: Uses `DatabaseLive` layer from [src/lib/db/layer.ts](src/lib/db/layer.ts)
   - Integrated with Effect-TS for functional error handling
   - Used by all provider services via `Pg.PgDrizzle`
   - Automatic dependency injection via layers

2. **Standalone (for API routes)**: Use `createDrizzleClient()` from [src/lib/db/layer.ts](src/lib/db/layer.ts:35)
   - Plain Drizzle client for Next.js API routes (Phase 6)
   - No Effect context required
   - Example: `const db = createDrizzleClient()`

### Database Schema

**Important**: Chain IDs use `bigint` (not `integer`) because some chains have IDs > 2 billion (e.g., 34268394551451).

```typescript
// src/lib/db/schema.ts
export const chains = pgTable("chains", {
  chainId: bigint("chain_id", { mode: "number" }).primaryKey(),
  // ... other fields
})
```

**4 Core Tables**:
1. `provider_fetches` - Tracks each fetch attempt with success/error status
2. `chains` - Normalized chain data with native currency info
3. `chain_provider_support` - M:N relationship between chains and providers
4. `tokens` - Token instances with `raw_data` JSONB field for debugging

**Key Design Decision**: The `raw_data` JSONB field stores the complete original API response for each token. This enables debugging provider discrepancies without refetching.

## Critical Implementation Notes

### Environment Configuration

**Local Development**: Database runs on **port 5433** (not the default 5432) to avoid conflicts with local PostgreSQL installations.

**Cloud (Neon)**: Uses port 5432 with SSL enabled.

`.env.local` structure (using Neon-compatible variable names):
```env
# Local Docker development:
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DATABASE=tokendb
POSTGRES_USER=dev
POSTGRES_PASSWORD=dev
POSTGRES_SSL=false
ADMIN_SECRET=change-this-in-production

# OR for Neon production:
# POSTGRES_HOST=ep-your-project.aws.neon.tech
# POSTGRES_PORT=5432
# POSTGRES_DATABASE=neondb
# POSTGRES_USER=neondb_owner
# POSTGRES_PASSWORD=<from-neon-dashboard>
# POSTGRES_SSL=true
# DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

**Important**:
- Variable names use `POSTGRES_*` prefix to match Neon's naming convention. This ensures seamless deployment to Neon production - you can copy environment variables directly from the Neon dashboard without renaming them.
- The Effect SQL layer uses `POSTGRES_SSL` environment variable (defaults to `false` for local, set to `true` for Neon/cloud databases) in [src/lib/db/layer.ts](src/lib/db/layer.ts).

### DevContainer Firewall

The devcontainer includes a security firewall that restricts outbound connections to whitelisted domains only. This prevents accidental data exfiltration and ensures reproducible builds.

**Adding Custom Domains**:

If you need to connect to external services (like Neon database, additional APIs), add them to the custom domains file:

1. Copy the example: `cp .devcontainer/custom-domains.txt.example .devcontainer/custom-domains.txt`
2. Add your domains (one per line):
   ```txt
   # .devcontainer/custom-domains.txt
   ep-super-paper-ah48h27x-pooler.c-3.us-east-1.aws.neon.tech
   api.custom.com
   ```
3. Rebuild the devcontainer

The firewall script ([.devcontainer/init-firewall.sh](.devcontainer/init-firewall.sh)) reads this file on startup:
- Resolves each domain to IP addresses
- Adds IPs to the firewall whitelist
- Failed resolutions print warnings but don't block startup
- The file is gitignored to keep private hostnames out of the repo

**Note**: See [DEVCONTAINER_SETUP.md](DEVCONTAINER_SETUP.md#adding-custom-domains-to-firewall) for full documentation.

### TypeScript Configuration Requirements

These specific tsconfig settings are **required** for Effect-TS to work properly:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "dom", "dom.iterable"],
    "downlevelIteration": true,
    "strict": true,
    "plugins": [
      { "name": "@effect/language-service" }
    ]
  }
}
```

### Shared Provider Utilities (DRY Refactoring)

To eliminate repetitive code across providers, we've created shared utilities:

**[src/lib/providers/factory.ts](src/lib/providers/factory.ts)** - Provider fetch pipeline
- `createProviderFetch()` - Wraps provider logic with standard logging, storage, and error handling
- `withProviderErrorHandling()` - Maps all error types to ProviderError for type safety
- Automatically handles: start logging, count logging, database storage, error recovery

**[src/lib/providers/storage.ts](src/lib/providers/storage.ts)** - Database operations
- `storeProviderData()` - Inserts fetch record, chains, chain-provider links, and tokens
- `batchInsertTokens()` - Batches token inserts (500 per batch) to prevent stack overflow
- `recordProviderError()` - Logs failed fetches to database
- `withDatabaseErrorHandling()` - Wraps storage with error handling

**Standard Provider Pattern**:
```typescript
const make = Effect.gen(function* () {
  yield* Pg.PgDrizzle

  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      // Fetch data
      const data = yield* fetchJson(API_URL)

      // Transform to normalized format
      const chains: Chain[] = ...
      const tokens: Token[] = ...

      // Return (storage/logging handled automatically)
      return { chains, tokens }
    })
  )

  return { fetch }
})
```

This pattern eliminates ~100 lines of boilerplate per provider while ensuring consistency.

### Provider-Specific Implementation Details

#### Relay Provider
- **EVM Filtering**: MUST filter chains where `vmType === "evm"` (excludes Solana, Bitcoin, etc.)
- **Nested Tokens**: Tokens are in `solverCurrencies` array within each chain
- **Schema Flexibility**: Handles chains missing `nativeCurrency` with fallback values
- File: [src/lib/providers/relay.ts](src/lib/providers/relay.ts)

#### LiFi Provider
- **Chain Inference**: No chains endpoint - must infer from token `chainId`s
- **Null Byte Sanitization**: MUST sanitize strings: `str?.replace(/\0/g, "")` or PostgreSQL will error
- **Large Dataset**: 12,597 tokens require batch inserts (500 per batch)
- File: [src/lib/providers/lifi.ts](src/lib/providers/lifi.ts)

#### Across Provider
- **Parallel Fetching**: Fetches chains and tokens from separate endpoints concurrently
- **Logo Field**: Uses `logoUrl` (not `logoURI` like other providers)
- File: [src/lib/providers/across.ts](src/lib/providers/across.ts)

### Common Data Transformation Patterns

**Address Normalization**: Chain-aware normalization (CRITICAL: Solana addresses are case-sensitive!)
```typescript
// src/lib/aggregation/normalize.ts
import { isEvmChain } from "../aggregation/chain-mapping"

// In provider code:
const isEvm = isEvmChain(chainId)
const address = normalizeAddress(token.address, isEvm)

// normalizeAddress implementation:
export const normalizeAddress = (address: string, isEvm: boolean = true): string => {
  if (!isEvm) {
    return address.trim() // Preserve case for Solana, Starknet, etc.
  }
  return address.toLowerCase().trim() // EVM addresses to lowercase
}
```

**Why this matters**:
- EVM addresses use checksummed hex (case-insensitive) → normalize to lowercase
- Solana addresses use base58 encoding (case-sensitive) → preserve original case
- Example: `2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv` (PENGU) must preserve caps

**Native Token Addresses**: Both `0x0000000000000000000000000000000000000000` and `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` represent native tokens and should be treated as equivalent (EVM only).

## Reference Codebases

The repository includes two Git submodules for reference (NOT dependencies):

- **`repos/effect/`**: Official Effect-TS source code
  - Layer composition patterns: `packages/sql-drizzle/test/utils.ts`
  - HTTP client examples: `packages/platform/src/HttpClient.ts`
  - SQL patterns: `packages/sql/src/SqlClient.ts`

- **`repos/cheffect/`**: Production Effect application by Tim Smart
  - Real-world service architecture
  - Practical `Effect.gen` usage patterns

**Note**: These are for reference only. Do NOT modify them or import from them.

## Running the Job Runner

The job runner fetches data from all configured providers in parallel:

```bash
pnpm fetch:providers
```

**Current Output**: Fetches from all 12 providers in ~3-5 seconds, stores 34,221+ tokens across 217+ chains.

**How it works**: [src/jobs/fetch-providers.ts](src/jobs/fetch-providers.ts)
- Uses `Effect.all` with `concurrency: "unbounded"` for parallel execution
- Mode `"either"` allows partial success (continues even if some providers fail)
- Each provider stores a record in `provider_fetches` table with success/error status
- All database operations run in transactions

## Known Issues & Solutions

### Issue: "Service not found: @effect/platform/HttpClient"
**Solution**: Use `Layer.provideMerge` instead of `Layer.provide` for nested dependencies.

### Issue: Chain ID out of range for integer
**Solution**: Use `bigint("chain_id", { mode: "number" })` in schema, not `integer`.

### Issue: Stack overflow when inserting large token lists
**Solution**: Batch inserts in groups of 500 records.

### Issue: PostgreSQL "invalid byte sequence for encoding UTF8: 0x00"
**Solution**: Sanitize LiFi data: `str?.replace(/\0/g, "")` before inserting.

### Issue: Effect.fail warnings about global Error type
**Solution**: Always use tagged errors that extend `Data.TaggedError`.

## API Endpoints (Phase 6 - Complete)

All API routes use standalone Drizzle client (`createDrizzleClient()`) for simplicity.

### GET /api/providers
Returns provider health status and fetch history.

**Response**: Provider list with success rates, last fetch status, and summary statistics.

```bash
curl http://localhost:3000/api/providers
```

### GET /api/chains
Returns all chains with provider support counts and token counts.

**Response**: Chain list ordered by provider count, with native currency info and summary.

```bash
curl http://localhost:3000/api/chains
```

### GET /api/tokens
Returns aggregated token list grouped by symbol.

**Query params**:
- `limit` (default: 100, max: 1000) - Number of tokens per page
- `offset` (default: 0) - Pagination offset
- `symbol` (optional) - Filter by symbol (case-insensitive partial match)

**Response**: Token list with provider/chain counts, pagination info.

```bash
curl 'http://localhost:3000/api/tokens?limit=10&symbol=USD'
```

### GET /api/tokens/[symbol]
Returns detailed information for a specific token symbol, including all instances across chains/providers.

**Response**: Token instances grouped by chain, with conflict detection for different addresses on the same chain.

```bash
curl http://localhost:3000/api/tokens/USDC
```

### POST /api/admin/fetch
Triggers the provider fetch job in the background.

**Authentication**: Requires `x-admin-secret` header matching `ADMIN_SECRET` env var.

**Response**: 202 Accepted (job runs asynchronously).

```bash
curl -X POST http://localhost:3000/api/admin/fetch \
  -H "x-admin-secret: your-secret-here"
```

**Important**: In Next.js 15+, route `params` are async. Always await them:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params  // Must await!
}
```

## Additional Context

**Full specification**: See [SPEC.md](SPEC.md) for complete requirements including:
- Database schema design rationale
- Provider-specific API details for all 12 providers (9 not yet implemented)
- Conflict detection logic (deferred to post-MVP)
- Wormhole chain ID mappings for Mayan provider
- Static token lists for Eco provider

**Handover document**: See [HANDOVER.md](HANDOVER.md) for:
- Detailed phase completion status (5/9 complete)
- Resolved issues with solutions
- Database verification queries
- Quick start checklist for new sessions

## Important Reminders

1. **Never break the layer composition pattern** - The `Layer.provideMerge` setup is critical for HttpClient resolution
2. **Database ports**: Local Docker uses 5433, Neon uses 5432
3. **Always batch large inserts** (>1000 records) with 500 per batch
4. **Sanitize LiFi data** for null bytes before database insertion
5. **Use bigint for chain IDs** - some exceed 2 billion
6. **Always use tagged errors** - Effect language service enforces this
7. **Submodules are read-only** - For reference patterns only
8. **TypeScript requires `downlevelIteration: true`** - Effect won't compile without it
9. **SSL for cloud databases** - Set `POSTGRES_SSL=true` for Neon/cloud databases, `false` for local development
10. **HTTP timeout** - All provider HTTP requests have a 30-second timeout to prevent indefinite hangs
