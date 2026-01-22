# Token List Application - Rebuild Specification

This specification outlines a clean rebuild of a token aggregation application using PostgreSQL for persistence and Effect-TS for robust error handling and data processing.

## Project Overview

An application that aggregates token support data from 12 blockchain interoperability providers (relay, lifi, debridge, stargate, mayan, rhino, gaszip, across, aori, eco, meson, butter) into a unified database and API.

## Initial Setup

### 1. Create New Repository

```bash
git init
```

### 2. Add Reference Codebases as Submodules

To provide reference implementations and patterns during development, add the Effect and Cheffect repositories as Git submodules:

```bash
# Create repos directory
mkdir repos

# Add Effect-TS repository (official Effect implementation)
git submodule add https://github.com/Effect-TS/effect repos/effect

# Add Cheffect repository (real-world Effect application example)
git submodule add https://github.com/tim-smart/cheffect repos/cheffect

# Initialize and update submodules
git submodule update --init --recursive
```

These reference codebases provide:
- **repos/effect**: Official Effect-TS source code, including:
  - `packages/platform/src/HttpClient.ts` - HTTP client patterns
  - `packages/sql/src/SqlClient.ts` - SQL client patterns
  - `packages/sql-drizzle/` - Drizzle ORM integration
  - Comprehensive test suites demonstrating usage patterns

- **repos/cheffect**: Production Effect application example showing:
  - Layer composition patterns
  - Service architecture
  - Real-world Effect.gen usage
  - Integration with React and modern web frameworks

**Note**: These submodules are for reference only during development. They are not dependencies and should be listed in `.gitignore` if not tracking submodule commits.

### 3. Clone Submodules (When Checking Out Repository)

When cloning the repository on a new machine:

```bash
git clone <repository-url>
cd token-list-v2
git submodule update --init --recursive
```

Or clone with submodules in one command:

```bash
git clone --recurse-submodules <repository-url>
```

## Architecture Goals

1. **Persistent Storage**: Replace in-memory cache with PostgreSQL
2. **Raw Data Tracking**: Store original provider responses for analysis and debugging
3. **Incremental Updates**: Track timestamps and only update changed data
4. **Type Safety**: Use Effect-TS for robust error handling and data validation
5. **Clean Separation**: Provider adapters → Raw storage → Aggregation → API

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (via Docker for local dev)
- **ORM**: Drizzle ORM (Effect-compatible, type-safe)
- **Effect**: Effect-TS for error handling, retries, scheduling
- **UI**: React + shadcn/ui
- **Deployment**: Vercel (with Vercel Postgres or external PG instance)

## Database Schema

### Provider Fetches
Tracks each fetch attempt from a provider:
```sql
provider_fetches
  - id: uuid (PK)
  - provider_name: varchar(50)
  - fetched_at: timestamp
  - status: enum('success', 'error')
  - error_message: text (nullable)
  - duration_ms: integer
  - raw_response: jsonb (full provider response)
```

### Chains
Normalized chain data across all providers:
```sql
chains
  - id: integer (PK, chain ID)
  - name: varchar(255)
  - explorer_url: varchar(500) (nullable)
  - first_seen_at: timestamp
  - last_seen_at: timestamp
```

### Chain Provider Support
Tracks which providers support which chains:
```sql
chain_provider_support
  - chain_id: integer (FK → chains.id)
  - provider_name: varchar(50)
  - first_seen_at: timestamp
  - last_seen_at: timestamp
  - (PK: chain_id, provider_name)
```

### Tokens
Token instances on specific chains from specific providers:
```sql
tokens
  - id: uuid (PK)
  - chain_id: integer (FK → chains.id)
  - provider_name: varchar(50)
  - address: varchar(42) (lowercase)
  - symbol: varchar(50)
  - name: varchar(255)
  - decimals: integer
  - logo_uri: varchar(500) (nullable)
  - raw_data: jsonb (original token object from provider)
  - first_seen_at: timestamp
  - last_seen_at: timestamp
  - (Unique: chain_id, provider_name, address)
```

**Note on raw_data**: This field stores the complete original token object from each provider's API response. This enables:
- Debugging provider data discrepancies
- Reconstructing aggregation logic without refetching
- Accessing provider-specific metadata not captured in normalized schema
- Historical analysis of how providers change their data over time

### Aggregated Tokens
Computed view of tokens grouped by symbol:
```sql
aggregated_tokens (materialized view, refreshed after each update)
  - symbol: varchar(50) (PK)
  - name: varchar(255)
  - logo_uri: varchar(500)
  - provider_count: integer
  - chain_count: integer
  - providers: text[] (array of provider names)
  - chains: integer[] (array of chain IDs)
  - has_conflicts: boolean
  - last_updated_at: timestamp
```

### Token Chain Data
Token data aggregated by symbol and chain (for conflict detection):
```sql
token_chain_data
  - symbol: varchar(50)
  - chain_id: integer
  - primary_address: varchar(42)
  - primary_decimals: integer
  - primary_providers: text[]
  - conflicts: jsonb (array of {address, decimals, providers, conflictType})
  - (PK: symbol, chain_id)
```

## Data Flow

### 1. Provider Fetching (Scheduled Job)
```
Effect Pipeline:
  1. For each provider (in parallel):
     - Fetch data with timeout and retries
     - Log fetch attempt to provider_fetches table
     - Store raw JSON response
  2. Handle failures gracefully (log and continue)
  3. Return all successful results
```

