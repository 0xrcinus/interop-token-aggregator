/**
 * Effect-based service layer for chain API operations
 */

import { Effect } from "effect"
import * as Pg from "@effect/sql-drizzle/Pg"
import { SqlError } from "@effect/sql/SqlError"
import { chains, chainProviderSupport, tokens } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export interface ChainInfo {
  readonly chainId: number
  readonly name: string
  readonly shortName?: string
  readonly chainType?: string
  readonly icon?: string
  readonly infoUrl?: string
  readonly explorers?: ReadonlyArray<{
    readonly name: string
    readonly url: string
    readonly standard: string
  }>
  readonly nativeCurrency: {
    readonly name: string
    readonly symbol: string
    readonly decimals: number
  }
  readonly providerCount: number
  readonly tokenCount: number
  readonly providers: ReadonlyArray<string>
}

export interface ChainsResponse {
  readonly chains: ReadonlyArray<ChainInfo>
  readonly summary: {
    readonly totalChains: number
    readonly multiProviderChains: number
    readonly totalTokens: number
  }
}

export class ChainApiError extends Error {
  readonly _tag = "ChainApiError"
  constructor(readonly message: string, readonly cause?: unknown) {
    super(message)
  }
}

export class ChainApiService extends Effect.Service<ChainApiService>()("ChainApiService", {
  effect: Effect.gen(function* () {
    const drizzle = yield* Pg.PgDrizzle

    const getChains = Effect.gen(function* () {
    const chainList = yield* drizzle
      .select({
        chainId: chains.chainId,
        name: chains.name,
        shortName: chains.shortName,
        chainType: chains.chainType,
        icon: chains.icon,
        infoUrl: chains.infoUrl,
        explorers: chains.explorers,
        nativeCurrencyName: chains.nativeCurrencyName,
        nativeCurrencySymbol: chains.nativeCurrencySymbol,
        nativeCurrencyDecimals: chains.nativeCurrencyDecimals,
        providerCount: sql<number>`COUNT(DISTINCT ${chainProviderSupport.providerName})`,
        tokenCount: sql<number>`COUNT(DISTINCT ${tokens.id})`,
        providers: sql<string[]>`ARRAY_AGG(DISTINCT ${chainProviderSupport.providerName})`,
      })
      .from(chains)
      .leftJoin(chainProviderSupport, sql`${chains.chainId} = ${chainProviderSupport.chainId}`)
      .leftJoin(tokens, sql`${chains.chainId} = ${tokens.chainId}`)
      .groupBy(
        chains.chainId,
        chains.name,
        chains.shortName,
        chains.chainType,
        chains.icon,
        chains.infoUrl,
        chains.explorers,
        chains.nativeCurrencyName,
        chains.nativeCurrencySymbol,
        chains.nativeCurrencyDecimals
      )
      .orderBy(sql`COUNT(DISTINCT ${chainProviderSupport.providerName}) DESC`, chains.chainId)

    const chainInfos: ChainInfo[] = chainList.map((chain) => ({
      chainId: chain.chainId,
      name: chain.name,
      shortName: chain.shortName ?? undefined,
      chainType: chain.chainType ?? undefined,
      icon: chain.icon ?? undefined,
      infoUrl: chain.infoUrl ?? undefined,
      explorers: chain.explorers as any ?? undefined,
      nativeCurrency: {
        name: chain.nativeCurrencyName,
        symbol: chain.nativeCurrencySymbol,
        decimals: chain.nativeCurrencyDecimals,
      },
      providerCount: chain.providerCount,
      tokenCount: chain.tokenCount,
      providers: chain.providers,
    }))

    return {
      chains: chainInfos,
      summary: {
        totalChains: chainInfos.length,
        multiProviderChains: chainInfos.filter((c) => c.providerCount > 1).length,
        totalTokens: chainInfos.reduce((sum, c) => sum + Number(c.tokenCount), 0),
      },
    }
  }).pipe(
    Effect.mapError((error) => new ChainApiError("Failed to fetch chains", error))
  )

  const getChainById = (chainId: number) =>
    Effect.gen(function* () {
      const chainList = yield* drizzle
        .select({
          chainId: chains.chainId,
          name: chains.name,
          shortName: chains.shortName,
          chainType: chains.chainType,
          icon: chains.icon,
          infoUrl: chains.infoUrl,
          explorers: chains.explorers,
          nativeCurrencyName: chains.nativeCurrencyName,
          nativeCurrencySymbol: chains.nativeCurrencySymbol,
          nativeCurrencyDecimals: chains.nativeCurrencyDecimals,
          providerCount: sql<number>`COUNT(DISTINCT ${chainProviderSupport.providerName})`,
          tokenCount: sql<number>`COUNT(DISTINCT ${tokens.id})`,
          providers: sql<string[]>`ARRAY_AGG(DISTINCT ${chainProviderSupport.providerName})`,
        })
        .from(chains)
        .leftJoin(chainProviderSupport, sql`${chains.chainId} = ${chainProviderSupport.chainId}`)
        .leftJoin(tokens, sql`${chains.chainId} = ${tokens.chainId}`)
        .where(sql`${chains.chainId} = ${chainId}`)
        .groupBy(
          chains.chainId,
          chains.name,
          chains.shortName,
          chains.chainType,
          chains.icon,
          chains.infoUrl,
          chains.explorers,
          chains.nativeCurrencyName,
          chains.nativeCurrencySymbol,
          chains.nativeCurrencyDecimals
        )

      if (chainList.length === 0) {
        return yield* Effect.fail(new ChainApiError(`Chain not found: ${chainId}`))
      }

      const chain = chainList[0]

      return {
        chainId: chain.chainId,
        name: chain.name,
        shortName: chain.shortName ?? undefined,
        chainType: chain.chainType ?? undefined,
        icon: chain.icon ?? undefined,
        infoUrl: chain.infoUrl ?? undefined,
        explorers: chain.explorers as any ?? undefined,
        nativeCurrency: {
          name: chain.nativeCurrencyName,
          symbol: chain.nativeCurrencySymbol,
          decimals: chain.nativeCurrencyDecimals,
        },
        providerCount: chain.providerCount,
        tokenCount: chain.tokenCount,
        providers: chain.providers,
      }
    }).pipe(
      Effect.mapError((error) =>
        error instanceof ChainApiError
          ? error
          : new ChainApiError("Failed to fetch chain by ID", error)
      )
    )

    return { getChains, getChainById }
  })
}) {}
