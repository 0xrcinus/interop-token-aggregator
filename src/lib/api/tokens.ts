/**
 * Effect-based service layer for token API operations
 */

import { Effect, Context, Layer, Data } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import { SqlError } from "@effect/sql/SqlError"
import { tokens, chains } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

/**
 * Query parameters for token list
 */
export class TokenListQuery extends Data.Class<{
  readonly limit: number
  readonly offset: number
  readonly symbol?: string
  readonly tag?: string
  readonly chainId?: number
}> {}

export interface TokenAggregate {
  readonly symbol: string
  readonly providerCount: number
  readonly chainCount: number
  readonly totalInstances: number
  readonly providers: ReadonlyArray<string>
  readonly chains: ReadonlyArray<number>
  readonly name: string
  readonly decimals: number | null
  readonly logoUri: string | null
  readonly tags: ReadonlyArray<string>
}

export interface TokensResponse {
  readonly tokens: ReadonlyArray<TokenAggregate>
  readonly pagination: {
    readonly limit: number
    readonly offset: number
    readonly total: number
    readonly hasMore: boolean
  }
}

export interface TokenInstance {
  readonly provider: string
  readonly address: string
  readonly name: string
  readonly decimals: number | null
  readonly logoUri: string | null
  readonly tags: ReadonlyArray<string>
  readonly createdAt: Date
  readonly rawData: unknown
}

export interface TokenChainGroup {
  readonly chainId: number
  readonly chainName: string | null
  readonly instances: ReadonlyArray<TokenInstance>
}

export interface TokenConflict {
  readonly chainId: number
  readonly chainName: string | null
  readonly addresses: ReadonlyArray<string>
}

export interface TokenDetailResponse {
  readonly symbol: string
  readonly summary: {
    readonly totalInstances: number
    readonly providerCount: number
    readonly chainCount: number
    readonly uniqueAddresses: number
    readonly hasConflicts: boolean
  }
  readonly providers: ReadonlyArray<string>
  readonly chains: ReadonlyArray<TokenChainGroup>
  readonly conflicts?: ReadonlyArray<TokenConflict>
}

export class TokenApiError extends Data.TaggedError("TokenApiError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class TokenNotFoundError extends Data.TaggedError("TokenNotFoundError")<{
  readonly symbol: string
}> {}

export class TokenApiService extends Context.Tag("TokenApiService")<
  TokenApiService,
  {
    readonly getTokens: (
      query: TokenListQuery
    ) => Effect.Effect<TokensResponse, TokenApiError | SqlError>
    readonly getTokenBySymbol: (
      symbol: string
    ) => Effect.Effect<TokenDetailResponse, TokenApiError | TokenNotFoundError | SqlError>
  }
>() {}