### 2. Data Normalization
```
Effect Pipeline:
  1. Parse raw responses into normalized Chain/Token types
  2. Validate data (EVM-only, required fields)
  3. Transform addresses to lowercase
  4. Handle native token equivalence (0x0...0 = 0xe...e)
```

### 3. Database Updates
```
Transaction:
  1. Upsert chains (update last_seen_at)
  2. Upsert chain_provider_support
  3. Upsert tokens (update last_seen_at)
  4. Delete tokens not seen in last 7 days (configurable)
  5. Refresh materialized view (aggregated_tokens)
  6. Recompute token_chain_data with conflict detection
```

### 4. API Layer
```
GET /api/tokens
  - Returns aggregated_tokens from materialized view
  - Includes provider/chain lists and conflict info
  - No computation, pure read from DB

GET /api/tokens/:symbol
  - Returns detailed token data including chain-specific info
  - Includes conflict details and provider disagreements

GET /api/providers
  - Returns provider status from recent provider_fetches
  - Shows last fetch time, success rate, error messages

GET /api/chains
  - Returns all chains with provider support info
```

## Effect-TS Integration

### Setup
```bash
npm install effect @effect/schema @effect/platform @effect/platform-node
npm install @effect/sql @effect/sql-pg @effect/sql-drizzle
npm install drizzle-orm postgres
npm install @effect/language-service --save-dev
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "@effect/language-service"
      }
    ]
  }
}
```

### package.json
```json
{
  "scripts": {
    "prepare": "effect-language-service patch",
    "dev": "next dev",
    "build": "next build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "fetch:providers": "tsx src/jobs/fetch-providers.ts"
  }
}
```

### Core Architecture Patterns

#### 1. HTTP Client with Retry and Timeout

Use `@effect/platform/HttpClient` instead of raw fetch for built-in resilience:

```typescript
// src/lib/providers/http.ts
import { HttpClient } from "@effect/platform"
import { Effect, Schedule } from "effect"
import * as Schema from "@effect/schema/Schema"

export const makeHttpClient = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient

  return client.pipe(
    // Add default retry policy
    HttpClient.retry(
      Schedule.exponential("1 second", 2).pipe(
        Schedule.compose(Schedule.recurs(3))
      )
    ),
    // Add timeout
    HttpClient.timeout("30 seconds")
  )
})
```

#### 2. Schema Validation for API Responses

Use `@effect/schema` for runtime validation of provider responses:

```typescript
// src/lib/providers/schemas.ts
import * as Schema from "@effect/schema/Schema"

export const ChainSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  displayName: Schema.optional(Schema.String),
  nativeCurrency: Schema.Struct({
    name: Schema.String,
    symbol: Schema.String,
    decimals: Schema.Number,
  }),
})

export const TokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  chainId: Schema.Number,
  logoURI: Schema.optional(Schema.String),
})

export const ProviderResponseSchema = Schema.Struct({
  chains: Schema.Array(ChainSchema),
  tokens: Schema.Array(TokenSchema),
})

export type Chain = Schema.Schema.Type<typeof ChainSchema>
export type Token = Schema.Schema.Type<typeof TokenSchema>
export type ProviderResponse = Schema.Schema.Type<typeof ProviderResponseSchema>
```

#### 3. Database Layer with Drizzle Integration

Use `@effect/sql-drizzle` for type-safe database access:

```typescript
// src/lib/db/layer.ts
import { PgClient } from "@effect/sql-pg"
import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { Config, Layer } from "effect"
import * as schema from "./schema"

export const SqlLive = PgClient.layer({
  database: Config.string("POSTGRES_DATABASE"),
  username: Config.string("POSTGRES_USER"),
  password: Config.secret("POSTGRES_PASSWORD"),
  host: Config.string("POSTGRES_HOST"),
  port: Config.number("POSTGRES_PORT"),
})

export const DrizzleLive = PgDrizzle.layer.pipe(
  Layer.provide(SqlLive)
)

export const DatabaseLive = Layer.mergeAll(SqlLive, DrizzleLive)
```

#### 4. Provider Service Pattern with Layers

Each provider is a service with dependencies injected via Layers:

