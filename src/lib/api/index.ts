/**
 * Combined API service layer
 * Provides all API services with database dependencies
 */

import { Layer } from "effect"
import { DatabaseLive } from "../db/layer"
import { AllProvidersLive } from "../providers"
import { ProviderApiService } from "./providers"
import { ChainApiService } from "./chains"
import { TokenApiService } from "./tokens"
import { AdminApiService } from "./admin"

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
 * Now using Effect.Service pattern with .Default auto-generated layers
 */
const ProvidersLive = ProviderApiService.Default.pipe(Layer.provideMerge(DatabaseLive))
const ChainsLive = ChainApiService.Default.pipe(Layer.provideMerge(DatabaseLive))
const TokensLive = TokenApiService.Default.pipe(Layer.provideMerge(DatabaseLive))

/**
 * Admin service requires AllProvidersLive (which includes DatabaseLive)
 */
const AdminLive = AdminApiService.Default.pipe(Layer.provideMerge(AllProvidersLive))

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
