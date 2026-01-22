/**
 * TanStack Query API client with typed query functions
 */

import type {
  TokensResponse,
  TokenDetailResponse,
} from "@/lib/api/tokens"
import type { ProvidersResponse } from "@/lib/api/providers"
import type { ChainsResponse } from "@/lib/api/chains"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

/**
 * Generic fetch helper with error handling
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(error.error || "Failed to fetch data")
  }

  return response.json()
}

/**
 * Tokens API
 */
export interface TokensQueryParams {
  limit?: number
  offset?: number
  symbol?: string
  tag?: string
  chainId?: number
}

export const tokensApi = {
  list: async (params: TokensQueryParams): Promise<TokensResponse> => {
    const searchParams = new URLSearchParams()
    if (params.limit !== undefined)
      searchParams.set("limit", params.limit.toString())
    if (params.offset !== undefined)
      searchParams.set("offset", params.offset.toString())
    if (params.symbol) searchParams.set("symbol", params.symbol)
    if (params.tag) searchParams.set("tag", params.tag)
    if (params.chainId !== undefined)
      searchParams.set("chainId", params.chainId.toString())

    return fetchJson<TokensResponse>(
      `${BASE_URL}/api/tokens?${searchParams.toString()}`
    )
  },

  getBySymbol: async (symbol: string): Promise<TokenDetailResponse> => {
    return fetchJson<TokenDetailResponse>(
      `${BASE_URL}/api/tokens/${encodeURIComponent(symbol)}`
    )
  },
}

/**
 * Providers API
 */
export interface ProviderTokensQueryParams {
  provider: string
  limit?: number
  offset?: number
  search?: string
}

export interface ProviderTokensResponse {
  readonly provider: string
  readonly totalTokens: number
  readonly uniqueSymbols: number
  readonly tokens: ReadonlyArray<{
    readonly symbol: string
    readonly name: string
    readonly chainCount: number
    readonly tags: ReadonlyArray<string>
    readonly chains: ReadonlyArray<{
      readonly chainId: number
      readonly chainName: string
      readonly address: string
      readonly decimals: number | null
      readonly name: string
    }>
  }>
  readonly pagination: {
    readonly limit: number
    readonly offset: number
    readonly total: number
    readonly hasMore: boolean
  }
}

export const providersApi = {
  list: async (): Promise<ProvidersResponse> => {
    return fetchJson<ProvidersResponse>(`${BASE_URL}/api/providers`)
  },

  getTokens: async (
    params: ProviderTokensQueryParams
  ): Promise<ProviderTokensResponse> => {
    const searchParams = new URLSearchParams()
    if (params.limit !== undefined)
      searchParams.set("limit", params.limit.toString())
    if (params.offset !== undefined)
      searchParams.set("offset", params.offset.toString())
    if (params.search) searchParams.set("search", params.search)

    return fetchJson<ProviderTokensResponse>(
      `${BASE_URL}/api/providers/${encodeURIComponent(params.provider)}?${searchParams.toString()}`
    )
  },
}

/**
 * Chains API
 */
export interface ChainTokensQueryParams {
  chainId: number
  limit?: number
  offset?: number
  search?: string
}

export interface ChainTokensResponse {
  readonly tokens: ReadonlyArray<{
    readonly symbol: string
    readonly name: string
    readonly providerCount: number
    readonly tags: ReadonlyArray<string>
    readonly canonicalAddress: string
    readonly instances: ReadonlyArray<{
      readonly address: string
      readonly name: string
      readonly decimals: number | null
      readonly providerName: string
    }>
  }>
  readonly pagination: {
    readonly limit: number
    readonly offset: number
    readonly total: number
    readonly hasMore: boolean
  }
}

export interface ChainMetadata {
  readonly chainId: number
  readonly name: string
  readonly shortName?: string
  readonly icon?: string
  readonly explorers?: ReadonlyArray<{
    readonly name: string
    readonly url: string
    readonly standard: string
  }>
}

export interface ChainMetadataResponse {
  readonly chains: ReadonlyArray<ChainMetadata>
}

export const chainsApi = {
  list: async (): Promise<ChainsResponse> => {
    return fetchJson<ChainsResponse>(`${BASE_URL}/api/chains`)
  },

  metadata: async (): Promise<ChainMetadataResponse> => {
    return fetchJson<ChainMetadataResponse>(`${BASE_URL}/api/chains/metadata`)
  },

  getTokens: async (
    params: ChainTokensQueryParams
  ): Promise<ChainTokensResponse> => {
    const searchParams = new URLSearchParams()
    if (params.limit !== undefined)
      searchParams.set("limit", params.limit.toString())
    if (params.offset !== undefined)
      searchParams.set("offset", params.offset.toString())
    if (params.search) searchParams.set("search", params.search)

    return fetchJson<ChainTokensResponse>(
      `${BASE_URL}/api/chains/${params.chainId}/tokens?${searchParams.toString()}`
    )
  },
}

/**
 * Admin API
 */
export const adminApi = {
  triggerFetch: async (adminSecret: string): Promise<{ message: string }> => {
    const response = await fetch(`${BASE_URL}/api/admin/fetch`, {
      method: "POST",
      headers: {
        "x-admin-secret": adminSecret,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }))
      throw new Error(error.error || "Failed to trigger fetch")
    }

    return response.json()
  },
}
