/**
 * Chain Registry Service
 * Fetches and enriches chain metadata from multiple sources:
 * 1. Primary: chainlist.org/rpcs.json (higher quality data)
 * 2. Fallback: chainid.network/chains.json (more comprehensive)
 * 3. Manual overrides: manual-overrides.ts (corrections for incorrect data)
 *
 * Excludes testnets from both sources.
 */

import { Effect, Schema } from "effect"
import { HttpClient } from "@effect/platform"
import { applyManualOverrides } from "./manual-overrides"

// Base fields shared by both sources
// Using loose schemas to handle API changes gracefully

// Icon can be either a string or an object
const IconSchema = Schema.Union(
  Schema.String,
  Schema.Struct({
    url: Schema.String,
    format: Schema.optional(Schema.String),
    width: Schema.optional(Schema.Number),
    height: Schema.optional(Schema.Number),
  })
)

// Features can be array of strings or array of objects with name field
const FeaturesSchema = Schema.Union(
  Schema.Array(Schema.String),
  Schema.Array(Schema.Struct({ name: Schema.String }))
)

// Faucets can be a single string or array of strings
const FaucetsSchema = Schema.Union(
  Schema.String,
  Schema.Array(Schema.String)
)

const baseChainFields = {
  name: Schema.String,
  chain: Schema.String,
  icon: Schema.optional(IconSchema),
  faucets: Schema.optional(FaucetsSchema),
  nativeCurrency: Schema.Struct({
    name: Schema.String,
    symbol: Schema.String,
    decimals: Schema.Number,
  }),
  infoURL: Schema.optional(Schema.String),
  shortName: Schema.String,
  chainId: Schema.Number,
  networkId: Schema.optional(Schema.Number),
  slip44: Schema.optional(Schema.Number),
  ens: Schema.optional(
    Schema.Struct({
      registry: Schema.optional(Schema.String),
    })
  ),
  explorers: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        url: Schema.String,
        standard: Schema.optional(Schema.String), // Optional to handle missing standard field
        icon: Schema.optional(Schema.String),
      })
    )
  ),
  features: Schema.optional(FeaturesSchema),
  status: Schema.optional(Schema.String),
}

// Schema for chainlist.org (uses isTestnet, rpc is array of objects)
const ChainlistOrgSchema = Schema.Struct({
  ...baseChainFields,
  isTestnet: Schema.Boolean,
  rpc: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      tracking: Schema.optional(Schema.String),
      isOpenSource: Schema.optional(Schema.Boolean),
    })
  ),
  chainSlug: Schema.optional(Schema.String),
  tvl: Schema.optional(Schema.Number),
})

// Schema for chainid.network (uses testnet, rpc is array of strings)
const ChainidNetworkSchema = Schema.Struct({
  ...baseChainFields,
  testnet: Schema.optional(Schema.Boolean),
  rpc: Schema.Array(Schema.String),
})

export type ChainlistOrgChain = Schema.Schema.Type<typeof ChainlistOrgSchema>
export type ChainidNetworkChain = Schema.Schema.Type<typeof ChainidNetworkSchema>
export type ChainlistChain = ChainlistOrgChain | ChainidNetworkChain