```typescript
// src/lib/providers/relay.ts
import { HttpClient } from "@effect/platform"
import { Context, Effect, Layer } from "effect"
import * as Schema from "@effect/schema/Schema"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import * as db from "../db/schema"

// Define the service
export class RelayProvider extends Context.Tag("RelayProvider")<
  RelayProvider,
  {
    readonly fetch: Effect.Effect<
      { chains: Chain[]; tokens: Token[] },
      HttpError | ParseError | ValidationError
    >
  }
>() {}

// Response schema
const RelayChainSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  displayName: Schema.optional(Schema.String),
  vmType: Schema.String,
  nativeCurrency: Schema.Struct({
    name: Schema.String,
    symbol: Schema.String,
    decimals: Schema.Number,
  }),
})

const RelayTokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  chainId: Schema.String,
  logoURI: Schema.optional(Schema.String),
})

const RelayResponseSchema = Schema.Struct({
  chains: Schema.Array(
    Schema.Struct({
      solverCurrencies: Schema.Array(RelayTokenSchema),
    }).pipe(Schema.extend(RelayChainSchema))
  ),
})

// Implementation
const make = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const drizzle = yield* PgDrizzle.PgDrizzle

  const fetch = Effect.gen(function* () {
    // Fetch with HttpClient
    const response = yield* client.get(
      "https://api.relay.link/chains"
    ).pipe(
      Effect.flatMap((res) => res.json),
      Effect.flatMap((json) =>
        Schema.decodeUnknown(RelayResponseSchema)(json)
      )
    )

    // Filter EVM chains only
    const evmChains = response.chains.filter(
      (chain) => chain.vmType === "evm"
    )

    // Transform to normalized format
    const chains: Chain[] = evmChains.map((chain) => ({
      id: parseInt(chain.id),
      name: chain.displayName || chain.name,
      nativeCurrency: chain.nativeCurrency,
    }))

    // Extract tokens from solverCurrencies
    const tokens: Token[] = evmChains.flatMap((chain) =>
      chain.solverCurrencies.map((token) => ({
        address: token.address.toLowerCase(),
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId: parseInt(chain.id),
        logoURI: token.logoURI,
      }))
    )

    // Store in database with raw data
    yield* Effect.gen(function* () {
      const fetchId = yield* drizzle
        .insert(db.providerFetches)
        .values({
          providerName: "relay",
          success: true,
          chainsCount: chains.length,
          tokensCount: tokens.length,
        })
        .returning({ id: db.providerFetches.id })
        .then((rows) => rows[0].id)

      // Insert chains
      yield* drizzle.insert(db.chains).values(
        chains.map((chain) => ({
          chainId: chain.id,
          name: chain.name,
          nativeCurrencyName: chain.nativeCurrency.name,
          nativeCurrencySymbol: chain.nativeCurrency.symbol,
          nativeCurrencyDecimals: chain.nativeCurrency.decimals,
        }))
      ).onConflictDoNothing()

      // Link chains to provider
      yield* drizzle.insert(db.chainProviderSupport).values(
        chains.map((chain) => ({
          chainId: chain.id,
          providerName: "relay",
          fetchId,
        }))
      )

      // Insert tokens with raw data
      yield* drizzle.insert(db.tokens).values(
        tokens.map((token) => ({
          providerName: "relay",
          chainId: token.chainId,
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoUri: token.logoURI,
          fetchId,
          rawData: token, // Store original response
        }))
      )
    }).pipe(
      Effect.catchAll((error) =>
        drizzle
          .insert(db.providerFetches)
          .values({
            providerName: "relay",
            success: false,
            errorMessage: String(error),
          })
          .pipe(Effect.flatMap(() => Effect.fail(error)))
      )
    )

    return { chains, tokens }
  })

  return { fetch }
})

// Export layer
export const RelayProviderLive = Layer.effect(RelayProvider, make)
```

#### 5. Database Schema with Drizzle

```typescript
// src/lib/db/schema.ts
import { pgTable, text, integer, boolean, timestamp, jsonb, serial, index } from "drizzle-orm/pg-core"

export const providerFetches = pgTable("provider_fetches", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  success: boolean("success").notNull(),
  chainsCount: integer("chains_count"),
  tokensCount: integer("tokens_count"),
  errorMessage: text("error_message"),
})

export const chains = pgTable("chains", {
  chainId: integer("chain_id").primaryKey(),
  name: text("name").notNull(),
  nativeCurrencyName: text("native_currency_name").notNull(),
  nativeCurrencySymbol: text("native_currency_symbol").notNull(),
  nativeCurrencyDecimals: integer("native_currency_decimals").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const chainProviderSupport = pgTable("chain_provider_support", {
  id: serial("id").primaryKey(),
  chainId: integer("chain_id").notNull().references(() => chains.chainId),
  providerName: text("provider_name").notNull(),
  fetchId: integer("fetch_id").notNull().references(() => providerFetches.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  chainProviderIdx: index("chain_provider_idx").on(table.chainId, table.providerName),
}))

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  chainId: integer("chain_id").notNull().references(() => chains.chainId),
  address: text("address").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  decimals: integer("decimals").notNull(),
  logoUri: text("logo_uri"),
  fetchId: integer("fetch_id").notNull().references(() => providerFetches.id),
  rawData: jsonb("raw_data").notNull(), // Store original provider response
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  providerChainAddressIdx: index("provider_chain_address_idx").on(
    table.providerName,
    table.chainId,
    table.address
  ),
  symbolIdx: index("symbol_idx").on(table.symbol),
}))
```

#### 6. Job Runner for Provider Fetching

```typescript
// src/jobs/fetch-providers.ts
import { Effect, Layer } from "effect"
import { DatabaseLive } from "../lib/db/layer"
import { RelayProviderLive } from "../lib/providers/relay"
import { LifiProviderLive } from "../lib/providers/lifi"
// ... import all provider layers

const FetchAllProvidersLive = Layer.mergeAll(
  RelayProviderLive,
  LifiProviderLive,
  // ... all provider layers
).pipe(Layer.provide(DatabaseLive))

const program = Effect.gen(function* () {
  const relay = yield* RelayProvider
  const lifi = yield* LifiProvider
  // ... get all providers

  // Fetch all in parallel
  yield* Effect.all(
    [
      relay.fetch,
      lifi.fetch,
      // ... all provider fetches
    ],
    { concurrency: "unbounded" }
  )
}).pipe(Effect.provide(FetchAllProvidersLive))

// Run the program
Effect.runPromise(program).catch(console.error)
```

