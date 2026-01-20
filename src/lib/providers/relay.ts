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

const PROVIDER_NAME = "relay"
const API_URL = "https://api.relay.link/chains"

/**
 * Relay API response schemas
 */
const RelayNativeCurrencySchema = Schema.Struct({
  name: Schema.String,
  symbol: Schema.String,
  decimals: Schema.Number,
})

const RelayTokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  logoURI: Schema.optional(Schema.String),
})

const RelayChainSchema = Schema.Struct({
  id: Schema.Union(Schema.String, Schema.Number),
  name: Schema.String,
  displayName: Schema.optional(Schema.String),
  vmType: Schema.optional(Schema.String),
  nativeCurrency: Schema.optional(RelayNativeCurrencySchema),
  solverCurrencies: Schema.optional(Schema.Array(RelayTokenSchema)),
})

const RelayResponseSchema = Schema.Struct({
  chains: Schema.Array(RelayChainSchema),
})

/**
 * Relay Provider Service
 * The fetch effect requires HttpClient, Scope, and PgDrizzle which are provided by the layer
 */
export class RelayProvider extends Context.Tag("RelayProvider")<
  RelayProvider,
  {
    readonly fetch: Effect.Effect<ProviderResponse, ProviderError, HttpClient.HttpClient | Scope.Scope | Pg.PgDrizzle>
  }
>() {}

const make = Effect.gen(function* () {
  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      // Fetch and validate response
      const rawResponse = yield* fetchJson(API_URL)
      const response = yield* Schema.decodeUnknown(RelayResponseSchema)(rawResponse)

      console.log(
        `[${PROVIDER_NAME}] Found ${response.chains.length} chains`
      )

      // Transform to normalized format
      const chains: Chain[] = response.chains.map((chain) => ({
        id: typeof chain.id === "number" ? chain.id : parseInt(chain.id),
        name: chain.displayName || chain.name,
        vmType: chain.vmType, // Store VM type from provider
        nativeCurrency: chain.nativeCurrency || {
          name: "Unknown",
          symbol: "Unknown",
          decimals: 18,
        },
      }))

      // Extract tokens from solverCurrencies
      const tokens: Token[] = response.chains.flatMap((chain) => {
        const chainId = typeof chain.id === "number" ? chain.id : parseInt(chain.id)
        const isEvm = isEvmChain(chainId)
        return (chain.solverCurrencies || []).map((token) => {
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
      })

      console.log(`[${PROVIDER_NAME}] Extracted ${tokens.length} tokens`)

      return { chains, tokens }
    })
  )

  return { fetch }
})

/**
 * Relay Provider Layer
 * Note: Requires HttpClient to be provided separately
 */
export const RelayProviderLive = Layer.effect(RelayProvider, make)
