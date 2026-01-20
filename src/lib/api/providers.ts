/**
 * Effect-based service layer for provider API operations
 * This demonstrates Effect patterns for database queries and error handling
 */

import { Effect, Context, Layer } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import { SqlError } from "@effect/sql/SqlError"
import { providerFetches, tokens } from "@/lib/db/schema"
import { sql, eq } from "drizzle-orm"

/**
 * Provider summary statistics
 */
export interface ProviderSummary {
  readonly name: string
  readonly status: "healthy" | "error"
  readonly lastFetchedAt: Date
  readonly successRate: string
  readonly stats: {
    readonly totalFetches: number
    readonly successfulFetches: number
    readonly failedFetches: number
  }
  readonly lastFetch: {
    readonly success: boolean
    readonly chainsCount: number | null
    readonly tokensCount: number | null
    readonly error: string | null
  }
}

export interface ProvidersResponse {
  readonly providers: ReadonlyArray<ProviderSummary>
  readonly summary: {
    readonly total: number
    readonly healthy: number
    readonly error: number
  }
}

export interface ProviderMetadata {
  readonly provider: string
  readonly totalTokens: number
  readonly uniqueSymbols: number
}

/**
 * Custom error types for provider API operations
 */
export class ProviderApiError extends Error {
  readonly _tag = "ProviderApiError"
  constructor(readonly message: string, readonly cause?: unknown) {
    super(message)
  }
}

/**
 * Provider API Service
 * Demonstrates Effect Context.Tag pattern for dependency injection
 */
export class ProviderApiService extends Context.Tag("ProviderApiService")<
  ProviderApiService,
  {
    readonly getProviders: Effect.Effect<ProvidersResponse, ProviderApiError | SqlError>
    readonly getProviderMetadata: (provider: string) => Effect.Effect<ProviderMetadata, ProviderApiError | SqlError>
  }
>() {}

/**
 * Implementation of Provider API Service
 * Uses Effect.gen for composable operations
 */
const make = Effect.gen(function* () {
  const drizzle = yield* Pg.PgDrizzle

  const getProviders = Effect.gen(function* () {
    // First get aggregated stats per provider
    const stats = yield* drizzle
      .select({
        providerName: providerFetches.providerName,
        totalFetches: sql<number>`COUNT(*)`,
        successfulFetches: sql<number>`SUM(CASE WHEN ${providerFetches.success} THEN 1 ELSE 0 END)`,
        failedFetches: sql<number>`SUM(CASE WHEN NOT ${providerFetches.success} THEN 1 ELSE 0 END)`,
      })
      .from(providerFetches)
      .groupBy(providerFetches.providerName)

    // Then get latest fetch info for each provider using DISTINCT ON
    // Use Effect SQL's sql template for raw queries
    const latestFetchesResult = yield* Effect.tryPromise({
      try: () =>
        drizzle.execute(sql`
          SELECT DISTINCT ON (provider_name)
            provider_name,
            fetched_at,
            success,
            chains_count,
            tokens_count,
            error_message
          FROM provider_fetches
          ORDER BY provider_name, fetched_at DESC
        `),
      catch: (error) => new ProviderApiError("Failed to fetch latest provider data", error),
    })

    // Combine stats with latest fetch info
    const statsMap = new Map(stats.map((s) => [s.providerName, s]))

    const providers: ProviderSummary[] = (latestFetchesResult as any[]).map((latest: any) => {
      const providerStats = statsMap.get(latest.provider_name) || {
        totalFetches: 0,
        successfulFetches: 0,
        failedFetches: 0,
      }

      return {
        name: latest.provider_name,
        status: latest.success ? "healthy" : "error",
        lastFetchedAt: latest.fetched_at,
        successRate:
          providerStats.totalFetches > 0
            ? ((providerStats.successfulFetches / providerStats.totalFetches) * 100).toFixed(1) + "%"
            : "0%",
        stats: {
          totalFetches: providerStats.totalFetches,
          successfulFetches: providerStats.successfulFetches,
          failedFetches: providerStats.failedFetches,
        },
        lastFetch: {
          success: latest.success,
          chainsCount: latest.chains_count,
          tokensCount: latest.tokens_count,
          error: latest.error_message,
        },
      }
    })

    return {
      providers,
      summary: {
        total: providers.length,
        healthy: providers.filter((p) => p.status === "healthy").length,
        error: providers.filter((p) => p.status === "error").length,
      },
    }
  }).pipe(
    Effect.mapError((error) => new ProviderApiError("Failed to fetch providers", error))
  )

  const getProviderMetadata = (provider: string) =>
    Effect.gen(function* () {
      // Get total token instances
      const totalInstancesResult = yield* drizzle
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(tokens)
        .where(eq(tokens.providerName, provider))

      const totalInstances = totalInstancesResult[0]?.count || 0

      // Get unique symbols count
      const uniqueSymbolsResult = yield* drizzle
        .select({
          count: sql<number>`COUNT(DISTINCT ${tokens.symbol})`,
        })
        .from(tokens)
        .where(eq(tokens.providerName, provider))

      const uniqueSymbols = uniqueSymbolsResult[0]?.count || 0

      // If no tokens found, this might not be a valid provider
      if (totalInstances === 0 && uniqueSymbols === 0) {
        return yield* Effect.fail(new ProviderApiError(`Provider not found: ${provider}`))
      }

      return {
        provider,
        totalTokens: totalInstances,
        uniqueSymbols,
      }
    }).pipe(
      Effect.mapError((error) =>
        error instanceof ProviderApiError
          ? error
          : new ProviderApiError("Failed to fetch provider metadata", error)
      )
    )

  return { getProviders, getProviderMetadata }
})

/**
 * Live implementation layer
 * Requires PgDrizzle to be provided
 */
export const ProviderApiServiceLive = Layer.effect(ProviderApiService, make)