## Provider Adapters (Keep Existing Logic)

All 12 existing provider adapters should be migrated with their current logic intact:

- **relay.ts** - Relay Bridge API
- **lifi.ts** - LI.FI aggregator API
- **debridge.ts** - deBridge protocol (chain-specific fetching)
- **stargate.ts** - Stargate Finance
- **mayan.ts** - Mayan Finance (Wormhole chain mapping)
- **rhino.ts** - Rhino.fi
- **gaszip.ts** - GasZip
- **across.ts** - Across Protocol
- **aori.ts** - Aori
- **eco.ts** - Eco Protocol (static list)
- **meson.ts** - Meson Finance
- **butter.ts** - Butter (paginated API)

Each adapter wraps its existing fetch logic in Effect for error handling and logging.

## Conflict Detection Logic (Keep Existing)

Maintain the current conflict detection system:

1. **Address Equivalence**: Native token addresses (0x0...0 and 0xe...e) are treated as equivalent
2. **Primary Selection**: Token with most provider support becomes primary
3. **Conflict Classification**:
   - **Variant**: Multiple providers agree, or matches known bridged token patterns (.e suffix)
   - **Error**: Single unreliable provider reports different address
4. **Reliable Providers**: relay, lifi, across, stargate, debridge (give these benefit of doubt)

## Scheduling Strategy

### Development
- Manual trigger via API endpoint: `POST /api/admin/fetch`
- Or CLI command: `pnpm fetch:providers`

### Production
- Vercel Cron job (hourly): `0 * * * *`
- Or external cron service hitting webhook
- Consider rate limiting (providers may have limits)

## Migration Path

1. **Phase 1**: Set up new repo with Next.js + PostgreSQL + Drizzle
2. **Phase 2**: Define schema and migrations
3. **Phase 3**: Migrate provider adapters (wrap in Effect)
4. **Phase 4**: Build data ingestion pipeline
5. **Phase 5**: Build API routes
6. **Phase 6**: Migrate frontend components
7. **Phase 7**: Add scheduling/cron
8. **Phase 8**: Deploy and test

## Development Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL (Docker)
docker run --name token-db -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# Run migrations
pnpm db:migrate

# Start dev server
pnpm dev

# Trigger initial fetch
pnpm fetch:providers
```

## Key Improvements Over Current Implementation

1. **Persistence**: No data loss on restart, historical tracking
2. **Raw Data**: Can debug provider issues, rebuild aggregations
3. **Incremental Updates**: Only update what changed, track staleness
4. **Reliability**: Effect-TS handles errors, retries, timeouts consistently
5. **Performance**: Materialized views for fast reads, background updates
6. **Observability**: Track fetch success rates, provider reliability over time
7. **Scalability**: Database can handle growth, separate read/write paths

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/tokendb

# Optional: External chain registry
CHAIN_REGISTRY_URL=https://chainlist.org/rpcs.json

# Cron secret (for webhook triggers)
CRON_SECRET=random-secret-key
```

---

# Appendix: Provider Implementation Details

This section documents the critical implementation details for each provider to ensure no logic is lost during migration.

## 1. Relay (`relay.ts`)

**API Endpoint**: `https://api.relay.link/chains`

**Response Structure**:
```typescript
interface RelayResponse {
  chains: Array<{
    id: number
    name: string
    displayName?: string
    vmType?: string
    solverCurrencies?: Array<{
      address: string
      symbol: string
      name: string
      decimals: number
    }>
  }>
}
```

**Critical Logic**:
- **EVM Filtering**: MUST filter chains where `vmType === "evm"` (excludes Solana, Bitcoin, etc.)
- **Chain Name**: Prefer `displayName` over `name` if available
- **Tokens**: Extracted from `solverCurrencies` array within each chain object
- **Single Endpoint**: Both chains and tokens come from the same response

**Effect Migration**:
```typescript
export const fetchRelay = Effect.gen(function* () {
  const data = yield* fetchWithRetry("https://api.relay.link/chains")

  // Store raw response
  yield* storeProviderFetch({
    providerName: "relay",
    rawResponse: data,
    status: "success"
  })

  const evmChains = data.chains.filter(chain => chain.vmType === "evm")

  // Store tokens with raw_data field
  const tokens = evmChains.flatMap(chain =>
    (chain.solverCurrencies || []).map(token => ({
      ...normalizeToken(token, chain.id),
      rawData: token // <-- Store original object
    }))
  )

  return { chains, tokens }
})
```

---

## 2. LI.FI (`lifi.ts`)

**API Endpoint**: `https://li.quest/v1/tokens`

**Response Structure**:
```typescript
interface LifiResponse {
  tokens: Record<string, Array<{
    address: string
    symbol: string
    name: string
    decimals: number
    chainId: number
    logoURI?: string
  }>>
}
```

**Critical Logic**:
- **Chain Inference**: Chains are NOT provided directly; must be inferred from token `chainId`s
- **Object Keys**: Chain IDs are the keys of the `tokens` object (as strings)
- **Chain Names**: Default to `"Chain {id}"` since LI.FI doesn't provide names in this endpoint
- **Token ChainId**: Prefer token's `chainId` field over the object key if present

