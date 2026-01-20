/**
 * Combined API service layer
 * Provides all API services with database dependencies
 */

import { Layer } from "effect"
import { DatabaseLive } from "../db/layer"
import { AllProvidersLive } from "../providers"
import { ProviderApiService, ProviderApiServiceLive } from "./providers"
import { ChainApiService, ChainApiServiceLive } from "./chains"
import { TokenApiService, TokenApiServiceLive } from "./tokens"
import { AdminApiService, AdminApiServiceLive } from "./admin"

/**
 * Export all services and types
 */
export { ProviderApiService, ChainApiService, TokenApiService, AdminApiService }
export type { ProvidersResponse, ProviderMetadata } from "./providers"
export type { ChainsResponse, ChainInfo } from "./chains"
export type { TokensResponse, TokenDetailResponse } from "./tokens"
export { TokenListQuery, TokenNotFoundError } from "./tokens"
export type { FetchResponse } from "./admin"

/**
 * Combined API layer with all services and database
 * Uses Layer.provideMerge to provide DatabaseLive to all service layers
 */
const ProvidersLive = ProviderApiServiceLive.pipe(Layer.provideMerge(DatabaseLive))
const ChainsLive = ChainApiServiceLive.pipe(Layer.provideMerge(DatabaseLive))
const TokensLive = TokenApiServiceLive.pipe(Layer.provideMerge(DatabaseLive))

/**
 * Admin service requires AllProvidersLive (which includes DatabaseLive)
 */
const AdminLive = AdminApiServiceLive.pipe(Layer.provideMerge(AllProvidersLive))

/**
 * All API services in one layer
 */
export const ApiServicesLive = Layer.mergeAll(ProvidersLive, ChainsLive, TokensLive)

/**
 * Admin API services (includes provider fetch capabilities)
 */
export const AdminApiServicesLive = Layer.mergeAll(
  ProvidersLive,
  ChainsLive,
  TokensLive,
  AdminLive
)
