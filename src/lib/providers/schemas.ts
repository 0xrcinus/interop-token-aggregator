import { Schema } from "effect"

/**
 * Schema for native currency information
 */
export const NativeCurrencySchema = Schema.Struct({
  name: Schema.String,
  symbol: Schema.String,
  decimals: Schema.Number,
})

/**
 * Schema for chain data
 */
export const ChainSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  explorerUrl: Schema.optional(Schema.String),
  nativeCurrency: NativeCurrencySchema,
})

/**
 * Schema for token data
 */
export const TokenSchema = Schema.Struct({
  address: Schema.String,
  symbol: Schema.String,
  name: Schema.String,
  decimals: Schema.Number,
  chainId: Schema.Number,
  logoURI: Schema.optional(Schema.String),
})

/**
 * Schema for provider response
 */
export const ProviderResponseSchema = Schema.Struct({
  chains: Schema.Array(ChainSchema),
  tokens: Schema.Array(TokenSchema),
})