**Effect Migration**:
```typescript
export const fetchLifi = Effect.gen(function* () {
  const data = yield* fetchWithRetry("https://li.quest/v1/tokens")

  yield* storeProviderFetch({
    providerName: "lifi",
    rawResponse: data,
    status: "success"
  })

  const chainIds = new Set<number>()
  const tokens = []

  for (const [chainIdStr, chainTokens] of Object.entries(data.tokens)) {
    const chainId = parseInt(chainIdStr, 10)
    if (isNaN(chainId)) continue

    chainIds.add(chainId)

    for (const token of chainTokens) {
      tokens.push({
        ...normalizeToken(token, token.chainId || chainId),
        rawData: token // <-- Store original
      })
    }
  }

  // Inferred chains
  const chains = Array.from(chainIds).map(id => ({
    id,
    name: `Chain ${id}`
  }))

  return { chains, tokens }
})
```

---

## 3. deBridge (`debridge.ts`)

**API Endpoints**:
1. Chains: `https://dln.debridge.finance/v1.0/supported-chains-info`
2. Tokens (per chain): `https://dln.debridge.finance/v1.0/token-list?chainId={chainId}`

**Response Structures**:
```typescript
interface DebridgeChainsResponse {
  chains: Array<{
    chainId: number        // deBridge internal ID
    originalChainId: number // Standard EVM chain ID
    chainName: string
  }>
}

interface DebridgeTokensResponse {
  tokens: Record<string, {
    symbol: string
    name: string
    decimals: number
    address: string
    logoURI?: string
  }>
}
```

**Critical Logic**:
- **Non-EVM Exclusions**: MUST exclude specific chain IDs: `[7565164, 100000026, 100000027, 100000029]`
  - 7565164: Solana
  - 100000026: Tron
  - 100000027: Sei
  - 100000029: Injective
- **Chain ID Mapping**: Use `originalChainId` if present, fallback to `chainId`
- **Per-Chain Fetching**: Must fetch tokens separately for EACH EVM chain (parallel requests)
- **Address Validation**: MUST validate EVM address format (`/^0x[a-fA-F0-9]{40}$/`) to filter non-EVM tokens
- **Error Handling**: Individual token fetch failures should not abort entire operation

**Effect Migration**:
```typescript
const NON_EVM_CHAIN_IDS = new Set([7565164, 100000026, 100000027, 100000029])

export const fetchDebridge = Effect.gen(function* () {
  // Fetch chains
  const chainsData = yield* fetchWithRetry(
    "https://dln.debridge.finance/v1.0/supported-chains-info"
  )

  const evmChains = chainsData.chains.filter(
    chain => !NON_EVM_CHAIN_IDS.has(chain.chainId)
  )

  // Fetch tokens per chain in parallel
  const tokenResults = yield* Effect.all(
    evmChains.map(chain =>
      Effect.gen(function* () {
        const data = yield* fetchWithRetry(
          `https://dln.debridge.finance/v1.0/token-list?chainId=${chain.chainId}`
        )

        const chainId = chain.originalChainId || chain.chainId

        return Object.values(data.tokens)
          .filter(token => /^0x[a-fA-F0-9]{40}$/.test(token.address))
          .map(token => ({
            ...normalizeToken(token, chainId),
            rawData: token
          }))
      }).pipe(
        Effect.catchAll(() => Effect.succeed([])) // Graceful failure
      )
    ),
    { concurrency: "unbounded" }
  )

  return { chains, tokens: tokenResults.flat() }
})
```

---

## 4. Stargate (`stargate.ts`)

**API Endpoints** (parallel):
1. `https://stargate.finance/api/v1/chains`
2. `https://stargate.finance/api/v1/tokens`

**Response Structures**:
```typescript
interface StargateChainsResponse {
  chains: Array<{
    chainId: number
    name: string
    chainKey: string
    chainType: string
  }>
}

interface StargateTokensResponse {
  tokens: Array<{
    address: string
    symbol: string
    name: string
    decimals: number
    chainKey: string
  }>
}
```

**Critical Logic**:
- **EVM Filtering**: MUST filter chains where `chainType === "evm"`
- **Chain Key Mapping**: Tokens use `chainKey` (string) not `chainId`, must build mapping
- **Parallel Fetching**: Fetch both endpoints in parallel for efficiency
- **Token Filtering**: Only include tokens whose `chainKey` maps to a known EVM chain

**Effect Migration**:
```typescript
export const fetchStargate = Effect.gen(function* () {
  const [chainsData, tokensData] = yield* Effect.all([
    fetchWithRetry("https://stargate.finance/api/v1/chains"),
    fetchWithRetry("https://stargate.finance/api/v1/tokens")
  ])

  // Build chainKey → chainId mapping
  const chainKeyToId = new Map<string, number>()
  const chains = []

  for (const chain of chainsData.chains) {
    if (chain.chainType !== "evm") continue

    chains.push({ id: chain.chainId, name: chain.name })
    chainKeyToId.set(chain.chainKey, chain.chainId)
  }

  // Map tokens using chainKey
  const tokens = tokensData.tokens
    .filter(token => chainKeyToId.has(token.chainKey))
    .map(token => ({
      ...normalizeToken(token, chainKeyToId.get(token.chainKey)!),
      rawData: token
    }))

  return { chains, tokens }
})
```

