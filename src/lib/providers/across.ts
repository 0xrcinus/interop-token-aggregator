import { Context, Effect, Layer } from "effect"
import * as Schema from "@effect/schema/Schema"
import * as Pg from "@effect/sql-drizzle/Pg"
import { HttpClient } from "@effect/platform"
import type { Scope } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import { Chain, Token, ProviderResponse, ProviderError } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "across"
const CHAINS_API_URL = "https://across.to/api/swap/chains"
const TOKENS_API_URL = "https://across.to/api/swap/tokens"

/**
 * Across API response schemas
 */
const AcrossChainSchema = Schema.Struct({
  chainId: Schema.Number,
  name: Schema.String,
})

const AcrossTokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  chainId: Schema.Number,
  logoUrl: Schema.optional(Schema.String),
})

/**
 * Across Provider Service
 * The fetch effect requires HttpClient, Scope, and PgDrizzle which are provided by the layer
 */
export class AcrossProvider extends Context.Tag("AcrossProvider")<
  AcrossProvider,
  {
    readonly fetch: Effect.Effect<ProviderResponse, ProviderError, HttpClient.HttpClient | Scope.Scope | Pg.PgDrizzle>
  }
>() {}

const make = Effect.gen(function* () {
  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      // Fetch chains and tokens in parallel
      const [chainsData, tokensData] = yield* Effect.all([
        fetchJson(CHAINS_API_URL),
        fetchJson(TOKENS_API_URL),
      ])

      // Validate responses
      const chainsArray = yield* Schema.decodeUnknown(
        Schema.Array(AcrossChainSchema)
      )(chainsData)
      const tokensArray = yield* Schema.decodeUnknown(
        Schema.Array(AcrossTokenSchema)
      )(tokensData)

      console.log(`[${PROVIDER_NAME}] Received ${chainsArray.length} chains from API`)

      // Transform to normalized format
      // Deduplicate chains by chainId to avoid duplicate insertion errors
      const chainMap = new Map<number, Chain>()
      for (const chain of chainsArray) {
        if (!chainMap.has(chain.chainId)) {
          chainMap.set(chain.chainId, {
            id: chain.chainId,
            name: chain.name,
            nativeCurrency: {
              name: "Unknown",
              symbol: "Unknown",
              decimals: 18,
            },
          })
        }
      }
      const chains: Chain[] = Array.from(chainMap.values())

      console.log(`[${PROVIDER_NAME}] Deduplicated to ${chains.length} unique chains`)

      const tokens: Token[] = tokensArray.map((token) => {
        const isEvm = isEvmChain(token.chainId)
        const address = normalizeAddress(token.address, isEvm)
        const tags = categorizeToken(token.symbol, token.name, address)

        return {
          address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          chainId: token.chainId,
          logoURI: token.logoUrl,
          tags,
        }
      })

      return { chains, tokens }
    })
  )

  return { fetch }
})

/**
 * Across Provider Layer
 */
export const AcrossProviderLive = Layer.effect(AcrossProvider, make)
