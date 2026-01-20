/**
 * Factory utilities for creating provider services
 * Eliminates boilerplate around error handling and logging
 */

import { Effect } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import { ProviderResponse, ProviderError } from "./types"
import { storeProviderData, withDatabaseErrorHandling } from "./storage"
import { normalizeChainId } from "../aggregation/chain-mapping"

/**
 * Wrap any error type into ProviderError for type safety
 */
const mapToProviderError = (providerName: string, error: unknown): ProviderError => {
  if (error instanceof ProviderError) {
    return error
  }
  return new ProviderError({
    provider: providerName,
    message: "Fetch operation failed",
    cause: error,
  })
}

/**
 * Wrap a provider fetch operation with standard error handling and logging
 */
export const withProviderErrorHandling = <E, R>(
  providerName: string,
  effect: Effect.Effect<ProviderResponse, E, R>
): Effect.Effect<ProviderResponse, ProviderError, R> =>
  effect.pipe(
    Effect.catchAll((error) => {
      console.error(`[${providerName}] Fetch failed:`, error)
      return Effect.fail(mapToProviderError(providerName, error))
    })
  )

/**
 * Standard provider fetch pipeline:
 * 1. Log start
 * 2. Execute fetch logic (with error mapping to ProviderError)
 * 3. Normalize chain IDs (consolidate non-EVM chains like Solana)
 * 4. Store data in database with error handling
 * 5. Log completion
 * 6. Return response
 *
 * All errors (fetch errors, database errors, SQL errors) are mapped to ProviderError
 */
export const createProviderFetch = <E, R>(
  providerName: string,
  fetchLogic: Effect.Effect<ProviderResponse, E, R>
): Effect.Effect<ProviderResponse, ProviderError, R | Pg.PgDrizzle> =>
  Effect.gen(function* () {
    console.log(`[${providerName}] Starting fetch...`)

    // Execute provider-specific fetch logic with error mapping
    const response = yield* withProviderErrorHandling(providerName, fetchLogic)

    console.log(
      `[${providerName}] Found ${response.chains.length} chains and ${response.tokens.length} tokens`
    )

    // Normalize chain IDs (consolidates non-EVM chains like Solana)
    const normalizedChains = response.chains.map((chain) => {
      const normalizedId = normalizeChainId(chain.id)
      if (normalizedId !== chain.id) {
        console.log(`[${providerName}] Normalized chain ${chain.id} -> ${normalizedId} (${chain.name})`)
      }
      return {
        ...chain,
        id: normalizedId,
      }
    })

    const normalizedTokens = response.tokens.map((token) => {
      const normalizedId = normalizeChainId(token.chainId)
      return {
        ...token,
        chainId: normalizedId,
      }
    })

    const normalizedResponse: ProviderResponse = {
      chains: normalizedChains,
      tokens: normalizedTokens,
    }

    // Store in database with error handling
    // This will catch SqlError, DatabaseError, or any other errors and map them
    yield* withDatabaseErrorHandling(
      providerName,
      storeProviderData(providerName, normalizedResponse.chains, normalizedResponse.tokens)
    )

    return normalizedResponse
  }).pipe(
    // Catch any remaining errors (e.g., SqlError, DatabaseError) and map to ProviderError
    Effect.mapError((error) => mapToProviderError(providerName, error))
  )
