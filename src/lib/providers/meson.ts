import { Effect, Schema } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "meson"
const API_URL = "https://relayer.meson.fi/api/v1/list"

/**
 * Meson API response schemas
 */
const MesonTokenSchema = Schema.Struct({
  id: Schema.String,
  addr: Schema.optional(Schema.String), // Some tokens don't have addr
})

const MesonChainSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  chainId: Schema.String, // Can be hex or decimal!
  tokens: Schema.Array(MesonTokenSchema),
})

const MesonResponseSchema = Schema.Struct({
  result: Schema.Array(MesonChainSchema),
})

/**
 * Meson Provider Service
 */
export class MesonProvider extends Effect.Service<MesonProvider>()("MesonProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // Fetch chain/token data
        const raw = yield* fetchJson(API_URL)
        const response = yield* Schema.decodeUnknown(MesonResponseSchema)(raw)

        const chains: Chain[] = []
        const tokens: Token[] = []

        for (const chain of response.result) {
          // Handle hex and decimal chain IDs
          let chainId: number
          if (chain.chainId.startsWith("0x")) {
            chainId = parseInt(chain.chainId, 16)
          } else {
            chainId = parseInt(chain.chainId, 10)
          }

          if (isNaN(chainId)) continue

          chains.push({
            id: chainId,
            name: chain.name,
            nativeCurrency: {
              name: "Unknown",
              symbol: "Unknown",
              decimals: 18,
            },
          })

          for (const token of chain.tokens) {
            if (!token.addr) continue

            const isEvm = isEvmChain(chainId)
            const address = normalizeAddress(token.addr, isEvm)
            const symbol = token.id.toUpperCase()
            const tags = categorizeToken(symbol, symbol, address)

            tokens.push({
              address,
              symbol,
              name: symbol, // No name provided
              decimals: undefined, // Meson API doesn't provide decimals
              chainId,
              logoURI: undefined,
              tags,
            })
          }
        }

        console.log(
          `[${PROVIDER_NAME}] Found ${chains.length} chains and ${tokens.length} tokens`
        )

        return { chains, tokens }
      })
    )

    return { fetch }
  })
}) {}
