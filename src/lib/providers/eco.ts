import { Effect } from "effect"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import type { Chain, Token, ProviderResponse } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "eco"

/**
 * Static data from Eco documentation
 * Source: https://eco.com/docs/getting-started/routes/chain-support
 */
const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 10, name: "Optimism" },
  { id: 130, name: "Unichain" },
  { id: 137, name: "Polygon" },
  { id: 146, name: "Sonic" },
  { id: 480, name: "World Chain" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
  { id: 42220, name: "Celo" },
  { id: 57073, name: "Ink" },
]

const SUPPORTED_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    addresses: {
      1: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      10: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      130: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      146: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
      480: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      42161: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      42220: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    },
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    addresses: {
      1: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      137: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
      42220: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    },
  },
  {
    symbol: "USDCe",
    name: "Bridged USDC",
    decimals: 6,
    addresses: {
      10: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      42161: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
      57073: "0xF1815bd50389c46847f0Bda824eC8da914045D14",
    },
  },
  {
    symbol: "USDbC",
    name: "USD Base Coin",
    decimals: 6,
    addresses: {
      8453: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    },
  },
  {
    symbol: "oUSDT",
    name: "Omni USDT",
    decimals: 6,
    addresses: {
      1: "0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189",
      10: "0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189",
      8453: "0x1217bfe6c773eec6cc4a38b5dc45b92292b6e189",
    },
  },
  {
    symbol: "USDT0",
    name: "USDT0",
    decimals: 6,
    addresses: {
      130: "0x9151434b16b9763660705744891fA906F660EcC5",
      42161: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      57073: "0x0200C29006150606B650577BBE7B6248F58470c1",
    },
  },
]

/**
 * Eco Provider Service
 */
export class EcoProvider extends Effect.Service<EcoProvider>()("EcoProvider", {
  effect: Effect.gen(function* () {
    const fetch = createProviderFetch(
      PROVIDER_NAME,
      Effect.gen(function* () {
        // No external fetch - static data
        const chains: Chain[] = SUPPORTED_CHAINS.map((chain) => ({
          id: chain.id,
          name: chain.name,
          nativeCurrency: {
            name: "Unknown",
            symbol: "Unknown",
            decimals: 18,
          },
        }))

        const tokens: Token[] = SUPPORTED_TOKENS.flatMap((tokenDef) =>
          Object.entries(tokenDef.addresses).map(([chainIdStr, address]) => {
            const chainId = parseInt(chainIdStr, 10)
            const isEvm = isEvmChain(chainId)
            const normalizedAddress = normalizeAddress(address, isEvm)
            const tags = categorizeToken(tokenDef.symbol, tokenDef.name, normalizedAddress)

            return {
              address: normalizedAddress,
              symbol: tokenDef.symbol,
              name: tokenDef.name,
              decimals: tokenDef.decimals,
              chainId,
              logoURI: undefined,
              tags,
            }
          })
        )

        console.log(
          `[${PROVIDER_NAME}] Found ${chains.length} chains and ${tokens.length} tokens`
        )

        return { chains, tokens }
      })
    )

    return { fetch }
  })
}) {}
