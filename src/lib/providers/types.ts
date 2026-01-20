import { Data } from "effect"

/**
 * Normalized chain data structure
 */
export interface Chain {
  id: number
  name: string
  explorerUrl?: string
  vmType?: string // "evm", "svm" (Solana), etc. - provided by some providers
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

/**
 * Normalized token data structure
 */
export interface Token {
  address: string
  symbol: string
  name: string
  decimals?: number // Optional - some providers don't provide this data
  chainId: number
  logoURI?: string
  tags?: string[]
}

/**
 * Standard response from provider fetch operations
 */
export interface ProviderResponse {
  chains: Chain[]
  tokens: Token[]
}

/**
 * Tagged error for provider fetch failures
 */
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly provider: string
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Tagged error for database operations
 */
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly provider: string
  readonly message: string
  readonly cause?: unknown
}> {}
