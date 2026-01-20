/**
 * Chain Enrichment Service
 * Enriches chain data with metadata from Chainlist registry
 */

import { Effect } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import * as db from "../db/schema"
import { ChainRegistry } from "./registry"
import { sql } from "drizzle-orm"

/**
 * Enrich chains in the database with metadata from registry
 * Updates existing chains with additional metadata
 */
export const enrichChains = Effect.gen(function* () {
  const drizzle = yield* Pg.PgDrizzle
  const registry = yield* ChainRegistry

  console.log("[ChainEnrichment] Starting chain enrichment process...")

  // Fetch all chain metadata from registry
  const chainMetadata = yield* registry.fetchAll

  // Get existing chain IDs to filter what we need to update
  const existingChains = yield* drizzle
    .select({ chainId: db.chains.chainId })
    .from(db.chains)

  const existingChainIds = new Set(existingChains.map((c) => Number(c.chainId)))

  console.log(
    `[ChainEnrichment] Found ${existingChainIds.size} chains in database, ${chainMetadata.length} in registry`
  )

  // Filter to only chains we actually have in our database
  const chainsToUpdate = chainMetadata.filter((metadata) =>
    existingChainIds.has(metadata.chainId)
  )

  if (chainsToUpdate.length === 0) {
    console.log("[ChainEnrichment] No chains to enrich")
    return { enrichedCount: 0, totalChains: existingChainIds.size }
  }

  console.log(`[ChainEnrichment] Will update ${chainsToUpdate.length} chains`)

  // Batch all updates using Effect.all for parallel execution
  // Note: Neon's Postgres Proxy driver doesn't support transactions, so we use parallel updates
  const updates = chainsToUpdate.map((metadata) =>
    drizzle
      .update(db.chains)
      .set({
        name: metadata.name,
        shortName: metadata.shortName,
        chainType: metadata.chainType,
        icon: metadata.icon,
        infoUrl: metadata.infoUrl,
        explorers: metadata.explorers as any,
        rpc: metadata.rpc as any,
        faucets: metadata.faucets as any,
        ens: metadata.ens as any,
        features: metadata.features as any,
        nativeCurrencyName: metadata.nativeCurrency.name,
        nativeCurrencySymbol: metadata.nativeCurrency.symbol,
        nativeCurrencyDecimals: metadata.nativeCurrency.decimals,
        updatedAt: sql`NOW()`,
      })
      .where(sql`${db.chains.chainId} = ${metadata.chainId}`)
  )

  // Execute all updates in parallel with concurrency limit
  yield* Effect.all(updates, { concurrency: 10 })

  console.log(`[ChainEnrichment] Successfully enriched ${chainsToUpdate.length} chains`)

  return { enrichedCount: chainsToUpdate.length, totalChains: existingChainIds.size }
})

/**
 * Enrich a single chain by ID
 */
export const enrichChainById = (chainId: number) =>
  Effect.gen(function* () {
    const drizzle = yield* Pg.PgDrizzle
    const registry = yield* ChainRegistry

    const metadata = yield* registry.fetchByChainId(chainId)

    if (!metadata) {
      console.log(`[ChainEnrichment] No metadata found for chain ${chainId}`)
      return null
    }

    yield* drizzle
      .update(db.chains)
      .set({
        name: metadata.name,
        shortName: metadata.shortName,
        chainType: metadata.chainType,
        icon: metadata.icon,
        infoUrl: metadata.infoUrl,
        explorers: metadata.explorers as any,
        rpc: metadata.rpc as any,
        faucets: metadata.faucets as any,
        ens: metadata.ens as any,
        features: metadata.features as any,
        updatedAt: sql`NOW()`,
      })
      .where(sql`${db.chains.chainId} = ${chainId}`)

    console.log(`[ChainEnrichment] Successfully enriched chain ${chainId}`)

    return metadata
  })
