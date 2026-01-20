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

const PROVIDER_NAME = "stargate"
const CHAINS_URL = "https://stargate.finance/api/v1/chains"
const TOKENS_URL = "https://stargate.finance/api/v1/tokens"

/**
 * Stargate API response schemas
 */
const StargateChainSchema = Schema.Struct({
  chainId: Schema.Number,
  name: Schema.String,
  chainKey: Schema.String,
  chainType: Schema.String,
})

const StargateChainsResponseSchema = Schema.Struct({
  chains: Schema.Array(StargateChainSchema),
})

const StargateTokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  chainKey: Schema.String,
  logoURI: Schema.optional(Schema.String),
})

const StargateTokensResponseSchema = Schema.Struct({
  tokens: Schema.Array(StargateTokenSchema),
})

/**
 * Stargate Provider Service
 */
export class StargateProvider extends Context.Tag("StargateProvider")<
  StargateProvider,
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

      const chainsResponse = yield* Schema.decodeUnknown(StargateChainsResponseSchema)(chainsRaw)
      const tokensResponse = yield* Schema.decodeUnknown(StargateTokensResponseSchema)(tokensRaw)

      console.log(
        `[${PROVIDER_NAME}] Received ${chainsResponse.chains.length} chains from API`
      )

      // Build chainKey → chainId mapping and filter EVM chains
      const chainKeyToId = new Map<string, number>()
      const chains: Chain[] = []

      for (const chain of chainsResponse.chains) {
        if (chain.chainType !== "evm") continue

        chains.push({
          id: chain.chainId,
          name: chain.name,
          vmType: chain.chainType, // Store VM type from provider ("evm")
          nativeCurrency: {
            name: "Unknown",
            symbol: "Unknown",
            decimals: 18,
          },
        })
        chainKeyToId.set(chain.chainKey, chain.chainId)
      }

      console.log(
        `[${PROVIDER_NAME}] Filtered to ${chains.length} EVM chains`
      )

      // Map tokens using chainKey
      const tokens: Token[] = tokensResponse.tokens
        .filter((token) => chainKeyToId.has(token.chainKey))
        .map((token) => {
          const chainId = chainKeyToId.get(token.chainKey)!
          const isEvm = isEvmChain(chainId)
          const address = normalizeAddress(token.address, isEvm)
          const tags = categorizeToken(token.symbol, token.name, address)

          return {
            address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            chainId,
            logoURI: token.logoURI,
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
 * Stargate Provider Layer
 */
export const StargateProviderLive = Layer.effect(StargateProvider, make)
