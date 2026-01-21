import { Effect, Schema } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "lifi"
const API_URL = "https://li.quest/v1/tokens"

/**
 * Sanitize strings to remove null bytes that PostgreSQL doesn't allow
 */
const sanitize = (str: string | undefined) => str?.replace(/\0/g, "") || undefined

/**
 * LiFi API response schemas
 */
const LifiTokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  chainId: Schema.optional(Schema.Number),
  logoURI: Schema.optional(Schema.String),
  priceUSD: Schema.optional(Schema.String),
})

// LiFi response structure: { "tokens": { "1": [tokens], "10": [tokens], ... } }
const LifiResponseSchema = Schema.Struct({
  tokens: Schema.Record({
    key: Schema.String,
    value: Schema.Array(LifiTokenSchema)
  }),
})

/**
 * LiFi Provider Service
 */
export class LifiProvider extends Effect.Service<LifiProvider>()("LifiProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // Fetch and validate response
        const rawResponse = yield* fetchJson(API_URL)
        const response = yield* Schema.decodeUnknown(LifiResponseSchema)(rawResponse)

        // Infer chains from token data
        const chainIds = new Set<number>()
        const tokens: Token[] = []

        for (const [chainIdStr, chainTokens] of Object.entries(response.tokens)) {
          const chainId = parseInt(chainIdStr, 10)
          if (isNaN(chainId)) continue

          chainIds.add(chainId)

          for (const token of chainTokens) {
            const tokenChainId = token.chainId || chainId
            const isEvm = isEvmChain(tokenChainId)
            const address = normalizeAddress(token.address, isEvm)
            const symbol = sanitize(token.symbol) || token.symbol
            const name = sanitize(token.name) || token.name
            const tags = categorizeToken(symbol, name, address)

            tokens.push({
              address,
              symbol,
              name,
              decimals: token.decimals,
              chainId: tokenChainId,
              logoURI: sanitize(token.logoURI),
              tags,
            })
          }
        }

        // Create chains with default names (LiFi doesn't provide chain names)
        const chains: Chain[] = Array.from(chainIds).map((id) => ({
          id,
          name: `Chain ${id}`,
          nativeCurrency: {
            name: "Unknown",
            symbol: "Unknown",
            decimals: 18,
          },
        }))

        return { chains, tokens }
      })
    )

    return { fetch }
  })
}) {}
