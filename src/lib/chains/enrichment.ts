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

  // Fetch all chain metadata
  const chainMetadata = yield* registry.fetchAll

  // Get all chain IDs currently in our database
  const existingChains = yield* drizzle
    .select({ chainId: db.chains.chainId })
    .from(db.chains)

  const existingChainIds = new Set(existingChains.map((c) => Number(c.chainId)))

  console.log(
    `[ChainEnrichment] Found ${existingChainIds.size} chains in database, ${chainMetadata.length} in registry`
  )

  // Update chains with enriched metadata
  let enrichedCount = 0
  for (const metadata of chainMetadata) {
    if (!existingChainIds.has(metadata.chainId)) {
      continue // Skip chains we don't have
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
      .where(sql`${db.chains.chainId} = ${metadata.chainId}`)

    enrichedCount++
  }

  console.log(`[ChainEnrichment] Successfully enriched ${enrichedCount} chains`)

  return { enrichedCount, totalChains: existingChainIds.size }
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