const make = Effect.gen(function* () {
  const drizzle = yield* Pg.PgDrizzle

  const getTokens = (query: TokenListQuery) =>
    Effect.gen(function* () {
      // Build base query
      let dbQuery = drizzle
        .select({
          symbol: tokens.symbol,
          providerCount: sql<number>`COUNT(DISTINCT ${tokens.providerName})`,
          chainCount: sql<number>`COUNT(DISTINCT ${tokens.chainId})`,
          totalInstances: sql<number>`COUNT(*)`,
          providers: sql<string[]>`ARRAY_AGG(DISTINCT ${tokens.providerName})`,
          chains: sql<number[]>`ARRAY_AGG(DISTINCT ${tokens.chainId})`,
          name: sql<string>`MIN(${tokens.name})`,
          decimals: sql<number>`MODE() WITHIN GROUP (ORDER BY ${tokens.decimals})`,
          logoUri: sql<string | null>`(
            SELECT logo_uri
            FROM tokens t
            WHERE t.symbol = ${tokens.symbol}
            AND t.logo_uri IS NOT NULL
            LIMIT 1
          )`,
          tags: sql<string[]>`
            COALESCE(
              (
                SELECT array_agg(DISTINCT tag ORDER BY tag)
                FROM tokens t2,
                jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(t2.tags) = 'array' THEN t2.tags ELSE '[]'::jsonb END
                ) AS tag
                WHERE t2.symbol = tokens.symbol
              ),
              ARRAY[]::text[]
            )
          `,
        })
        .from(tokens)
        .$dynamic()

      // Apply symbol filter if provided
      if (query.symbol) {
        dbQuery = dbQuery.where(sql`${tokens.symbol} ILIKE ${`%${query.symbol}%`}`)
      }

      // Apply chainId filter if provided
      if (query.chainId !== undefined) {
        dbQuery = dbQuery.where(eq(tokens.chainId, query.chainId))
      }

      // Apply tag filter if provided
      if (query.tag) {
        dbQuery = dbQuery.where(
          sql`EXISTS (
            SELECT 1 FROM tokens t
            WHERE t.symbol = ${tokens.symbol}
            AND ${query.tag} = ANY(
              SELECT jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(t.tags) = 'array' THEN t.tags ELSE '[]'::jsonb END
              )
            )
          )`
        )
      }

      // Execute query with pagination
      const tokenList = yield* dbQuery
        .groupBy(tokens.symbol)
        .orderBy(sql`COUNT(DISTINCT ${tokens.providerName}) DESC`, tokens.symbol)
        .limit(query.limit)
        .offset(query.offset)

      // Get total count for pagination (respecting filters)
      let countQuery = drizzle
        .select({
          count: sql<number>`COUNT(DISTINCT ${tokens.symbol})`,
        })
        .from(tokens)
        .$dynamic()

      if (query.symbol) {
        countQuery = countQuery.where(sql`${tokens.symbol} ILIKE ${`%${query.symbol}%`}`)
      }

      if (query.chainId !== undefined) {
        countQuery = countQuery.where(eq(tokens.chainId, query.chainId))
      }

      if (query.tag) {
        countQuery = countQuery.where(
          sql`EXISTS (
            SELECT 1 FROM tokens t
            WHERE t.symbol = ${tokens.symbol}
            AND ${query.tag} = ANY(
              SELECT jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(t.tags) = 'array' THEN t.tags ELSE '[]'::jsonb END
              )
            )
          )`
        )
      }

      const totalCountResult = yield* countQuery
      const total = totalCountResult[0]?.count || 0

      // Ensure numeric fields are actually numbers (Drizzle sometimes returns strings)
      const parsedTokens = tokenList.map((token) => ({
        ...token,
        providerCount: Number(token.providerCount),
        chainCount: Number(token.chainCount),
        totalInstances: Number(token.totalInstances),
        decimals: token.decimals !== null ? Number(token.decimals) : null,
      }))

      return {
        tokens: parsedTokens,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: Number(total),
          hasMore: query.offset + query.limit < Number(total),
        },
      }
    }).pipe(Effect.mapError((error) => new TokenApiError({ message: "Failed to fetch tokens", cause: error })))

  const getTokenBySymbol = (symbol: string) =>
    Effect.gen(function* () {
      // Get all token instances for this symbol (case-insensitive)
      const tokenInstances = yield* drizzle
        .select({
          id: tokens.id,
          providerName: tokens.providerName,
          chainId: tokens.chainId,
          chainName: chains.name,
          address: tokens.address,
          symbol: tokens.symbol,
          name: tokens.name,
          decimals: tokens.decimals,
          logoUri: tokens.logoUri,
          tags: tokens.tags,
          createdAt: tokens.createdAt,
          rawData: tokens.rawData,
        })
        .from(tokens)
        .leftJoin(chains, eq(tokens.chainId, chains.chainId))
        .where(sql`UPPER(${tokens.symbol}) = UPPER(${symbol})`)
        .orderBy(tokens.providerName, tokens.chainId)

      // Check if token exists
      if (tokenInstances.length === 0) {
        return yield* new TokenNotFoundError({ symbol })
      }

      // Group instances by chain
      const byChain = tokenInstances.reduce(
        (acc, instance) => {
          const chainId = instance.chainId.toString()
          if (!acc[chainId]) {
            acc[chainId] = {
              chainId: instance.chainId,
              chainName: instance.chainName,
              instances: [],
            }
          }
          acc[chainId].instances.push({
            provider: instance.providerName,
            address: instance.address,
            name: instance.name,
            decimals: instance.decimals,
            logoUri: instance.logoUri,
            tags: Array.isArray(instance.tags) ? instance.tags : [],
            createdAt: instance.createdAt,
            rawData: instance.rawData,
          })
          return acc
        },
        {} as Record<string, TokenChainGroup & { instances: TokenInstance[] }>
      )

      // Calculate summary
      const providers = [...new Set(tokenInstances.map((t) => t.providerName))]
      const chainIds = [...new Set(tokenInstances.map((t) => t.chainId))]
      const addresses = [...new Set(tokenInstances.map((t) => t.address))]

      // Detect conflicts (same chain, different addresses)
      const conflicts = Object.values(byChain)
        .filter((chain) => {
          const uniqueAddresses = new Set(chain.instances.map((i) => i.address))
          return uniqueAddresses.size > 1
        })
        .map((chain) => ({
          chainId: chain.chainId,
          chainName: chain.chainName,
          addresses: [...new Set(chain.instances.map((i) => i.address))],
        }))

      return {
        symbol: tokenInstances[0].symbol,
        summary: {
          totalInstances: tokenInstances.length,
          providerCount: providers.length,
          chainCount: chainIds.length,
          uniqueAddresses: addresses.length,
          hasConflicts: conflicts.length > 0,
        },
        providers,
        chains: Object.values(byChain),
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      }
    }).pipe(
      Effect.catchAll((error: TokenNotFoundError | SqlError): Effect.Effect<never, TokenNotFoundError | TokenApiError> => {
        if (error._tag === "TokenNotFoundError") {
          return Effect.fail(error)
        }
        return Effect.fail(new TokenApiError({ message: "Failed to fetch token details", cause: error }))
      })
    )

  return { getTokens, getTokenBySymbol }
})

export const TokenApiServiceLive = Layer.effect(TokenApiService, make)