---

## 5. Mayan (`mayan.ts`)

**API Endpoint**: `https://price-api.mayan.finance/v3/tokens`

**Response Structure**:
```typescript
type MayanResponse = Record<string, Array<{
  name: string
  symbol: string
  mint?: string      // Solana address
  contract?: string  // EVM address
  chainId: number
  wChainId?: number  // Wormhole chain ID
  decimals: number
  logoURI?: string
}>>
```

**Critical Logic**:
- **Chain Name Filtering**: Keys are chain names (e.g., "ethereum", "solana"); MUST exclude non-EVM: `["solana", "aptos", "sui", "ton", "tron", "cosmos", "osmosis", "injective", "sei"]`
- **Wormhole Mapping**: MUST map `wChainId` to standard EVM chain IDs:
  ```typescript
  const WORMHOLE_TO_EVM = {
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
- **Address Validation**: MUST validate EVM address format
- **Chain ID Priority**: Use wormhole-mapped ID over raw `chainId`
- **Chain Inference**: Chains inferred from tokens (no separate endpoint)

**Effect Migration**:
```typescript
const WORMHOLE_TO_EVM_CHAIN = {
  2: 1, 4: 56, 5: 137, 6: 43114, 10: 250, 23: 42161, 24: 10, 30: 8453
}
const NON_EVM_CHAINS = new Set([
  "solana", "aptos", "sui", "ton", "tron", "cosmos", "osmosis", "injective", "sei"
])

export const fetchMayan = Effect.gen(function* () {
  const data = yield* fetchWithRetry("https://price-api.mayan.finance/v3/tokens")

  const chainIds = new Set<number>()
  const tokens = []

  for (const [chainName, chainTokens] of Object.entries(data)) {
    if (!Array.isArray(chainTokens)) continue
    if (NON_EVM_CHAINS.has(chainName.toLowerCase())) continue

    for (const token of chainTokens) {
      const address = token.contract || ""
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) continue

      // CRITICAL: Map wormhole ID to EVM ID
      const chainId = token.wChainId
        ? WORMHOLE_TO_EVM_CHAIN[token.wChainId]
        : token.chainId || 0

      if (!chainId) continue

      chainIds.add(chainId)
      tokens.push({
        ...normalizeToken({ ...token, address }, chainId),
        rawData: token
      })
    }
  }

  return {
    chains: Array.from(chainIds).map(id => ({ id, name: `Chain ${id}` })),
    tokens
  }
})
```

---

## 6. Rhino.fi (`rhino.ts`)

**API Endpoint**: `https://api.rhino.fi/bridge/configs`

**Response Structure**:
```typescript
type RhinoResponse = Record<string, {
  name: string
  networkId: number
  tokens: Record<string, {
    token: string
    address: string
    decimals: number
  }>
}>
```

**Critical Logic**:
- **Nested Structure**: Object keys are arbitrary, values contain chain config
- **Token Symbol**: Use object key (not `token` field) as symbol
- **Token Name**: Fallback to symbol if `token` field missing
- **Decimals Default**: Default to 18 if not provided
- **All EVM**: Rhino.fi only supports EVM chains (no filtering needed)

**Effect Migration**:
```typescript
export const fetchRhino = Effect.gen(function* () {
  const data = yield* fetchWithRetry("https://api.rhino.fi/bridge/configs")

  const chains = []
  const tokens = []

  for (const [_, chainConfig] of Object.entries(data)) {
    if (!chainConfig.networkId) continue

    chains.push({
      id: chainConfig.networkId,
      name: chainConfig.name
    })

    if (chainConfig.tokens) {
      for (const [symbol, tokenData] of Object.entries(chainConfig.tokens)) {
        if (!tokenData.address) continue

        tokens.push({
          address: normalizeAddress(tokenData.address),
          symbol: symbol,
          name: tokenData.token || symbol,
          decimals: tokenData.decimals || 18,
          chainId: chainConfig.networkId,
          rawData: tokenData
        })
      }
    }
  }

  return { chains, tokens }
})
```

---

## 7. GasZip (`gaszip.ts`)

**API Endpoint**: `https://backend.gas.zip/v2/chains`

**Response Structure**:
```typescript
interface GasZipResponse {
  chains: Array<{
    name: string
    chain: number
    symbol: string
    decimals: number
    mainnet: boolean
  }>
}
```

**Critical Logic**:
- **Mainnet Filter**: MUST filter where `mainnet === true`
- **Native Tokens Only**: GasZip only provides native gas tokens (not ERC20s)
- **Native Address**: Use `0x0000000000000000000000000000000000000000`
- **Name = Symbol**: GasZip doesn't provide full names, use symbol for both

**Effect Migration**:
```typescript
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"

export const fetchGasZip = Effect.gen(function* () {
  const data = yield* fetchWithRetry("https://backend.gas.zip/v2/chains")

  const mainnetChains = data.chains.filter(chain => chain.mainnet)

  const chains = mainnetChains.map(chain => ({
    id: chain.chain,
    name: chain.name
  }))

  const tokens = mainnetChains.map(chain => ({
    address: NATIVE_TOKEN_ADDRESS,
    symbol: chain.symbol,
    name: chain.symbol,
    decimals: chain.decimals,
    chainId: chain.chain,
    rawData: chain
  }))

  return { chains, tokens }
})
```

