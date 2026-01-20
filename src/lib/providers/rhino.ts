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

const PROVIDER_NAME = "rhino"
const API_URL = "https://api.rhino.fi/bridge/configs"

/**
 * Rhino.fi API response schemas
 */
const RhinoTokenSchema = Schema.Struct({
  token: Schema.optional(Schema.String),
  address: Schema.String,
  decimals: Schema.optional(Schema.Number),
})

const RhinoChainConfigSchema = Schema.Struct({
  name: Schema.String,
  networkId: Schema.Union(Schema.Number, Schema.String), // Can be number or string
  tokens: Schema.optional(Schema.Record({
    key: Schema.String,
    value: RhinoTokenSchema
  })),
})

const RhinoResponseSchema = Schema.Record({
  key: Schema.String,
  value: RhinoChainConfigSchema
})

/**
 * Rhino.fi Provider Service
 */
export class RhinoProvider extends Context.Tag("RhinoProvider")<
  RhinoProvider,
  {
    readonly fetch: Effect.Effect<ProviderResponse, ProviderError, HttpClient.HttpClient | Scope.Scope | Pg.PgDrizzle>
  }
>() {}

const make = Effect.gen(function* () {
  const fetch = createProviderFetch(
    PROVIDER_NAME,
    Effect.gen(function* () {
      // Fetch config data
      const raw = yield* fetchJson(API_URL)
      const response = yield* Schema.decodeUnknown(RhinoResponseSchema)(raw)

      const chains: Chain[] = []
      const tokens: Token[] = []

      for (const [_, chainConfig] of Object.entries(response)) {
        if (!chainConfig.networkId) continue

        const chainId = typeof chainConfig.networkId === "number"
          ? chainConfig.networkId
          : parseInt(chainConfig.networkId, 10)

        if (isNaN(chainId)) continue

        chains.push({
          id: chainId,
          name: chainConfig.name,
          nativeCurrency: {
            name: "Unknown",
            symbol: "Unknown",
            decimals: 18,
          },
        })

        if (chainConfig.tokens) {
          for (const [symbol, tokenData] of Object.entries(chainConfig.tokens)) {
            if (!tokenData.address) continue

            const isEvm = isEvmChain(chainId)
            const address = normalizeAddress(tokenData.address, isEvm)
            const name = tokenData.token || symbol
            const tags = categorizeToken(symbol, name, address)

            tokens.push({
              address,
              symbol,
              name,
              decimals: tokenData.decimals || 18,
              chainId,
              logoURI: undefined,
              tags,
            })
          }
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

/**
 * Rhino.fi Provider Layer
 */
export const RhinoProviderLive = Layer.effect(RhinoProvider, make)
