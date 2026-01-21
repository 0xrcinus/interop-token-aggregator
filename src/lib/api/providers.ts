/**
 * Effect-based service layer for provider API operations
 * This demonstrates Effect patterns for database queries and error handling
 */

import { Effect } from "effect"
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
 * Uses Effect.Service pattern for dependency injection
 */
export class ProviderApiService extends Effect.Service<ProviderApiService>()("ProviderApiService", {
  effect: Effect.gen(function* () {
    const drizzle = yield* Pg.PgDrizzle

    const getProviders = Effect.gen(function* () {
    // Get all provider fetches and group them to find latest per provider
    const allFetches = yield* drizzle
      .select()
      .from(providerFetches)
      .orderBy(providerFetches.fetchedAt)

    // Group by provider and get latest + stats
    const providerMap = new Map<string, {
      latest: typeof allFetches[0],
      total: number,
      successful: number,
      failed: number
    }>()

    for (const fetch of allFetches) {
      const existing = providerMap.get(fetch.providerName)
      if (!existing) {
        providerMap.set(fetch.providerName, {
          latest: fetch,
          total: 1,
          successful: fetch.success ? 1 : 0,
          failed: fetch.success ? 0 : 1
        })
      } else {
        // Update to latest (ordered by fetchedAt)
        existing.latest = fetch
        existing.total++
        if (fetch.success) {
          existing.successful++
        } else {
          existing.failed++
        }
      }
    }

    const providers: ProviderSummary[] = Array.from(providerMap.entries())
      .map(([name, data]) => ({
        name,
        status: (data.latest.success ? "healthy" : "error") as "healthy" | "error",
        lastFetchedAt: data.latest.fetchedAt,
        successRate:
          data.total > 0
            ? ((data.successful / data.total) * 100).toFixed(1) + "%"
            : "0%",
        stats: {
          totalFetches: data.total,
          successfulFetches: data.successful,
          failedFetches: data.failed,
        },
        lastFetch: {
          success: data.latest.success,
          chainsCount: data.latest.chainsCount,
          tokensCount: data.latest.tokensCount,
          error: data.latest.errorMessage,
        },
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically by name

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
}) {}