---

## 8. Across (`across.ts`)

**API Endpoints** (parallel):
1. `https://across.to/api/swap/chains`
2. `https://across.to/api/swap/tokens`

**Response Structures**:
```typescript
interface AcrossChain {
  chainId: number
  name: string
}

interface AcrossToken {
  address: string
  symbol: string
  name: string
  decimals: number
  chainId: number
  logoUrl?: string
}
```

**Critical Logic**:
- **Parallel Fetching**: Fetch both endpoints concurrently
- **Direct Mapping**: Tokens already include `chainId`, no key mapping needed
- **Logo Field**: Use `logoUrl` (not `logoURI`)
- **All EVM**: Across only supports EVM chains

**Effect Migration**:
```typescript
export const fetchAcross = Effect.gen(function* () {
  const [chainsData, tokensData] = yield* Effect.all([
    fetchWithRetry("https://across.to/api/swap/chains"),
    fetchWithRetry("https://across.to/api/swap/tokens")
  ])

  const chains = chainsData.map(chain => ({
    id: chain.chainId,
    name: chain.name
  }))

  const tokens = tokensData.map(token => ({
    address: normalizeAddress(token.address),
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    chainId: token.chainId,
    logoURI: token.logoUrl,
    rawData: token
  }))

  return { chains, tokens }
})
```

---

## 9. Aori (`aori.ts`)

**API Endpoints** (parallel):
1. `https://api.aori.io/chains`
2. `https://api.aori.io/tokens`

**Response Structures**:
```typescript
interface AoriChain {
  chainKey: string
  chainId: number
  eid: number
  address: string
}

interface AoriToken {
  symbol: string
  address: string
  chainId: number
  chainKey: string
}
```

**Critical Logic**:
- **Missing Metadata**: Aori doesn't provide:
  - Token names (use symbol as fallback)
  - Token decimals (default to 18)
- **Chain Name**: Use `chainKey` as name (no display name provided)
- **Direct Mapping**: Tokens include `chainId` directly

**Effect Migration**:
```typescript
export const fetchAori = Effect.gen(function* () {
  const [chainsData, tokensData] = yield* Effect.all([
    fetchWithRetry("https://api.aori.io/chains"),
    fetchWithRetry("https://api.aori.io/tokens")
  ])

  const chains = chainsData.map(chain => ({
    id: chain.chainId,
    name: chain.chainKey // Use chainKey as name
  }))

  const tokens = tokensData.map(token => ({
    address: normalizeAddress(token.address),
    symbol: token.symbol,
    name: token.symbol, // No name provided
    decimals: 18,       // Default
    chainId: token.chainId,
    rawData: token
  }))

  return { chains, tokens }
})
```

---

## 10. Eco (`eco.ts`)

**API**: None (static data)

**Critical Logic**:
- **Static Lists**: Hardcoded chains and tokens (no API available)
- **Source**: Based on Eco documentation
- **Multi-Chain Tokens**: Each token has `addresses: Record<chainId, address>`
- **Variants**: Includes bridged versions (USDCe, USDbC, USDT0, oUSDT)
- **Must Maintain**: Keep static data synchronized with Eco docs

**Data Structure**:
```typescript
// Source: https://eco.com/docs/getting-started/routes/chain-support
const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 10, name: "Optimism" },
  { id: 130, name: "Unichain" },
  { id: 137, name: "Polygon" },
  { id: 146, name: "Sonic" },
  { id: 480, name: "World Chain" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
  { id: 42220, name: "Celo" },
  { id: 57073, name: "Ink" }
]

const SUPPORTED_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    addresses: {
      1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      10: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      130: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      146: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
      480: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      42161: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      42220: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    }
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    addresses: {
      1: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      137: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      42220: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    }
  },
  {
    symbol: "USDCe",
    name: "Bridged USDC",
    decimals: 6,
    addresses: {
      10: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      42161: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
      57073: "0xF1815bd50389c46847f0Bda824eC8da914045D14",
    }
  },
  {
    symbol: "USDbC",
    name: "USD Base Coin",
    decimals: 6,
    addresses: {
      8453: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    }
  },
  {
    symbol: "oUSDT",
    name: "Omni USDT",
    decimals: 6,
    addresses: {
      1: "0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189",
      10: "0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189",
      8453: "0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189",
    }
  },
  {
    symbol: "USDT0",
    name: "USDT0",
    decimals: 6,
    addresses: {
      130: "0x9151434b16b9763660705744891fA906F660EcC5",
      42161: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      57073: "0x0200C29006150606B650577BBE7B6248F58470c1",
    }
  },
]
```

**Effect Migration**:
```typescript
export const fetchEco = Effect.gen(function* () {
  // No external fetch, but wrap in Effect for consistency
  const chains = SUPPORTED_CHAINS.map(chain => ({
    id: chain.id,
    name: chain.name
  }))

  const tokens = SUPPORTED_TOKENS.flatMap(tokenDef =>
    Object.entries(tokenDef.addresses).map(([chainIdStr, address]) => {
      const chainId = parseInt(chainIdStr, 10)
      return {
        address: normalizeAddress(address),
        symbol: tokenDef.symbol,
        name: tokenDef.name,
        decimals: tokenDef.decimals,
        chainId,
        rawData: { ...tokenDef, chainId, address } // Synthetic raw data
      }
    })
  )

  return { chains, tokens }
})
```

