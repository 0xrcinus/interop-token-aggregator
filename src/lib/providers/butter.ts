import { Effect, Schema } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "butter"
const CHAINS_URL = "https://bs-tokens-api.chainservice.io/api/queryChainList"
const TOKENS_URL_TEMPLATE = "https://bs-tokens-api.chainservice.io/api/queryTokenList?network="

// Limit to major networks to avoid excessive requests
const MAJOR_NETWORKS = [
  "ethereum",
  "binance-smart-chain",
  "polygon",
  "arbitrum",
  "optimism",
]

/**
 * Butter API response schemas
 */
const ButterChainSchema = Schema.Struct({
  chainId: Schema.String,
  name: Schema.String,
  coin: Schema.String,
})

const ButterChainsResponseSchema = Schema.Struct({
  code: Schema.Number,
  data: Schema.Struct({
    chains: Schema.Array(ButterChainSchema),
  }),
})

const ButterTokenSchema = Schema.Struct({
  chainId: Schema.String,
  address: Schema.String,
  name: Schema.String,
  symbol: Schema.String,
  decimals: Schema.Number,
  image: Schema.optional(Schema.String),
})

const ButterTokensResponseSchema = Schema.Struct({
  code: Schema.Number,
  data: Schema.Struct({
    results: Schema.Array(ButterTokenSchema),
    count: Schema.Number,
  }),
})

/**
 * Butter Provider Service
 */
export class ButterProvider extends Effect.Service<ButterProvider>()("ButterProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // Fetch chains list
        const chainsRaw = yield* fetchJson(CHAINS_URL)
        const chainsResponse = yield* Schema.decodeUnknown(ButterChainsResponseSchema)(chainsRaw)

        console.log(
          `[${PROVIDER_NAME}] Received ${chainsResponse.data.chains.length} chains from API`
        )

        const chains: Chain[] = chainsResponse.data.chains.map((chain) => ({
          id: parseInt(chain.chainId, 10),
          name: chain.name,
          nativeCurrency: {
            name: chain.coin,
            symbol: chain.coin,
            decimals: 18,
          },
        }))

        // Fetch tokens for major networks in parallel (with rate limiting)
        const tokenResults = yield* Effect.all(
          MAJOR_NETWORKS.map((network) =>
            Effect.gen(function* () {
              const tokensRaw = yield* fetchJson(
                `${TOKENS_URL_TEMPLATE}${network}&pageSize=100`
              )
              const tokensResponse = yield* Schema.decodeUnknown(ButterTokensResponseSchema)(tokensRaw)

              return tokensResponse.data.results.map((token) => {
                const chainId = parseInt(token.chainId, 10)
                const isEvm = isEvmChain(chainId)
                const address = normalizeAddress(token.address, isEvm)
                const tags = categorizeToken(token.symbol, token.name, address)

                return {
                  address,
                  symbol: token.symbol,
                  name: token.name,
                  decimals: token.decimals,
                  chainId: parseInt(token.chainId, 10),
                  logoURI: token.image,
                  tags,
                }
              })
            }).pipe(
              Effect.catchAll((error) => {
                console.log(`[${PROVIDER_NAME}] Failed to fetch tokens for ${network}: ${error}`)
                return Effect.succeed([])
              })
            )
          ),
          { concurrency: 5 } // Rate limiting
        )

        const tokens: Token[] = tokenResults.flat()

        console.log(
          `[${PROVIDER_NAME}] Found ${chains.length} chains and ${tokens.length} tokens`
        )

        return { chains, tokens }
      })
    )

    return { fetch }
  })
}) {}
