import { Effect, Schema } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "gaszip"
const API_URL = "https://backend.gas.zip/v2/chains"

// Native token address placeholder
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"

/**
 * GasZip API response schemas
 */
const GasZipChainSchema = Schema.Struct({
  name: Schema.String,
  chain: Schema.Number,
  symbol: Schema.String,
  decimals: Schema.Number,
  mainnet: Schema.Boolean,
})

const GasZipResponseSchema = Schema.Struct({
  chains: Schema.Array(GasZipChainSchema),
})

/**
 * GasZip Provider Service
 */
export class GasZipProvider extends Effect.Service<GasZipProvider>()("GasZipProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // Fetch chains data
        const raw = yield* fetchJson(API_URL)
        const response = yield* Schema.decodeUnknown(GasZipResponseSchema)(raw)

        console.log(
          `[${PROVIDER_NAME}] Received ${response.chains.length} chains from API`
        )

        // Filter mainnet chains only
        const mainnetChains = response.chains.filter((chain) => chain.mainnet)

        console.log(
          `[${PROVIDER_NAME}] Filtered to ${mainnetChains.length} mainnet chains`
        )

        const chains: Chain[] = mainnetChains.map((chain) => ({
          id: chain.chain,
          name: chain.name,
          nativeCurrency: {
            name: chain.symbol,
            symbol: chain.symbol,
            decimals: chain.decimals,
          },
        }))

        // GasZip only provides native gas tokens
        const tokens: Token[] = mainnetChains.map((chain) => {
          const isEvm = isEvmChain(chain.chain)
          const address = normalizeAddress(NATIVE_TOKEN_ADDRESS, isEvm)
          const tags = categorizeToken(chain.symbol, chain.symbol, address)

          return {
            address,
            symbol: chain.symbol,
            name: chain.symbol,
            decimals: chain.decimals,
            chainId: chain.chain,
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
}) {}
