import { Layer } from "effect"
import { NodeHttpClient } from "@effect/platform-node"
import { DatabaseLive } from "../db/layer"
import { ChainRegistryLive } from "../chains/registry"
import { RelayProvider, RelayProviderLive } from "./relay"
import { LifiProvider, LifiProviderLive } from "./lifi"
import { AcrossProvider, AcrossProviderLive } from "./across"
import { StargateProvider, StargateProviderLive } from "./stargate"
import { DebridgeProvider, DebridgeProviderLive } from "./debridge"
import { MayanProvider, MayanProviderLive } from "./mayan"
import { RhinoProvider, RhinoProviderLive } from "./rhino"
import { GasZipProvider, GasZipProviderLive } from "./gaszip"
import { AoriProvider, AoriProviderLive } from "./aori"
import { EcoProvider, EcoProviderLive } from "./eco"
import { MesonProvider, MesonProviderLive } from "./meson"
import { ButterProvider, ButterProviderLive } from "./butter"

/**
 * Export all provider services
 */
export {
  RelayProvider,
  LifiProvider,
  AcrossProvider,
  StargateProvider,
  DebridgeProvider,
  MayanProvider,
  RhinoProvider,
  GasZipProvider,
  AoriProvider,
  EcoProvider,
  MesonProvider,
  ButterProvider,
}

/**
 * Export all provider layers (without dependencies)
 */
export {
  RelayProviderLive,
  LifiProviderLive,
  AcrossProviderLive,
  StargateProviderLive,
  DebridgeProviderLive,
  MayanProviderLive,
  RhinoProviderLive,
  GasZipProviderLive,
  AoriProviderLive,
  EcoProviderLive,
  MesonProviderLive,
  ButterProviderLive,
}

/**
 * Combined layer with all dependencies provided
 * Following the pattern: Layer.provideMerge for nested dependencies
 */
// ChainRegistry needs HttpClient, so provide it explicitly
const ChainRegistryWithHttp = ChainRegistryLive.pipe(
  Layer.provide(NodeHttpClient.layerUndici)
)

const ProvidersBaseLive = Layer.mergeAll(
  DatabaseLive,
  NodeHttpClient.layerUndici,
  ChainRegistryWithHttp
)

const RelayLive = RelayProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const LifiLive = LifiProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const AcrossLive = AcrossProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const StargateLive = StargateProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const DebridgeLive = DebridgeProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const MayanLive = MayanProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const RhinoLive = RhinoProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const GasZipLive = GasZipProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const AoriLive = AoriProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const EcoLive = EcoProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const MesonLive = MesonProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))
const ButterLive = ButterProviderLive.pipe(Layer.provideMerge(ProvidersBaseLive))

/**
 * Combined layer with all providers and their dependencies
 */
export const AllProvidersLive = Layer.mergeAll(
  RelayLive,
  LifiLive,
  AcrossLive,
  StargateLive,
  DebridgeLive,
  MayanLive,
  RhinoLive,
  GasZipLive,
  AoriLive,
  EcoLive,
  MesonLive,
  ButterLive
)