---

## 11. Meson (`meson.ts`)

**API Endpoint**: `https://relayer.meson.fi/api/v1/list`

**Response Structure**:
```typescript
interface MesonResponse {
  result: Array<{
    id: string
    name: string
    chainId: string  // Can be hex or decimal!
    tokens: Array<{
      id: string
      addr: string
    }>
  }>
}
```

**Critical Logic**:
- **Hex/Decimal ChainID**: MUST handle both formats:
  - If `chainId.startsWith("0x")` → parse as hex
  - Otherwise → parse as decimal
- **Missing Metadata**: Meson doesn't provide:
  - Token names (use uppercase `id` as symbol)
  - Token decimals (default to 18)
- **Symbol Normalization**: Convert token `id` to uppercase for symbol

**Effect Migration**:
```typescript
export const fetchMeson = Effect.gen(function* () {
  const data = yield* fetchWithRetry("https://relayer.meson.fi/api/v1/list")

  const chains = []
  const tokens = []

  for (const chain of data.result) {
    // CRITICAL: Handle hex and decimal chain IDs
    let chainId: number
    if (chain.chainId.startsWith("0x")) {
      chainId = parseInt(chain.chainId, 16)
    } else {
      chainId = parseInt(chain.chainId, 10)
    }

    if (isNaN(chainId)) continue

    chains.push({ id: chainId, name: chain.name })

    for (const token of chain.tokens) {
      if (!token.addr) continue

      tokens.push({
        address: normalizeAddress(token.addr),
        symbol: token.id.toUpperCase(),
        name: token.id.toUpperCase(),
        decimals: 18, // Default
        chainId,
        rawData: token
      })
    }
  }

  return { chains, tokens }
})
```

---

## 12. Butter (`butter.ts`)

**API Endpoints**:
1. Chains: `https://bs-tokens-api.chainservice.io/api/queryChainList`
2. Tokens (paginated): `https://bs-tokens-api.chainservice.io/api/queryTokenList?network={network}&pageSize=100`

**Response Structures**:
```typescript
interface ButterChainsResponse {
  code: number
  data: {
    chains: Array<{
      chainId: string
      name: string
      coin: string
    }>
  }
}

interface ButterTokensResponse {
  code: number
  data: {
    results: Array<{
      chainId: string
      address: string
      name: string
      symbol: string
      decimals: number
      image?: string
    }>
    count: number
  }
}
```

**Critical Logic**:
- **Limited Networks**: Only fetch major networks to avoid excessive requests:
  `["ethereum", "binance-smart-chain", "polygon", "arbitrum", "optimism"]`
- **Network Naming**: Build mapping from chain name to URL-safe network name (lowercase, hyphenated)
- **Pagination**: API supports pagination but we limit to `pageSize=100` per network
- **Error Tolerance**: Individual network failures should not abort operation
- **Response Codes**: Check `code` field for success

**Effect Migration**:
```typescript
const MAJOR_NETWORKS = [
  "ethereum",
  "binance-smart-chain",
  "polygon",
  "arbitrum",
  "optimism"
]

export const fetchButter = Effect.gen(function* () {
  const chainsData = yield* fetchWithRetry(
    "https://bs-tokens-api.chainservice.io/api/queryChainList"
  )

  const chains = chainsData.data.chains.map(chain => ({
    id: parseInt(chain.chainId, 10),
    name: chain.name
  }))

  // Fetch tokens for major networks in parallel
  const tokenResults = yield* Effect.all(
    MAJOR_NETWORKS.map(network =>
      Effect.gen(function* () {
        const data = yield* fetchWithRetry(
          `https://bs-tokens-api.chainservice.io/api/queryTokenList?network=${network}&pageSize=100`
        )

        return data.data.results.map(token => ({
          address: normalizeAddress(token.address),
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          chainId: parseInt(token.chainId, 10),
          logoURI: token.image,
          rawData: token
        }))
      }).pipe(
        Effect.catchAll(() => Effect.succeed([])) // Graceful failure
      )
    ),
    { concurrency: 5 } // Rate limiting
  )

  return { chains, tokens: tokenResults.flat() }
})
```

---

## Summary: Critical Patterns to Preserve

1. **EVM Filtering**: relay, debridge, stargate, mayan all require explicit EVM filtering
2. **Chain Inference**: lifi, mayan infer chains from token data (no separate endpoint)
3. **ID Mappings**: stargate (chainKey), mayan (wormhole), debridge (originalChainId)
4. **Address Validation**: debridge, mayan validate EVM address format
5. **Defaults**: aori (decimals=18), meson (decimals=18, uppercase symbols), rhino (decimals=18)
6. **Static Data**: eco has no API, must maintain hardcoded lists
7. **Hex Parsing**: meson handles hex chain IDs
8. **Rate Limiting**: butter limits to major networks, debridge fetches per-chain
9. **Native Tokens**: gaszip uses 0x000...000 placeholder
10. **Parallel Fetching**: across, stargate, aori fetch chains/tokens concurrently
11. **Raw Data Storage**: ALL providers must store original object in `raw_data` field