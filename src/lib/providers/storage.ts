/**
 * Shared database storage utilities for providers
 * Eliminates duplication of batching logic and database operations
 */

import { Effect } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import * as db from "../db/schema"
import { Chain, Token, DatabaseError } from "./types"
import { sql } from "drizzle-orm"
import { getCanonicalMetadata } from "../chains/canonical-metadata"

const BATCH_SIZE = 500

/**
 * Store provider fetch results in database
 * Handles: fetch record, chains, chain-provider links, and batched token inserts
 */
export const storeProviderData = (
  providerName: string,
  chains: Chain[],
  tokens: Token[]
) =>
  Effect.gen(function* () {
    const drizzle = yield* Pg.PgDrizzle

    // Deduplicate tokens by (chainId, address) before recording count
    // This ensures the recorded count matches what will actually be inserted
    const uniqueTokens = Array.from(
      new Map(
        tokens.map((token) => [`${token.chainId}-${token.address}`, token])
      ).values()
    )

    const duplicateCount = tokens.length - uniqueTokens.length
    console.log(
      `[${providerName}] Deduplication check: ${tokens.length} raw tokens → ${uniqueTokens.length} unique tokens (${duplicateCount} duplicates)`
    )
    if (duplicateCount > 0) {
      console.log(
        `[${providerName}] ⚠️  Found duplicates! Removed ${duplicateCount} duplicate token entries`
      )
    }

    // Insert fetch record with accurate post-deduplication count
    const [fetchRecord] = yield* drizzle
      .insert(db.providerFetches)
      .values({
        providerName,
        success: true,
        chainsCount: chains.length,
        tokensCount: uniqueTokens.length, // Use deduplicated count
      })
      .returning({ id: db.providerFetches.id })

    const fetchId = fetchRecord.id

    // Upsert chains with canonical metadata when available
    // Provider data is stored first, then enriched with chainlist.network metadata
    // via the enrichChains() function after all providers complete
    if (chains.length > 0) {
      yield* drizzle
        .insert(db.chains)
        .values(
          chains.map((chain) => {
            // Check canonical metadata (manually curated for non-EVM chains like Solana)
            const canonical = getCanonicalMetadata(chain.id)
            if (canonical) {
              return {
                chainId: canonical.chainId,
                name: canonical.name,
                shortName: canonical.shortName,
                vmType: canonical.vmType,
                nativeCurrencyName: canonical.nativeCurrency.name,
                nativeCurrencySymbol: canonical.nativeCurrency.symbol,
                nativeCurrencyDecimals: canonical.nativeCurrency.decimals,
                chainType: canonical.chainType,
                icon: canonical.icon,
                infoUrl: canonical.infoUrl,
                explorers: canonical.explorers,
                rpc: canonical.rpc,
              }
            }

            // Use provider data (will be enriched later via ChainRegistry)
            return {
              chainId: chain.id,
              name: chain.name,
              vmType: chain.vmType,
              nativeCurrencyName: chain.nativeCurrency.name,
              nativeCurrencySymbol: chain.nativeCurrency.symbol,
              nativeCurrencyDecimals: chain.nativeCurrency.decimals,
            }
          })
        )
        .onConflictDoNothing()
    }

    // Link chains to provider
    // Deduplicate chains first to avoid ON CONFLICT issues with duplicate chain IDs in same batch
    if (chains.length > 0) {
      const uniqueChains = Array.from(
        new Map(chains.map((chain) => [chain.id, chain])).values()
      )

      yield* drizzle
        .insert(db.chainProviderSupport)
        .values(
          uniqueChains.map((chain) => ({
            chainId: chain.id,
            providerName,
            fetchId,
          }))
        )
        .onConflictDoNothing()
    }

    // Insert tokens in batches to avoid stack overflow
    // Use deduplicated tokens to avoid redundant processing
    if (uniqueTokens.length > 0) {
      yield* batchInsertTokens(providerName, uniqueTokens, fetchId)
    }

    console.log(`[${providerName}] Successfully stored data in database`)
  })

/**
 * Insert tokens in batches to prevent stack overflow on large datasets
 * Note: Expects pre-deduplicated tokens (deduplication happens in storeProviderData)
 */
const batchInsertTokens = (
  providerName: string,
  tokens: Token[],
  fetchId: number
) =>
  Effect.gen(function* () {
    const drizzle = yield* Pg.PgDrizzle

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE)

      yield* drizzle
        .insert(db.tokens)
        .values(
          batch.map((token) => ({
            providerName,
            chainId: token.chainId,
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoUri: token.logoURI,
            tags: sql.raw(`'${JSON.stringify(token.tags || [])}'::jsonb`),
            fetchId,
            rawData: sql.raw(`'${JSON.stringify(token).replace(/'/g, "''")}'::jsonb`),
          }))
        )
        .onConflictDoUpdate({
          target: [db.tokens.providerName, db.tokens.chainId, db.tokens.address],
          set: {
            symbol: sql`excluded.symbol`,
            name: sql`excluded.name`,
            decimals: sql`excluded.decimals`,
            logoUri: sql`excluded.logo_uri`,
            tags: sql`excluded.tags`,
            fetchId: sql`excluded.fetch_id`,
            rawData: sql`excluded.raw_data`,
          },
        })
    }
  })

/**
 * Record a failed provider fetch in the database
 */
export const recordProviderError = (providerName: string, error: unknown) =>
  Effect.gen(function* () {
    const drizzle = yield* Pg.PgDrizzle

    console.error(`[${providerName}] Database error:`, error)

    yield* drizzle.insert(db.providerFetches).values({
      providerName,
      success: false,
      errorMessage: String(error),
    })

    return yield* new DatabaseError({
      provider: providerName,
      message: "Failed to store data in database",
      cause: error,
    })
  })

/**
 * Wrap database storage operations with error handling
 * Automatically records failures in provider_fetches table
 */
export const withDatabaseErrorHandling = (
  providerName: string,
  effect: Effect.Effect<void, any, Pg.PgDrizzle>
) =>
  effect.pipe(Effect.catchAll((error) => recordProviderError(providerName, error)))
