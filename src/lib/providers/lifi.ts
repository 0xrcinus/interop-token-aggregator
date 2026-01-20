import { Context, Effect, Layer } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import { HttpClient } from "@effect/platform"
import type { Scope } from "effect"
import { fetchJson } from "./http"
import { normalizeAddress } from "../aggregation/normalize"
import { categorizeToken } from "../aggregation/categorize"
import { isEvmChain } from "../aggregation/chain-mapping"
import { Chain, Token, ProviderResponse, ProviderError } from "./types"
import { createProviderFetch } from "./factory"

const PROVIDER_NAME = "lifi"
const API_URL = "https://li.quest/v1/tokens"

/**
 * Sanitize strings to remove null bytes that PostgreSQL doesn't allow
 */
const sanitize = (str: string | undefined) => str?.replace(/\0/g, "") || undefined

/**
 * LiFi Provider Service
 * The fetch effect requires HttpClient, Scope, and PgDrizzle which are provided by the layer
 */
export class LifiProvider extends Context.Tag("LifiProvider")<
  LifiProvider,
  {
    readonly fetch: Effect.Effect<ProviderResponse, ProviderError, HttpClient.HttpClient | Scope.Scope | Pg.PgDrizzle>
  }
>() {}

const make = Effect.gen(function* () {
  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      // Fetch response
      const rawResponse = yield* fetchJson(API_URL)

      // LiFi returns { "tokens": { "1": [...], "10": [...], ... } }
      // Extract the tokens object first
      const tokensObj = (rawResponse as any)?.tokens

      if (typeof tokensObj !== "object" || tokensObj === null) {
        return yield* new ProviderError({
          provider: PROVIDER_NAME,
          message: "Invalid LiFi response: expected tokens object",
          cause: rawResponse,
        })
      }

      // Infer chains from token data
      const chainIds = new Set<number>()
      const tokens: Token[] = []

      for (const [chainIdStr, chainTokens] of Object.entries(tokensObj)) {
        const chainId = parseInt(chainIdStr, 10)
        if (isNaN(chainId) || !Array.isArray(chainTokens)) continue

        chainIds.add(chainId)

        for (const token of chainTokens as any[]) {
          // Basic validation
          if (!token.address || !token.symbol || !token.name || typeof token.decimals !== "number") {
            continue
          }

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
            chainId: token.chainId || chainId,
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

/**
 * LiFi Provider Layer
 */
export const LifiProviderLive = Layer.effect(LifiProvider, make)
