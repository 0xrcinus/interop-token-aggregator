import { Effect } from "effect"
import { config } from "dotenv"
import {
  AllProvidersLive,
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
} from "../lib/providers"

// Load environment variables
config({ path: ".env.local" })

/**
 * Main program to fetch data from all providers
 */
const program = Effect.gen(function* () {
  console.log("=".repeat(60))
  console.log("Starting provider fetch job...")
  console.log("=".repeat(60))
  console.log("")

  // Get all provider services
  const relay = yield* RelayProvider
  const lifi = yield* LifiProvider
  const across = yield* AcrossProvider
  const stargate = yield* StargateProvider
  const debridge = yield* DebridgeProvider
  const mayan = yield* MayanProvider
  const rhino = yield* RhinoProvider
  const gaszip = yield* GasZipProvider
  const aori = yield* AoriProvider
  const eco = yield* EcoProvider
  const meson = yield* MesonProvider
  const butter = yield* ButterProvider

  const startTime = Date.now()

  const providerNames = [
    "Relay",
    "LiFi",
    "Across",
    "Stargate",
    "DeBridge",
    "Mayan",
    "Rhino.fi",
    "GasZip",
    "Aori",
    "Eco",
    "Meson",
    "Butter",
  ]

  // Fetch all providers in parallel
  const results = yield* Effect.all(
    [
      relay.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Relay complete")))
      ),
      lifi.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ LiFi complete")))
      ),
      across.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Across complete")))
      ),
      stargate.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Stargate complete")))
      ),
      debridge.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ DeBridge complete")))
      ),
      mayan.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Mayan complete")))
      ),
      rhino.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Rhino.fi complete")))
      ),
      gaszip.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ GasZip complete")))
      ),
      aori.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Aori complete")))
      ),
      eco.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Eco complete")))
      ),
      meson.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Meson complete")))
      ),
      butter.fetch.pipe(
        Effect.tap(() => Effect.sync(() => console.log("✓ Butter complete")))
      ),
    ],
    { concurrency: "unbounded", mode: "either" }
  )

  const duration = Date.now() - startTime

  console.log("")
  console.log("=".repeat(60))
  console.log("Fetch job completed")
  console.log(`Duration: ${duration}ms`)
  console.log("=".repeat(60))
  console.log("")

  // Count successes and failures
  const successes = results.filter((r) => r._tag === "Right").length
  const failures = results.filter((r) => r._tag === "Left").length

  console.log(`Successes: ${successes}`)
  console.log(`Failures: ${failures}`)

  if (failures > 0) {
    console.log("")
    console.log("Failed providers:")
    results.forEach((result, i) => {
      if (result._tag === "Left") {
        console.log(`  - ${providerNames[i]}: ${result.left}`)
      }
    })
  }

  if (successes > 0) {
    console.log("")
    console.log("Summary:")
    results.forEach((result, i) => {
      if (result._tag === "Right") {
        const data = result.right
        console.log(
          `  ${providerNames[i]}: ${data.chains.length} chains, ${data.tokens.length} tokens`
        )
      }
    })
  }

  return { successes, failures }
})

/**
 * Run the program with AllProvidersLive
 * AllProvidersLive already includes DatabaseLive and HttpClient
 */
Effect.runPromise(
  program.pipe(Effect.provide(AllProvidersLive), Effect.scoped)
)
  .then(({ successes, failures }) => {
    console.log("")
    console.log("Job finished successfully")
    process.exit(failures > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error("")
    console.error("Job failed with error:")
    console.error(error)
    process.exit(1)
  })
