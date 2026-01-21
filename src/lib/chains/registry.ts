/**
 * Chain Registry Service
 * Fetches and enriches chain metadata from Chainlist (chainid.network)
 */

import { Effect, Schema } from "effect"
import { HttpClient } from "@effect/platform"

// Chainlist API response schema
const ChainlistChainSchema = Schema.Struct({
  name: Schema.String,
  chain: Schema.String,
  icon: Schema.optional(Schema.String),
  rpc: Schema.Array(Schema.String),
  faucets: Schema.optional(Schema.Array(Schema.String)),
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
        standard: Schema.String,
        icon: Schema.optional(Schema.String),
      })
    )
  ),
  features: Schema.optional(Schema.Array(Schema.Struct({ name: Schema.String }))),
  status: Schema.optional(Schema.String),
  testnet: Schema.optional(Schema.Boolean),
})

export type ChainlistChain = Schema.Schema.Type<typeof ChainlistChainSchema>

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
const CHAINLIST_API = "https://chainid.network/chains.json"

export class ChainRegistry extends Effect.Service<ChainRegistry>()("ChainRegistry", {
  effect: Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    const fetchAll = Effect.gen(function* () {
    console.log("[ChainRegistry] Fetching chain metadata from Chainlist...")

    // Fetch with timeout and retry
    const response = yield* client.get(CHAINLIST_API).pipe(
      Effect.flatMap((res) => res.json),
      Effect.timeout("30 seconds"),
      Effect.retry({ times: 2 }),
      Effect.mapError((error) =>
        new ChainRegistryError({
          message: "Failed to fetch from Chainlist API",
          cause: error,
        })
      )
    )

    // Parse and validate response
    const chains = yield* Schema.decodeUnknown(Schema.Array(ChainlistChainSchema))(
      response
    ).pipe(
      Effect.mapError((error) =>
        new ChainRegistryError({
          message: "Failed to parse Chainlist response",
          cause: error,
        })
      )
    )

    // Transform to our format
    const metadata: ChainMetadata[] = chains.map((chain) => ({
      chainId: chain.chainId,
      name: chain.name,
      shortName: chain.shortName,
      chainType: chain.testnet === true ? "testnet" : "mainnet",
      icon: chain.icon,
      infoUrl: chain.infoURL,
      explorers: chain.explorers?.map((e) => ({
        name: e.name,
        url: e.url,
        standard: e.standard,
      })),
      rpc: chain.rpc.filter((url) => !url.includes("${") && url.startsWith("http")) as string[], // Filter out template URLs
      faucets: chain.faucets as string[] | undefined,
      ens: chain.ens,
      features: chain.features as Array<{ name: string }> | undefined,
      nativeCurrency: chain.nativeCurrency,
    }))

    console.log(`[ChainRegistry] Successfully fetched metadata for ${metadata.length} chains`)

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
