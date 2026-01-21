import { Effect, Schema } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "debridge"
const CHAINS_URL = "https://dln.debridge.finance/v1.0/supported-chains-info"
const TOKENS_URL_TEMPLATE = "https://dln.debridge.finance/v1.0/token-list?chainId="

// Non-EVM chain IDs to exclude
const NON_EVM_CHAIN_IDS = new Set([
  7565164,   // Solana
  100000026, // Tron
  100000027, // Sei
  100000029, // Injective
])

// EVM address validation regex
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/**
 * DeBridge API response schemas
 */
const DebridgeChainSchema = Schema.Struct({
  chainId: Schema.Number,
  originalChainId: Schema.optional(Schema.Number),
  chainName: Schema.String,
})

const DebridgeChainsResponseSchema = Schema.Struct({
  chains: Schema.Array(DebridgeChainSchema),
})

const DebridgeTokenSchema = Schema.Struct({
  symbol: Schema.optional(Schema.String), // Some tokens are missing symbol
  name: Schema.optional(Schema.String),   // Some tokens are missing name
  decimals: Schema.optional(Schema.Number), // Some tokens are missing decimals
  address: Schema.String,
  logoURI: Schema.optional(Schema.String),
})

const DebridgeTokensResponseSchema = Schema.Struct({
  tokens: Schema.Record({
    key: Schema.String,
    value: DebridgeTokenSchema
  })
})

/**
 * DeBridge Provider Service
 */
export class DebridgeProvider extends Effect.Service<DebridgeProvider>()("DebridgeProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // Fetch chains list
        const chainsRaw = yield* fetchJson(CHAINS_URL)
        const chainsResponse = yield* Schema.decodeUnknown(DebridgeChainsResponseSchema)(chainsRaw)

        console.log(
          `[${PROVIDER_NAME}] Received ${chainsResponse.chains.length} chains from API`
        )

        // Filter EVM chains
        const evmChains = chainsResponse.chains.filter(
          (chain) => !NON_EVM_CHAIN_IDS.has(chain.chainId)
        )

        console.log(
          `[${PROVIDER_NAME}] Filtered to ${evmChains.length} EVM chains`
        )

        const chains: Chain[] = evmChains.map((chain) => ({
          id: chain.originalChainId || chain.chainId,
          name: chain.chainName,
          nativeCurrency: {
            name: "Unknown",
            symbol: "Unknown",
            decimals: 18,
          },
        }))

        // Fetch tokens per chain in parallel (with error handling)
        const tokenResults = yield* Effect.all(
          evmChains.map((chain) =>
            Effect.gen(function* () {
              const chainId = chain.originalChainId || chain.chainId
              const tokensRaw = yield* fetchJson(TOKENS_URL_TEMPLATE + chain.chainId)
              const tokensResponse = yield* Schema.decodeUnknown(DebridgeTokensResponseSchema)(tokensRaw)

              return Object.values(tokensResponse.tokens)
                .filter((token) => token.symbol && token.name && token.decimals !== undefined && EVM_ADDRESS_REGEX.test(token.address))
                .map((token) => {
                  const isEvm = isEvmChain(chainId)
                  const address = normalizeAddress(token.address, isEvm)
                  const tags = categorizeToken(token.symbol!, token.name!, address)

                  return {
                    address,
                    symbol: token.symbol!,
                    name: token.name!,
                    decimals: token.decimals,
                    chainId,
                    logoURI: token.logoURI,
                    tags,
                  }
                })
            }).pipe(
              Effect.catchAll((error) => {
                console.log(`[${PROVIDER_NAME}] Failed to fetch tokens for chain ${chain.chainId}: ${error}`)
                return Effect.succeed([])
              })
            )
          ),
          { concurrency: "unbounded" }
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