export interface ChainMetadata {
  chainId: number
  name: string
  shortName: string
  chainType: "mainnet" | "testnet"
  icon?: string
  infoUrl?: string
  explorers?: Array<{
    name: string
    url: string
    standard: string
  }>
  rpc?: string[]
  faucets?: string[]
  ens?: { registry?: string }
  features?: Array<{ name: string }>
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

export class ChainRegistryError extends Schema.TaggedError<ChainRegistryError>()(
  "ChainRegistryError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Chain Registry Service
 * Provides access to chain metadata from Chainlist
 */
const CHAINLIST_ORG_API = "https://chainlist.org/rpcs.json"
const CHAINID_NETWORK_API = "https://chainid.network/chains.json"

/**
 * Helper to check if a chain is a testnet
 */
const isTestnetOrg = (chain: ChainlistOrgChain): boolean => {
  // Explicit isTestnet field
  if (chain.isTestnet === true) return true

  // Check name for testnet indicators
  const name = chain.name.toLowerCase()
  const testnetKeywords = [
    'testnet',
    'test net',
    'sepolia',
    'goerli',
    'ropsten',
    'rinkeby',
    'kovan',
    'mumbai',
    'fuji',
    'chapel',
    'sandbox',
  ]

  return testnetKeywords.some(keyword => name.includes(keyword))
}

const isTestnetNetwork = (chain: ChainidNetworkChain): boolean => {
  // Explicit testnet field
  if (chain.testnet === true) return true

  // Check name for testnet indicators
  const name = chain.name.toLowerCase()
  const testnetKeywords = [
    'testnet',
    'test net',
    'sepolia',
    'goerli',
    'ropsten',
    'rinkeby',
    'kovan',
    'mumbai',
    'fuji',
    'chapel',
    'sandbox',
  ]

  return testnetKeywords.some(keyword => name.includes(keyword))
}

/**
 * Transforms raw chain data to our format
 */
const transformChainOrg = (chain: ChainlistOrgChain): ChainMetadata => {
  // Normalize icon: extract URL if it's an object, keep string as-is
  const icon = chain.icon
    ? typeof chain.icon === 'string'
      ? chain.icon
      : chain.icon.url
    : undefined

  // Normalize faucets: ensure it's always an array
  const faucets = chain.faucets
    ? typeof chain.faucets === 'string'
      ? [chain.faucets]
      : chain.faucets
    : undefined

  // Normalize features: convert string array to object array if needed
  const features = chain.features
    ? Array.isArray(chain.features) && chain.features.length > 0
      ? typeof chain.features[0] === 'string'
        ? (chain.features as string[]).map(name => ({ name }))
        : (chain.features as Array<{ name: string }>)
      : undefined
    : undefined

  return {
    chainId: chain.chainId,
    name: chain.name,
    shortName: chain.shortName,
    chainType: isTestnetOrg(chain) ? "testnet" : "mainnet",
    icon,
    infoUrl: chain.infoURL,
    explorers: chain.explorers?.map((e) => ({
      name: e.name,
      url: e.url,
      standard: e.standard || "unknown",
    })) as Array<{ name: string; url: string; standard: string }> | undefined,
    rpc: chain.rpc
      .map((rpcObj) => rpcObj.url)
      .filter((url) => !url.includes("${") && url.startsWith("http")) as string[],
    faucets: faucets as string[] | undefined,
    ens: chain.ens,
    features: features as Array<{ name: string }> | undefined,
    nativeCurrency: chain.nativeCurrency,
  }
}

const transformChainNetwork = (chain: ChainidNetworkChain): ChainMetadata => {
  // Normalize icon: extract URL if it's an object, keep string as-is
  const icon = chain.icon
    ? typeof chain.icon === 'string'
      ? chain.icon
      : chain.icon.url
    : undefined

  // Normalize faucets: ensure it's always an array
  const faucets = chain.faucets
    ? typeof chain.faucets === 'string'
      ? [chain.faucets]
      : chain.faucets
    : undefined

  // Normalize features: convert string array to object array if needed
  const features = chain.features
    ? Array.isArray(chain.features) && chain.features.length > 0
      ? typeof chain.features[0] === 'string'
        ? (chain.features as string[]).map(name => ({ name }))
        : (chain.features as Array<{ name: string }>)
      : undefined
    : undefined

  return {
    chainId: chain.chainId,
    name: chain.name,
    shortName: chain.shortName,
    chainType: isTestnetNetwork(chain) ? "testnet" : "mainnet",
    icon,
    infoUrl: chain.infoURL,
    explorers: chain.explorers?.map((e) => ({
      name: e.name,
      url: e.url,
      standard: e.standard || "unknown",
    })) as Array<{ name: string; url: string; standard: string }> | undefined,
    rpc: chain.rpc.filter((url) => !url.includes("${") && url.startsWith("http")) as string[],
    faucets: faucets as string[] | undefined,
    ens: chain.ens,
    features: features as Array<{ name: string }> | undefined,
    nativeCurrency: chain.nativeCurrency,
  }
}

export class ChainRegistry extends Effect.Service<ChainRegistry>()("ChainRegistry", {
  effect: Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    const fetchAll = Effect.gen(function* () {
        console.log("[ChainRegistry] Fetching chain metadata from chainlist.org (primary)...")

        // Fetch from primary source (chainlist.org)
        const primaryResponse = yield* client.get(CHAINLIST_ORG_API).pipe(
          Effect.flatMap((res) => res.json),
          Effect.timeout("30 seconds"),
          Effect.retry({ times: 2 }),
          Effect.mapError((error) =>
            new ChainRegistryError({
              message: "Failed to fetch from chainlist.org",
              cause: error,
            })
          ),
          Effect.orElse(() => Effect.succeed(null)) // Don't fail if primary source is down
        )

        let primaryChains: readonly ChainlistOrgChain[] = []
        if (primaryResponse !== null) {
          primaryChains = yield* Schema.decodeUnknown(
            Schema.Array(ChainlistOrgSchema),
            { errors: "all", onExcessProperty: "ignore" }
          )(primaryResponse).pipe(
            Effect.tapError((error) =>
              Effect.sync(() => {
                console.error("[ChainRegistry] Failed to parse chainlist.org response:", error)
              })
            ),
            Effect.orElse(() => {
              console.warn("[ChainRegistry] Falling back due to parse error, using empty array")
              return Effect.succeed([] as const)
            })
          )
        }

        console.log(`[ChainRegistry] Fetched ${primaryChains.length} chains from chainlist.org`)
        console.log("[ChainRegistry] Fetching chain metadata from chainid.network (fallback)...")

        // Fetch from fallback source (chainid.network)
        const fallbackResponse = yield* client.get(CHAINID_NETWORK_API).pipe(
          Effect.flatMap((res) => res.json),
          Effect.timeout("30 seconds"),
          Effect.retry({ times: 2 }),
          Effect.mapError((error) =>
            new ChainRegistryError({
              message: "Failed to fetch from chainid.network",
              cause: error,
            })
          )
        )

        const fallbackChains = yield* Schema.decodeUnknown(
          Schema.Array(ChainidNetworkSchema),
          { errors: "all", onExcessProperty: "ignore" }
        )(fallbackResponse).pipe(
          Effect.mapError((error) =>
            new ChainRegistryError({
              message: "Failed to parse chainid.network response",
              cause: error,
            })
          )
        )

        console.log(`[ChainRegistry] Fetched ${fallbackChains.length} chains from chainid.network`)

        // Merge chains: primary source takes precedence
        const chainMap = new Map<number, ChainMetadata>()

        // Add fallback chains first
        for (const chain of fallbackChains) {
          if (!isTestnetNetwork(chain)) {
            chainMap.set(chain.chainId, transformChainNetwork(chain))
          }
        }

        // Override with primary chains (higher quality data)
        for (const chain of primaryChains) {
          if (!isTestnetOrg(chain)) {
            chainMap.set(chain.chainId, transformChainOrg(chain))
          }
        }

        // Get final metadata array and apply manual overrides
        const metadata: ChainMetadata[] = Array.from(chainMap.values()).map(applyManualOverrides)

        console.log(`[ChainRegistry] Successfully merged ${metadata.length} mainnet chains (with manual overrides applied)`)

        return metadata
      }).pipe(Effect.scoped)

    const fetchByChainId = (chainId: number) =>
      Effect.gen(function* () {
        const allChains = yield* fetchAll
        return allChains.find((c) => c.chainId === chainId) ?? null
      })

    return { fetchAll, fetchByChainId }
  })
}) {}
