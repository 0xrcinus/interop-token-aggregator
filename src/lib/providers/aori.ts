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

const PROVIDER_NAME = "aori"
const CHAINS_URL = "https://api.aori.io/chains"
const TOKENS_URL = "https://api.aori.io/tokens"

/**
 * Aori API response schemas
 */
const AoriChainSchema = Schema.Struct({
  chainKey: Schema.String,
  chainId: Schema.Number,
  eid: Schema.Number,
  address: Schema.String,
})

const AoriTokenSchema = Schema.Struct({
  symbol: Schema.String,
  address: Schema.String,
  chainId: Schema.Number,
  chainKey: Schema.String,
})

/**
 * Aori Provider Service
 */
export class AoriProvider extends Context.Tag("AoriProvider")<
  AoriProvider,
  {
    readonly fetch: Effect.Effect<ProviderResponse, ProviderError, HttpClient.HttpClient | Scope.Scope | Pg.PgDrizzle>
  }
>() {}

const make = Effect.gen(function* () {
  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      // Fetch both endpoints in parallel
      const [chainsRaw, tokensRaw] = yield* Effect.all([
        fetchJson(CHAINS_URL),
        fetchJson(TOKENS_URL),
      ])

      const chainsResponse = yield* Schema.decodeUnknown(Schema.Array(AoriChainSchema))(chainsRaw)
      const tokensResponse = yield* Schema.decodeUnknown(Schema.Array(AoriTokenSchema))(tokensRaw)

      console.log(
        `[${PROVIDER_NAME}] Received ${chainsResponse.length} chains from API`
      )

      // Map chains
      const chains: Chain[] = chainsResponse.map((chain) => ({
        id: chain.chainId,
        name: chain.chainKey, // Use chainKey as name
        nativeCurrency: {
          name: "Unknown",
          symbol: "Unknown",
          decimals: 18,
        },
      }))

      // Map tokens (missing metadata - use defaults)
      const tokens: Token[] = tokensResponse.map((token) => {
        const isEvm = isEvmChain(token.chainId)
        const address = normalizeAddress(token.address, isEvm)
        const tags = categorizeToken(token.symbol, token.symbol, address)

        return {
          address,
          symbol: token.symbol,
          name: token.symbol, // No name provided
          decimals: undefined, // Aori API doesn't provide decimals
          chainId: token.chainId,
          logoURI: undefined,
          tags,
        }
      })

      console.log(
        `[${PROVIDER_NAME}] Found ${chains.length} chains and ${tokens.length} tokens`
      )

      return { chains, tokens }
    })
  )

  return { fetch }
})

/**
 * Aori Provider Layer
 */
export const AoriProviderLive = Layer.effect(AoriProvider, make)
