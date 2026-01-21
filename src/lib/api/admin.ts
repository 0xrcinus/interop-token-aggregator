/**
 * Effect-based service layer for admin operations
 */

import { Effect, Data } from "effect"
import {
  AllProvidersLive,
  RelayProvider,
  LifiProvider,
  AcrossProvider,
  StargateProvider,
  DebridgeProvider,
  MayanProvider,
  RhinoProvider,
  GasZipProvider,
  AoriProvider,
  EcoProvider,
  MesonProvider,
  ButterProvider,
} from "../providers"
import { enrichChains } from "../chains/enrichment"
import { ChainRegistry } from "../chains/registry"
import * as Pg from "@effect/sql-drizzle/Pg"
import { HttpClient } from "@effect/platform"
import type { Scope } from "effect"

/**
 * Result of a provider fetch operation
 */
export interface FetchResult {
  readonly provider: string
  readonly success: boolean
  readonly chainsCount?: number
  readonly tokensCount?: number
  readonly error?: string
}

/**
 * Response from the fetch operation
 */
export interface FetchResponse {
  readonly results: ReadonlyArray<FetchResult>
  readonly summary: {
    readonly total: number
    readonly successful: number
    readonly failed: number
  }
  readonly chainEnrichment?: {
    readonly enrichedCount: number
    readonly totalChains: number
  }
  readonly durationMs: number
}

/**
 * Custom error types for admin operations
 */
export class AdminApiError extends Data.TaggedError("AdminApiError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Admin API Service
 */
export class AdminApiService extends Effect.Service<AdminApiService>()("AdminApiService", {
  effect: Effect.gen(function* () {
    // Get all 12 provider services
    const relay = yield* RelayProvider
  const lifi = yield* LifiProvider
  const across = yield* AcrossProvider
  const stargate = yield* StargateProvider
  const debridge = yield* DebridgeProvider
  const mayan = yield* MayanProvider
  const rhino = yield* RhinoProvider
  const gaszip = yield* GasZipProvider
  const aori = yield* AoriProvider
  const eco = yield* EcoProvider
  const meson = yield* MesonProvider
  const butter = yield* ButterProvider

  const triggerFetch = Effect.gen(function* () {
    const startTime = Date.now()

    // Fetch all 12 providers in parallel
    // Use mode: "either" to get both successes and failures
    const results = yield* Effect.all(
      [
        relay.fetch.pipe(Effect.map((data) => ({ provider: "relay", data }))),
        lifi.fetch.pipe(Effect.map((data) => ({ provider: "lifi", data }))),
        across.fetch.pipe(Effect.map((data) => ({ provider: "across", data }))),
        stargate.fetch.pipe(Effect.map((data) => ({ provider: "stargate", data }))),
        debridge.fetch.pipe(Effect.map((data) => ({ provider: "debridge", data }))),
        mayan.fetch.pipe(Effect.map((data) => ({ provider: "mayan", data }))),
        rhino.fetch.pipe(Effect.map((data) => ({ provider: "rhino", data }))),
        gaszip.fetch.pipe(Effect.map((data) => ({ provider: "gaszip", data }))),
        aori.fetch.pipe(Effect.map((data) => ({ provider: "aori", data }))),
        eco.fetch.pipe(Effect.map((data) => ({ provider: "eco", data }))),
        meson.fetch.pipe(Effect.map((data) => ({ provider: "meson", data }))),
        butter.fetch.pipe(Effect.map((data) => ({ provider: "butter", data }))),
      ],
      { concurrency: "unbounded", mode: "either" }
    )

    const durationMs = Date.now() - startTime

    // Transform results to FetchResult format
    const fetchResults: FetchResult[] = results.map((result, index) => {
      const providerName = ["relay", "lifi", "across", "stargate", "debridge", "mayan", "rhino", "gaszip", "aori", "eco", "meson", "butter"][index]

      if (result._tag === "Right") {
        return {
          provider: providerName,
          success: true,
          chainsCount: result.right.data.chains.length,
          tokensCount: result.right.data.tokens.length,
        }
      } else {
        return {
          provider: providerName,
          success: false,
          error: String(result.left),
        }
      }
    })

    const successful = fetchResults.filter((r) => r.success).length
    const failed = fetchResults.filter((r) => !r.success).length

    // Enrich chains with metadata from Chainlist
    // This runs after providers have populated the chains table
    const chainEnrichment = yield* enrichChains.pipe(
      Effect.catchAll((error) => {
        console.error("[AdminApi] Chain enrichment failed:", error)
        return Effect.succeed(null) // Don't fail the entire operation
      })
    )

    return {
      results: fetchResults,
      summary: {
        total: fetchResults.length,
        successful,
        failed,
      },
      chainEnrichment: chainEnrichment ?? undefined,
      durationMs,
    }
  }).pipe(
    Effect.mapError((error) => new AdminApiError({ message: "Failed to trigger fetch", cause: error }))
  )

    return { triggerFetch }
  })
}) {}
