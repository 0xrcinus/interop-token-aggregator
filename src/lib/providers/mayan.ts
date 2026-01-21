import { Effect, Schema } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "mayan"
const API_URL = "https://price-api.mayan.finance/v3/tokens"

// Wormhole chain ID to EVM chain ID mapping
const WORMHOLE_TO_EVM_CHAIN: Record<number, number> = {
  2: 1,      // Ethereum
  4: 56,     // BSC
  5: 137,    // Polygon
  6: 43114,  // Avalanche
  10: 250,   // Fantom
  23: 42161, // Arbitrum
  24: 10,    // Optimism
  30: 8453,  // Base
}

// Non-EVM chains to exclude
const NON_EVM_CHAINS = new Set([
  "solana",
  "aptos",
  "sui",
  "ton",
  "tron",
  "cosmos",
  "osmosis",
  "injective",
  "sei",
])

// EVM address validation regex
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/**
 * Mayan API response schemas
 */
const MayanTokenSchema = Schema.Struct({
  name: Schema.String,
  symbol: Schema.String,
  mint: Schema.optional(Schema.String),      // Solana address
  contract: Schema.optional(Schema.String),  // EVM address
  chainId: Schema.optional(Schema.Number),
  wChainId: Schema.optional(Schema.Number),  // Wormhole chain ID
  decimals: Schema.Number,
  logoURI: Schema.optional(Schema.String),
})

const MayanResponseSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Array(MayanTokenSchema)
})

/**
 * Mayan Provider Service
 */
export class MayanProvider extends Effect.Service<MayanProvider>()("MayanProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // Fetch token data
        const raw = yield* fetchJson(API_URL)
        const response = yield* Schema.decodeUnknown(MayanResponseSchema)(raw)

        const chainIds = new Set<number>()
        const tokens: Token[] = []

        for (const [chainName, chainTokens] of Object.entries(response)) {
          if (!Array.isArray(chainTokens)) continue
          if (NON_EVM_CHAINS.has(chainName.toLowerCase())) continue

          for (const token of chainTokens) {
            // Use contract field for EVM chains
            const address = token.contract || ""
            if (!address || !EVM_ADDRESS_REGEX.test(address)) continue

            // Map wormhole ID to EVM ID
            const chainId = token.wChainId
              ? WORMHOLE_TO_EVM_CHAIN[token.wChainId]
              : token.chainId || 0

            if (!chainId) continue

            chainIds.add(chainId)

            const isEvm = isEvmChain(chainId)
            const normalizedAddress = normalizeAddress(address, isEvm)
            const tags = categorizeToken(token.symbol, token.name, normalizedAddress)

            tokens.push({
              address: normalizedAddress,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              chainId,
              logoURI: token.logoURI,
              tags,
            })
          }
        }

        // Infer chains from tokens
        const chains: Chain[] = Array.from(chainIds).map((id) => ({
          id,
          name: `Chain ${id}`,
          nativeCurrency: {
            name: "Unknown",
            symbol: "Unknown",
            decimals: 18,
          },
        }))

        console.log(
          `[${PROVIDER_NAME}] Found ${chains.length} chains and ${tokens.length} tokens`
        )

        return { chains, tokens }
      })
    )

    return { fetch }
  })
}) {}
