/**
 * TanStack Query hooks for API calls
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  tokensApi,
  providersApi,
  chainsApi,
  adminApi,
  type TokensQueryParams,
  type ProviderTokensQueryParams,
  type ChainTokensQueryParams,
} from "./api-client"

/**
 * Query keys for cache management
 */
export const queryKeys = {
  tokens: {
    all: ["tokens"] as const,
    list: (params: TokensQueryParams) => ["tokens", "list", params] as const,
    detail: (symbol: string) => ["tokens", "detail", symbol] as const,
  },
  providers: {
    all: ["providers"] as const,
    list: () => ["providers", "list"] as const,
    tokens: (params: ProviderTokensQueryParams) =>
      ["providers", "tokens", params] as const,
  },
  chains: {
    all: ["chains"] as const,
    list: () => ["chains", "list"] as const,
    tokens: (params: ChainTokensQueryParams) =>
      ["chains", "tokens", params] as const,
  },
}

/**
 * Tokens hooks
 */
export function useTokens(params: TokensQueryParams) {
  return useQuery({
    queryKey: queryKeys.tokens.list(params),
    queryFn: () => tokensApi.list(params),
  })
}

export function useTokenDetail(symbol: string) {
  return useQuery({
    queryKey: queryKeys.tokens.detail(symbol),
    queryFn: () => tokensApi.getBySymbol(symbol),
  })
}

/**
 * Providers hooks
 */
export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers.list(),
    queryFn: () => providersApi.list(),
  })
}

export function useProviderTokens(params: ProviderTokensQueryParams) {
  return useQuery({
    queryKey: queryKeys.providers.tokens(params),
    queryFn: () => providersApi.getTokens(params),
  })
}

/**
 * Chains hooks
 */
export function useChains() {
  return useQuery({
    queryKey: queryKeys.chains.list(),
    queryFn: () => chainsApi.list(),
  })
}

export function useChainTokens(params: ChainTokensQueryParams) {
  return useQuery({
    queryKey: queryKeys.chains.tokens(params),
    queryFn: () => chainsApi.getTokens(params),
  })
}

/**
 * Admin hooks
 */
export function useTriggerFetch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (adminSecret: string) => adminApi.triggerFetch(adminSecret),
    onSuccess: () => {
      // Invalidate all queries to refetch fresh data after provider fetch
      queryClient.invalidateQueries({ queryKey: queryKeys.providers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.chains.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all })
    },
  })
}
