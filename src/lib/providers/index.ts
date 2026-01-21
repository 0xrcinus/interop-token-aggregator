import { Layer } from "effect"
import { NodeHttpClient } from "@effect/platform-node"
import { DatabaseLive } from "../db/layer"
import { ChainRegistry } from "../chains/registry"
import { RelayProvider } from "./relay"
import { LifiProvider } from "./lifi"
import { AcrossProvider } from "./across"
import { StargateProvider } from "./stargate"
import { DebridgeProvider } from "./debridge"
import { MayanProvider } from "./mayan"
import { RhinoProvider } from "./rhino"
import { GasZipProvider } from "./gaszip"
import { AoriProvider } from "./aori"
import { EcoProvider } from "./eco"
import { MesonProvider } from "./meson"
import { ButterProvider } from "./butter"

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
 * Combined layer with all dependencies provided
 * Following the pattern: Layer.provideMerge for nested dependencies
 *
 * With Effect.Service pattern, services automatically generate a .Default layer
 * that we can use directly.
 */
// ChainRegistry needs HttpClient, so provide it explicitly
const ChainRegistryWithHttp = ChainRegistry.Default.pipe(
  Layer.provide(NodeHttpClient.layerUndici)
)

const ProvidersBaseLive = Layer.mergeAll(
  DatabaseLive,
  NodeHttpClient.layerUndici,
  ChainRegistryWithHttp
)

const RelayLive = RelayProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const LifiLive = LifiProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const AcrossLive = AcrossProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const StargateLive = StargateProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const DebridgeLive = DebridgeProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const MayanLive = MayanProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const RhinoLive = RhinoProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const GasZipLive = GasZipProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const AoriLive = AoriProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const EcoLive = EcoProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const MesonLive = MesonProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))
const ButterLive = ButterProvider.Default.pipe(Layer.provideMerge(ProvidersBaseLive))

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
